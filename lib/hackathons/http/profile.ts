/**
 * lib/hackathons/http/profile.ts
 *
 * Builds a HackathonUserProfile (needed by RankingService/
 * RecommendationService) from the real, existing `profiles` table.
 * Intentionally thin: profiles has no skills/preferred-themes/preferred-
 * technologies columns, so those come back empty rather than guessed —
 * ranking-engine.ts's scoring degrades gracefully on empty preference
 * arrays (neutral score), it doesn't error. A deeper integration pulling
 * skills from Resume Studio's parsed resume data would improve match
 * quality but is a separate, larger piece of work than "make Hackathons
 * functional" — flagged here rather than faked with invented skills.
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import type { HackathonUserProfile, ExperienceTier } from "../models/hackathon.model";

function inferExperienceTier(semester: number | null): ExperienceTier {
  if (semester === null) return "intermediate";
  if (semester <= 2) return "beginner";
  if (semester <= 6) return "intermediate";
  return "advanced";
}

export async function buildHackathonUserProfile(userId: string): Promise<HackathonUserProfile> {
  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("semester").eq("id", userId).maybeSingle();

  return {
    userId,
    skills: [],
    experienceTier: inferExperienceTier(profile?.semester ?? null),
    preferredThemes: [],
    preferredTechnologies: [],
    preferredCountries: [],
  };
}
