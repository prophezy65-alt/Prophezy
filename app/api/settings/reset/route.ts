import { requireSettingsUser, ok, fail } from "@/lib/settings/http/helpers";
import { SettingsRepository } from "@/lib/settings/repository/settings.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/settings/reset — deletes and recreates the row with defaults. */
export async function POST() {
  try {
    const { supabase, userId } = await requireSettingsUser();
    const repository = new SettingsRepository(supabase);
    const settings = await repository.resetSettings(userId);
    const themePreference = await repository.getThemePreference(userId);
    return ok({ ...settings, themePreference });
  } catch (error) {
    return fail(error);
  }
}
