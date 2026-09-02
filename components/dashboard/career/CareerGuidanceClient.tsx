"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Send, Loader2, CheckCircle2, Circle, History, MessageSquarePlus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Shared fetch helpers
// ---------------------------------------------------------------------------

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json: ApiEnvelope<T> = await res.json();
  if (!res.ok || !json.ok || json.data === undefined) {
    throw new Error(json.error?.message ?? "Something went wrong.");
  }
  return json.data;
}

const getJSON = <T,>(url: string) => apiRequest<T>(url);
const postJSON = <T,>(url: string, body: unknown) =>
  apiRequest<T>(url, { method: "POST", body: JSON.stringify(body) });
const patchJSON = <T,>(url: string, body: unknown) =>
  apiRequest<T>(url, { method: "PATCH", body: JSON.stringify(body) });
const deleteJSON = <T,>(url: string) => apiRequest<T>(url, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Domain types (mirroring lib/career/models/career.model.ts response shapes)
// ---------------------------------------------------------------------------

interface CareerAnalytics {
  skillScore: number;
  readinessScore: number;
  careerScore: number;
  resumeStrength: number;
  learningProgressPercent: number;
  roleMatchPercent: Record<string, number>;
}

interface RoadmapMilestone {
  id: string;
  title: string;
  description: string;
  estimatedWeeks: number;
  skillsCovered: string[];
  order: number;
}

interface LearningRoadmap {
  id: string;
  targetRole: string;
  milestones: RoadmapMilestone[];
  totalEstimatedWeeks: number;
}

interface SavedRoadmap {
  id: string;
  targetRole: string;
  roadmap: LearningRoadmap;
  totalEstimatedWeeks: number;
  progress: Record<string, { completed: boolean }>;
  createdAt: string;
}

interface SkillGapItem {
  skill: string;
  currentProficiency: string;
  requiredProficiency: string;
  priority: "high" | "medium" | "low";
  reason: string;
}

interface SkillGapAnalysis {
  targetRole: string;
  matchedSkills: string[];
  gaps: SkillGapItem[];
  overallReadinessPercent: number;
}

interface Recommendation {
  type: string;
  title: string;
  rationale: string;
  confidenceScore: number;
  actionItems: string[];
}

interface SalaryEstimate {
  role: string;
  country: string;
  currency: string;
  low: number;
  median: number;
  high: number;
  commentary?: string;
}

interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const RECOMMENDATION_KINDS = ["career_path", "company", "course", "certification", "project"] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ROLE_STORAGE_KEY = "prophezy.career.selectedRole";

export default function CareerGuidanceClient() {
  const [targetRole, setTargetRole] = useState("");
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [track, setTrack] = useState<"internship" | "fulltime">("fulltime");

  // Restore the last-selected role/track on mount — without this, every
  // page reload resets activeRole to null, and the roadmap/skill-gap/salary
  // sections fall back to showing everything instead of staying scoped.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROLE_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { role?: string; track?: "internship" | "fulltime" };
      if (parsed.role) {
        setTargetRole(parsed.role);
        setActiveRole(parsed.role);
      }
      if (parsed.track) setTrack(parsed.track);
    } catch {
      // Corrupt/old localStorage value — ignore and start fresh.
    }
  }, []);

  const setRole = (role: string, nextTrack: "internship" | "fulltime") => {
    setActiveRole(role);
    setTrack(nextTrack);
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify({ role, track: nextTrack }));
    } catch {
      // Storage unavailable (private browsing, etc.) — role still works for this session.
    }
  };

  // Every AI-driven section takes the role as free text, so folding the
  // track into the label itself is enough to shift roadmap/skill-gap/salary
  // toward internship-level expectations vs. full-time ones — no backend
  // changes needed.
  const effectiveRole = activeRole
    ? track === "internship" && !/intern/i.test(activeRole)
      ? `${activeRole} Intern`
      : activeRole
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
            <Compass size={22} /> Career Guidance
          </h1>
          <p className="mt-1 text-sm text-mist">
            A roadmap, skill gap analysis, and recommendations built from your Resume, Interview, and Quiz activity.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Target role</CardTitle>
            <CardDescription>Every section below is scoped to this role and track.</CardDescription>
          </div>
        </CardHeader>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (targetRole.trim()) setRole(targetRole.trim(), track);
          }}
        >
          <div className="min-w-[220px] flex-1">
            <Input
              placeholder="e.g. Backend Engineer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
          </div>
          <div className="flex overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setTrack("internship")}
              className={`px-3 py-2 text-xs ${track === "internship" ? "bg-signal/15 text-signal" : "text-mist"}`}
            >
              Internship
            </button>
            <button
              type="button"
              onClick={() => setTrack("fulltime")}
              className={`px-3 py-2 text-xs ${track === "fulltime" ? "bg-signal/15 text-signal" : "text-mist"}`}
            >
              Full-time
            </button>
          </div>
          <Button type="submit" disabled={!targetRole.trim()}>
            Set role
          </Button>
        </form>
      </Card>

      <AnalyticsSection key={`analytics-${effectiveRole ?? "none"}`} targetRole={effectiveRole} />
      <SkillGapSection key={`skills-${effectiveRole ?? "none"}`} targetRole={effectiveRole} />
      <RoadmapSection key={`roadmap-${effectiveRole ?? "none"}`} targetRole={effectiveRole} />
      <RecommendationsSection key={`recs-${effectiveRole ?? "none"}`} />
      <SalarySection key={`salary-${effectiveRole ?? "none"}`} targetRole={effectiveRole} />
      <AdvisorSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

