/**
 * timeline.service.ts
 * "Deadline Prediction" and calendar-view support: exposes urgency levels
 * and deadline predictions for a single hackathon, plus an aggregated
 * calendar view across a list of tracked/saved hackathons.
 */

import { Hackathon, DeadlinePrediction, ServiceResult, success } from "../models/hackathon.model";
import { predictDeadlineFallback, calculateUrgency, UrgencyLevel, isRegistrationOpen } from "../utils/timeline-calculator";

export interface CalendarEntry {
  hackathonId: string;
  title: string;
  submissionDeadline: string;
  urgency: UrgencyLevel;
  registrationOpen: boolean;
}

export class TimelineService {
  predictDeadline(hackathon: Hackathon): ServiceResult<DeadlinePrediction> {
    return success(predictDeadlineFallback(hackathon));
  }

  getUrgency(hackathon: Hackathon): UrgencyLevel {
    return calculateUrgency(hackathon.timeline.submissionDeadline);
  }

  /**
   * Builds a calendar view sorted by nearest deadline first — powers the
   * "Calendar View" and "Upcoming Deadlines" tracking features.
   */
  buildCalendarView(hackathons: Hackathon[]): ServiceResult<CalendarEntry[]> {
    const entries: CalendarEntry[] = hackathons
      .map((h) => ({
        hackathonId: h.id,
        title: h.title,
        submissionDeadline: h.timeline.submissionDeadline,
        urgency: this.getUrgency(h),
        registrationOpen: isRegistrationOpen(h.timeline),
      }))
      .filter((e) => e.urgency !== "past")
      .sort((a, b) => new Date(a.submissionDeadline).getTime() - new Date(b.submissionDeadline).getTime());

    return success(entries);
  }
}
