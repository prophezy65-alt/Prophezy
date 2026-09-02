/**
 * app/api/project-library/[id]/route.ts
 *
 * GET /api/project-library/:id — returns the stored record exactly as-is.
 * No AI enrichment of missing fields. No credit deduction.
 */

import { NextRequest, NextResponse } from "next/server";
import { getProjectById } from "@/lib/project-library/query.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Project not found." } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: project });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: "QUERY_FAILED", message: error instanceof Error ? error.message : "Unknown error." } }, { status: 500 });
  }
}
