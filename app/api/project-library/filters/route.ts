/**
 * app/api/project-library/filters/route.ts
 *
 * GET /api/project-library/filters — distinct domain/difficulty values
 * actually present in the table, so filter dropdowns reflect real data
 * instead of a hardcoded list that can drift out of sync.
 */

import { NextResponse } from "next/server";
import { listFilterOptions } from "@/lib/project-library/query.service";

export async function GET() {
  try {
    const options = await listFilterOptions();
    return NextResponse.json({ ok: true, data: options });
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: "QUERY_FAILED", message: error instanceof Error ? error.message : "Unknown error." } }, { status: 500 });
  }
}
