/**
 * analytics.service.ts
 * "Technology Trend Analysis" across the hackathon catalog, and tracking
 * analytics for a user's saved/registered/completed hackathons. Both
 * deterministic — no AI call required, so the dashboard is always fast.
 */

import { Hackathon, HackathonTrackingEntry, ServiceResult, success } from "../models/hackathon.model";
import { calculateTechnologyTrends } from "../utils/technology-analyzer";
import { buildTrackingAnalytics, TrackingAnalytics } from "../analytics/tracking-analytics";

export class AnalyticsService {
  getTechnologyTrends(hackathons: Hackathon[], topN = 15): ServiceResult<{ technology: string; count: number }[]> {
    return success(calculateTechnologyTrends(hackathons, topN));
  }

  getTrackingAnalytics(entries: HackathonTrackingEntry[]): ServiceResult<TrackingAnalytics> {
    return success(buildTrackingAnalytics(entries));
  }

  /**
   * Surfaces the most common themes across a hackathon set — a cheap
   * companion to technology trends for the "Theme Analysis" dashboard.
   */
  getThemeTrends(hackathons: Hackathon[], topN = 15): ServiceResult<{ theme: string; count: number }[]> {
    const counts = new Map<string, number>();
    hackathons.forEach((h) => h.themes.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));

    const trends = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([theme, count]) => ({ theme, count }));

    return success(trends);
  }
}
