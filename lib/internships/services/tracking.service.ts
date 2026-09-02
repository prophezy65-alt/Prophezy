import type { ApplicationRecord, ApplicationStatus, InternshipRecord, StatusTransition } from '../types';
import { InternshipRepository, TrackingRepository } from '../db/repositories';
import { EngineError } from '../utils/errors';
import { isoNow } from '../utils/date';
import { createLogger } from '../utils/logger';

const log = createLogger('internships.tracking');

/** Allowed status transitions. Enforced server-side so the UI cannot corrupt the funnel. */
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  saved: ['applied', 'withdrawn'],
  applied: ['interview_scheduled', 'rejected', 'offer', 'withdrawn'],
  interview_scheduled: ['offer', 'rejected', 'withdrawn', 'interview_scheduled'],
  rejected: [],
  offer: ['accepted', 'rejected', 'withdrawn'],
  accepted: ['withdrawn'],
  withdrawn: [],
};

export interface TrackedApplication {
  application: ApplicationRecord;
  internship: InternshipRecord;
  daysUntilDeadline: number | null;
}

export class TrackingService {
  constructor(
    private readonly tracking = new TrackingRepository(),
    private readonly internships = new InternshipRepository(),
  ) {}

  async save(userId: string, internshipId: string): Promise<ApplicationRecord> {
    const internship = await this.internships.findById(internshipId);
    await this.tracking.save(userId, internshipId);
    return this.tracking.upsertApplication({
      userId,
      internshipId,
      status: 'saved',
      deadlineAt: internship.deadlineAt,
    });
  }

  async unsave(userId: string, internshipId: string): Promise<void> {
    await this.tracking.unsave(userId, internshipId);
  }

  async listSaved(userId: string): Promise<InternshipRecord[]> {
    const ids = await this.tracking.listSavedIds(userId);
    return this.internships.findByIds(ids);
  }

  async transition(
    userId: string,
    internshipId: string,
    next: ApplicationStatus,
    patch: Partial<Pick<ApplicationRecord, 'notes' | 'interviewAt' | 'documents' | 'deadlineAt'>> = {},
  ): Promise<{ application: ApplicationRecord; transition: StatusTransition }> {
    const existing = await this.tracking.findApplication(userId, internshipId);
    const from = existing?.status ?? null;

    if (from !== null && from !== next && !TRANSITIONS[from].includes(next)) {
      throw new EngineError(
        'INVALID_TRANSITION',
        `Cannot move an application from "${from}" to "${next}"`,
        409,
        { from, to: next },
      );
    }

    const now = isoNow();
    const application = await this.tracking.upsertApplication({
      userId,
      internshipId,
      status: next,
      appliedAt: next === 'applied' ? (existing?.appliedAt ?? now) : existing?.appliedAt ?? null,
      interviewAt: patch.interviewAt ?? existing?.interviewAt ?? null,
      decisionAt: ['rejected', 'offer', 'accepted'].includes(next) ? now : existing?.decisionAt ?? null,
      deadlineAt: patch.deadlineAt ?? existing?.deadlineAt ?? null,
      notes: patch.notes ?? existing?.notes ?? null,
      documents: patch.documents ?? existing?.documents ?? [],
    });

    if (next === 'applied' && from !== 'applied') {
      await this.internships.incrementCounter(internshipId, 'apply_count').catch((error: unknown) => {
        log.warn('apply counter increment failed', { internshipId, error: (error as Error).message });
      });
    }

    return { application, transition: { from, to: next, at: now } };
  }

  async listApplications(userId: string, status?: ApplicationStatus): Promise<TrackedApplication[]> {
    const applications = await this.tracking.listApplications(userId, status);
    const internships = await this.internships.findByIds(applications.map((a) => a.internshipId));
    const byId = new Map(internships.map((item) => [item.id, item]));

    return applications
      .filter((application) => byId.has(application.internshipId))
      .map((application) => {
        const internship = byId.get(application.internshipId) as InternshipRecord;
        const deadline = application.deadlineAt ?? internship.deadlineAt;
        return {
          application,
          internship,
          daysUntilDeadline: deadline
            ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
            : null,
        };
      });
  }

  /** Funnel counts for the student dashboard. */
  async funnel(userId: string): Promise<Record<ApplicationStatus, number>> {
    const applications = await this.tracking.listApplications(userId);
    const counts = {
      saved: 0, applied: 0, interview_scheduled: 0,
      rejected: 0, offer: 0, accepted: 0, withdrawn: 0,
    } satisfies Record<ApplicationStatus, number>;

    for (const application of applications) counts[application.status] += 1;
    return counts;
  }

  async recordView(userId: string | null, internshipId: string): Promise<void> {
    await this.internships.incrementCounter(internshipId, 'view_count').catch((error: unknown) => {
      log.warn('view counter increment failed', { internshipId, userId, error: (error as Error).message });
    });

    if (userId) {
      await this.tracking.recordView(userId, internshipId).catch((error: unknown) => {
        log.warn('recently-viewed record failed', { internshipId, userId, error: (error as Error).message });
      });
    }
  }

  async listRecentlyViewed(userId: string, limit = 30): Promise<InternshipRecord[]> {
    const ids = await this.tracking.listRecentlyViewedIds(userId, limit);
    const records = await this.internships.findByIds(ids);
    // findByIds doesn't preserve order — re-sort to match most-recently-viewed-first.
    const order = new Map(ids.map((id, index) => [id, index]));
    return records.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
}
