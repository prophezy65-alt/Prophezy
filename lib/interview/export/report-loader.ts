/**
 * lib/interview/export/report-loader.ts
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionReportBundle } from "./export.service";

export async function loadSessionReportBundle(
  db: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<SessionReportBundle> {
  const { data: sessionRow, error: sessionError } = await db
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  if (sessionError || !sessionRow) {
    throw new Error(`loadSessionReportBundle: session not found — ${sessionError?.message}`);
  }

  const { data: questionRows, error: questionsError } = await db
    .from("interview_questions")
    .select("*, interview_answers(*, interview_evaluations(*))")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });
  if (questionsError || !questionRows) {
    throw new Error(`loadSessionReportBundle: failed to load questions — ${questionsError?.message}`);
  }

  const items = (questionRows as any[])
    .filter((q) => q.interview_answers?.[0]?.interview_evaluations?.[0])
    .map((q) => {
      const answer = q.interview_answers[0];
      const evaluation = answer.interview_evaluations[0];
      return {
        question: {
          id: q.id,
          sessionId: q.session_id,
          orderIndex: q.order_index,
          question: q.question,
          topic: q.topic,
          difficulty: q.difficulty,
          questionType: q.question_type,
          source: q.source,
          createdAt: q.created_at,
        },
        answerText: answer.answer_text,
        evaluation: {
          id: evaluation.id,
          answerId: evaluation.answer_id,
          correctness: evaluation.correctness,
          communication: evaluation.communication,
          technicalDepth: evaluation.technical_depth,
          confidence: evaluation.confidence,
          problemSolving: evaluation.problem_solving,
          clarity: evaluation.clarity,
          grammar: evaluation.grammar,
          completeness: evaluation.completeness,
          logic: evaluation.logic,
          professionalism: evaluation.professionalism,
          overallScore: evaluation.overall_score,
          strengths: evaluation.strengths ?? [],
          weaknesses: evaluation.weaknesses ?? [],
          modelAnswer: evaluation.model_answer,
          alternativeAnswer: evaluation.alternative_answer,
          improvementPlan: evaluation.improvement_plan,
          suggestedResources: evaluation.suggested_resources ?? [],
          createdAt: evaluation.created_at,
        },
      };
    });

  const overallScore =
    items.length > 0
      ? Math.round((items.reduce((sum, it) => sum + it.evaluation.overallScore, 0) / items.length) * 10) / 10
      : 0;

  return {
    session: {
      id: sessionRow.id,
      userId: sessionRow.user_id,
      interviewType: sessionRow.interview_type,
      role: sessionRow.role,
      company: sessionRow.company,
      seniority: sessionRow.seniority,
      status: sessionRow.status,
      startedAt: sessionRow.started_at,
      endedAt: sessionRow.ended_at,
      metadata: sessionRow.metadata ?? {},
    },
    items,
    overallScore,
  };
}
