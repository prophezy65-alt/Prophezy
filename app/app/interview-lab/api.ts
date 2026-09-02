/**
 * app/app/interview-lab/api.ts
 *
 * Typed fetch wrappers around the /api/interview routes. Every route returns
 * a { ok, data } | { ok, error } envelope; `request` unwraps it and throws
 * a plain Error(message) on failure so React Query surfaces it as an error.
 */
import type {
  AnalyticsSnapshot,
  CompanyContext,
  CompleteSessionResponse,
  CreateSessionResponse,
  ExportFormat,
  SessionDetail,
  SessionListItem,
  StartSessionForm,
  SubmitAnswerResponse,
} from "./types";

export type { ExportFormat };

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // Don't force a JSON content-type for FormData — the browser must set the
  // multipart boundary itself.
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };

  const res = await fetch(url, {
    ...init,
    headers: { ...baseHeaders, ...(init?.headers ?? {}) },
  });

  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    // fall through to status-based error below
  }

  if (!res.ok || !body?.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body.data as T;
}

export function listSessions(): Promise<SessionListItem[]> {
  return request<SessionListItem[]>("/api/interview/sessions");
}

export function getSessionDetail(id: string): Promise<SessionDetail> {
  return request<SessionDetail>(`/api/interview/sessions/${id}`);
}

export function getAnalytics(): Promise<AnalyticsSnapshot> {
  return request<AnalyticsSnapshot>("/api/interview/analytics");
}

export function createSessionFromDocument(
  form: StartSessionForm,
  file: File,
): Promise<CreateSessionResponse> {
  const body = new FormData();
  body.append("file", file);
  body.append("role", form.role.trim());
  body.append("interviewType", form.interviewType);
  body.append("seniority", form.seniority);
  body.append("questionCount", String(form.questionCount));

  return request<CreateSessionResponse>("/api/interview/sessions/from-document", {
    method: "POST",
    body,
  });
}

export function createSession(form: StartSessionForm): Promise<CreateSessionResponse> {
  const skills = form.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return request<CreateSessionResponse>("/api/interview/sessions", {
    method: "POST",
    body: JSON.stringify({
      role: form.role.trim(),
      interviewType: form.interviewType,
      seniority: form.seniority,
      company: form.company.trim() || undefined,
      jobDescription: form.jobDescription.trim() || undefined,
      skills: skills.length ? skills : undefined,
      questionCount: form.questionCount,
    }),
  });
}

export function submitAnswer(
  sessionId: string,
  questionId: string,
  answerText: string,
): Promise<SubmitAnswerResponse> {
  return request<SubmitAnswerResponse>(`/api/interview/sessions/${sessionId}/answers`, {
    method: "POST",
    body: JSON.stringify({ questionId, answerText }),
  });
}

export function completeSession(
  sessionId: string,
  status: "completed" | "abandoned",
): Promise<CompleteSessionResponse> {
  return request<CompleteSessionResponse>(`/api/interview/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteSession(sessionId: string): Promise<{ removed: string }> {
  return request<{ removed: string }>(`/api/interview/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function lookupCompany(company: string, role?: string): Promise<CompanyContext> {
  return request<CompanyContext>("/api/interview/company", {
    method: "POST",
    body: JSON.stringify({ company, role }),
  });
}

export function exportUrl(sessionId: string, format: ExportFormat): string {
  return `/api/interview/sessions/${sessionId}/export?format=${format}`;
}
