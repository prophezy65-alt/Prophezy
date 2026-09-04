"use client";

/**
 * Browser-safe API client for the Internship Discovery Engine.
 *
 * IMPORTANT: this file must never import from `@/lib/internships/*` at
 * runtime (only `import type` is safe) — the engine's repositories use a
 * service-role Supabase client that must never reach a client bundle.
 * Every function here just calls the existing `/api/internships/*` routes,
 * which already handle auth + the service-role client server-side.
 */
import type {
  InternshipRecord,
  Page,
  SearchRequest,
  MatchResult,
  ApplicationStatus,
  ApplicationRecord,
  ApplicationDocumentRef,
  NotificationRecord,
} from "@/lib/internships/types";
// Type-only import — erased at compile time, so pulling these two shapes
// from the engine barrel is safe even though the barrel also has server code.
import type { TrackedApplication, RecommendationBundle } from "@/lib/internships";
// Type-only import of the unlock result shape. Same rule as above: never
// import this module for its runtime value (it pulls in credit spending
// and a service-role repository) — only the type is safe in a client bundle.
import type { UnlockApplicationResult } from "@/lib/internships/services/application-unlock.service";

export type { TrackedApplication, RecommendationBundle };

export interface InternshipDetail {
  internship: InternshipRecord;
  match: MatchResult | null;
  similar: InternshipRecord[];
}

/** allowance/remaining are null when the plan has no cap (Premium today) —
 * always render that as "Unlimited", never as 0 or a placeholder number. */
export interface UnlockStatus {
  allowance: number | null;
  remaining: number | null;
}

/** One entry in the durable "everything this user has unlocked" list —
 * see GET /api/internships/unlocked and the internship_unlocks table. */
export interface UnlockedInternshipEntry {
  internship: InternshipRecord;
  applyUrl: string;
}

export class InternshipApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "InternshipApiError";
    this.code = code;
    this.status = status;
  }
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new InternshipApiError("The server sent back something unexpected.", "BAD_RESPONSE", res.status);
  }

  if (!res.ok || !body.ok) {
    throw new InternshipApiError(
      body.error?.message ?? "Something went wrong.",
      body.error?.code ?? "UNKNOWN",
      res.status,
    );
  }

  return body.data as T;
}

function buildSearchParams(req: SearchRequest): string {
  const params = new URLSearchParams();
  if (req.q) params.set("q", req.q);
  if (req.mode) params.set("mode", req.mode);
  if (req.sort) params.set("sort", req.sort);
  if (req.limit) params.set("limit", String(req.limit));
  if (req.cursor) params.set("cursor", req.cursor);

  const f = req.filters;
  if (f) {
    if (f.country) params.set("country", f.country);
    if (f.state) params.set("state", f.state);
    if (f.city) params.set("city", f.city);
    if (f.company?.length) params.set("company", f.company.join(","));
    if (f.role) params.set("role", f.role);
    if (f.workMode?.length) params.set("workMode", f.workMode.join(","));
    // THE FIX: this was never here before. filters.employmentType was being
    // set correctly by OpportunitiesView's Internships/Jobs toggle, but with
    // no line here to put it into the query string, it silently never left
    // the browser — the server received no employmentType param at all, so
    // it had nothing to filter by, which is why "Jobs" kept showing
    // internship-badged cards regardless of any server-side fix.
    if (f.employmentType?.length) params.set("employmentType", f.employmentType.join(","));
    if (f.paid !== undefined) params.set("paid", String(f.paid));
    if (f.minStipendInr !== undefined) params.set("minStipend", String(f.minStipendInr));
    if (f.maxStipendInr !== undefined) params.set("maxStipend", String(f.maxStipendInr));
    if (f.skills?.length) params.set("skills", f.skills.join(","));
    if (f.cgpa !== undefined) params.set("cgpa", String(f.cgpa));
    if (f.year !== undefined) params.set("year", String(f.year));
    if (f.degree) params.set("degree", f.degree);
    if (f.branch) params.set("branch", f.branch);
    if (f.minDurationMonths !== undefined) params.set("minDuration", String(f.minDurationMonths));
    if (f.maxDurationMonths !== undefined) params.set("maxDuration", String(f.maxDurationMonths));
    if (f.providers?.length) params.set("providers", f.providers.join(","));
    if (f.postedAfter) params.set("postedAfter", f.postedAfter);
    if (f.deadlineBefore) params.set("deadlineBefore", f.deadlineBefore);
    if (f.activeOnly !== undefined) params.set("activeOnly", String(f.activeOnly));
  }
  return params.toString();
}

