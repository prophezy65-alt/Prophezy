// EXAMPLE: app/api/humanizer/search/route.ts

import { NextRequest, NextResponse } from "next/server";
import { searchHumanizerHistory } from "@/lib/humanizer/services/search.service";
import { searchRequestSchema, parseOrError } from "@/lib/humanizer/validation/schemas";
import { logHumanizerEvent } from "@/lib/humanizer/services/analytics.service";

declare function getCurrentUserId(req: NextRequest): Promise<string>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = parseOrError(searchRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  try {
    const results = await searchHumanizerHistory({ userId, ...validation.data });

    await logHumanizerEvent({
      userId,
      rewriteId: null,
      eventType: "search",
      metadata: { mode: validation.data.mode, resultCount: results.length },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Search failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
