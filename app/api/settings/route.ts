import { NextResponse, type NextRequest } from "next/server";
import { requireSettingsUser, ok, fail } from "@/lib/settings/http/helpers";
import { SettingsRepository } from "@/lib/settings/repository/settings.repository";
import type { ThemePreference, UserSettingsPatch } from "@/lib/settings/models/settings.model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THEME_VALUES: ThemePreference[] = ["light", "dark", "system"];
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];

/** GET /api/settings — full settings bundle (theme + user_settings), auto-creating defaults on first load. */
export async function GET() {
  try {
    const { supabase, userId } = await requireSettingsUser();
    const repository = new SettingsRepository(supabase);
    const settings = await repository.getFullSettings(userId);
    return ok(settings);
  } catch (error) {
    return fail(error);
  }
}

/** PATCH /api/settings — partial update. Accepts { themePreference?, ...UserSettingsPatch }. */
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, userId } = await requireSettingsUser();
    const repository = new SettingsRepository(supabase);

    const body = (await request.json().catch(() => null)) as
      | (UserSettingsPatch & { themePreference?: string })
      | null;
    if (!body) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: "Request body must be JSON." } },
        { status: 400 }
      );
    }

    if (body.themePreference !== undefined) {
      if (!THEME_VALUES.includes(body.themePreference as ThemePreference)) {
        return NextResponse.json(
          { ok: false, error: { code: "INVALID_INPUT", message: `themePreference must be one of: ${THEME_VALUES.join(", ")}` } },
          { status: 400 }
        );
      }
      await repository.setThemePreference(userId, body.themePreference as ThemePreference);
    }

    if (body.geminiModel !== undefined && !GEMINI_MODELS.includes(body.geminiModel)) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_INPUT", message: `geminiModel must be one of: ${GEMINI_MODELS.join(", ")}` } },
        { status: 400 }
      );
    }

    const { themePreference: _themePreference, ...settingsPatch } = body;
    const hasSettingsPatch = Object.keys(settingsPatch).length > 0;
    const settings = hasSettingsPatch
      ? await repository.patchSettings(userId, settingsPatch)
      : await repository.getOrCreateSettings(userId);
    const theme = await repository.getThemePreference(userId);

    return ok({ ...settings, themePreference: theme });
  } catch (error) {
    return fail(error);
  }
}
