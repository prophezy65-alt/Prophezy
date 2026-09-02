import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { uploadAvatar } from "@/lib/storage/avatar-service";
import { StorageError } from "@/lib/storage/errors";

// POST /api/avatar — multipart form: file
export async function POST(request: Request) {
  const user = await requireUser();

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    const avatarUrl = await uploadAvatar(user.id, file);
    return NextResponse.json({ avatarUrl });
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ error: "Avatar upload failed" }, { status: 500 });
  }
}
