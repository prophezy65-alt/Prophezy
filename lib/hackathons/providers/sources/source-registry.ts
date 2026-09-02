/**
 * source-registry.ts
 * Central registry of every hackathon source adapter. Services depend on
 * this registry, never on individual adapter classes, so adding a new
 * source or swapping an implementation never requires touching
 * provider.service.ts or anything downstream.
 */

import { HackathonSourceId } from "../../models/hackathon.model";
import { HackathonSourceAdapter } from "./source-adapter.interface";
import { DevpostSourceAdapter } from "./devpost.adapter";
import { GithubEventsSourceAdapter } from "./github-events.adapter";
import { UNIMPLEMENTED_SOURCE_ADAPTERS } from "./unimplemented-sources";

export class SourceRegistry {
  private readonly adapters = new Map<HackathonSourceId, HackathonSourceAdapter>();

  constructor(adapters: HackathonSourceAdapter[]) {
    for (const adapter of adapters) {
      this.adapters.set(adapter.sourceId, adapter);
    }
  }

  get(sourceId: HackathonSourceId): HackathonSourceAdapter | undefined {
    return this.adapters.get(sourceId);
  }

  list(): HackathonSourceAdapter[] {
    return [...this.adapters.values()];
  }

  listImplemented(): HackathonSourceAdapter[] {
    return this.list().filter((a) => a.isImplemented);
  }
}

/**
 * Default registry wired with every source from the spec. Implemented
 * adapters (Devpost, GitHub) fetch real data; the rest are registered but
 * throw `SourceNotImplementedError` until filled in — see
 * `unimplemented-sources.ts`.
 */
export function createDefaultSourceRegistry(): SourceRegistry {
  return new SourceRegistry([
    new DevpostSourceAdapter(),
    new GithubEventsSourceAdapter(),
    ...UNIMPLEMENTED_SOURCE_ADAPTERS,
  ]);
}
