import type { NextRequest } from "next/server";
import { requireAuth, ok, fail } from "@/lib/interview/http";
import { companySearchSchema } from "@/lib/validations/interview";
import { getCompanyContext } from "@/lib/interview/company/company.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/interview/company
 * Body: { company, role? }.
 * Returns a structured "how this company tends to interview" profile used to
 * preview typical rounds/focus areas and to bias question generation.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth();
    const input = companySearchSchema.parse(await request.json());
    const context = await getCompanyContext(user.id, input);
    return ok(context);
  } catch (error) {
    return fail(error);
  }
}
