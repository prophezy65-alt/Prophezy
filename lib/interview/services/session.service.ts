/**
 * lib/interview/services/session.service.ts
 *
 * Orchestrates a full structured mock-interview session:
 *   1. generate a question set (generator/question-generator.service.ts)
 *   2. persist session + questions to Supabase
 *   3. accept answers one at a time, evaluate each
 *      (evaluation/evaluation.service.ts), persist evaluations
 *   4. on completion, compute skill gaps + roadmap and an analytics snapshot
 *
 * This is the structured, turn-by-turn "generate question -> grade answer"
 * flow. The free-form conversational flow (streaming interviewer persona,
 * follow-up banter) already exists in lib/ai/services/interview.service.ts
 * and lib/ai/prompts/interview.ts — this module does not duplicate that;
 * a route can offer either mode, or use this module to grade answers
 * collected from that conversational flow's transcript.
 *
 * CREDIT GATING (fixed — this was the reported bug): this file's real
 * Gemini calls are generateInterviewQuestions() inside createSession() and
 * evaluateAnswer() inside submitAndEvaluateAnswer(). Neither was ever
 * connected to the credit system — lib/ai/services/interview.service.ts
 * (a DIFFERENT, generic conversational primitive) was gated instead in an
 * earlier pass, but this module doesn't call that file at all, so nothing
 * here was ever actually charged. Both entry points now spend
 * INTERVIEW_AI_ACTION (3 credits) BEFORE their real Gemini call, wrapped
 * with spendCreditsForFeature so a failure anywhere in the call — Gemini
 * itself or the subsequent Supabase persistence — triggers an automatic
 * refund rather than leaving the user charged for nothing usable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateInterviewQuestions } from "../generator/question-generator.service";
import { evaluateAnswer } from "../evaluation/evaluation.service";
import { buildSkillGapRoadmap, type ScoredQuestion } from "../skillgap/skillgap.service";
import { computeAnalyticsSnapshot, recordAttempt } from "../analytics/analytics.service";
import { spendCreditsForFeature, getFeatureCreditCost, CREDIT_FEATURES } from "@/lib/credits";
import type {
  InterviewEvaluation,
  InterviewQuestion,
  InterviewSession,
  InterviewType,
  Seniority,
  SessionStatus,
} from "../models/interview.model";

type SessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];
type QuestionRow = Database["public"]["Tables"]["interview_questions"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["interview_evaluations"]["Row"];

export interface CreateSessionParams {
  role: string;
  interviewType: InterviewType;
  seniority: Seniority;
  company?: string;
  jobDescription?: string;
  resumeText?: string;
  projectContext?: string;
  skills?: string[];
  questionCount?: number;
}

async function requireInterviewCreditCost(): Promise<number> {
  const cost = await getFeatureCreditCost(CREDIT_FEATURES.INTERVIEW_AI_ACTION);
  if (!cost) {
    throw new Error(
      `Interview AI is temporarily unavailable (no active credit cost configured for "${CREDIT_FEATURES.INTERVIEW_AI_ACTION}").`
    );
  }
  return cost.creditCost;
}

export async function createSession(
  db: SupabaseClient,
  userId: string,
  params: CreateSessionParams
): Promise<{ session: InterviewSession; questions: InterviewQuestion[] }> {
  const creditCost = await requireInterviewCreditCost();

  return spendCreditsForFeature(
    userId,
    creditCost,
    CREDIT_FEATURES.INTERVIEW_AI_ACTION,
    async () => {
      const { questions } = await generateInterviewQuestions(userId, {
        role: params.role,
        interviewType: params.interviewType,
        seniority: params.seniority,
        company: params.company,
        jobDescription: params.jobDescription,
        resumeText: params.resumeText,
        projectContext: params.projectContext,
        skills: params.skills,
        questionCount: params.questionCount ?? 8,
      });

      const { data: sessionRow, error: sessionError } = await db
        .from("interview_sessions")
        .insert({
          user_id: userId,
          role: params.role,
          interview_type: params.interviewType,
          seniority: params.seniority,
          company: params.company ?? null,
          status: "active",
          metadata: { skills: params.skills ?? [] },
        })
        .select()
        .single();
      if (sessionError || !sessionRow) {
        throw new Error(`createSession: failed to persist session — ${sessionError?.message}`);
      }

      const { data: questionRows, error: questionsError } = await db
        .from("interview_questions")
        .insert(
          questions.map((q, i) => ({
            session_id: sessionRow.id,
            order_index: i,
            question: q.question,
            topic: q.topic,
            difficulty: q.difficulty,
            question_type: params.interviewType,
            source: q.source,
          }))
        )
        .select();
      if (questionsError || !questionRows) {
        throw new Error(`createSession: failed to persist questions — ${questionsError?.message}`);
      }

      return {
        session: toSession(sessionRow),
        questions: questionRows.map(toQuestion),
      };
    },
    `Interview question generation (${params.role}, ${params.interviewType})`
  );
}

export interface SubmitAndEvaluateResult {
  answerId: string;
  evaluation: InterviewEvaluation;
}

export async function submitAndEvaluateAnswer(
  db: SupabaseClient,
  userId: string,
  params: { sessionId: string; question: InterviewQuestion; role: string; interviewType: InterviewType; answerText: string }
): Promise<SubmitAndEvaluateResult> {
  const creditCost = await requireInterviewCreditCost();

  return spendCreditsForFeature(
    userId,
    creditCost,
    CREDIT_FEATURES.INTERVIEW_AI_ACTION,
    async () => {
      // Evaluate FIRST (the Gemini client retries transient failures internally).
      // Persisting only after a successful evaluation means a failed grade leaves
      // no orphaned answer row, so the user can safely retry the same question.
      const result = await evaluateAnswer(userId, {
        question: params.question.question,
        answerText: params.answerText,
        interviewType: params.interviewType,
        role: params.role,
        topic: params.question.topic,
      });

      const { data: answerRow, error: answerError } = await db
        .from("interview_answers")
        .insert({
          session_id: params.sessionId,
          question_id: params.question.id,
          answer_text: params.answerText,
        })
        .select()
        .single();
      if (answerError || !answerRow) {
        throw new Error(`submitAndEvaluateAnswer: failed to persist answer — ${answerError?.message}`);
      }

      const { data: evalRow, error: evalError } = await db
        .from("interview_evaluations")
        .insert({
          answer_id: answerRow.id,
          correctness: result.scores.correctness,
          communication: result.scores.communication,
          technical_depth: result.scores.technicalDepth,
          confidence: result.scores.confidence,
          problem_solving: result.scores.problemSolving,
          clarity: result.scores.clarity,
          grammar: result.scores.grammar,
          completeness: result.scores.completeness,
          logic: result.scores.logic,
          professionalism: result.scores.professionalism,
          overall_score: result.overallScore,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          model_answer: result.modelAnswer,
          alternative_answer: result.alternativeAnswer,
          improvement_plan: result.improvementPlan,
          suggested_resources: result.suggestedResources,
        })
        .select()
        .single();
      if (evalError || !evalRow) {
        // Roll back the answer so the question stays cleanly re-answerable.
        await db.from("interview_answers").delete().eq("id", answerRow.id);
        throw new Error(`submitAndEvaluateAnswer: failed to persist evaluation — ${evalError?.message}`);
      }

      return { answerId: answerRow.id, evaluation: toEvaluation(evalRow) };
    },
    `Interview answer evaluation (${params.interviewType})`
  );
}

export async function completeSession(
  db: SupabaseClient,
  userId: string,
  sessionId: string,
  role: string,
  scoredQuestions: ScoredQuestion[]
) {
  const { error } = await db
    .from("interview_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);
  if (error) throw new Error(`completeSession: ${error.message}`);

  const skillGap = await buildSkillGapRoadmap(userId, role, scoredQuestions);

  await recordAttempt(db, {
    userId,
    sessionId,
    overallScore:
      scoredQuestions.length > 0
        ? Math.round(
            (scoredQuestions.reduce(
              (sum, q) =>
                sum + (q.scores.technicalDepth + q.scores.correctness + q.scores.problemSolving + q.scores.logic) / 4,
              0
            ) /
              scoredQuestions.length) *
              10
          ) / 10
        : 0,
    topicScores: skillGap.weakSkills.concat(skillGap.strongSkills),
  });

  const analytics = await computeAnalyticsSnapshot(db, userId);

  return { skillGap, analytics };
}

// --- row <-> model mapping -------------------------------------------------

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
