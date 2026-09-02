import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { foldersService } from "@/lib/notes/services/folders.service";
import { createFolderSchema } from "@/lib/validations/notes";

/** GET /api/notes/folders */
export async function GET() {
  const user = await requireUser();

  try {
    const folders = await foldersService.list(user.id);
    return NextResponse.json({ folders });
  } catch (err) {
    console.error("GET /api/notes/folders failed", err);
    return NextResponse.json({ error: "Failed to load folders" }, { status: 500 });
  }
}

/** POST /api/notes/folders */
export async function POST(request: Request) {
  const user = await requireUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createFolderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const folder = await foldersService.create(user.id, parsed.data.name, parsed.data.color);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create folder";
    const isDuplicate = message.includes("duplicate key") || message.includes("unique");
    return NextResponse.json(
      { error: isDuplicate ? "A folder with that name already exists" : message },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