function AnalyticsSection({ targetRole }: { targetRole: string | null }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["career", "analytics", targetRole],
    queryFn: () =>
      getJSON<CareerAnalytics>(
        `/api/career/analytics${targetRole ? `?targetRole=${encodeURIComponent(targetRole)}` : ""}`
      ),
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Career analytics</CardTitle>
          <CardDescription>Skill score, readiness, and composite career score.</CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 size={14} className="animate-spin" /> : "Refresh"}
        </Button>
      </CardHeader>

      {isLoading && <SectionSkeleton />}
      {isError && <ErrorNote message={(error as Error).message} />}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Skill score" value={data.skillScore} />
          <Metric label="Readiness" value={data.readinessScore} />
          <Metric label="Career score" value={data.careerScore} />
          <Metric label="Resume strength" value={data.resumeStrength} />
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/30 p-4 text-center">
      <div className="font-display text-2xl font-semibold text-ink">{Math.round(value)}</div>
      <div className="mt-1 text-xs text-mist">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill gap
// ---------------------------------------------------------------------------

function SkillGapSection({ targetRole }: { targetRole: string | null }) {
  const query = useQuery({
    queryKey: ["career", "skills", targetRole],
    queryFn: () =>
      getJSON<{ report: SkillGapAnalysis | null }>(`/api/career/skills?targetRole=${encodeURIComponent(targetRole!)}`),
    enabled: !!targetRole,
  });

  const mutation = useMutation({
    mutationFn: (role: string) => postJSON<{ report: SkillGapAnalysis }>("/api/career/skills", { targetRole: role }),
  });

  const report = mutation.data?.report ?? query.data?.report ?? null;
  const isLoading = query.isLoading || mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Skill gap analysis</CardTitle>
          <CardDescription>What you have vs. what the role needs.</CardDescription>
        </div>
        <Button
          size="sm"
          disabled={!targetRole || mutation.isPending}
          onClick={() => targetRole && mutation.mutate(targetRole)}
        >
          {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : report ? "Re-analyze" : "Analyze"}
        </Button>
      </CardHeader>

      {!targetRole && <EmptyNote text="Set a target role above to run an analysis." />}
      {mutation.isError && <ErrorNote message={(mutation.error as Error).message} />}
      {isLoading && !report && <SectionSkeleton />}
      {!isLoading && targetRole && !report && (
        <EmptyNote text="No analysis yet for this role — click Analyze to run one." />
      )}
      {report && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-mist">
            Overall readiness: <Badge tone="signal">{report.overallReadinessPercent}%</Badge>
          </div>
          {report.matchedSkills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.matchedSkills.map((skill) => (
                <Badge key={skill} tone="success">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
          {report.gaps.length === 0 && report.matchedSkills.length === 0 ? (
            <CardDescription>
              No profile data to compare yet — upload a resume, take a quiz, or run a mock interview so this
              analysis has something real to work from.
            </CardDescription>
          ) : report.gaps.length === 0 ? (
            <CardDescription>No gaps found — you match this role well.</CardDescription>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.gaps.map((gap) => (
                <li key={gap.skill} className="rounded-xl border border-border bg-surface/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{gap.skill}</span>
                    <Badge tone={gap.priority === "high" ? "pulse" : "neutral"}>{gap.priority}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-mist">{gap.reason}</p>
                </li>
              ))}
            </ul>
          )}

        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Roadmap + progress tracking
// ---------------------------------------------------------------------------

function RoadmapSection({ targetRole }: { targetRole: string | null }) {
  const queryClient = useQueryClient();
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);

  const roadmapsQuery = useQuery({
    queryKey: ["career", "roadmaps"],
    queryFn: () => getJSON<{ roadmaps: SavedRoadmap[] }>("/api/career/roadmap"),
  });

  const generateMutation = useMutation({
    mutationFn: (role: string) => postJSON<{ roadmap: SavedRoadmap }>("/api/career/roadmap", { targetRole: role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["career", "roadmaps"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJSON<{ deleted: boolean }>(`/api/career/roadmap/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["career", "roadmaps"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, milestoneId, completed }: { id: string; milestoneId: string; completed: boolean }) =>
      patchJSON<{ roadmap: SavedRoadmap }>(`/api/career/roadmap/${id}/progress`, { milestoneId, completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["career", "roadmaps"] }),
  });

  const roadmaps = (roadmapsQuery.data?.roadmaps ?? []).filter((r) => !targetRole || r.targetRole === targetRole);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Learning roadmap</CardTitle>
          <CardDescription>Generated milestones with progress tracking.</CardDescription>
        </div>
        <Button
          size="sm"
          disabled={!targetRole || generateMutation.isPending}
          onClick={() => targetRole && generateMutation.mutate(targetRole)}
        >
          {generateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Generate roadmap"}
        </Button>
      </CardHeader>

      {!targetRole && roadmaps.length === 0 && (
        <EmptyNote text="Set a target role above, then generate a roadmap." />
      )}
      {generateMutation.isError && <ErrorNote message={(generateMutation.error as Error).message} />}
      {roadmapsQuery.isLoading && <SectionSkeleton />}
      {roadmapsQuery.isError && <ErrorNote message={(roadmapsQuery.error as Error).message} />}

      {roadmaps.length === 0 && !roadmapsQuery.isLoading ? (
        targetRole && <CardDescription>No roadmaps yet for this role.</CardDescription>
      ) : (
        <div className="flex flex-col gap-4">
          {roadmaps.map((saved) => {
            const completedCount = Object.values(saved.progress).filter((p) => p.completed).length;
            const totalMilestones = saved.roadmap.milestones.length;
            const progressPercent = totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : 0;
            return (
              <div key={saved.id} className="rounded-xl border border-border bg-surface/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-ink">{saved.targetRole}</div>
                    <div className="text-xs text-mist">
                      {completedCount}/{totalMilestones} milestones · {saved.totalEstimatedWeeks} weeks
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-signal transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(saved.id)}>
                    Delete
                  </Button>
                </div>
                <ol className="mt-3 flex flex-col gap-1">
                  {saved.roadmap.milestones
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((milestone) => {
                      const completed = saved.progress[milestone.id]?.completed ?? false;
                      const isExpanded = expandedMilestone === milestone.id;
                      return (
                        <li key={milestone.id} className="rounded-lg text-sm">
                          <div className="flex items-start gap-2 py-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                toggleMutation.mutate({ id: saved.id, milestoneId: milestone.id, completed: !completed })
                              }
                              className="mt-0.5 shrink-0 text-signal"
                              aria-label={completed ? "Mark incomplete" : "Mark complete"}
                            >
                              {completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                            </button>
                            <button
                              type="button"
                              className="flex-1 text-left"
                              onClick={() => setExpandedMilestone(isExpanded ? null : milestone.id)}
                            >
                              <div className={completed ? "text-mist line-through" : "text-ink"}>
                                {milestone.title} <span className="text-xs text-mist">({milestone.estimatedWeeks}w)</span>
                              </div>
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="ml-6 mb-2 flex flex-col gap-2 rounded-lg bg-ink/5 p-3">
                              <p className="text-xs text-mist">{milestone.description}</p>
                              {milestone.skillsCovered.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {milestone.skillsCovered.map((skill) => (
                                    <Badge key={skill} tone="neutral">
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function RecommendationsSection() {
  const [kind, setKind] = useState<(typeof RECOMMENDATION_KINDS)[number]>("career_path");
  const mutation = useMutation({
    mutationFn: (k: string) => postJSON<{ recommendations: Recommendation[] }>("/api/career/recommendations", { kind: k }),
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>AI-generated, ranked suggestions.</CardDescription>
        </div>
      </CardHeader>

      <div className="mb-3 flex flex-wrap gap-2">
        {RECOMMENDATION_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-3 py-1 text-xs ${
              kind === k ? "bg-signal/15 text-signal" : "bg-ink/5 text-mist"
            }`}
          >
            {k.replace("_", " ")}
          </button>
        ))}
        <Button size="sm" onClick={() => mutation.mutate(kind)} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Get recommendations"}
        </Button>
      </div>

      {mutation.isError && <ErrorNote message={(mutation.error as Error).message} />}
      {mutation.isPending && <SectionSkeleton />}
      {mutation.data && (
        <div className="flex flex-col gap-2">
          {mutation.data.recommendations.length === 0 ? (
            <CardDescription>No recommendations returned — try a different category.</CardDescription>
          ) : (
            mutation.data.recommendations.map((rec, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{rec.title}</span>
                  <Badge tone="signal">{Math.round(rec.confidenceScore)}%</Badge>
                </div>
                <p className="mt-1 text-xs text-mist">{rec.rationale}</p>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Salary insights
// ---------------------------------------------------------------------------

const SUPPORTED_COUNTRIES = [
  "Australia",
  "Bangladesh",
  "Brazil",
  "Canada",
  "China",
  "France",
  "Germany",
  "Hong Kong",
  "India",
  "Indonesia",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Kenya",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Pakistan",
  "Philippines",
  "Poland",
  "Saudi Arabia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "UAE",
  "UK",
  "United States",
  "Vietnam",
].sort((a, b) => a.localeCompare(b));

const KNOWN_COMPANIES = [
  "No specific company",
  "Google",
  "Microsoft",
  "Amazon",
  "Meta",
  "Apple",
  "Netflix",
  "TCS",
  "Infosys",
  "Wipro",
  "Accenture",
  "Startup",
  "Early-stage startup",
];

function SalarySection({ targetRole }: { targetRole: string | null }) {
  const [country, setCountry] = useState("United States");
  const [company, setCompany] = useState("No specific company");
  const [experienceLevel, setExperienceLevel] = useState("fresher");

  const mutation = useMutation({
    mutationFn: () =>
      postJSON<SalaryEstimate>("/api/career/salary", {
        role: targetRole,
        country,
        experienceLevel,
        company: company === "No specific company" ? undefined : company,
      }),
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Salary insights</CardTitle>
          <CardDescription>Deterministic range with plain-language commentary, in the local currency.</CardDescription>
        </div>
      </CardHeader>

      <div className="flex flex-wrap gap-3">
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-11 rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink"
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="h-11 rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink"
        >
          {KNOWN_COMPANIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={experienceLevel}
          onChange={(e) => setExperienceLevel(e.target.value)}
          className="h-11 rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink"
        >
          {["student", "fresher", "junior", "mid", "senior", "lead"].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <Button disabled={!targetRole || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Estimate"}
        </Button>
      </div>

      {!targetRole && <EmptyNote text="Set a target role above to estimate salary." />}
      {mutation.isError && <ErrorNote message={(mutation.error as Error).message} />}
      {mutation.data && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-surface/30 p-3 text-center">
              <div className="text-xs text-mist">On the lower end</div>
              <div className="mt-1 text-base font-medium text-ink">
                {mutation.data.currency} {mutation.data.low.toLocaleString()}
              </div>
              <div className="text-xs text-mist">/ year</div>
            </div>
            <div className="rounded-xl border border-signal/30 bg-signal/10 p-3 text-center">
              <div className="text-xs text-signal">Typical (median)</div>
              <div className="mt-1 text-base font-medium text-ink">
                {mutation.data.currency} {mutation.data.median.toLocaleString()}
              </div>
              <div className="text-xs text-mist">/ year</div>
            </div>
            <div className="rounded-xl border border-border bg-surface/30 p-3 text-center">
              <div className="text-xs text-mist">On the higher end</div>
              <div className="mt-1 text-base font-medium text-ink">
                {mutation.data.currency} {mutation.data.high.toLocaleString()}
              </div>
              <div className="text-xs text-mist">/ year</div>
            </div>
          </div>
          <div className="text-sm text-mist">
            That's about{" "}
            <span className="font-medium text-ink">
              {mutation.data.currency} {Math.round(mutation.data.median / 12).toLocaleString()}
            </span>{" "}
            per month at the typical rate (
            {mutation.data.currency} {Math.round(mutation.data.low / 12).toLocaleString()}–
            {Math.round(mutation.data.high / 12).toLocaleString()} per month across the full range).
          </div>
          {mutation.data.commentary && <p className="text-sm text-mist">{mutation.data.commentary}</p>}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AI advisor chat
// ---------------------------------------------------------------------------

interface AdvisorSessionSummary {
  id: string;
  title: string;
  last_message_at: string;
}

function AdvisorSection() {
  const [question, setQuestion] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessions, setSessions] = useState<AdvisorSessionSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadSessionList = async () => {
    try {
      const { sessions: list } = await getJSON<{ sessions: AdvisorSessionSummary[] }>("/api/career/advisor");
      setSessions(list ?? []);
      return list ?? [];
    } catch {
      return [];
    }
  };

  const loadSession = async (id: string) => {
    const { messages: history } = await getJSON<{ messages: AdvisorMessage[] }>(
      `/api/career/advisor?sessionId=${encodeURIComponent(id)}`
    );
    setSessionId(id);
    setMessages(history);
    setShowHistory(false);
  };

  const deleteSession = async (id: string) => {
    await apiRequest(`/api/career/advisor?sessionId=${encodeURIComponent(id)}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === sessionId) {
      setSessionId(null);
      setMessages([]);
    }
  };

  // Load the most recent advisor session (if any) on mount, so refreshing
  // the page doesn't lose a conversation that's already saved server-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadSessionList();
      const latest = list[0];
      if (!latest || cancelled) {
        if (!cancelled) setHistoryLoaded(true);
        return;
      }
      try {
        const { messages: history } = await getJSON<{ messages: AdvisorMessage[] }>(
          `/api/career/advisor?sessionId=${encodeURIComponent(latest.id)}`
        );
        if (cancelled) return;
        setSessionId(latest.id);
        setMessages(history);
      } catch {
        // Fetch failed — starting a fresh session is a fine fallback.
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (q: string) => postJSON<{ sessionId: string; answer: string }>("/api/career/advisor", { sessionId, question: q }),
    onSuccess: (data, q) => {
      const isNewSession = sessionId !== data.sessionId;
      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: q, created_at: new Date().toISOString() },
        { id: `a-${Date.now()}`, role: "assistant", content: data.answer, created_at: new Date().toISOString() },
      ]);
      setQuestion("");
      if (isNewSession) loadSessionList();
    },
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>AI career advisor</CardTitle>
          <CardDescription>Ask anything grounded in your profile — resume, quizzes, interviews, projects.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await loadSessionList();
              setShowHistory((v) => !v);
            }}
          >
            <History size={14} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSessionId(null);
              setMessages([]);
              setShowHistory(false);
            }}
          >
            <MessageSquarePlus size={14} />
          </Button>
        </div>
      </CardHeader>

      {showHistory && (
        <div className="mb-3 flex flex-col gap-1 rounded-xl border border-border bg-surface/30 p-2">
          {sessions.length === 0 ? (
            <CardDescription>No saved conversations yet.</CardDescription>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  s.id === sessionId ? "bg-signal/15" : "hover:bg-ink/5"
                }`}
              >
                <button type="button" onClick={() => loadSession(s.id)} className="min-w-0 flex-1 text-left">
                  <div className={`truncate ${s.id === sessionId ? "text-signal" : "text-ink"}`}>
                    {s.title || "Untitled conversation"}
                  </div>
                  <div className="text-xs text-mist">{new Date(s.last_message_at).toLocaleString()}</div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSession(s.id)}
                  className="shrink-0 rounded-lg p-1.5 text-mist hover:text-red-400"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
        {historyLoaded && messages.length === 0 && !mutation.isPending && (
          <EmptyNote text="Ask your first question below." />
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === "user" ? "self-end bg-signal/15 text-ink" : "self-start bg-ink/5 text-ink"
            }`}
          >
            {m.content}
          </div>
        ))}
        {mutation.isPending && <SectionSkeleton />}
      </div>

      {mutation.isError && <ErrorNote message={(mutation.error as Error).message} />}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim() && !mutation.isPending) mutation.mutate(question.trim());
        }}
      >
        <Input
          placeholder="e.g. What should I focus on next month?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={!question.trim() || mutation.isPending}>
          <Send size={16} />
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionSkeleton() {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-mist">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return <p className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{message}</p>;
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-sm text-mist">{text}</p>;
}
