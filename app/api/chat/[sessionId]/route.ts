import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Returns one chat session's full message history, ordered oldest -> newest,
 * so the assistant widget can restore a past conversation exactly as it was.
 * Confirms the session belongs to the requesting user before returning
 * anything (same pattern as the sessionId ownership check in the main
 * /api/chat POST route).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) {
    return new Response(`Failed to load session: ${sessionError.message}`, { status: 500 });
  }
  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(`Failed to load messages: ${error.message}`, { status: 500 });
  }

  return Response.json({ messages: messages ?? [] });
}

/** Lets a student delete an old chat from their history. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    return new Response(`Failed to delete session: ${error.message}`, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
