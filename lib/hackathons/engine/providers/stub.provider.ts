/**
 * lib/hackathons/engine/providers/stub.provider.ts
 *
 * Mirrors lib/internships/providers/base/stub.provider.ts's pattern
 * exactly: a fully-typed provider that satisfies HackathonProvider and
 * reports itself honestly as unimplemented, rather than a bare object
 * literal. This means ProviderRegistry, SyncService, and the health-check
 * endpoint already work against the complete source list today — turning
 * a stub real is a one-file change (implement collect(), swap the
 * registry factory), nothing else in the engine needs to know.
 */

import type { HackathonSourceId } from "../../models/hackathon.model";
import type { FetchOptions, FetchResult, HackathonProvider, ProviderHealth } from "../types";

export class StubHackathonProvider implements HackathonProvider {
  readonly isImplemented = false;
  readonly accessBasis = "unsupported" as const;

  constructor(
    public readonly key: HackathonSourceId,
    public readonly displayName: string,
    private readonly integrationNote: string
  ) {}

  async fetchAll(_options?: FetchOptions): Promise<FetchResult> {
    throw new Error(
      `Provider "${this.key}" (${this.displayName}) is registered but not implemented: ${this.integrationNote}`
    );
  }

  async checkHealth(): Promise<ProviderHealth> {
    return {
      key: this.key,
      status: "unsupported",
      reachable: false,
      message: this.integrationNote,
      checkedAt: new Date().toISOString(),
    };
  }
}
