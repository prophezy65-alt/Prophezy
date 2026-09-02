/**
 * lib/dashboard/live-context.ts
 *
 * Server-only. Every function here reads real Supabase data — no mock
 * values, no placeholders. Factored out of app/app/page.tsx so RightPanel
 * and the chat assistant's system prompt can share the exact same signals
 * instead of each re-deriving them slightly differently.
 */
import type { createClient } from "@/lib/supabase/server";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ProjectStats {
  total: number;
  byStatus: { idea: number; in_progress: number; completed: number; archived: number };
}

export type ActivityKind = "generation" | "interview" | "project" | "research" | "resume";

export interface ActivityItem {
  kind: ActivityKind;
  title: string;
  timestamp: string;
}

export interface NextAction {
  message: string;
  href: string;
}

export interface LiveUserContext {
  fullName: string | null;
  streak: number;
  resumeStats: { score: number | null; title: string | null };
  interviewStats: { averageScore: number | null; totalAttempts: number };
  cardsDue: number;
  researchCount: number;
  assignmentsCount: number;
  projectStats: ProjectStats;
  weeklyActivity: { label: string; count: number }[];
  recentActivity: ActivityItem[];
  activeInterview: { id: string; role: string; interview_type: string } | null;
  nextAction: NextAction | null;
}

async function getProfile(supabase: SupabaseServerClient, userId: string) {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
  return data?.full_name ?? null;
}

async function getStreak(supabase: SupabaseServerClient, userId: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const [{ data: gens }, { data: interviews }] = await Promise.all([
    supabase.from("generations").select("created_at").eq("user_id", userId).gte("created_at", since.toISOString()),
    supabase
      .from("interview_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .gte("started_at", since.toISOString()),
  ]);

  const activeDates = new Set<string>();
  for (const g of (gens ?? []) as { created_at: string }[]) activeDates.add(g.created_at.slice(0, 10));
  for (const iv of (interviews ?? []) as { started_at: string }[]) activeDates.add(iv.started_at.slice(0, 10));

  let streak = 0;
  const cursor = new Date();
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function getResumeStats(supabase: SupabaseServerClient, userId: string) {
  const { data: latestResume } = await supabase
    .from("resumes")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestResume) return { score: null as number | null, title: null as string | null };

  const { data: latestAts } = await supabase
    .from("ats_checks")
    .select("score, created_at")
    .eq("resume_id", latestResume.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { score: latestAts?.score ?? null, title: latestResume.title as string };
}

async function getInterviewStats(supabase: SupabaseServerClient, userId: string) {
  const { data: snapshot } = await supabase
    .from("interview_analytics_snapshots")
    .select("average_score, total_attempts")
    .eq("user_id", userId)
    .maybeSingle();

  return { averageScore: snapshot?.average_score ?? null, totalAttempts: snapshot?.total_attempts ?? 0 };
}

async function getActiveInterviewSession(supabase: SupabaseServerClient, userId: string) {
  const { data } = await supabase
    .from("interview_sessions")
    .select("id, role, interview_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; role: string; interview_type: string } | null;
}

async function getCardsDueCount(supabase: SupabaseServerClient, userId: string) {
  const { count } = await supabase
    .from("flashcards")
    .select("id, flashcard_decks!inner(generation_id, generations!inner(user_id))", {
      count: "exact",
      head: true,
    })
    .eq("flashcard_decks.generations.user_id", userId)
    .lte("due_at", new Date().toISOString());
  return count ?? 0;
}

async function getResearchCount(supabase: SupabaseServerClient, userId: string) {
  const { count } = await supabase.from("research_papers").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

async function getAssignmentsCount(supabase: SupabaseServerClient, userId: string) {
  const { count } = await supabase
    .from("assignments")
    .select("id, generations!inner(user_id)", { count: "exact", head: true })
    .eq("generations.user_id", userId);
  return count ?? 0;
}

async function getProjectStats(supabase: SupabaseServerClient, userId: string): Promise<ProjectStats> {
  const { data: projects } = await supabase.from("projects").select("status").eq("user_id", userId);
  const byStatus: ProjectStats["byStatus"] = { idea: 0, in_progress: 0, completed: 0, archived: 0 };
  for (const p of (projects ?? []) as { status: keyof ProjectStats["byStatus"] }[]) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  }
  return { total: projects?.length ?? 0, byStatus };
}

async function getWeeklyActivity(supabase: SupabaseServerClient, userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const { data: gens } = await supabase
    .from("generations")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  const rows = (gens ?? []) as { created_at: string }[];
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = rows.filter((g) => g.created_at.slice(0, 10) === key).length;
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), count });
  }
  return days;
}

