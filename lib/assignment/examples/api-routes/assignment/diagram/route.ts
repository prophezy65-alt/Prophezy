// EXAMPLE: app/api/assignment/diagram/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateDiagram } from "@/lib/assignment/services/diagram.service";

declare function getCurrentUserId(req: NextRequest): Promise<string>;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getCurrentUserId(req);
  const body: unknown = await req.json();

  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).topic !== "string") {
    return NextResponse.json({ error: "`topic` must be a string" }, { status: 400 });
  }

  const { topic, context, preferredType } = body as {
    topic: string;
    context?: string;
    preferredType?: "flowchart" | "sequence" | "class" | "state" | "er" | "mindmap" | "gantt" | "auto";
  };

  try {
    const diagram = await generateDiagram(topic, context ?? "", { userId, preferredType });
    return NextResponse.json({ diagram }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate diagram", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
