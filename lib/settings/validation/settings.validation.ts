/**
 * settings.validation.ts
 * Validates settings-shaped JSON before it's accepted by the import
 * endpoint. Mirrors lib/career/validation/career.validation.ts's pattern
 * (zod schema + a small `validate` wrapper returning a ServiceResult-style
 * outcome) rather than throwing raw zod errors up to the API layer.
 */

import { z } from "zod";

const themePreferenceSchema = z.enum(["light", "dark", "system"]);
const geminiModelSchema = z.enum(["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"]);

const notificationChannelSchema = z.object({
  generationComplete: z.boolean(),
  subscription: z.boolean(),
  internship: z.boolean(),
  research: z.boolean(),
  system: z.boolean(),
});

export const settingsImportSchema = z.object({
  themePreference: themePreferenceSchema.optional(),
  language: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(64).optional(),
  geminiModel: geminiModelSchema.optional(),
  notificationPreferences: z
    .object({
      email: notificationChannelSchema.partial().optional(),
      inApp: notificationChannelSchema.extend({ admin: z.boolean() }).partial().optional(),
    })
    .partial()
    .optional(),
  aiPreferences: z
    .object({
      responseLength: z.enum(["concise", "balanced", "detailed"]).optional(),
      creativity: z.enum(["focused", "balanced", "creative"]).optional(),
      autoSaveGenerations: z.boolean().optional(),
    })
    .partial()
    .optional(),
  privacyPreferences: z
    .object({
      profileVisibility: z.enum(["private", "college_only", "public"]).optional(),
      shareUsageAnalytics: z.boolean().optional(),
      allowAiTrainingOnMyData: z.boolean().optional(),
    })
    .partial()
    .optional(),
  appearancePreferences: z
    .object({
      density: z.enum(["comfortable", "compact"]).optional(),
      reduceMotion: z.boolean().optional(),
      fontScale: z.enum(["small", "medium", "large"]).optional(),
    })
    .partial()
    .optional(),
  keyboardShortcutsEnabled: z.boolean().optional(),
  dashboardPreferences: z
    .object({
      showAiActivityPanel: z.boolean().optional(),
      showRecentDiscoveries: z.boolean().optional(),
      showUpcomingDeadlines: z.boolean().optional(),
      showQuickActions: z.boolean().optional(),
    })
    .partial()
    .optional(),
  modulePreferences: z
    .object({
      careerGuidance: z.object({ defaultTrack: z.enum(["internship", "fulltime"]) }).partial().optional(),
    })
    .partial()
    .optional(),
});

export type SettingsImportInput = z.infer<typeof settingsImportSchema>;

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function validateSettingsImport(raw: unknown): ValidationResult<SettingsImportInput> {
  const result = settingsImportSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, data: result.data };
}
