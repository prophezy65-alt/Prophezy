"use client";

/**
 * client/api.ts — shared fetch wrapper for Resume Studio's client components.
 *
 * Two things this exists to guarantee, regardless of what's wrong on the
 * server side at any given moment:
 *   1. A request NEVER hangs the UI indefinitely — every call is bounded by
 *      REQUEST_TIMEOUT_MS and rejects with a clear message if exceeded.
 *   2. A non-JSON error response (e.g. an HTML error page from an uncaught
 *      exception) doesn't throw an opaque "Unexpected token <" — it's
 *      turned into a readable message instead.
 */

const REQUEST_TIMEOUT_MS = 20_000;

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

function formatErrorDetails(details: unknown): string {
  if (!Array.isArray(details)) return "";
  const parts = details
    .filter((d): d is { path?: string; message?: string } => typeof d === "object" && d !== null)
    .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
    .filter(Boolean);
  return parts.length ? ` (${parts.join("; ")})` : "";
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers:
        init?.body instanceof FormData
          ? init.headers
          : { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Request to ${url} timed out after ${REQUEST_TIMEOUT_MS / 1000}s. The server may be stuck — check the dev server terminal for a hung request or a silent crash.`
      );
    }
    throw err instanceof Error ? err : new Error("Network request failed.");
  } finally {
    clearTimeout(timeout);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Expected JSON from ${url} but got "${contentType || "unknown"}" (HTTP ${res.status}). ` +
        (text ? `Response started with: ${text.slice(0, 200)}` : "Empty response.")
    );
  }

  const json: ApiEnvelope<T> = await res.json();
  if (!res.ok || !json.ok) {
    const base = json.error?.message ?? `Request failed (HTTP ${res.status}).`;
    throw new Error(base + formatErrorDetails(json.error?.details));
  }
  return json.data as T;
}
