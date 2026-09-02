import { NextResponse, type NextRequest } from "next/server";
import { requireSettingsUser, ok, fail } from "@/lib/settings/http/helpers";
import { SettingsRepository } from "@/lib/settings/repository/settings.repository";
import { validateSettingsImport } from "@/lib/settings/validation/settings.validation";
import type { ThemePreference, UserSettingsPatch } from "@/lib/settings/models/settings.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/settings/import — body is a settings JSON bundle (as produced by /api/settings/export). */
export async function POST(request: NextRequest) {
  try {
    const { supabase, userId } = await requireSettingsUser();
    const repository = new SettingsRepository(supabase);

    const raw = await request.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Uploaded file is not valid JSON." } },
        { status: 400 }
      );
    }

    const validation = validateSettingsImport(raw);
    if (!validation.ok || !validation.data) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_IMPORT", message: validation.error ?? "Invalid settings file." } },
        { status: 400 }
      );
    }

    const { themePreference, ...settingsPatch } = validation.data;
    const patch = settingsPatch as UserSettingsPatch;

    if (themePreference) {
      await repository.setThemePreference(userId, themePreference as ThemePreference);
    }

    const hasSettingsPatch = Object.keys(patch).length > 0;
    const settings = hasSettingsPatch
      ? await repository.patchSettings(userId, patch)
      : await repository.getOrCreateSettings(userId);
    const theme = await repository.getThemePreference(userId);

    return ok({ ...settings, themePreference: theme });
  } catch (error) {
    return fail(error);
  }
}
