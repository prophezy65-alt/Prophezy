import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProphecyRing } from "@/components/ui/prophecy-ring";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Data loading — every value below comes from a real Supabase query. No
// hardcoded numbers. Where a feature genuinely has no data yet (e.g. a user
// with no resumes), we render the same kind of honest empty-state copy the
// original file already used ("Not scored yet"), not a fake number.
// ---------------------------------------------------------------------------

type ActivityItem = {
  kind: "generation" | "interview" | "project" | "research" | "resume";
  title: string;
  timestamp: string;
  href?: string;
};

async function getStreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const [{ data: gens }, { data: interviews }] = await Promise.all([
    supabase
      .from("generations")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("interview_sessions")
      .select("started_at")
      .eq("user_id", userId)
      .gte("started_at", since.toISOString()),
  ]);

  const activeDates = new Set<string>();
  for (const g of gens ?? []) activeDates.add(g.created_at.slice(0, 10));
  for (const iv of interviews ?? []) activeDates.add(iv.started_at.slice(0, 10));

  let streak = 0;
  const cursor = new Date();
  // Count consecutive days with activity, walking backwards from today.
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function getResumeStats(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
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

  return { score: latestAts?.score ?? null, title: latestResume.title };
}

async function getInterviewStats(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: snapshot } = await supabase
    .from("interview_analytics_snapshots")
    .select("average_score, total_attempts")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    averageScore: snapshot?.average_score ?? null,
    totalAttempts: snapshot?.total_attempts ?? 0,
  };
}

async function getCardsDueCount(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
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

async function getResearchCount(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { count } = await supabase
    .from("research_papers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

async function getAssignmentsCount(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { count } = await supabase
    .from("assignments")
    .select("id, generations!inner(user_id)", { count: "exact", head: true })
    .eq("generations.user_id", userId);
  return count ?? 0;
}

async function getProjectStats(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: projects } = await supabase
    .from("projects")
    .select("status")
    .eq("user_id", userId);

  const byStatus: Record<string, number> = {
    idea: 0,
    in_progress: 0,
    completed: 0,
    archived: 0,
  };
  for (const p of projects ?? []) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  }
  return { total: projects?.length ?? 0, byStatus };
}

async function getWeeklyActivity(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const { data: gens } = await supabase
    .from("generations")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = (gens ?? []).filter((g: { created_at: string }) => g.created_at.slice(0, 10) === key).length;
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), count });
  }
  return days;
}

