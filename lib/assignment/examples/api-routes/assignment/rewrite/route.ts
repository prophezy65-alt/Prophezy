// EXAMPLE: app/api/assignment/rewrite/route.ts

import { NextRequest, NextResponse } from "next/server";
import { rewriteTextRegister } from "@/lib/assignment/services/formatter.service";
import { validateRewriteTextRequest } from "@/lib/assignment/validation/schemas";
import type { RewriteRegister } from "@/lib/assignment/prompts/formatter";

declare function getCurrentUserId(req: NextRequest): Promise<string>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = validateRewriteTextRequest(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  const { text, register } = body as { text: string; register: RewriteRegister };

  try {
    const result = await rewriteTextRegister(text, { userId, register });
    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to rewrite text", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
