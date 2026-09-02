import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { getExamPrediction, deleteExamPrediction } from "@/lib/syllabus/services/exam-prediction-history.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/exam-predictor/history/:id — reopen a previously saved prediction.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const record = await getExamPrediction(user.id, id);
    if (!record) {
      return NextResponse.json({ error: "Prediction not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        id: record.id,
        syllabus: record.syllabus,
        prediction: record.prediction,
        pyqMap: record.pyqMap,
        previousPapersUsed: record.previousPapersUsed,
        warnings: record.warnings,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[exam-predictor:history:get] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load that prediction." },
      { status: 500 },
    );
  }
}

// DELETE /api/exam-predictor/history/:id — remove a saved prediction.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteExamPrediction(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "Prediction not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[exam-predictor:history:delete] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't delete that prediction." },
      { status: 500 },
    );
  }
}
