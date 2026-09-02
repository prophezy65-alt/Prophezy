/**
 * timeline-calculator.ts
 * Deterministic date math for hackathon timelines: time remaining, urgency
 * flags, and a heuristic deadline prediction fallback for hackathons whose
 * source hasn't published a firm date yet.
 */

import { Hackathon, HackathonTimeline, DeadlinePrediction } from "../models/hackathon.model";

export function hoursUntil(isoDate: string, now: Date = new Date()): number {
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return NaN;
  return (target - now.getTime()) / (1000 * 60 * 60);
}

export function daysUntil(isoDate: string, now: Date = new Date()): number {
  return hoursUntil(isoDate, now) / 24;
}

export type UrgencyLevel = "past" | "urgent" | "soon" | "upcoming" | "far";

export function calculateUrgency(submissionDeadline: string, now: Date = new Date()): UrgencyLevel {
  const hours = hoursUntil(submissionDeadline, now);
  if (Number.isNaN(hours) || hours < 0) return "past";
  if (hours <= 48) return "urgent";
  if (hours <= 24 * 7) return "soon";
  if (hours <= 24 * 30) return "upcoming";
  return "far";
}

export function isRegistrationOpen(timeline: HackathonTimeline, now: Date = new Date()): boolean {
  const opens = timeline.registrationOpensAt ? new Date(timeline.registrationOpensAt).getTime() : -Infinity;
  const closes = timeline.registrationClosesAt ? new Date(timeline.registrationClosesAt).getTime() : Infinity;
  const current = now.getTime();
  return current >= opens && current <= closes;
}

/**
 * Heuristic fallback for hackathons missing a firm submission deadline:
 * uses the typical hacking-window length for the source, or a generic
 * 6-week-out estimate, with explicitly low confidence so the UI can flag
 * it as provisional.
 */
export function predictDeadlineFallback(hackathon: Hackathon, now: Date = new Date()): DeadlinePrediction {
  if (hackathon.timeline.submissionDeadline) {
    return {
      predictedSubmissionDeadline: hackathon.timeline.submissionDeadline,
      confidence: "high",
      basis: "Deadline published directly by the source.",
    };
  }

  const estimated = new Date(now.getTime() + 42 * 24 * 60 * 60 * 1000); // ~6 weeks out
  return {
    predictedSubmissionDeadline: estimated.toISOString(),
    confidence: "low",
    basis: "No deadline published by the source; estimated using a typical 6-week hackathon planning window.",
  };
}
