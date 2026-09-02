import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// DELETE /api/account — permanently deletes the signed-in user's auth
// record. If `profiles.id` (and anything FK'd to it — resumes, notes,
// bookmarks, etc.) references auth.users(id) with ON DELETE CASCADE,
// deleting the auth user cascades automatically. If any table's FK is
// NOT set to cascade, you'll want to add explicit cleanup here before
// calling admin.auth.admin.deleteUser — worth verifying in Phase 2 when
// we go table-by-table on foreign keys.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
