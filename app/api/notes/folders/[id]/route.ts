import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { foldersService } from "@/lib/notes/services/folders.service";
import { updateFolderSchema } from "@/lib/validations/notes";

/** PATCH /api/notes/folders/:id — rename and/or recolor. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateFolderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const folder = await foldersService.rename(user.id, id, parsed.data);
    return NextResponse.json({ folder });
  } catch (err) {
    console.error(`PATCH /api/notes/folders/${id} failed`, err);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
}

/** DELETE /api/notes/folders/:id — notes inside become unfiled, not deleted. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  try {
    await foldersService.remove(user.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/notes/folders/${id} failed`, err);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
}
