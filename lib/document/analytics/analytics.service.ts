/**
 * lib/document/analytics/analytics.service.ts
 * Logs processing events to `document_analytics` (see migration) and
 * computes aggregate stats — how long parsing/OCR/extraction/embedding
 * takes, failure rates by format, etc. This is the observability layer the
 * spec's OBSERVABILITY section asks for (structured logging + performance
 * metrics + processing statistics + failure reports + health checks).
 */

import type { Json } from "@/lib/supabase/types";
import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { DocumentError } from "../errors/document-errors";

export type ProcessingEvent =
  | "upload_received"
  | "validation_passed"
  | "validation_failed"
  | "parsing_started"
  | "parsing_completed"
  | "parsing_failed"
  | "ocr_started"
  | "ocr_completed"
  | "ocr_failed"
  | "extraction_completed"
  | "chunking_completed"
  | "embedding_completed"
  | "indexing_completed"
  | "processing_completed"
  | "processing_failed";

export interface LogEventInput {
  documentId: string;
  event: ProcessingEvent;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export const analyticsService = {
  async logEvent(input: LogEventInput): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("document_analytics").insert({
      document_id: input.documentId,
      event: input.event,
      duration_ms: input.durationMs ?? null,
      metadata: (input.metadata ?? {}) as unknown as Json,
    });

    if (error) {
      // Analytics failures should never break the actual processing
      // pipeline — log to console and move on rather than throwing.
      // eslint-disable-next-line no-console
      console.error("analytics.service.ts: failed to log event", input.event, error.message);
    }
  },

  async getProcessingStats(userId: string): Promise<{
    totalDocuments: number;
    completedCount: number;
    failedCount: number;
    averageProcessingMs: number;
    failuresByFormat: Record<string, number>;
  }> {
    const supabase = await getSupabaseServerClient();

    const { data: docs, error } = await supabase
      .from("documents")
      .select("id, format, status")
      .eq("user_id", userId);

    if (error) throw new DocumentError("Failed to fetch processing stats.", "ANALYTICS_ERROR", { cause: error.message });

    const documents = (docs as { id: string; format: string; status: string }[]) ?? [];
    const completedCount = documents.filter((d) => d.status === "completed").length;
    const failedCount = documents.filter((d) => d.status === "failed").length;

    const failuresByFormat: Record<string, number> = {};
    for (const d of documents.filter((doc) => doc.status === "failed")) {
      failuresByFormat[d.format] = (failuresByFormat[d.format] ?? 0) + 1;
    }

    const { data: completedEvents, error: eventsError } = await supabase
      .from("document_analytics")
      .select("duration_ms")
      .eq("event", "processing_completed")
      .in("document_id", documents.map((d) => d.id));

    if (eventsError) throw new DocumentError("Failed to fetch processing durations.", "ANALYTICS_ERROR", { cause: eventsError.message });

    const durations = ((completedEvents as { duration_ms: number | null }[]) ?? [])
      .map((e) => e.duration_ms)
      .filter((d): d is number => d !== null);

    const averageProcessingMs =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    return {
      totalDocuments: documents.length,
      completedCount,
      failedCount,
      averageProcessingMs,
      failuresByFormat,
    };
  },

  /** Lightweight health check — verifies the DB connection + a recent success within the last hour, for a /health route. */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, unknown> }> {
    try {
      const supabase = await getSupabaseServerClient();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from("document_analytics")
        .select("*", { count: "exact", head: true })
        .eq("event", "processing_completed")
        .gte("created_at", oneHourAgo);

      if (error) return { healthy: false, details: { error: error.message } };

      return { healthy: true, details: { recentSuccessCount: count ?? 0 } };
    } catch (err) {
      return { healthy: false, details: { error: err instanceof Error ? err.message : String(err) } };
    }
  },
};
