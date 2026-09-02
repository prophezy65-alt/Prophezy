/**
 * lib/ai/utils/stream.ts
 *
 * Bridges lib/ai/config/client.ts's `streamGenerate` async generator to a
 * Next.js Route Handler `Response` the frontend can consume with
 * `EventSource` or a manual `fetch` + `ReadableStream` reader.
 *
 * Usage in an API route:
 *
 *   export async function POST(req: Request) {
 *     const { messages } = await req.json();
 *     return toSSEResponse(streamGenerate(messages, { requestId }));
 *   }
 */

import type { StreamChunk } from "../config/client";

export interface ProgressEvent {
  type: "progress" | "done" | "error";
  delta?: string;
  accumulated?: string;
  error?: string;
}

function encodeSSE(event: ProgressEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Wraps an async generator of StreamChunk into a text/event-stream Response.
 * Honors upstream abort (e.g. the client closing the connection / hitting
 * "stop generating") by tearing down the generator via `.return()`.
 */
export function toSSEResponse(
  source: AsyncGenerator<StreamChunk, void, unknown>,
  requestSignal?: AbortSignal
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const onAbort = () => {
        source.return?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      requestSignal?.addEventListener("abort", onAbort);

      try {
        for await (const chunk of source) {
          if (requestSignal?.aborted) break;

          controller.enqueue(
            encodeSSE({
              type: chunk.done ? "done" : "progress",
              delta: chunk.delta,
              accumulated: chunk.accumulated,
            })
          );
        }
      } catch (err) {
        controller.enqueue(
          encodeSSE({
            type: "error",
            error: err instanceof Error ? err.message : "Unknown streaming error",
          })
        );
      } finally {
        requestSignal?.removeEventListener("abort", onAbort);
        controller.close();
      }
    },
    cancel() {
      source.return?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Consumes an async generator to completion and returns the final
 * accumulated text — for server-side callers (e.g. a service that streams
 * internally but returns one string to its own caller).
 */
export async function collectStream(
  source: AsyncGenerator<StreamChunk, void, unknown>
): Promise<string> {
  let final = "";
  for await (const chunk of source) {
    final = chunk.accumulated;
  }
  return final;
}
