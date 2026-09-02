import type {
  InternshipRecord,
  NotificationChannel,
  NotificationKind,
  NotificationRecord,
} from '../types';
import { InternshipRepository, TrackingRepository, UserRepository, type NotificationPreferences } from '../db/repositories';
import { RecommendationService } from './recommendation.service';
import { getEnv } from '../config/env';
import { createLogger } from '../utils/logger';
import { isoDaysAgo, isoNow } from '../utils/date';
import { formatCompensation } from '../utils/money';
import { truncate } from '../utils/text';

const log = createLogger('internships.notifications');

type PendingNotification = Omit<NotificationRecord, 'id' | 'createdAt' | 'readAt'>;

/**
 * Outbound delivery seam. The engine owns persistence — the in-app bell always
 * works — but it does not own transport. Bind email, push or SMS here:
 *
 *   setNotificationTransport({
 *     channel: 'email',
 *     async deliver(batch) { await resend.batch.send(batch.map(toEmail)); },
 *   });
 *
 * Failures are logged and swallowed: a dead mail provider must never roll back
 * notifications the student can still read in the app.
 */
export interface NotificationTransport {
  readonly channel: NotificationChannel;
  deliver(batch: readonly PendingNotification[]): Promise<void>;
}

const transports = new Map<NotificationChannel, NotificationTransport>();

export function setNotificationTransport(transport: NotificationTransport): void {
  transports.set(transport.channel, transport);
}

export function clearNotificationTransports(): void {
  transports.clear();
}

export interface DispatchSummary {
  kind: NotificationKind;
  usersConsidered: number;
  notificationsCreated: number;
}

export class NotificationService {
  constructor(
    private readonly users = new UserRepository(),
    private readonly internships = new InternshipRepository(),
    private readonly tracking = new TrackingRepository(),
    private readonly recommendations = new RecommendationService(),
  ) {}

  /** Daily and weekly digests of the best new matches for each opted-in user. */
  async sendDigest(kind: 'daily_digest' | 'weekly_digest'): Promise<DispatchSummary> {
    const userIds = await this.users.listActiveUserIds();
    const pending: PendingNotification[] = [];

    for (const userId of userIds) {
      const preferences = await this.users.getPreferences(userId).catch(() => null);
      if (!preferences) continue;
      if (kind === 'daily_digest' && !preferences.dailyDigest) continue;
      if (kind === 'weekly_digest' && !preferences.weeklyDigest) continue;

      const bundles = await this.recommendations.forUser(userId, kind === 'daily_digest' ? 5 : 10)
        .catch((error: unknown) => {
          log.warn('digest recommendation failed', { userId, error: (error as Error).message });
          return [];
        });

      const qualified = bundles.filter((b) => b.match.recommendationScore >= preferences.minMatchScore);
      if (qualified.length === 0) continue;

      const top = qualified[0];
      if (!top) continue;

      pending.push(...this.fanOut(preferences, {
        kind,
        title: kind === 'daily_digest'
          ? `${qualified.length} internships matched you today`
          : `Your weekly shortlist: ${qualified.length} matches`,
        body: `Top pick: ${top.internship.title} at ${top.internship.company.name} — ${top.match.recommendationScore}% match.`,
        url: `${getEnv().appUrl}/app/opportunities?tab=recommended`,
        internshipIds: qualified.map((b) => b.internship.id),
        meta: { topScore: top.match.recommendationScore },
      }));
    }

    return this.persist(kind, userIds.length, pending);
  }

  /** Alerts for postings that appeared since the last run and clear the user's bar. */
  async sendNewInternshipAlerts(sinceHours = 24): Promise<DispatchSummary> {
    const { items } = await this.internships.list({
      filters: { activeOnly: true, postedAfter: isoDaysAgo(sinceHours / 24) },
      sort: 'recent',
      limit: 200,
      offset: 0,
    });
    if (items.length === 0) return { kind: 'new_internship', usersConsidered: 0, notificationsCreated: 0 };

    const userIds = await this.users.listActiveUserIds();
    const pending: PendingNotification[] = [];

    for (const userId of userIds) {
      const preferences = await this.users.getPreferences(userId).catch(() => null);
      if (!preferences?.newInternshipAlerts) continue;

      const companyHits = items.filter((item) =>
        preferences.followedCompanies.some((c) => c.toLowerCase() === item.company.slug));
      const roleHits = items.filter((item) =>
        preferences.followedRoles.some((r) => item.normalizedTitle.includes(r.toLowerCase())));

      if (companyHits.length > 0) {
        pending.push(...this.fanOut(preferences, {
          kind: 'company_alert',
          title: `New roles at ${(companyHits[0] as InternshipRecord).company.name}`,
          body: this.describe(companyHits),
          url: `${getEnv().appUrl}/app/opportunities?tab=discover`,
          internshipIds: companyHits.map((i) => i.id),
          meta: {},
        }));
      }
      if (roleHits.length > 0) {
        pending.push(...this.fanOut(preferences, {
          kind: 'role_alert',
          title: `${roleHits.length} new postings in roles you follow`,
          body: this.describe(roleHits),
          url: `${getEnv().appUrl}/app/opportunities?tab=discover`,
          internshipIds: roleHits.map((i) => i.id),
          meta: {},
        }));
      }
    }

    return this.persist('new_internship', userIds.length, pending);
  }

