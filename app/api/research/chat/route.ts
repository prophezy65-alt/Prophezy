import "@/lib/polyfills/pdf-node-polyfill";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listResearchSessions,
  getOrCreateResearchSession,
  streamResearchChat,
} from "@/lib/research/services/chat.service";
import { isResearchError } from "@/lib/research/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/research/chat
 *
 * Left in place for backward compatibility — the frontend's session list
 * actually calls GET /api/research/chat/sessions (chat/sessions/route.ts),
 * so this is otherwise unused. Not touched beyond keeping it working.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  try {
    const sessions = await listResearchSessions(user.id);
    return NextResponse.json({ sessions });
  } catch (error) {
    if (isResearchError(error)) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    return NextResponse.json({ error: "Failed to list chat sessions." }, { status: 500 });
  }
}

interface ChatRequestBody {
  sessionId?: string;
  paperId?: string;
  message?: string;
}

/**
 * POST /api/research/chat — body: { sessionId?, paperId?, message }
 *
 * ============================================================================
 * ROOT CAUSE FIX — this handler did not exist before this change.
 * ============================================================================
 * app/api/research/chat/route.ts only exported a GET (a byte-for-byte
 * duplicate of chat/sessions/route.ts's session-list handler). But
 * components/research/researchApi.ts's streamChat() has always done
 * `fetch("/api/research/chat", { method: "POST", ... })`. With no POST
 * export, Next.js's App Router returns its default 405 for any method
 * without a handler — that is exactly the "Method Not Allowed" toast in the
 * product screenshots when sending a chat message. lib/research/services/
 * chat.service.ts's streamResearchChat() (session resolution, credit spend/
 * refund, RAG retrieval via lib/document's searchService, Gemini streaming
 * via the existing lib/ai/services/chat.service.ts — none of that touched)
 * was fully correct and simply never wired to an HTTP route.
 *
 * This handler:
 *   1. Resolves/creates the chat session up front (streamResearchChat's
 *      sessionId param is required, since it persists the user's turn as
 *      soon as it starts — before the session would otherwise exist on a
 *      first message).
 *   2. Calls streamResearchChat() and re-emits its StreamChunk generator as
 *      an SSE response, in the exact `data: {...}\n\n` framing and
 *      `X-Research-Session-Id` / `X-Research-Sources` headers researchApi.ts's
 *      streamChat() already parses — so no frontend change is needed at all.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "`message` is required." }, { status: 400 });
  }

  try {
    const session = await getOrCreateResearchSession(user.id, {
      sessionId: body.sessionId,
      paperId: body.paperId,
    });

    // Everything that can fail before any bytes are sent — auth, ownership,
    // "no extracted text", insufficient credits — happens inside this await,
    // so it's still safe to return a plain JSON error response for it.
    const { sources, stream } = await streamResearchChat({
      userId: user.id,
      sessionId: session.id,
      paperId: body.paperId,
      message: body.message,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const event = JSON.stringify({ type: "chunk", accumulated: chunk.accumulated });
            controller.enqueue(encoder.encode(`data: ${event}\n\n`));
          }
        } catch (err) {
          // The stream already refunds credits internally on failure
          // (see chat.service.ts) before rethrowing — here we just need to
          // tell the client. Headers are already sent by this point, so an
          // SSE error event (which researchApi.ts's parser already handles)
          // is the only way to surface it, rather than an HTTP status.
          const message = err instanceof Error ? err.message : "Chat stream failed.";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    const sourcesHeader = encodeURIComponent(
      JSON.stringify(
        sources.map((s) => ({ documentId: s.documentId, pageIndex: s.pageIndex ?? null, snippet: s.snippet }))
      )
    );

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Research-Session-Id": session.id,
        "X-Research-Sources": sourcesHeader,
      },
    });
  } catch (error) {
    if (isResearchError(error)) {
      const status = error.code === "PAPER_NOT_FOUND" ? 404 : error.code === "RESEARCH_CHAT_ERROR" ? 422 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : "Chat failed.";
    // spendCredits() throws before any streaming starts, so an
    // insufficient-balance failure lands here as a plain JSON response too
    // — never a broken/empty SSE stream.
    const status = /insufficient credit/i.test(message) ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
