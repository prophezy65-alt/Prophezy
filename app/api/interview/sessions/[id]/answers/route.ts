import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, ok, fail, HttpError } from "@/lib/interview/http";
import { submitAndEvaluateAnswer } from "@/lib/interview/services/session.service";
import type { InterviewQuestion, InterviewType } from "@/lib/interview/models/interview.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  questionId: z.string().uuid("questionId must be a valid id"),
  answerText: z.string().min(1, "Answer cannot be empty").max(10_000),
});

/**
 * POST /api/interview/sessions/:id/answers
 * Body: { questionId, answerText }.
 * Persists the answer, evaluates it with Gemini, persists the evaluation,
 * and returns the full evaluation (scores + feedback + model answer).
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth();
    const { id: sessionId } = await context.params;
    const { questionId, answerText } = bodySchema.parse(await request.json());

    // Ownership + context: the session must belong to the caller.
    const { data: sessionRow, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("id, role, interview_type, status")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();
    if (sessionError || !sessionRow) {
      throw new HttpError(404, "Session not found.");
    }
    if (sessionRow.status !== "active") {
      throw new HttpError(409, "This session is already closed.");
    }

    // The question must belong to this session.
    const { data: questionRow, error: questionError } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("id", questionId)
      .eq("session_id", sessionId)
      .single();
    if (questionError || !questionRow) {
      throw new HttpError(404, "Question not found in this session.");
    }

    const question: InterviewQuestion = {
      id: questionRow.id,
      sessionId: questionRow.session_id,
      orderIndex: questionRow.order_index,
      question: questionRow.question,
      topic: questionRow.topic,
      difficulty: questionRow.difficulty as InterviewQuestion["difficulty"],
      questionType: questionRow.question_type as InterviewType,
      source: questionRow.source,
      createdAt: questionRow.created_at,
    };

    const result = await submitAndEvaluateAnswer(supabase, user.id, {
      sessionId,
      question,
      role: sessionRow.role,
      interviewType: sessionRow.interview_type as InterviewType,
      answerText,
    });

    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
