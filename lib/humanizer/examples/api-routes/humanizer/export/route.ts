// EXAMPLE: app/api/humanizer/export/route.ts

import { NextRequest, NextResponse } from "next/server";
import { exportRewrite } from "@/lib/humanizer/services/export.service";
import { humanizerExportRequestSchema, parseOrError } from "@/lib/humanizer/validation/schemas";
import { logHumanizerEvent } from "@/lib/humanizer/services/analytics.service";
import type { Rewrite } from "@/lib/humanizer/models/types";

declare function getCurrentUserId(req: NextRequest): Promise<string>;
declare function loadRewriteById(rewriteId: string, userId: string): Promise<Rewrite | null>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  const validation = parseOrError(humanizerExportRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid request", details: validation.errors }, { status: 400 });
  }

  const rewrite = await loadRewriteById(validation.data.rewriteId, userId);
  if (!rewrite) {
    return NextResponse.json({ error: "Rewrite not found" }, { status: 404 });
  }

  try {
    const result = await exportRewrite(rewrite, validation.data);

    await logHumanizerEvent({
      userId,
      rewriteId: rewrite.id,
      eventType: "export",
      metadata: { format: validation.data.format },
      timestamp: new Date().toISOString(),
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Export failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
