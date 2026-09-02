/**
 * lib/hackathons/http/parse.ts
 *
 * Parses HackathonFilters + sort + pagination from URL search params.
 * Shared by GET /api/hackathons and GET /api/hackathons/search so filter
 * syntax stays identical across both.
 */

import type { HackathonFilters, HackathonMode, ExperienceTier, EligibilityAudience } from "../models/hackathon.model";
import type { HackathonSort } from "../services/hackathon.service";

const VALID_SORTS: HackathonSort[] = ["deadline_asc", "deadline_desc", "prize_desc", "newest"];

function csv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(",").map((v) => v.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function parseFilters(params: URLSearchParams): HackathonFilters {
  const filters: HackathonFilters = {};

  const country = params.get("country");
  if (country) filters.country = country;

  const mode = csv(params.get("mode"));
  if (mode) filters.mode = mode as HackathonMode[];

  const experienceTier = csv(params.get("experienceTier"));
  if (experienceTier) filters.experienceTier = experienceTier as ExperienceTier[];

  const eligibility = csv(params.get("eligibility"));
  if (eligibility) filters.eligibility = eligibility as EligibilityAudience[];

  const minPrizePoolUsd = params.get("minPrizePoolUsd");
  if (minPrizePoolUsd) filters.minPrizePoolUsd = Number(minPrizePoolUsd);

  const technologies = csv(params.get("technologies"));
  if (technologies) filters.technologies = technologies;

  const themes = csv(params.get("themes"));
  if (themes) filters.themes = themes;

  const registrationDeadlineBefore = params.get("registrationDeadlineBefore");
  if (registrationDeadlineBefore) filters.registrationDeadlineBefore = registrationDeadlineBefore;

  const submissionDeadlineBefore = params.get("submissionDeadlineBefore");
  if (submissionDeadlineBefore) filters.submissionDeadlineBefore = submissionDeadlineBefore;

  return filters;
}

export function parseSort(params: URLSearchParams): HackathonSort {
  const raw = params.get("sort");
  return raw && (VALID_SORTS as string[]).includes(raw) ? (raw as HackathonSort) : "deadline_asc";
}

export function parseLimit(params: URLSearchParams, fallback = 20, max = 100): number {
  const raw = Number(params.get("limit"));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(raw, max);
}
