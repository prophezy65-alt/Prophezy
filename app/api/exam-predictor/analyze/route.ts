import "@/lib/polyfills/pdf-node-polyfill";

import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { extractSyllabus } from "@/lib/syllabus/services/syllabus-extraction.service";
import { ingestSyllabus } from "@/lib/syllabus/ingestion/ingestion.service";
import { predictPaper } from "@/lib/syllabus/services/paper-predictor.service";
import { mapPreviousYearQuestions } from "@/lib/syllabus/services/pyq-mapper.service";
import { detectSyllabusFormat, UnsupportedExamPredictorFileError } from "@/lib/exam-predictor/file-format";
import { saveExamPrediction } from "@/lib/syllabus/services/exam-prediction-history.service";

// This route only ever imports the existing Gemini AI layer indirectly,
// through lib/syllabus/services/* -> lib/syllabus/services/_syllabus-ai.runner.ts
// -> lib/ai/services/_run-structured.ts -> lib/ai/engine.ts. It never touches
// lib/ai/config/client.ts, lib/ai/config/key-manager.ts, or any Gemini env var.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const MAX_PREVIOUS_PAPERS = 8;
const STAGE_TIMEOUT_MS = 60_000; // fail a single stage fast instead of hanging forever
const MIN_QUESTION_COUNT = 5;
const MAX_QUESTION_COUNT = 40;
const DEFAULT_QUESTION_COUNT = 12;

class StageTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, label: string, ms = STAGE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new StageTimeoutError(`"${label}" took too long to respond (>${ms / 1000}s) and was aborted.`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const syllabusText = typeof formData.get("syllabusText") === "string" ? (formData.get("syllabusText") as string).trim() : "";
  const syllabusFile = formData.get("syllabusFile");
  const previousPapers = formData.getAll("previousPapers").filter((f): f is File => f instanceof File);

  const rawQuestionCount = formData.get("questionCount");
  const parsedQuestionCount = typeof rawQuestionCount === "string" ? Number.parseInt(rawQuestionCount, 10) : NaN;
  const questionCount = Number.isFinite(parsedQuestionCount)
    ? Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, parsedQuestionCount))
    : DEFAULT_QUESTION_COUNT;

  if (!syllabusText && !(syllabusFile instanceof File)) {
    return NextResponse.json(
      { error: "Give me a syllabus first — upload a file or paste the text." },
      { status: 400 }
    );
  }
  if (previousPapers.length > MAX_PREVIOUS_PAPERS) {
    return NextResponse.json(
      { error: `A single analysis can't take more than ${MAX_PREVIOUS_PAPERS} previous papers.` },
      { status: 400 }
    );
  }

  const log = (stage: string, extra?: Record<string, unknown>) =>
    console.log(`[exam-predictor:analyze] ${stage}`, { userId: user.id, ...extra });

  try {
    log("start", { hasSyllabusFile: syllabusFile instanceof File, syllabusTextLen: syllabusText.length, previousPapers: previousPapers.length });

    // Syllabus extraction gets a longer budget than the other stages. It's
    // the heaviest call (largest prompt + largest output) and, per the AI
    // engine's own logs, the one that most often needs 2-4 key rotations
    // (quota-exhausted keys reject in under a second each, but a slow/
    // hanging key can legitimately cost up to its own ~25s timeout before
    // the engine moves on — see lib/ai/config/client.ts). 2-4 rotations
    // alone can approach or exceed the default 60s stage budget even when
    // nothing is actually broken, which is what was producing the 504s
    // here. maxDuration=180 above leaves plenty of room for this stage to
    // run longer while still leaving the later stages (paper ingestion,
    // prediction, PYQ mapping) their normal 60s each.
    const SYLLABUS_EXTRACTION_TIMEOUT_MS = 110_000;

    // 1. Extract structured syllabus (existing lib/syllabus service).
    const syllabus = syllabusText
      ? await withTimeout(
          extractSyllabus(user.id, { format: "text", content: syllabusText }),
          "Syllabus extraction",
          SYLLABUS_EXTRACTION_TIMEOUT_MS
        )
      : await withTimeout(
          extractSyllabus(user.id, {
            format: detectSyllabusFormat(syllabusFile as File),
            content: Buffer.from(await (syllabusFile as File).arrayBuffer()),
            fileName: (syllabusFile as File).name,
            mimeType: (syllabusFile as File).type,
          }),
          "Syllabus extraction",
          SYLLABUS_EXTRACTION_TIMEOUT_MS
        );
    log("syllabus extracted", { subject: syllabus.subjectName, units: syllabus.units.length });

    // 2. Ingest previous papers to raw text (same ingestion pipeline, reused
    //    for a different document kind — it only cares about pdf/docx/image/text).
    const paperWarnings: string[] = [];
    let previousYearQuestionsText: string | undefined;
    if (previousPapers.length > 0) {
      // Read/ingest every previous paper CONCURRENTLY instead of one at a
      // time — each file's ingestSyllabus() call is independent (no file
      // needs another file's result), so awaiting them sequentially in a
      // for-loop was just adding up N files' worth of wait time for no
      // reason. Promise.allSettled preserves per-file error handling
      // exactly as before and keeps output order (chunks stay in the same
      // order the files were uploaded, matching the old loop's behavior).
      const results = await Promise.allSettled(
        previousPapers.map(async (file) => {
          const format = detectSyllabusFormat(file);
          const ingested = await withTimeout(
            ingestSyllabus(user.id, {
              format,
              content: format === "text" ? await file.text() : Buffer.from(await file.arrayBuffer()),
              fileName: file.name,
              mimeType: file.type,
            }),
            `Reading ${file.name}`
          );
          return { file, ingested };
        })
      );

      const chunks: string[] = [];
      results.forEach((result, i) => {
        const file = previousPapers[i];
        if (result.status === "fulfilled") {
          const { ingested } = result.value;
          chunks.push(`--- ${file.name} ---\n${ingested.rawText}`);
          paperWarnings.push(...ingested.warnings);
          log("paper ingested", { fileName: file.name });
        } else {
          const err = result.reason;
          if (err instanceof UnsupportedExamPredictorFileError) {
            paperWarnings.push(err.message);
            return;
          }
          log("paper ingest failed", { fileName: file.name, err: err instanceof Error ? err.message : String(err) });
          paperWarnings.push(
            err instanceof StageTimeoutError
              ? `"${file.name}" took too long to read and was skipped.`
              : `Couldn't read "${file.name}" — it was skipped.`
          );
        }
      });
      previousYearQuestionsText = chunks.length > 0 ? chunks.join("\n\n") : undefined;
    }

    // 3 & 4. Predict, and map PYQ coverage — these two stages are
    // independent (PYQ mapping only needs the syllabus + previous-paper
    // text, not the prediction output), so run them CONCURRENTLY instead
    // of back-to-back. This halves the wall-clock cost of this part of the
    // request whenever previous papers are supplied, without changing what
    // either stage computes.
    const [prediction, pyqMap] = await Promise.all([
      withTimeout(predictPaper(user.id, syllabus, previousYearQuestionsText, questionCount), "Prediction"),
      previousYearQuestionsText
        ? withTimeout(mapPreviousYearQuestions(user.id, syllabus, previousYearQuestionsText), "PYQ mapping")
        : Promise.resolve(null),
    ]);
    log("prediction done", { questions: prediction.expectedQuestions.length });
    log("done");

    const previousPapersUsedCount = previousPapers.length - paperWarnings.filter((w) => w.includes("skipped")).length;
    const warnings = [...syllabus.extractionWarnings, ...paperWarnings];

    // 5. Save to history so this run survives navigation/refresh and shows
    // up in the Exam Predictor history list. Best-effort: a storage
    // failure here shouldn't erase an analysis that already succeeded, so
    // it's reported as a warning rather than failing the whole request.
    let predictionId: string | null = null;
    try {
      predictionId = await saveExamPrediction(user.id, {
        syllabus,
        prediction,
        pyqMap,
        previousPapersUsed: previousPapersUsedCount,
        questionCountRequested: questionCount,
        warnings,
      });
    } catch (saveErr) {
      log("save to history failed", { err: saveErr instanceof Error ? saveErr.message : String(saveErr) });
      warnings.push("This prediction couldn't be saved to your history, but the result below is complete.");
    }

    return NextResponse.json(
      {
        id: predictionId,
        syllabus,
        prediction,
        pyqMap,
        previousPapersUsed: previousPapersUsedCount,
        warnings,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[exam-predictor:analyze] failed", err);

    if (err instanceof UnsupportedExamPredictorFileError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof StageTimeoutError) {
      return NextResponse.json({ error: err.message }, { status: 504 });
    }
    return NextResponse.json(
      {
        error: "Couldn't analyze that material. Please try again.",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
