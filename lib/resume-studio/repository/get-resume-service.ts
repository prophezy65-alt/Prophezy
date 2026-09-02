import { createClient } from "@/lib/supabase/server";
import { ResumeService } from "../services/resume.service";
import { createSupabaseResumeRepository } from "./supabase-resume.repository";

/** Builds a request-scoped ResumeService backed by the real Supabase tables,
 *  using the cookie-authenticated server client (so RLS enforces per-user
 *  access — every call here still requires the caller to check auth
 *  themselves, this only wires the DB layer). */
export async function getResumeService(): Promise<ResumeService> {
  const supabase = await createClient();
  const repo = createSupabaseResumeRepository(supabase);
  return new ResumeService(repo);
}
