import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { deleteUpload, getUploadSignedUrl } from "@/lib/storage/uploads-repository";
import { StorageError } from "@/lib/storage/errors";

// GET /api/uploads/:id — returns a short-lived signed URL to view the file
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  try {
    const url = await getUploadSignedUrl(id);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to get file URL" }, { status: 500 });
  }
}

// DELETE /api/uploads/:id
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  try {
    await deleteUpload(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    }
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