export const internshipsApi = {
  search(req: SearchRequest): Promise<Page<InternshipRecord>> {
    return request<Page<InternshipRecord>>(`/api/internships/search?${buildSearchParams(req)}`);
  },

  getById(id: string): Promise<InternshipDetail> {
    return request<InternshipDetail>(`/api/internships/${id}`);
  },

  listSaved(): Promise<InternshipRecord[]> {
    return request<InternshipRecord[]>(`/api/internships/saved`);
  },

  listRecentlyViewed(limit = 30): Promise<InternshipRecord[]> {
    return request<InternshipRecord[]>(`/api/internships/recently-viewed?limit=${limit}`);
  },

  save(internshipId: string): Promise<ApplicationRecord> {
    return request<ApplicationRecord>(`/api/internships/saved`, {
      method: "POST",
      body: JSON.stringify({ internshipId }),
    });
  },

  unsave(internshipId: string): Promise<{ removed: string }> {
    return request<{ removed: string }>(
      `/api/internships/saved?internshipId=${encodeURIComponent(internshipId)}`,
      { method: "DELETE" },
    );
  },

  // Phase 5: this is the ONLY call that returns a real applyUrl (see
  // POST /api/internships/[id]/unlock) — GET /search and GET /:id both
  // strip it now. "Apply Now" must call this first, every time; there is
  // no longer a cached/local applyUrl anywhere on the client to fall back to.
  unlockApplication(internshipId: string): Promise<UnlockApplicationResult> {
    return request<UnlockApplicationResult>(`/api/internships/${internshipId}/unlock`, {
      method: "POST",
    });
  },

  // Read-only check of the plan's unlock allowance/remaining — lets the UI
  // show/disable state before a click, instead of only learning the limit
  // was hit from a 403 after attempting an unlock.
  getUnlockStatus(): Promise<UnlockStatus> {
    return request<UnlockStatus>(`/api/internships/unlocks`);
  },

  // Full, durable list of every internship this user has unlocked, with
  // its real applyUrl — never resets on reload (see internship_unlocks
  // table), unlike the in-memory per-card cache from unlockApplication().
  listUnlocked(): Promise<UnlockedInternshipEntry[]> {
    return request<UnlockedInternshipEntry[]>(`/api/internships/unlocked`);
  },

  listApplications(
    status?: ApplicationStatus,
  ): Promise<{ items: TrackedApplication[]; funnel: Record<ApplicationStatus, number> }> {
    const qs = status ? `?status=${status}` : "";
    return request(`/api/internships/applications${qs}`);
  },

  transitionApplication(
    internshipId: string,
    status: ApplicationStatus,
    patch?: {
      notes?: string;
      interviewAt?: string;
      deadlineAt?: string;
      documents?: ApplicationDocumentRef[];
    },
  ): Promise<{ application: ApplicationRecord; transition: { from: ApplicationStatus | null; to: ApplicationStatus; at: string } }> {
    return request(`/api/internships/applications`, {
      method: "PATCH",
      body: JSON.stringify({ internshipId, status, ...patch }),
    });
  },

  recommendations(limit = 20, force = false): Promise<RecommendationBundle[]> {
    return request<RecommendationBundle[]>(
      `/api/internships/recommendations?limit=${limit}&force=${force}`,
    );
  },

  listNotifications(unreadOnly = false, limit = 50): Promise<NotificationRecord[]> {
    return request<NotificationRecord[]>(
      `/api/internships/notifications?unread=${unreadOnly}&limit=${limit}`,
    );
  },

  markNotificationsRead(ids?: string[]): Promise<{ marked: number | "all" }> {
    return request<{ marked: number | "all" }>(`/api/internships/notifications`, {
      method: "POST",
      body: JSON.stringify(ids ? { ids } : {}),
    });
  },
};