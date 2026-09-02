import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { listExamPredictions } from "@/lib/syllabus/services/exam-prediction-history.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/exam-predictor/history — every saved prediction this user has run, newest first.
export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const predictions = await listExamPredictions(user.id);
    return NextResponse.json({ predictions }, { status: 200 });
  } catch (err) {
    console.error("[exam-predictor:history] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't load your prediction history." },
      { status: 500 },
    );
  }
}
