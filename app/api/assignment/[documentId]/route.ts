import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/assignment-db/auth";
import { deleteDocument, getDocumentDetail } from "@/lib/assignment-db/repository";

export const dynamic = "force-dynamic";

async function resolveDocumentId(params: Promise<{ documentId: string }> | undefined): Promise<string | null> {
  if (!params) return null;
  const resolved = await params;
  return resolved?.documentId ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentId = await resolveDocumentId(params);
  if (!documentId) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  try {
    const detail = await getDocumentDetail(user.id, documentId);
    if (!detail) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    return NextResponse.json(detail, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load assignment", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentId = await resolveDocumentId(params);
  if (!documentId) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  try {
    const deleted = await deleteDocument(user.id, documentId);
    if (!deleted) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete assignment", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
