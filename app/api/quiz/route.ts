import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, UnauthorizedQuizError } from "@/lib/quiz/http/response";
import { listMyQuizzes } from "@/lib/quiz/services/quiz.service";
import { generateAndValidateQuiz, persistGeneratedQuiz } from "@/lib/quiz/generator/generator.service";
import { generateQuizRequestSchema } from "@/lib/quiz/validation/quiz-schemas";
import { sanitizeQuestionForAttempt } from "@/lib/quiz/utils/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/quiz — the current user's quiz library (every quiz they've generated).
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");
    const quizzes = await listMyQuizzes(user.id);
    return ok({ quizzes });
  } catch (error) {
    return fail(error);
  }
}

// POST /api/quiz — generate a quiz via Gemini and persist it (quizzes + quiz_questions rows).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedQuizError("You must be signed in.");

    const body = await request.json();
    const input = generateQuizRequestSchema.parse({ ...body, userId: user.id });

    const { title, validatedQuestions, requestedCount, droppedCount } = await generateAndValidateQuiz(input);

    // NOTE: generations.upload_id and quizzes.source_upload_id both have a
    // foreign key to the legacy `uploads` table (0005_uploads.sql), not the
    // `documents` table the document-intelligence pipeline actually writes
    // to (0022_document_intelligence.sql). Passing a documents.id into
    // either column violates that FK. The uploaded content is already
    // baked into the generated questions (consumed above via
    // getUploadChunksText before this point), so these two columns are
    // left null for file-sourced quizzes rather than requiring a schema
    // change to repoint the FK.
    const supabase = await createClient();
    const { data: generation, error: genError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        upload_id: null,
        kind: "quiz",
        title,
        status: "ready",
      })
      .select()
      .single();
    if (genError) throw genError;

    const { quiz, questions, estimatedTimeSec } = await persistGeneratedQuiz({
      generationId: generation.id,
      title,
      examMode: input.examMode,
      difficulty: input.difficulty,
      isAdaptive: input.isAdaptive,
      timeLimitSec: input.timeLimitSec ?? null,
      negativeMarking: input.negativeMarking,
      topicIds: input.topicIds,
      sourceUploadId: null,
      validatedQuestions,
    });

    return ok(
      { quiz, questions: questions.map(sanitizeQuestionForAttempt), estimatedTimeSec, requestedCount, droppedCount },
      201
    );
  } catch (error) {
    return fail(error);
  }
}
