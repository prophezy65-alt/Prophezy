/**
 * settings.repository.ts
 * Supabase persistence for the Settings module. Auto-creates a default row
 * on first read so the frontend never has to special-case "no settings yet".
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { DEFAULT_SETTINGS } from "../defaults";
import type {
  AiGenerationOverrides,
  AiPreferences,
  AppearancePreferences,
  ColorTheme,
  DashboardPreferences,
  FullSettingsResponse,
  GeminiModelId,
  MemoryPreferences,
  ModulePreferences,
  NotificationPreferences,
  PrivacyPreferences,
  ThemePreference,
  UserSettings,
  UserSettingsPatch,
} from "../models/settings.model";

type DB = SupabaseClient<Database>;
type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

export class SettingsRepository {
  constructor(private readonly db: DB) {}

  async getFullSettings(userId: string): Promise<FullSettingsResponse> {
    const [settings, theme] = await Promise.all([this.getOrCreateSettings(userId), this.getThemePreference(userId)]);
    return { ...settings, themePreference: theme };
  }

  async getThemePreference(userId: string): Promise<ThemePreference> {
    const { data, error } = await this.db.from("profiles").select("theme_preference").eq("id", userId).single();
    if (error) throw error;
    return (data.theme_preference as ThemePreference) ?? "system";
  }

  async setThemePreference(userId: string, theme: ThemePreference): Promise<void> {
    const { error } = await this.db.from("profiles").update({ theme_preference: theme }).eq("id", userId);
    if (error) throw error;
  }

  async getOrCreateSettings(userId: string): Promise<UserSettings> {
    const { data, error } = await this.db.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data) return toUserSettings(data);

    const { data: created, error: insertError } = await this.db
      .from("user_settings")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (insertError) throw insertError;
    return toUserSettings(created);
  }

  async patchSettings(userId: string, patch: UserSettingsPatch): Promise<UserSettings> {
    // Ensure a row exists first so a partial JSONB patch merges against the
    // current stored value, not against nothing.
    const current = await this.getOrCreateSettings(userId);

    const update: Database["public"]["Tables"]["user_settings"]["Update"] = {};
    if (patch.language !== undefined) update.language = patch.language;
    if (patch.timezone !== undefined) update.timezone = patch.timezone;
    if (patch.geminiModel !== undefined) update.gemini_model = patch.geminiModel;
    if (patch.keyboardShortcutsEnabled !== undefined) update.keyboard_shortcuts_enabled = patch.keyboardShortcutsEnabled;
    if (patch.notificationPreferences !== undefined) {
      update.notification_preferences = mergeJson(current.notificationPreferences, patch.notificationPreferences) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["notification_preferences"];
    }
    if (patch.aiPreferences !== undefined) {
      update.ai_preferences = mergeJson(current.aiPreferences, patch.aiPreferences) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["ai_preferences"];
    }
    if (patch.privacyPreferences !== undefined) {
      update.privacy_preferences = mergeJson(current.privacyPreferences, patch.privacyPreferences) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["privacy_preferences"];
    }
    if (patch.appearancePreferences !== undefined) {
      update.appearance_preferences = mergeJson(current.appearancePreferences, patch.appearancePreferences) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["appearance_preferences"];
    }
    if (patch.dashboardPreferences !== undefined) {
      update.dashboard_preferences = mergeJson(current.dashboardPreferences, patch.dashboardPreferences) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["dashboard_preferences"];
    }
    if (patch.modulePreferences !== undefined) {
      update.module_preferences = mergeJson(current.modulePreferences, patch.modulePreferences, true) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["module_preferences"];
    }
    if (patch.aiGenerationOverrides !== undefined) {
      update.ai_generation_overrides = mergeJson(current.aiGenerationOverrides, patch.aiGenerationOverrides) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["ai_generation_overrides"];
    }
    if (patch.memoryPreferences !== undefined) {
      update.memory_preferences = mergeJson(current.memoryPreferences, patch.memoryPreferences) as unknown as Database["public"]["Tables"]["user_settings"]["Update"]["memory_preferences"];
    }
    if (patch.colorTheme !== undefined) {
      update.color_theme = patch.colorTheme;
    }

    if (Object.keys(update).length === 0) return current;

    const { data, error } = await this.db
      .from("user_settings")
      .update(update)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return toUserSettings(data);
  }

  async resetSettings(userId: string): Promise<UserSettings> {
    const { error } = await this.db.from("user_settings").delete().eq("user_id", userId);
    if (error) throw error;
    return this.getOrCreateSettings(userId);
  }
}

/** Shallow merge for flat preference groups; one level deep for nested ones like notificationPreferences. */
function mergeJson<T extends object>(current: T, patch: Partial<T>, deep = false): T {
  if (!deep) return { ...current, ...patch };
  const result: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const existing = result[key];
    result[key] =
      value && typeof value === "object" && existing && typeof existing === "object"
        ? { ...existing, ...value }
        : value;
  }
  return result as T;
}

function toUserSettings(row: UserSettingsRow): UserSettings {
  return {
    language: row.language,
    timezone: row.timezone,
    geminiModel: row.gemini_model as GeminiModelId,
    notificationPreferences: (row.notification_preferences ?? DEFAULT_SETTINGS.notificationPreferences) as unknown as NotificationPreferences,
    aiPreferences: (row.ai_preferences ?? DEFAULT_SETTINGS.aiPreferences) as unknown as AiPreferences,
    privacyPreferences: (row.privacy_preferences ?? DEFAULT_SETTINGS.privacyPreferences) as unknown as PrivacyPreferences,
    appearancePreferences: (row.appearance_preferences ?? DEFAULT_SETTINGS.appearancePreferences) as unknown as AppearancePreferences,
    keyboardShortcutsEnabled: row.keyboard_shortcuts_enabled,
    dashboardPreferences: (row.dashboard_preferences ?? DEFAULT_SETTINGS.dashboardPreferences) as unknown as DashboardPreferences,
    modulePreferences: (row.module_preferences ?? DEFAULT_SETTINGS.modulePreferences) as unknown as ModulePreferences,
    aiGenerationOverrides: (row.ai_generation_overrides ?? DEFAULT_SETTINGS.aiGenerationOverrides) as unknown as AiGenerationOverrides,
    memoryPreferences: (row.memory_preferences ?? DEFAULT_SETTINGS.memoryPreferences) as unknown as MemoryPreferences,
    colorTheme: (row.color_theme as ColorTheme) ?? "midnight",
    updatedAt: row.updated_at,
  };
}
