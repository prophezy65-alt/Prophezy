/**
 * unimplemented-sources.ts
 * The remaining sources from the spec (MLH, Unstop, Devfolio, Hack2Skill,
 * DoraHacks, ETHGlobal, AngelHack, Major League Hacking, Google/Microsoft/
 * AWS Developer Events, HackClub, Y Combinator Events) each require
 * bespoke integration work: most don't expose a stable public JSON API
 * like Devpost's, and several require either scraping (fragile, needs
 * per-site maintenance) or a partner API key that only the account owner
 * can obtain.
 *
 * Rather than fabricate example endpoints/response shapes we can't verify
 * (which would silently return wrong data in production), these are
 * registered as fully-typed adapters that satisfy `HackathonSourceAdapter`
 * and throw `SourceNotImplementedError` when called — so the registry,
 * ranking, search, and every downstream service already work against the
 * full 15-source list today, and each adapter becomes a self-contained,
 * one-file implementation task with zero changes needed elsewhere.
 *
 * NOTE: "MLH" and "Major League Hacking" are the same organization in the
 * source spec; both ids are kept distinct here only because the original
 * requirements listed them separately.
 */

import { HackathonSourceId } from "../../models/hackathon.model";
import {
  HackathonSourceAdapter,
  SourceFetchOptions,
  SourceFetchResult,
  SourceNotImplementedError,
} from "./source-adapter.interface";

class UnimplementedSourceAdapter implements HackathonSourceAdapter {
  readonly isImplemented = false;

  constructor(public readonly sourceId: HackathonSourceId, public readonly displayName: string) {}

  async fetchHackathons(_options?: SourceFetchOptions): Promise<SourceFetchResult> {
    throw new SourceNotImplementedError(this.sourceId);
  }
}

export const UNIMPLEMENTED_SOURCE_ADAPTERS: HackathonSourceAdapter[] = [
  new UnimplementedSourceAdapter("mlh", "MLH"),
  new UnimplementedSourceAdapter("major_league_hacking", "Major League Hacking"),
  new UnimplementedSourceAdapter("unstop", "Unstop"),
  new UnimplementedSourceAdapter("devfolio", "Devfolio"),
  new UnimplementedSourceAdapter("hack2skill", "Hack2Skill"),
  new UnimplementedSourceAdapter("dorahacks", "DoraHacks"),
  new UnimplementedSourceAdapter("ethglobal", "ETHGlobal"),
  new UnimplementedSourceAdapter("angelhack", "AngelHack"),
  new UnimplementedSourceAdapter("google_developer_events", "Google Developer Events"),
  new UnimplementedSourceAdapter("microsoft_events", "Microsoft Events"),
  new UnimplementedSourceAdapter("aws_events", "AWS Events"),
  new UnimplementedSourceAdapter("hackclub", "HackClub"),
  new UnimplementedSourceAdapter("y_combinator_events", "Y Combinator Events"),
];