  /** Reminders at 7, 3 and 1 days out for anything the user is tracking. */
  async sendDeadlineReminders(): Promise<DispatchSummary> {
    const applications = await this.tracking.findUpcomingDeadlines(7);
    if (applications.length === 0) {
      return { kind: 'deadline_reminder', usersConsidered: 0, notificationsCreated: 0 };
    }

    const internships = await this.internships.findByIds(applications.map((a) => a.internshipId));
    const byId = new Map(internships.map((i) => [i.id, i]));
    const pending: PendingNotification[] = [];
    const users = new Set<string>();

    for (const application of applications) {
      const internship = byId.get(application.internshipId);
      const deadline = application.deadlineAt ?? internship?.deadlineAt ?? null;
      if (!internship || !deadline) continue;

      const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
      if (![7, 3, 1].includes(daysLeft)) continue;

      users.add(application.userId);
      const preferences = await this.users.getPreferences(application.userId).catch(() => null);
      if (!preferences?.deadlineReminders) continue;

      pending.push(...this.fanOut(preferences, {
        kind: 'deadline_reminder',
        title: daysLeft === 1 ? 'Deadline tomorrow' : `Deadline in ${daysLeft} days`,
        body: `${internship.title} at ${internship.company.name} closes on ${new Date(deadline).toDateString()}.`,
        url: internship.applyUrl,
        internshipIds: [internship.id],
        meta: { daysLeft, status: application.status },
      }));
    }

    return this.persist('deadline_reminder', users.size, pending);
  }

  async list(userId: string, unreadOnly: boolean, limit = 50): Promise<NotificationRecord[]> {
    return this.users.listNotifications(userId, unreadOnly, limit);
  }

  async markRead(userId: string, ids: readonly string[]): Promise<void> {
    await this.users.markNotificationsRead(userId, ids);
  }

  /** One notification row per enabled channel. */
  private fanOut(
    preferences: NotificationPreferences,
    input: {
      kind: NotificationKind;
      title: string;
      body: string;
      url: string | null;
      internshipIds: string[];
      meta: Record<string, unknown>;
    },
  ): PendingNotification[] {
    const channels: NotificationChannel[] = preferences.channels.length > 0 ? preferences.channels : ['in_app'];
    return channels.map((channel) => ({
      userId: preferences.userId,
      kind: input.kind,
      channel,
      payload: {
        title: input.title,
        body: truncate(input.body, 400),
        url: input.url,
        internshipIds: input.internshipIds.slice(0, 20),
        meta: input.meta,
      },
      sentAt: channel === 'in_app' ? isoNow() : null,
    }));
  }

  private describe(items: readonly InternshipRecord[]): string {
    return items
      .slice(0, 3)
      .map((item) => `${item.title} (${formatCompensation(item.compensation)})`)
      .join(' · ');
  }

  private async persist(
    kind: NotificationKind,
    usersConsidered: number,
    pending: readonly PendingNotification[],
  ): Promise<DispatchSummary> {
    if (pending.length === 0) return { kind, usersConsidered, notificationsCreated: 0 };

    let created = 0;
    for (let i = 0; i < pending.length; i += 500) {
      created += await this.users.insertNotifications(pending.slice(i, i + 500));
    }

    await this.deliver(pending);

    log.info('notifications dispatched', { kind, usersConsidered, created });
    return { kind, usersConsidered, notificationsCreated: created };
  }

  /** Hands each channel's slice to its bound transport, if any. */
  private async deliver(pending: readonly PendingNotification[]): Promise<void> {
    if (transports.size === 0) return;

    await Promise.all(
      [...transports.entries()].map(async ([channel, transport]) => {
        const batch = pending.filter((item) => item.channel === channel);
        if (batch.length === 0) return;

        try {
          await transport.deliver(batch);
        } catch (error) {
          log.warn('notification transport failed', {
            channel,
            count: batch.length,
            error: (error as Error).message,
          });
        }
      }),
    );
  }
}
