/**
 * lib/hackathons/engine/providers/provider-registry.ts
 *
 * Mirrors lib/internships/config/provider-registry.ts + providers/index.ts:
 * one descriptor-driven list, adding a new source means adding one
 * ProviderDescriptor entry and (when ready) swapping `factory` from a
 * StubHackathonProvider to a real one — nothing else in the engine
 * changes (Open/Closed Principle, same as the internship engine's own
 * README documents).
 *
 * Real (2): Devpost, GitHub Events — both genuinely public, keyless,
 * unauthenticated endpoints, verified before implementing (see chat
 * history: web-searched MLH and Devfolio specifically before ruling them
 * out — neither publishes an official public listings API; every "API"
 * that exists for them is an unofficial third-party scraper of the
 * site, which is exactly what "no scraping services / respect ToS" rules
 * out). The same reasoning applies to the rest below by the same
 * category of risk (consumer-facing hackathon platforms don't publish
 * public aggregation APIs) — each is registered honestly as unsupported
 * with its own integration note rather than assumed real without
 * verification.
 */

import type { HackathonSourceId } from "../../models/hackathon.model";
import type { ProviderDescriptor } from "../types";
import { DevpostProvider } from "./devpost.provider";
import { GithubEventsProvider } from "./github-events.provider";
import { StubHackathonProvider } from "./stub.provider";

const UNSUPPORTED: Array<{ key: HackathonSourceId; displayName: string; note: string }> = [
  { key: "mlh", displayName: "MLH", note: "No official public listings API. mlh.io is server-rendered; every 'MLH API' in the wild is an unofficial scraper — excluded per the no-scraping-services rule." },
  { key: "major_league_hacking", displayName: "Major League Hacking", note: "Same organization/limitation as 'mlh' — kept as a separate registry entry only because the source spec listed both names." },
  { key: "unstop", displayName: "Unstop", note: "No documented public API for hackathon listings. Their site is a SPA backed by internal, undocumented endpoints not intended for third-party use." },
  { key: "devfolio", displayName: "Devfolio", note: "No official public API (verified via web search before ruling out). Community projects reverse-engineer internal endpoints; not something to depend on in production without Devfolio's explicit permission." },
  { key: "hack2skill", displayName: "Hack2Skill", note: "No public API or feed found. Would require partner/organizer access." },
  { key: "dorahacks", displayName: "DoraHacks", note: "No documented public listings API found. Revisit if they publish one." },
  { key: "ethglobal", displayName: "ETHGlobal", note: "No public listings API. Their events page is server-rendered with no accompanying public feed." },
  { key: "angelhack", displayName: "AngelHack", note: "No public API or feed found." },
  { key: "google_developer_events", displayName: "Google Developer Events", note: "Google I/O Extended / DevFest listings are organizer-submitted to Google Developer Groups' own site with no public aggregation feed." },
  { key: "microsoft_events", displayName: "Microsoft Events", note: "No public hackathon-specific feed; Microsoft's events catalog covers all event types, not hackathons specifically, with no filterable public API." },
  { key: "aws_events", displayName: "AWS Events", note: "Same limitation as Microsoft Events — general events catalog, no hackathon-specific public feed." },
  { key: "hackclub", displayName: "HackClub", note: "hackclub.com/hackathons has no accompanying public JSON/RSS feed as of this writing — revisit; they're an open-source-friendly org and may add one." },
  { key: "y_combinator_events", displayName: "Y Combinator Events", note: "No public hackathon-specific feed." },
];

export const PROVIDER_REGISTRY: ProviderDescriptor[] = [
  {
    key: "devpost",
    displayName: "Devpost",
    isImplemented: true,
    accessBasis: "public_json",
    integrationNote: "Real — Devpost's own public site-search JSON endpoint (devpost.com/api/hackathons), unauthenticated.",
    factory: () => new DevpostProvider(),
  },
  {
    key: "github_events",
    displayName: "GitHub (hackathon-topic repositories)",
    isImplemented: true,
    accessBasis: "public_api",
    integrationNote: "Real — GitHub's documented public Search API, filtered to topic:hackathon. Discovery aid, not an authoritative structured listing.",
    factory: () => new GithubEventsProvider(),
  },
  ...UNSUPPORTED.map(
    (s): ProviderDescriptor => ({
      key: s.key,
      displayName: s.displayName,
      isImplemented: false,
      accessBasis: "unsupported",
      integrationNote: s.note,
      factory: () => new StubHackathonProvider(s.key, s.displayName, s.note),
    })
  ),
];

export function getProviderDescriptor(key: HackathonSourceId): ProviderDescriptor | undefined {
  return PROVIDER_REGISTRY.find((p) => p.key === key);
}

export function getImplementedProviders(): ProviderDescriptor[] {
  return PROVIDER_REGISTRY.filter((p) => p.isImplemented);
}

export function createAllProviders() {
  return PROVIDER_REGISTRY.map((descriptor) => descriptor.factory());
}
