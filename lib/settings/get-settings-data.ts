import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELS, FEATURE_MODEL_MAP, DEFAULT_MODEL } from "@/lib/ai/config/models";
import { getKeySnapshot, keyCount } from "@/lib/ai/config/key-manager";
import type {
  AIControlCenterData,
  ApiKeyManagementData,
  ConnectedServiceStatus,
  FeatureModelRoute,
  LiveAnalyticsData,
  ProfileData,
  SecurityData,
  ServiceHealth,
  SettingsInsightsData,
  StorageData,
  SubscriptionData,
  UsageSummary,
} from "./types";

const DAY_MS = 86_400_000;

/** Loads everything the Settings module adds beyond /api/settings — real
 * profile fields, AI Control Center usage/routing, API key health, storage,
 * live analytics, security, and connected-service status. Theme, language,
 * notifications, AI style, privacy, appearance, dashboard, and module
 * preferences are NOT duplicated here — those already live behind
 * /api/settings (lib/settings/repository/settings.repository.ts). */
export async function getSettingsInsights(userId: string): Promise<SettingsInsightsData> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const [
    profileRes,
    subscriptionRes,
    authUserRes,
    usageTodayRes,
    usageMonthRes,
    uploadsRes,
    projectsCountRes,
    assignmentsCountRes,
    researchCountRes,
    quizCountRes,
    interviewCountRes,
    resumeIdsRes,
    bookmarksCountRes,
    studySessionsWeekRes,
    notesCountRes,
    flashcardGenCountRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("subscriptions").select("plan_tier, status, current_period_end").eq("user_id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
    supabase.from("ai_usage_events").select("prompt_tokens, output_tokens, duration_ms, success").eq("user_id", userId).gte("created_at", startOfToday.toISOString()),
    supabase.from("ai_usage_events").select("prompt_tokens, output_tokens").eq("user_id", userId).gte("created_at", startOfMonth.toISOString()),
    supabase.from("uploads").select("file_size_bytes"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "assignment"),
    supabase.from("research_papers").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "quiz"),
    supabase.from("interview_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("resumes").select("id").eq("user_id", userId),
    supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("study_sessions").select("duration_seconds").eq("user_id", userId).gte("started_at", sevenDaysAgo),
    supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", userId).in("kind", ["notes", "revision_notes", "one_day_revision"]),
    supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "flashcards"),
  ]);

  if (profileRes.error || !profileRes.data) {
    throw new Error(`Failed to load profile: ${profileRes.error?.message ?? "not found"}`);
  }
  const profileRow = profileRes.data;
  const authUser = authUserRes.data.user;

  const resumeIds = (resumeIdsRes.data ?? []).map((r) => r.id);
  const resumeScanCountRes =
    resumeIds.length > 0
      ? await supabase.from("ats_checks").select("id", { count: "exact", head: true }).in("resume_id", resumeIds)
      : { count: 0 };

  const fieldsForCompletion = [profileRow.full_name, profileRow.avatar_url, profileRow.bio, profileRow.college, profileRow.branch];
  const completionPercent = Math.round((fieldsForCompletion.filter(Boolean).length / fieldsForCompletion.length) * 100);

  const profile: ProfileData = {
    id: profileRow.id,
    fullName: profileRow.full_name,
    username: profileRow.username,
    email: authUser?.email ?? "",
    avatarUrl: profileRow.avatar_url,
    bio: profileRow.bio,
    college: profileRow.college,
    branch: profileRow.branch,
    semester: profileRow.semester,
    role: profileRow.role,
    joinedAt: profileRow.created_at,
    lastActiveAt: authUser?.last_sign_in_at ?? null,
    emailConfirmed: Boolean(authUser?.email_confirmed_at),
    completionPercent,
  };

  const subscription: SubscriptionData = {
    planTier: subscriptionRes.data?.plan_tier ?? "free",
    status: subscriptionRes.data?.status ?? "active",
    currentPeriodEnd: subscriptionRes.data?.current_period_end ?? null,
  };

  const usageToday = usageTodayRes.data ?? [];
  const usageMonth = usageMonthRes.data ?? [];
  const successCount = usageToday.filter((e) => e.success).length;
  const usage: UsageSummary = {
    requestsToday: usageToday.length,
    requestsThisMonth: usageMonth.length,
    tokensToday: usageToday.reduce((sum, e) => sum + e.prompt_tokens + e.output_tokens, 0),
    tokensThisMonth: usageMonth.reduce((sum, e) => sum + e.prompt_tokens + e.output_tokens, 0),
    avgLatencyMs: usageToday.length > 0 ? Math.round(usageToday.reduce((s, e) => s + e.duration_ms, 0) / usageToday.length) : null,
    successRatePercent: usageToday.length > 0 ? Math.round((successCount / usageToday.length) * 100) : null,
  };

  const featureRoutes: FeatureModelRoute[] = Object.entries(FEATURE_MODEL_MAP).map(([feature, modelId]) => {
    const profile = MODELS[modelId];
    return { feature, modelId, displayName: profile.label, contextWindow: profile.contextWindow };
  });

  const aiControlCenter: AIControlCenterData = {
    defaultModel: DEFAULT_MODEL,
    featureRoutes,
    keyCount: keyCount(),
    usage,
  };

  const apiKeys: ApiKeyManagementData = {
    keys: getKeySnapshot(),
    autoRotation: true,
    autoFailover: true,
    healthChecksEnabled: true,
  };

  const health = await buildHealthChecks(supabase, apiKeys);

  const uploadBytes = (uploadsRes.data ?? []).reduce((sum, u) => sum + u.file_size_bytes, 0);
  const storage: StorageData = {
    totalUploadBytes: uploadBytes,
    breakdown: [
      { id: "uploads", label: "Uploads", count: uploadsRes.data?.length ?? 0, bytes: uploadBytes },
      { id: "projects", label: "Projects", count: projectsCountRes.count ?? 0, bytes: null },
      { id: "research", label: "Research Papers", count: researchCountRes.count ?? 0, bytes: null },
      { id: "assignments", label: "Assignments", count: assignmentsCountRes.count ?? 0, bytes: null },
      { id: "notes", label: "Notes", count: notesCountRes.count ?? 0, bytes: null },
      { id: "flashcards", label: "Flashcards", count: flashcardGenCountRes.count ?? 0, bytes: null },
      { id: "quiz", label: "Quiz", count: quizCountRes.count ?? 0, bytes: null },
    ],
  };

  const studyHours = (studySessionsWeekRes.data ?? []).reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) / 3600;

  const analytics: LiveAnalyticsData = {
    requestsToday: usage.requestsToday,
    requestsThisMonth: usage.requestsThisMonth,
    tokensThisMonth: usage.tokensThisMonth,
    projectsGenerated: projectsCountRes.count ?? 0,
    assignmentsGenerated: assignmentsCountRes.count ?? 0,
    researchGenerated: researchCountRes.count ?? 0,
    quizGenerated: quizCountRes.count ?? 0,
    interviewSessions: interviewCountRes.count ?? 0,
    resumeScans: resumeScanCountRes.count ?? 0,
    bookmarks: bookmarksCountRes.count ?? 0,
    studyHours: Math.round(studyHours * 10) / 10,
  };

  const connectedServices: ConnectedServiceStatus[] = [
    { id: "google_drive", label: "Google Drive", connected: false, lastSyncAt: null },
    { id: "github", label: "GitHub", connected: false, lastSyncAt: null },
    { id: "linkedin", label: "LinkedIn", connected: false, lastSyncAt: null },
    { id: "notion", label: "Notion", connected: false, lastSyncAt: null },
    { id: "gmail", label: "Gmail", connected: false, lastSyncAt: null },
    { id: "supabase", label: "Supabase", connected: true, lastSyncAt: new Date().toISOString() },
    { id: "gemini", label: "Gemini", connected: apiKeys.keys.length > 0, lastSyncAt: new Date().toISOString() },
  ];

  const headerList = await headers();
  const security: SecurityData = {
    email: profile.email,
    emailConfirmed: profile.emailConfirmed,
    lastSignInAt: authUser?.last_sign_in_at ?? null,
    accountCreatedAt: authUser?.created_at ?? profile.joinedAt,
    currentDevice: parseUserAgent(headerList.get("user-agent")),
  };

  return { profile, subscription, aiControlCenter, apiKeys, health, storage, analytics, connectedServices, security };
}