async function getRecentActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<ActivityItem[]> {
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

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);
}

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user!.id;

  const [
    { data: profile },
    { data: subscription },
    streak,
    resumeStats,
    interviewStats,
    cardsDue,
    researchCount,
    assignmentsCount,
    projectStats,
    weeklyActivity,
    recentActivity,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).single(),
    supabase.from("subscriptions").select("plan_tier, status").eq("user_id", userId).single(),
    getStreak(supabase, userId),
    getResumeStats(supabase, userId),
    getInterviewStats(supabase, userId),
    getCardsDueCount(supabase, userId),
    getResearchCount(supabase, userId),
    getAssignmentsCount(supabase, userId),
    getProjectStats(supabase, userId),
    getWeeklyActivity(supabase, userId),
    getRecentActivity(supabase, userId),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const maxWeeklyCount = Math.max(1, ...weeklyActivity.map((d) => d.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-mist">Here&apos;s where things stand today.</p>
        </div>
        <Badge tone={subscription?.plan_tier === "pro" ? "pulse" : "neutral"}>
          {subscription?.plan_tier === "pro" ? "Pro plan" : "Free plan"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col items-center gap-3">
          <ProphecyRing
            value={streak}
            label="Streak"
            sublabel={streak === 1 ? "1 day" : `${streak} days`}
            tone="pulse"
            size={104}
          />
          <CardDescription className="text-center">
            {streak > 0
              ? "Keep it going — do something today to extend it."
              : "Start a study session to begin your streak."}
          </CardDescription>
        </Card>

        <Card className="flex flex-col items-center gap-3">
          <ProphecyRing
            value={resumeStats.score ?? 0}
            label="Resume"
            sublabel={resumeStats.score !== null ? `${resumeStats.score}/100 ATS` : "Not scored yet"}
            tone="signal"
            size={104}
          />
          <CardDescription className="text-center">
            {resumeStats.score !== null
              ? `Latest scan on "${resumeStats.title}".`
              : "Build a resume to get your ATS score."}
          </CardDescription>
        </Card>

        <Card className="flex flex-col items-center gap-3">
          <ProphecyRing
            value={interviewStats.averageScore ? interviewStats.averageScore * 10 : 0}
            label="Viva"
            sublabel={
              interviewStats.totalAttempts > 0
                ? `${interviewStats.totalAttempts} session${interviewStats.totalAttempts === 1 ? "" : "s"}`
                : "No sessions"
            }
            tone="success"
            size={104}
          />
          <CardDescription className="text-center">
            {interviewStats.averageScore !== null
              ? `Average score ${interviewStats.averageScore}/10.`
              : "Practice with Viva Coach to build confidence."}
          </CardDescription>
        </Card>

        <Card className="flex flex-col items-center gap-3">
          <ProphecyRing
            value={cardsDue}
            label="Cards due"
            sublabel={cardsDue > 0 ? `${cardsDue} to review` : "Nothing yet"}
            tone="signal"
            size={104}
          />
          <CardDescription className="text-center">
            {cardsDue > 0
              ? "Clear your queue to keep your recall sharp."
              : "Upload material to generate your first flashcards."}
          </CardDescription>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Research</CardTitle>
              <CardDescription>Papers you&apos;ve saved or summarized.</CardDescription>
            </div>
          </CardHeader>
          <p className="font-display text-3xl font-semibold text-ink">{researchCount}</p>
          <p className="text-sm text-mist">
            {researchCount > 0 ? "paper(s) in your Research Hub." : "No papers saved yet."}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Assignments</CardTitle>
              <CardDescription>Generated free-response assignments.</CardDescription>
            </div>
          </CardHeader>
          <p className="font-display text-3xl font-semibold text-ink">{assignmentsCount}</p>
          <p className="text-sm text-mist">
            {assignmentsCount > 0 ? "assignment(s) generated." : "No assignments generated yet."}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Projects</CardTitle>
              <CardDescription>By status.</CardDescription>
            </div>
          </CardHeader>
          {projectStats.total > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-ink">
              <li className="flex justify-between">
                <span className="text-mist">Idea</span>
                <span>{projectStats.byStatus.idea}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-mist">In progress</span>
                <span>{projectStats.byStatus.in_progress}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-mist">Completed</span>
                <span>{projectStats.byStatus.completed}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-mist">Archived</span>
                <span>{projectStats.byStatus.archived}</span>
              </li>
            </ul>
          ) : (
            <p className="text-sm text-mist">No projects yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>This week&apos;s activity</CardTitle>
            <CardDescription>AI generations per day, last 7 days.</CardDescription>
          </div>
        </CardHeader>
        <div className="flex items-end gap-3 pt-2" style={{ height: 96 }}>
          {weeklyActivity.map((day) => (
            <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-signal/70"
                style={{ height: `${Math.max(4, (day.count / maxWeeklyCount) * 72)}px` }}
                title={`${day.count} on ${day.label}`}
              />
              <span className="text-xs text-mist">{day.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest across every module.</CardDescription>
          </div>
        </CardHeader>
        {recentActivity.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {recentActivity.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{item.title}</span>
                <span className="shrink-0 text-xs text-mist">
                  {new Date(item.timestamp).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-mist">
            Nothing yet — generate notes, run a mock interview, or start a project to see activity here.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>System, generation, and internship alerts.</CardDescription>
          </div>
        </CardHeader>
        <p className="text-sm text-mist">
          Notifications aren&apos;t wired up yet — the <code>notification_type</code> enum exists, but no{" "}
          <code>notifications</code> table was found in the current schema. This section will populate once
          that table lands.
        </p>
      </Card>
    </div>
  );
}
