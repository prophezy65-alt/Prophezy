/**
 * ranking.service.ts
 * Personalized ranking of hackathons for a user profile — thin service
 * wrapper over the deterministic ranking engine, with pagination.
 */

import { HackathonUserProfile, CursorPage, ServiceResult, success } from "../models/hackathon.model";
import { rankHackathons, RankedHackathon } from "../utils/ranking-engine";
import { HackathonService } from "./hackathon.service";
import { paginate } from "../utils/pagination";

export class RankingService {
  constructor(private readonly hackathonService: HackathonService) {}

  async getPersonalizedRanking(
    profile: HackathonUserProfile,
    cursor?: string,
    limit = 20
  ): Promise<ServiceResult<CursorPage<RankedHackathon>>> {
    const page = await this.hackathonService.list(undefined, undefined, 1000, false);
    const hackathons = page.ok && page.data ? page.data.items : [];

    const ranked = rankHackathons(hackathons, profile);
    return success(paginate(ranked, cursor, limit));
  }
}
