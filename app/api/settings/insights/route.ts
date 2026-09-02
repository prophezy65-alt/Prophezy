import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettingsInsights } from "@/lib/settings/get-settings-data";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const insights = await getSettingsInsights(user.id);
    return NextResponse.json(insights, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load settings insights", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
