/**
 * lib/hackathons/engine/services/normalizer.service.ts
 *
 * Two-stage normalization mirroring lib/internships/services/
 * normalizer.service.ts's philosophy exactly: a free deterministic pass
 * runs on every item; AI enrichment is optional and only invoked for
 * postings the deterministic pass left too thin to be useful — keeping
 * AI spend near zero at aggregation scale, same reasoning the internship
 * engine documents for itself. Devpost/GitHub already return reasonably
 * structured themes, so AI enrichment is the exception path here, not
 * the common one.
 *
 * Reuses the existing AiCoreClient interface (providers/ai-core.provider.ts)
 * already wired into recommendation.service.ts — never calls Gemini
 * directly, never adds a second AI bridge.
 */

import type { Hackathon } from "../../models/hackathon.model";
import type { AiCoreClient } from "../../providers/ai-core.provider";
import { createLogger } from "../../../internships/utils/logger";

const log = createLogger("hackathons.normalizer");

const COUNTRY_KEYWORDS: Array<[RegExp, string]> = [
  [/\b(usa|united states|u\.s\.a?\.?)\b/i, "United States"],
  [/\b(uk|united kingdom|england|london)\b/i, "United Kingdom"],
  [/\bindia\b/i, "India"],
  [/\bcanada\b/i, "Canada"],
  [/\bgermany\b/i, "Germany"],
  [/\bsingapore\b/i, "Singapore"],
  [/\baustralia\b/i, "Australia"],
  [/\bworldwide|global|remote\b/i, "Global"],
];

function cleanList(values: readonly string[], max = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const cleaned = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= max) break;
  }
  return out;
}

function inferCountry(text?: string): string | undefined {
  if (!text) return undefined;
  for (const [pattern, label] of COUNTRY_KEYWORDS) {
    if (pattern.test(text)) return label;
  }
  return undefined;
}

interface AiThemeExtraction {
  themes: string[];
  technologies: string[];
}

export class HackathonNormalizerService {
  constructor(private readonly aiCore?: AiCoreClient) {}

  /** Stage 1 — pure, synchronous, no network. Runs on every fetched item. */
  normalizeDeterministic(hackathon: Hackathon): Hackathon {
    return {
      ...hackathon,
      title: hackathon.title.trim(),
      description: hackathon.description.trim(),
      themes: cleanList(hackathon.themes),
      technologies: cleanList(hackathon.technologies),
      country: hackathon.country ?? inferCountry(`${hackathon.location ?? ""} ${hackathon.description}`),
    };
  }

  /** True when both themes and technologies came back empty — the case worth spending an AI call on. */
  needsAiEnrichment(hackathon: Hackathon): boolean {
    return hackathon.themes.length === 0 && hackathon.technologies.length === 0 && hackathon.description.length > 80;
  }

  /** Stage 2 — optional. Never called on the hot sync path unless needsAiEnrichment() is true and an AiCoreClient was injected. */
  async enrichWithAi(hackathon: Hackathon, userId?: string): Promise<Hackathon> {
    if (!this.aiCore) return hackathon;

    try {
      const prompt = `Given this hackathon's title and description, extract up to 6 themes (e.g. "AI", "climate", "fintech") and up to 8 relevant technologies (e.g. "Python", "React"). Respond as JSON: {"themes": string[], "technologies": string[]}.

Title: ${hackathon.title}
Description: ${hackathon.description.slice(0, 1500)}`;

      const result = await this.aiCore.generateJson<AiThemeExtraction>({
        taskId: "hackathons.normalizer.enrich",
        userId,
        prompt,
        temperature: 0.2,
        maxOutputTokens: 300,
      });

      return { ...hackathon, themes: cleanList(result.themes ?? []), technologies: cleanList(result.technologies ?? []) };
    } catch (error) {
      log.warn("AI enrichment failed, keeping deterministic result", {
        hackathonId: hackathon.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return hackathon;
    }
  }

  async normalize(hackathon: Hackathon, userId?: string): Promise<Hackathon> {
    const deterministic = this.normalizeDeterministic(hackathon);
    if (!this.needsAiEnrichment(deterministic)) return deterministic;
    return this.enrichWithAi(deterministic, userId);
  }
}
