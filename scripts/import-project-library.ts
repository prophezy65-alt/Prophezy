/**
 * scripts/import-project-library.ts
 *
 * Validates and upserts project records into public.project_library.
 * This script is the ONLY way rows get into project_library — there is no
 * AI generation path. It never calls Gemini or any LLM.
 *
 * Usage:
 *   npx tsx scripts/import-project-library.ts data/projects/*.json
 *   npx tsx scripts/import-project-library.ts --dry-run data/projects/batch-01.json
 *
 * Input format: one or more JSON files, each an array of ProjectRecord
 * objects (see the interface below). Records are validated, deduplicated
 * by external_id, and upserted (insert if new, update if changed).
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 * — the service role key is required because inserts/updates are
 * intentionally blocked for anon/authenticated roles by RLS (see the
 * migration). Never expose the service role key to the browser.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { globSync } from "glob";

interface ProjectRecord {
  external_id: string;
  source: string;
  source_url?: string;
  title: string;
  domain: string;
  subdomain?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  description: string;
  problem_statement?: string;
  solution_overview?: string;
  tech_stack?: string[];
  skills?: string[];
  architecture?: string;
  modules?: string[];
  how_it_is_built?: string;
  development_steps?: string[];
  prerequisites?: string[];
  expected_output?: string;
  github_url?: string;
  demo_url?: string;
  documentation_url?: string;
  tutorial_url?: string;
  dataset_info?: string;
  api_info?: string;
  estimated_hours_min?: number;
  estimated_hours_max?: number;
  team_size_min?: number;
  team_size_max?: number;
}

interface ValidationIssue {
  externalId: string;
  reason: string;
}

const GITHUB_URL_RE = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/;
const HTTPS_URL_RE = /^https:\/\/[^\s]+$/;

function validateRecord(r: unknown, index: number): { record: ProjectRecord | null; issue: ValidationIssue | null } {
  const rec = r as Partial<ProjectRecord>;
  const idForError = typeof rec?.external_id === "string" ? rec.external_id : `#${index}`;

  if (!rec || typeof rec !== "object") {
    return { record: null, issue: { externalId: idForError, reason: "not an object" } };
  }
  if (!rec.external_id || typeof rec.external_id !== "string") {
    return { record: null, issue: { externalId: idForError, reason: "missing external_id" } };
  }
  if (!rec.title || typeof rec.title !== "string") {
    return { record: null, issue: { externalId: idForError, reason: "missing title" } };
  }
  if (!rec.domain || typeof rec.domain !== "string") {
    return { record: null, issue: { externalId: idForError, reason: "missing domain" } };
  }
  if (!rec.description || typeof rec.description !== "string") {
    return { record: null, issue: { externalId: idForError, reason: "missing description" } };
  }
  if (!rec.source || typeof rec.source !== "string") {
    return { record: null, issue: { externalId: idForError, reason: "missing source" } };
  }
  // A GitHub URL, if present, must actually look like a real repo URL —
  // this is the guard against invented/placeholder links.
  if (rec.github_url && !GITHUB_URL_RE.test(rec.github_url)) {
    return { record: null, issue: { externalId: idForError, reason: `github_url is not a valid repo URL: ${rec.github_url}` } };
  }
  for (const [field, value] of [
    ["demo_url", rec.demo_url],
    ["documentation_url", rec.documentation_url],
    ["tutorial_url", rec.tutorial_url],
    ["source_url", rec.source_url],
  ] as const) {
    if (value && !HTTPS_URL_RE.test(value)) {
      return { record: null, issue: { externalId: idForError, reason: `${field} is not a valid https URL: ${value}` } };
    }
  }
  if (rec.difficulty && !["beginner", "intermediate", "advanced"].includes(rec.difficulty)) {
    return { record: null, issue: { externalId: idForError, reason: `invalid difficulty: ${rec.difficulty}` } };
  }

  return {
    record: {
      external_id: rec.external_id,
      source: rec.source,
      source_url: rec.source_url,
      title: rec.title,
      domain: rec.domain,
      subdomain: rec.subdomain,
      difficulty: rec.difficulty ?? "intermediate",
      description: rec.description,
      problem_statement: rec.problem_statement,
      solution_overview: rec.solution_overview,
      tech_stack: rec.tech_stack ?? [],
      skills: rec.skills ?? [],
      architecture: rec.architecture,
      modules: rec.modules ?? [],
      how_it_is_built: rec.how_it_is_built,
      development_steps: rec.development_steps ?? [],
      prerequisites: rec.prerequisites ?? [],
      expected_output: rec.expected_output,
      github_url: rec.github_url,
      demo_url: rec.demo_url,
      documentation_url: rec.documentation_url,
      tutorial_url: rec.tutorial_url,
      dataset_info: rec.dataset_info,
      api_info: rec.api_info,
      estimated_hours_min: rec.estimated_hours_min,
      estimated_hours_max: rec.estimated_hours_max,
      team_size_min: rec.team_size_min,
      team_size_max: rec.team_size_max,
    },
    issue: null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const patterns = args.filter((a) => a !== "--dry-run");

  if (patterns.length === 0) {
    console.error("Usage: import-project-library.ts [--dry-run] <file-or-glob> [...more]");
    process.exit(1);
  }

  const files = patterns.flatMap((p) => globSync(p));
  if (files.length === 0) {
    console.error("No input files matched:", patterns.join(", "));
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or pass --dry-run to validate only).");
    process.exit(1);
  }

  const rawRecords: unknown[] = [];
  for (const file of files) {
    const content = JSON.parse(readFileSync(file, "utf-8"));
    if (!Array.isArray(content)) {
      console.error(`Skipping ${file}: expected a JSON array of project records.`);
      continue;
    }
    rawRecords.push(...content);
  }

  console.log(`Loaded ${rawRecords.length} raw record(s) from ${files.length} file(s).`);

  // Validate + dedupe by external_id (last one in the input wins, so a
  // later batch file can intentionally correct an earlier one).
  const byExternalId = new Map<string, ProjectRecord>();
  const issues: ValidationIssue[] = [];
  rawRecords.forEach((r, i) => {
    const { record, issue } = validateRecord(r, i);
    if (issue) {
      issues.push(issue);
      return;
    }
    if (record) byExternalId.set(record.external_id, record);
  });

  const validRecords = Array.from(byExternalId.values());
  console.log(`Valid after validation + in-batch dedupe: ${validRecords.length}`);
  console.log(`Rejected: ${issues.length}`);
  if (issues.length > 0) {
    console.log("Rejected records:");
    for (const issue of issues) console.log(`  - ${issue.externalId}: ${issue.reason}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no database writes performed.");
    return;
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  // Look up which external_ids already exist so we can report
  // inserted vs. updated counts honestly (upsert alone can't tell us).
  const existingIds = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < validRecords.length; i += CHUNK) {
    const chunk = validRecords.slice(i, i + CHUNK).map((r) => r.external_id);
    const { data, error } = await supabase.from("project_library").select("external_id").in("external_id", chunk);
    if (error) throw new Error(`Lookup failed: ${error.message}`);
    for (const row of data ?? []) existingIds.add(row.external_id);
  }

  let inserted = 0;
  let updated = 0;
  const failures: { externalId: string; error: string }[] = [];

  for (let i = 0; i < validRecords.length; i += CHUNK) {
    const chunk = validRecords.slice(i, i + CHUNK);
    const { error } = await supabase.from("project_library").upsert(chunk, { onConflict: "external_id" });
    if (error) {
      for (const r of chunk) failures.push({ externalId: r.external_id, error: error.message });
      continue;
    }
    for (const r of chunk) {
      if (existingIds.has(r.external_id)) updated++;
      else inserted++;
    }
  }

  console.log("\n--- Import report ---");
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated:  ${updated}`);
  console.log(`Rejected (failed validation): ${issues.length}`);
  console.log(`Failed to write: ${failures.length}`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f.externalId}: ${f.error}`);
  }
  console.log(`Total real projects now targeted by this run: ${inserted + updated}`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
