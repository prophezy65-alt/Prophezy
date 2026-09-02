/**
 * settings.model.ts
 * Shared types for the Settings module. Mirrors the `user_settings` table
 * (20260804090000_user_settings.sql) plus `profiles.theme_preference`,
 * which is reused rather than duplicated.
 */

export type ThemePreference = "light" | "dark" | "system";
export type GeminiModelId = "gemini-2.5-flash" | "gemini-2.5-flash-lite" | "gemini-2.5-pro";
export type ResponseLength = "concise" | "balanced" | "detailed";
export type Creativity = "focused" | "balanced" | "creative";
export type ProfileVisibility = "private" | "college_only" | "public";
export type Density = "comfortable" | "compact";
export type FontScale = "small" | "medium" | "large";
export type CareerTrack = "internship" | "fulltime";

export interface NotificationPreferences {
  email: {
    generationComplete: boolean;
    subscription: boolean;
    internship: boolean;
    research: boolean;
    system: boolean;
  };
  inApp: {
    generationComplete: boolean;
    subscription: boolean;
    internship: boolean;
    research: boolean;
    system: boolean;
    admin: boolean;
  };
}

export interface AiPreferences {
  responseLength: ResponseLength;
  creativity: Creativity;
  autoSaveGenerations: boolean;
}

export interface PrivacyPreferences {
  profileVisibility: ProfileVisibility;
  shareUsageAnalytics: boolean;
  allowAiTrainingOnMyData: boolean;
}

export interface AppearancePreferences {
  density: Density;
  reduceMotion: boolean;
  fontScale: FontScale;
}

export interface DashboardPreferences {
  showAiActivityPanel: boolean;
  showRecentDiscoveries: boolean;
  showUpcomingDeadlines: boolean;
  showQuickActions: boolean;
}

export interface ModulePreferences {
  careerGuidance: {
    defaultTrack: CareerTrack;
  };
}

export type ReasoningMode = "fast" | "standard" | "deep";
export type ColorTheme = "midnight" | "amoled" | "carbon" | "glass" | "ocean" | "purple" | "neon" | "solar";

/** Overrides layered onto lib/ai/config/models.ts defaults at call time.
 * Every field optional/nullable — missing means "use the model default". */
export interface AiGenerationOverrides {
  temperature: number | null;
  maxOutputTokens: number | null;
  topP: number | null;
  frequencyPenalty: number;
  presencePenalty: number;
  streamingEnabled: boolean;
  reasoningMode: ReasoningMode;
}

export interface MemoryPreferences {
  conversations: boolean;
  projects: boolean;
  research: boolean;
  resumes: boolean;
  interviews: boolean;
  career_goals: boolean;
  preferences: boolean;
  uploaded_files: boolean;
}

export interface UserSettings {
  language: string;
  timezone: string;
  geminiModel: GeminiModelId;
  notificationPreferences: NotificationPreferences;
  aiPreferences: AiPreferences;
  privacyPreferences: PrivacyPreferences;
  appearancePreferences: AppearancePreferences;
  keyboardShortcutsEnabled: boolean;
  dashboardPreferences: DashboardPreferences;
  modulePreferences: ModulePreferences;
  aiGenerationOverrides: AiGenerationOverrides;
  memoryPreferences: MemoryPreferences;
  colorTheme: ColorTheme;
  updatedAt: string;
}

/** Settings the client is allowed to patch in one call. Every field optional. */
export interface UserSettingsPatch {
  language?: string;
  timezone?: string;
  geminiModel?: GeminiModelId;
  notificationPreferences?: Partial<NotificationPreferences>;
  aiPreferences?: Partial<AiPreferences>;
  privacyPreferences?: Partial<PrivacyPreferences>;
  appearancePreferences?: Partial<AppearancePreferences>;
  keyboardShortcutsEnabled?: boolean;
  dashboardPreferences?: Partial<DashboardPreferences>;
  modulePreferences?: Partial<ModulePreferences>;
  aiGenerationOverrides?: Partial<AiGenerationOverrides>;
  memoryPreferences?: Partial<MemoryPreferences>;
  colorTheme?: ColorTheme;
}

/** Full settings bundle returned to the client, including theme (from profiles). */
export interface FullSettingsResponse extends UserSettings {
  themePreference: ThemePreference;
}

/** Shape accepted by the import endpoint — same as export, theme included. */
export type SettingsExportBundle = FullSettingsResponse;