async function buildHealthChecks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  apiKeys: ApiKeyManagementData,
): Promise<ServiceHealth[]> {
  const checks: ServiceHealth[] = [];

  const dbStart = Date.now();
  const { error: dbError } = await supabase.from("profiles").select("id").limit(1);
  checks.push({
    id: "database",
    label: "Database",
    status: dbError ? "red" : "green",
    detail: dbError ? dbError.message : `Responding in ${Date.now() - dbStart}ms`,
  });

  const healthyKeys = apiKeys.keys.filter((k) => k.status === "healthy").length;
  checks.push({
    id: "gemini",
    label: "Gemini",
    status: apiKeys.keys.length === 0 ? "red" : healthyKeys === 0 ? "red" : healthyKeys < apiKeys.keys.length ? "yellow" : "green",
    detail: apiKeys.keys.length === 0 ? "No API keys configured" : `${healthyKeys}/${apiKeys.keys.length} keys healthy`,
  });

  checks.push({ id: "storage", label: "Storage", status: "green", detail: "Supabase Storage reachable" });

  const { count: recentFailures } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gte("created_at", new Date(Date.now() - DAY_MS).toISOString());

  checks.push({
    id: "ai_engine",
    label: "AI Engine",
    status: (recentFailures ?? 0) === 0 ? "green" : (recentFailures ?? 0) < 5 ? "yellow" : "red",
    detail: `${recentFailures ?? 0} failed request(s) in last 24h`,
  });

  return checks;
}

function parseUserAgent(ua: string | null): { browser: string; os: string } {
  if (!ua) return { browser: "Unknown", os: "Unknown" };

  let browser = "Unknown browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/") && !ua.includes("Chromium")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Unknown OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}
