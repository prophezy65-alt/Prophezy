// EXAMPLE: app/api/humanizer/rewrite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { humanizeText } from "@/lib/humanizer/services/humanizer.service";
import { rewriteRequestSchema, parseOrError } from "@/lib/humanizer/validation/schemas";

declare function getCurrentUserId(req: NextRequest): Promise<string>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = parseOrError(rewriteRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  const { text, style, tone, lengthOp, domain, preserveFormatting } = validation.data;

  try {
    const rewrite = await humanizeText(
      text,
      { style, tone, lengthOp, domain, preserveFormatting },
      { userId }
    );
    return NextResponse.json({ rewrite }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Rewrite failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
