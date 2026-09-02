/**
 * notification.service.ts
 * "NOTIFICATIONS" features: new hackathon alerts, deadline/registration/
 * submission reminders, and theme/technology match alerts. This service
 * *creates* notification records; actual delivery (email/push) is the
 * app's responsibility via whatever channel it already uses — kept out of
 * scope here per "reuse existing modules, don't duplicate infra".
 */

import {
  Hackathon,
  HackathonUserProfile,
  HackathonNotification,
  NotificationType,
  UserId,
  ServiceResult,
  success,
} from "../models/hackathon.model";
import { NotificationRepository } from "../tracking/notification.repository";
import { calculateUrgency } from "../utils/timeline-calculator";
import { calculateThemeMatchPercent } from "../utils/theme-analyzer";
import { calculateTechnologyMatchPercent } from "../utils/technology-analyzer";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const MATCH_ALERT_THRESHOLD_PERCENT = 70;

export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  private async create(
    userId: UserId,
    hackathon: Hackathon,
    type: NotificationType,
    message: string,
    triggerAt: string
  ): Promise<HackathonNotification> {
    return this.repo.create({
      id: generateId("notification"),
      userId,
      hackathonId: hackathon.id,
      type,
      message,
      triggerAt,
      sent: false,
    });
  }

  async notifyNewHackathon(userId: UserId, hackathon: Hackathon): Promise<ServiceResult<HackathonNotification>> {
    const notification = await this.create(
      userId,
      hackathon,
      "new_hackathon",
      `New hackathon added: ${hackathon.title}`,
      new Date().toISOString()
    );
    return success(notification);
  }

  /**
   * Scans a tracked hackathon's timeline and creates reminder
   * notifications for registration and submission deadlines that are
   * within the given lookahead window and haven't passed yet.
   */
  async scanDeadlineReminders(
    userId: UserId,
    hackathon: Hackathon,
    withinHours = 72
  ): Promise<ServiceResult<HackathonNotification[]>> {
    const created: HackathonNotification[] = [];
    const urgency = calculateUrgency(hackathon.timeline.submissionDeadline);

    if (urgency !== "past" && ["urgent", "soon"].includes(urgency)) {
      created.push(
        await this.create(
          userId,
          hackathon,
          "submission_reminder",
          `Submission for "${hackathon.title}" is due ${hackathon.timeline.submissionDeadline}.`,
          new Date().toISOString()
        )
      );
    }

    if (hackathon.timeline.registrationClosesAt) {
      const regUrgency = calculateUrgency(hackathon.timeline.registrationClosesAt);
      if (regUrgency !== "past" && ["urgent", "soon"].includes(regUrgency)) {
        created.push(
          await this.create(
            userId,
            hackathon,
            "registration_reminder",
            `Registration for "${hackathon.title}" closes ${hackathon.timeline.registrationClosesAt}.`,
            new Date().toISOString()
          )
        );
      }
    }

    return success(created);
  }

  /**
   * Checks a newly-synced hackathon against a user's preferences and
   * creates a match alert if it clears the theme/technology match
   * threshold — powers "Theme Match Alerts" / "Technology Match Alerts".
   */
  async checkMatchAlerts(
    userId: UserId,
    hackathon: Hackathon,
    profile: HackathonUserProfile
  ): Promise<ServiceResult<HackathonNotification[]>> {
    const created: HackathonNotification[] = [];
    const themeMatch = calculateThemeMatchPercent(hackathon, profile);
    const techMatch = calculateTechnologyMatchPercent(hackathon, profile);

    if (themeMatch >= MATCH_ALERT_THRESHOLD_PERCENT) {
      created.push(
        await this.create(userId, hackathon, "theme_match", `"${hackathon.title}" matches your preferred themes (${themeMatch}%).`, new Date().toISOString())
      );
    }
    if (techMatch >= MATCH_ALERT_THRESHOLD_PERCENT) {
      created.push(
        await this.create(userId, hackathon, "technology_match", `"${hackathon.title}" matches your tech stack (${techMatch}%).`, new Date().toISOString())
      );
    }

    return success(created);
  }

  async listPending(userId: UserId): Promise<ServiceResult<HackathonNotification[]>> {
    return success(await this.repo.listPending(userId));
  }

  async markSent(notificationId: string): Promise<ServiceResult<null>> {
    await this.repo.markSent(notificationId);
    return success(null);
  }
}
