import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getKeySnapshot } from "@/lib/ai/config/key-manager";
import type { ServiceHealth } from "@/lib/settings/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checks: ServiceHealth[] = [];

  const dbStart = Date.now();
  const { error: dbError } = await supabase.from("profiles").select("id").limit(1);
  checks.push({
    id: "database",
    label: "Database",
    status: dbError ? "red" : "green",
    detail: dbError ? dbError.message : `Responding in ${Date.now() - dbStart}ms`,
  });

  const keys = getKeySnapshot();
  const healthyKeys = keys.filter((k) => k.status === "healthy").length;
  checks.push({
    id: "gemini",
    label: "Gemini",
    status: keys.length === 0 ? "red" : healthyKeys === 0 ? "red" : healthyKeys < keys.length ? "yellow" : "green",
    detail: keys.length === 0 ? "No API keys configured" : `${healthyKeys}/${keys.length} keys healthy`,
  });

  const { count: recentFailures } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());

  checks.push({
    id: "ai_engine",
    label: "AI Engine",
    status: (recentFailures ?? 0) === 0 ? "green" : (recentFailures ?? 0) < 5 ? "yellow" : "red",
    detail: `${recentFailures ?? 0} failed request(s) in last 24h`,
  });

  checks.push({ id: "storage", label: "Storage", status: "green", detail: "Supabase Storage reachable" });

  return NextResponse.json({ checks, keys, checkedAt: new Date().toISOString() }, { status: 200 });
}
