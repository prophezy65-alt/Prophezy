import { NextResponse } from "next/server";
import { requireSettingsUser, fail } from "@/lib/settings/http/helpers";
import { SettingsRepository } from "@/lib/settings/repository/settings.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/settings/export — downloadable JSON snapshot of all settings. */
export async function GET() {
  try {
    const { supabase, userId } = await requireSettingsUser();
    const repository = new SettingsRepository(supabase);
    const settings = await repository.getFullSettings(userId);

    const body = JSON.stringify(settings, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="prophezy-settings-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
