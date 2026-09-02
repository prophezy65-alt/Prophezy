// EXAMPLE: app/api/humanizer/history/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getHistoryForUser } from "@/lib/humanizer/services/history.service";
import { historyListRequestSchema, parseOrError } from "@/lib/humanizer/validation/schemas";

declare function getCurrentUserId(req: NextRequest): Promise<string>;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());

  const validation = parseOrError(historyListRequestSchema, searchParams);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  try {
    const history = await getHistoryForUser(userId, validation.data.limit, validation.data.offset);
    return NextResponse.json({ history }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch history", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
