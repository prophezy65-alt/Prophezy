/**
 * source-adapter.interface.ts
 * The contract every hackathon source provider implements. Adding a new
 * source means writing one class that satisfies this interface and
 * registering it in `source-registry.ts` — nothing else in the module
 * needs to change (Open/Closed Principle).
 */

import { Hackathon, HackathonSourceId } from "../../models/hackathon.model";

export interface SourceFetchOptions {
  /** Only fetch hackathons updated/created after this ISO timestamp, when the source supports it. */
  since?: string;
  /** Max number of hackathons to fetch in this call, for incremental sync. */
  limit?: number;
}

export interface SourceFetchResult {
  hackathons: Hackathon[];
  fetchedCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface HackathonSourceAdapter {
  readonly sourceId: HackathonSourceId;
  readonly displayName: string;
  readonly isImplemented: boolean;

  /**
   * Fetches hackathons from this source, normalizing the source's native
   * format into the shared `Hackathon` model. Implementations must not
   * throw for "no results" — return an empty array instead. Throwing is
   * reserved for actual fetch/parse failures.
   */
  fetchHackathons(options?: SourceFetchOptions): Promise<SourceFetchResult>;
}

export class SourceNotImplementedError extends Error {
  constructor(public readonly sourceId: HackathonSourceId) {
    super(
      `Source adapter for "${sourceId}" is registered but not yet implemented. ` +
        `Implement HackathonSourceAdapter#fetchHackathons against this provider's API/site ` +
        `and swap it into the registry — see README "Adding a new source".`
    );
    this.name = "SourceNotImplementedError";
  }
}
