import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { listDocuments } from "@/lib/assignment-db/repository";

export const dynamic = "force-dynamic";

// GET /api/assignment?page=0&pageSize=20&search=&subject=&difficulty=&status=
// This is the index route (no [documentId] segment) — it lists the
// signed-in user's assignment documents. Uploading a new one lives at
// app/api/assignment/upload/route.ts instead — DO NOT put upload logic in
// this file; that's exactly the mix-up that caused the 405 errors.
export async function GET(req: Request): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? 0);
  const pageSize = Number(searchParams.get("pageSize") ?? 20);
  const search = searchParams.get("search") ?? undefined;
  const subject = searchParams.get("subject") ?? undefined;
  const difficulty = searchParams.get("difficulty") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  try {
    const result = await listDocuments({
      userId: user.id,
      page: Number.isFinite(page) && page >= 0 ? page : 0,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
      search,
      subject,
      difficulty,
      status,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to list assignments", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
