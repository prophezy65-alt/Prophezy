/**
 * lib/interview/services/detail.service.ts
 *
 * Loads a full interview session (session + every question, with each
 * question's answer + evaluation when present) as normalized domain
 * objects. Unlike export/report-loader.ts — which only returns fully
 * evaluated items for a finished report — this keeps unanswered questions
 * with null answer/evaluation so the frontend can resume an in-progress
 * session or render a live/partial view.
 *
 * Typed end-to-end against the generated Supabase types (no `any`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ScoredQuestion } from "../skillgap/skillgap.service";
import type {
  EvaluationScores,
  InterviewEvaluation,
  InterviewQuestion,
  InterviewSession,
  InterviewType,
  Seniority,
  SessionStatus,
} from "../models/interview.model";

type SessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];
type QuestionRow = Database["public"]["Tables"]["interview_questions"]["Row"];
type AnswerRow = Database["public"]["Tables"]["interview_answers"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["interview_evaluations"]["Row"];

interface AnswerWithEval extends AnswerRow {
  interview_evaluations: EvaluationRow[];
}
interface QuestionWithChildren extends QuestionRow {
  interview_answers: AnswerWithEval[];
}

export interface SessionDetailItem {
  question: InterviewQuestion;
  answerText: string | null;
  evaluation: InterviewEvaluation | null;
}

export interface SessionDetail {
  session: InterviewSession;
  items: SessionDetailItem[];
  overallScore: number;
  answeredCount: number;
}

export async function loadSessionDetail(
  db: SupabaseClient<Database>,
  userId: string,
  sessionId: string,
): Promise<SessionDetail> {
  const { data: sessionRow, error: sessionError } = await db
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  if (sessionError || !sessionRow) {
    throw new Error("Session not found.");
  }

  const { data: questionRows, error: questionsError } = await db
    .from("interview_questions")
    .select("*, interview_answers(*, interview_evaluations(*))")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });
  if (questionsError) {
    throw new Error(`Failed to load questions — ${questionsError.message}`);
  }

  const rows = (questionRows ?? []) as unknown as QuestionWithChildren[];

  const items: SessionDetailItem[] = rows.map((row) => {
    const answer = row.interview_answers?.[0] ?? null;
    const evaluationRow = answer?.interview_evaluations?.[0] ?? null;
    return {
      question: toQuestion(row),
      answerText: answer?.answer_text ?? null,
      evaluation: evaluationRow ? toEvaluation(evaluationRow) : null,
    };
  });

  const evaluated = items.filter((it) => it.evaluation !== null);
  const overallScore =
    evaluated.length > 0
      ? Math.round(
          (evaluated.reduce((sum, it) => sum + (it.evaluation as InterviewEvaluation).overallScore, 0) /
            evaluated.length) *
            10,
        ) / 10
      : 0;

  return {
    session: toSession(sessionRow),
    items,
    overallScore,
    answeredCount: evaluated.length,
  };
}

/** Builds the ScoredQuestion[] input that completeSession()/skill-gap expects. */
export function toScoredQuestions(detail: SessionDetail): ScoredQuestion[] {
  return detail.items
    .filter((it): it is SessionDetailItem & { evaluation: InterviewEvaluation } => it.evaluation !== null)
    .map((it) => ({
      topic: it.question.topic,
      scores: extractScores(it.evaluation),
    }));
}

function extractScores(e: InterviewEvaluation): EvaluationScores {
  return {
    correctness: e.correctness,
    communication: e.communication,
    technicalDepth: e.technicalDepth,
    confidence: e.confidence,
    problemSolving: e.problemSolving,
    clarity: e.clarity,
    grammar: e.grammar,
    completeness: e.completeness,
    logic: e.logic,
    professionalism: e.professionalism,
  };
}

function toSession(row: SessionRow): InterviewSession {
  return {
    id: row.id,
    userId: row.user_id,
    interviewType: row.interview_type as InterviewType,
    role: row.role,
    company: row.company,
    seniority: row.seniority as Seniority,
    status: row.status as SessionStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function toQuestion(row: QuestionRow): InterviewQuestion {
  return {
    id: row.id,
    sessionId: row.session_id,
    orderIndex: row.order_index,
    question: row.question,
    topic: row.topic,
    difficulty: row.difficulty as InterviewQuestion["difficulty"],
    questionType: row.question_type as InterviewType,
    source: row.source,
    createdAt: row.created_at,
  };
}

function toEvaluation(row: EvaluationRow): InterviewEvaluation {
  return {
    id: row.id,
    answerId: row.answer_id,
    correctness: row.correctness,
    communication: row.communication,
    technicalDepth: row.technical_depth,
    confidence: row.confidence,
    problemSolving: row.problem_solving,
    clarity: row.clarity,
    grammar: row.grammar,
    completeness: row.completeness,
    logic: row.logic,
    professionalism: row.professionalism,
    overallScore: row.overall_score,
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    modelAnswer: row.model_answer,
    alternativeAnswer: row.alternative_answer,
    improvementPlan: row.improvement_plan,
    suggestedResources: row.suggested_resources ?? [],
    createdAt: row.created_at,
  };
}
