/**
 * prize-analyzer.ts
 * Deterministic analysis of a hackathon's prize structure: normalizes
 * pool size into a comparable score and flags notable prize types
 * (internship/job offers) that matter more than raw dollar amount for
 * students.
 */

import { PrizeStructure } from "../models/hackathon.model";

/**
 * 0-100 score for prize attractiveness. Uses a log scale so a $100k prize
 * pool doesn't make every other hackathon look worthless by comparison —
 * diminishing returns above a certain pool size are realistic (most
 * participants target top-3-5 placements regardless of total size).
 */
export function calculatePrizeScore(prizes: PrizeStructure): number {
  const pool = prizes.totalPoolUsd ?? 0;
  if (pool <= 0 && !prizes.hasInternshipOrJobOffers && !prizes.hasSwag) return 10;

  const logScore = pool > 0 ? Math.min(70, Math.log10(pool + 1) * 14) : 0;
  const offerBonus = prizes.hasInternshipOrJobOffers ? 20 : 0;
  const swagBonus = prizes.hasSwag ? 5 : 0;
  const cashBonus = prizes.hasCash ? 5 : 0;

  return Math.round(Math.min(100, logScore + offerBonus + swagBonus + cashBonus));
}

export function summarizePrizeStructure(prizes: PrizeStructure): string {
  const parts: string[] = [];

  if (prizes.totalPoolUsd) {
    parts.push(`${prizes.currency} ${prizes.totalPoolUsd.toLocaleString()} total prize pool`);
  }
  if (prizes.hasInternshipOrJobOffers) parts.push("internship/job opportunities");
  if (prizes.hasSwag) parts.push("swag");
  if (prizes.tiers.length) parts.push(`${prizes.tiers.length} prize categories`);

  return parts.length ? parts.join(" · ") : "Prize details not specified";
}
