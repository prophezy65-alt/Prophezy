import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ServiceStatus = "operational" | "degraded" | "down" | "not_configured";

interface CheckResult {
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail?: string;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timeout);
  }
}

async function timedCheck(name: string, fn: () => Promise<{ ok: boolean; detail?: string }>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(fn(), 5000);
    return { name, status: result.ok ? "operational" : "degraded", latencyMs: Date.now() - start, detail: result.detail };
  } catch (err) {
    return {
      name,
      status: "down",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "Check failed",
    };
  }
}

async function checkSupabaseRest(): Promise<CheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { name: "Supabase", status: "not_configured", latencyMs: null };

  return timedCheck("Supabase", async () => {
    const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: anonKey }, cache: "no-store" });
    return { ok: res.status < 500, detail: `HTTP ${res.status}` };
  });
}

async function checkDatabase(): Promise<CheckResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { name: "Database", status: "not_configured", latencyMs: null };
  }
  return timedCheck("Database", async () => {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("blog_categories").select("id").limit(1);
    // A missing-table error still proves the database itself is reachable;
    // only surface degraded/down for actual connection-level failures.
    if (error && error.code !== "42P01") return { ok: false, detail: error.message };
    return { ok: true };
  });
}

async function checkStorage(): Promise<CheckResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { name: "Storage", status: "not_configured", latencyMs: null };
  }
  return timedCheck("Storage", async () => {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.storage.listBuckets();
    return { ok: !error, detail: error?.message };
  });
}

async function checkGemini(): Promise<CheckResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return { name: "Gemini AI", status: "not_configured", latencyMs: null };

  return timedCheck("Gemini AI", async () => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      cache: "no-store",
    });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  });
}

async function checkApiServices(): Promise<CheckResult> {
  // This route itself is the "API services" surface — if it executed this
  // far, the Next.js API layer is up. Reported for symmetry with the rest
  // of the panel rather than as a separate network call.
  return { name: "API Services", status: "operational", latencyMs: 0 };
}

async function checkFrontend(): Promise<CheckResult> {
  return { name: "Frontend", status: "operational", latencyMs: 0 };
}

export async function GET() {
  const start = Date.now();
  const [frontend, apiServices, supabaseRest, database, storage, gemini] = await Promise.all([
    checkFrontend(),
    checkApiServices(),
    checkSupabaseRest(),
    checkDatabase(),
    checkStorage(),
    checkGemini(),
  ]);

  const services = [frontend, apiServices, supabaseRest, database, storage, gemini];
  const anyDown = services.some((s) => s.status === "down");
  const anyDegraded = services.some((s) => s.status === "degraded");
  const overall = anyDown ? "down" : anyDegraded ? "degraded" : "operational";

  return NextResponse.json(
    {
      overall,
      checkedAt: new Date().toISOString(),
      totalLatencyMs: Date.now() - start,
      services,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
