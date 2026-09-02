// EXAMPLE: app/api/humanizer/analyze/route.ts

import { NextRequest, NextResponse } from "next/server";
import { analyzeTextQuality } from "@/lib/humanizer/services/humanizer.service";
import { z } from "zod";
import { parseOrError } from "@/lib/humanizer/validation/schemas";

declare function getCurrentUserId(req: NextRequest): Promise<string>;

const analyzeRequestSchema = z.object({ text: z.string().min(1).max(30000) });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = parseOrError(analyzeRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  try {
    const analysis = await analyzeTextQuality(validation.data.text, { userId });
    return NextResponse.json({ analysis }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Analysis failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