async function getRecentActivity(supabase: SupabaseServerClient, userId: string, limit = 6): Promise<ActivityItem[]> {
  const [{ data: gens }, { data: interviews }, { data: projects }, { data: papers }, { data: resumes }] =
    await Promise.all([
      supabase
        .from("generations")
        .select("id, kind, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("interview_sessions")
        .select("id, role, interview_type, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(5),
      supabase
        .from("projects")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("research_papers")
        .select("id, title, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("resumes")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);

  const items: ActivityItem[] = [
    ...(gens ?? []).map((g: { kind: string; title: string; created_at: string }) => ({
      kind: "generation" as const,
      title: `${g.kind.replace(/_/g, " ")} — ${g.title}`,
      timestamp: g.created_at,
    })),
    ...(interviews ?? []).map((iv: { interview_type: string; role: string; started_at: string }) => ({
      kind: "interview" as const,
      title: `${iv.interview_type} interview — ${iv.role}`,
      timestamp: iv.started_at,
    })),
    ...(projects ?? []).map((p: { title: string; created_at: string }) => ({
      kind: "project" as const,
      title: `Project: ${p.title}`,
      timestamp: p.created_at,
    })),
    ...(papers ?? []).map((r: { title: string; created_at: string }) => ({
      kind: "research" as const,
      title: `Research: ${r.title}`,
      timestamp: r.created_at,
    })),
    ...(resumes ?? []).map((r: { title: string; updated_at: string }) => ({
      kind: "resume" as const,
      title: `Resume updated: ${r.title}`,
      timestamp: r.updated_at,
    })),
  ];

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}

function computeNextAction(input: {
  activeInterview: { id: string; role: string; interview_type: string } | null;
  cardsDue: number;
  resumeScore: number | null;
  projectsInProgress: number;
}): NextAction | null {
  if (input.activeInterview) {
    return {
      message: `Continue your ${input.activeInterview.interview_type} interview for ${input.activeInterview.role}.`,
      href: "/app/interview-lab",
    };
  }
  if (input.cardsDue > 0) {
    return { message: `Review ${input.cardsDue} flashcard${input.cardsDue === 1 ? "" : "s"} due today.`, href: "/app/flashcards" };
  }
  if (input.resumeScore === null) {
    return { message: "Upload your resume to get an ATS score.", href: "/app/resume-studio" };
  }
  if (input.projectsInProgress > 0) {
    return { message: "Continue your in-progress project.", href: "/app/projects" };
  }
  return null;
}

export async function getLiveUserContext(supabase: SupabaseServerClient, userId: string): Promise<LiveUserContext> {
  const [
    fullName,
    streak,
    resumeStats,
    interviewStats,
    cardsDue,
    researchCount,
    assignmentsCount,
    projectStats,
    weeklyActivity,
    recentActivity,
    activeInterview,
  ] = await Promise.all([
    getProfile(supabase, userId),
    getStreak(supabase, userId),
    getResumeStats(supabase, userId),
    getInterviewStats(supabase, userId),
    getCardsDueCount(supabase, userId),
    getResearchCount(supabase, userId),
    getAssignmentsCount(supabase, userId),
    getProjectStats(supabase, userId),
    getWeeklyActivity(supabase, userId),
    getRecentActivity(supabase, userId),
    getActiveInterviewSession(supabase, userId),
  ]);

  const nextAction = computeNextAction({
    activeInterview,
    cardsDue,
    resumeScore: resumeStats.score,
    projectsInProgress: projectStats.byStatus.in_progress,
  });

  return {
    fullName,
    streak,
    resumeStats,
    interviewStats,
    cardsDue,
    researchCount,
    assignmentsCount,
    projectStats,
    weeklyActivity,
    recentActivity,
    activeInterview,
    nextAction,
  };
}

/** Compact plain-text summary for injecting into the assistant's system prompt. */
export function summarizeContextForAssistant(ctx: LiveUserContext): string {
  const lines = [
    ctx.fullName ? `Student name: ${ctx.fullName}.` : "",
    `Study streak: ${ctx.streak} day(s).`,
    ctx.resumeStats.score !== null
      ? `Latest resume "${ctx.resumeStats.title}" has an ATS score of ${ctx.resumeStats.score}/100.`
      : "No resume uploaded yet.",
    ctx.interviewStats.totalAttempts > 0
      ? `Completed ${ctx.interviewStats.totalAttempts} interview session(s), average score ${ctx.interviewStats.averageScore}/10.`
      : "No interview sessions completed yet.",
    ctx.activeInterview
      ? `Has an IN-PROGRESS ${ctx.activeInterview.interview_type} interview for "${ctx.activeInterview.role}".`
      : "",
    `${ctx.cardsDue} flashcard(s) due for review right now.`,
    `${ctx.researchCount} research paper(s) saved.`,
    `${ctx.assignmentsCount} assignment(s) generated.`,
    `${ctx.projectStats.total} project(s) total — ${ctx.projectStats.byStatus.in_progress} in progress, ${ctx.projectStats.byStatus.completed} completed.`,
    ctx.recentActivity.length > 0
      ? `Most recent activity: ${ctx.recentActivity
          .slice(0, 3)
          .map((a) => a.title)
          .join("; ")}.`
      : "No recent activity recorded.",
  ].filter(Boolean);
  return lines.join("\n");
}
