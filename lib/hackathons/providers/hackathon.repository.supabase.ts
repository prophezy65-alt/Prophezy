/**
 * lib/hackathons/providers/hackathon.repository.supabase.ts
 *
 * Real Supabase-backed implementation of HackathonRepository
 * (services/hackathon.service.ts). Backed by public.hackathons
 * (0037_hackathon_engine.sql, promoted from this module's own proposed
 * migration). jsonb columns (organizer/timeline/prizes) round-trip as
 * plain objects through supabase-js with no manual (de)serialization.
 */

import type { HackathonRepository } from "../services/hackathon.service";
import type { Hackathon, HackathonId } from "../models/hackathon.model";

export interface MinimalSupabaseClient {
  from(table: string): any;
}

interface HackathonRow {
  id: string;
  source_id: string;
  source_url: string;
  title: string;
  description: string;
  organizer: Hackathon["organizer"];
  mode: Hackathon["mode"];
  location: string | null;
  country: string | null;
  themes: string[];
  technologies: string[];
  eligibility: string[];
  experience_tier: string[];
  timeline: Hackathon["timeline"];
  prizes: Hackathon["prizes"];
  rules_summary: string | null;
  evaluation_criteria: string[] | null;
  submission_requirements: string[] | null;
  team_size_min: number | null;
  team_size_max: number | null;
  fetched_at: string;
  raw_source_hash: string;
}

function rowToHackathon(row: HackathonRow): Hackathon {
  return {
    id: row.id,
    sourceId: row.source_id as Hackathon["sourceId"],
    sourceUrl: row.source_url,
    title: row.title,
    description: row.description,
    organizer: row.organizer,
    mode: row.mode,
    location: row.location ?? undefined,
    country: row.country ?? undefined,
    themes: row.themes ?? [],
    technologies: row.technologies ?? [],
    eligibility: (row.eligibility ?? []) as Hackathon["eligibility"],
    experienceTier: (row.experience_tier ?? []) as Hackathon["experienceTier"],
    timeline: row.timeline,
    prizes: row.prizes,
    rulesSummary: row.rules_summary ?? undefined,
    evaluationCriteria: row.evaluation_criteria ?? undefined,
    submissionRequirements: row.submission_requirements ?? undefined,
    teamSizeMin: row.team_size_min ?? undefined,
    teamSizeMax: row.team_size_max ?? undefined,
    fetchedAt: row.fetched_at,
    rawSourceHash: row.raw_source_hash,
  };
}

function hackathonToRow(h: Hackathon): Record<string, unknown> {
  return {
    id: h.id,
    source_id: h.sourceId,
    source_url: h.sourceUrl,
    title: h.title,
    description: h.description,
    organizer: h.organizer,
    mode: h.mode,
    location: h.location ?? null,
    country: h.country ?? null,
    themes: h.themes,
    technologies: h.technologies,
    eligibility: h.eligibility,
    experience_tier: h.experienceTier,
    timeline: h.timeline,
    prizes: h.prizes,
    rules_summary: h.rulesSummary ?? null,
    evaluation_criteria: h.evaluationCriteria ?? null,
    submission_requirements: h.submissionRequirements ?? null,
    team_size_min: h.teamSizeMin ?? null,
    team_size_max: h.teamSizeMax ?? null,
    fetched_at: h.fetchedAt,
    raw_source_hash: h.rawSourceHash,
  };
}

export class SupabaseHackathonRepository implements HackathonRepository {
  constructor(private readonly client: MinimalSupabaseClient) {}

  async upsert(hackathon: Hackathon): Promise<Hackathon> {
    const { data, error } = await this.client
      .from("hackathons")
      .upsert(hackathonToRow(hackathon), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(`SupabaseHackathonRepository.upsert failed: ${error.message}`);
    return rowToHackathon(data as HackathonRow);
  }

  async upsertMany(hackathons: Hackathon[]): Promise<Hackathon[]> {
    if (hackathons.length === 0) return [];
    const { data, error } = await this.client
      .from("hackathons")
      .upsert(hackathons.map(hackathonToRow), { onConflict: "id" })
      .select("*");
    if (error) throw new Error(`SupabaseHackathonRepository.upsertMany failed: ${error.message}`);
    return (data as HackathonRow[]).map(rowToHackathon);
  }

  async getById(id: HackathonId): Promise<Hackathon | null> {
    const { data, error } = await this.client.from("hackathons").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`SupabaseHackathonRepository.getById failed: ${error.message}`);
    return data ? rowToHackathon(data as HackathonRow) : null;
  }

  /**
   * hackathon.service.ts's list()/search's SearchService/ranking.service.ts
   * all filter/sort/paginate IN MEMORY over the full result of listAll() —
   * that's this module's own existing design (not something introduced
   * here), so listAll() intentionally fetches every row rather than
   * pushing filters down to SQL. Fine at the catalog sizes a hackathon
   * aggregator realistically has (low thousands of rows); revisit if that
   * changes.
   */
  async listAll(): Promise<Hackathon[]> {
    const { data, error } = await this.client.from("hackathons").select("*");
    if (error) throw new Error(`SupabaseHackathonRepository.listAll failed: ${error.message}`);
    return (data as HackathonRow[]).map(rowToHackathon);
  }

  async deleteById(id: HackathonId): Promise<void> {
    const { error } = await this.client.from("hackathons").delete().eq("id", id);
    if (error) throw new Error(`SupabaseHackathonRepository.deleteById failed: ${error.message}`);
  }
}
