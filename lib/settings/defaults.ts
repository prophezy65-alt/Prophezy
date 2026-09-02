/**
 * defaults.ts
 * Single source of truth for default settings values on the application
 * side. Kept in sync with the column defaults in
 * 20260804090000_user_settings.sql — if you change one, change the other.
 */

import type { UserSettings } from "./models/settings.model";

export const DEFAULT_SETTINGS: Omit<UserSettings, "updatedAt"> = {
  language: "en",
  timezone: "UTC",
  geminiModel: "gemini-2.5-flash",
  notificationPreferences: {
    email: { generationComplete: true, subscription: true, internship: true, research: true, system: true },
    inApp: {
      generationComplete: true,
      subscription: true,
      internship: true,
      research: true,
      system: true,
      admin: true,
    },
  },
  aiPreferences: {
    responseLength: "balanced",
    creativity: "balanced",
    autoSaveGenerations: true,
  },
  privacyPreferences: {
    profileVisibility: "private",
    shareUsageAnalytics: true,
    allowAiTrainingOnMyData: false,
  },
  appearancePreferences: {
    density: "comfortable",
    reduceMotion: false,
    fontScale: "medium",
  },
  keyboardShortcutsEnabled: true,
  dashboardPreferences: {
    showAiActivityPanel: true,
    showRecentDiscoveries: true,
    showUpcomingDeadlines: true,
    showQuickActions: true,
  },
  modulePreferences: {
    careerGuidance: { defaultTrack: "fulltime" },
  },
  aiGenerationOverrides: {
    temperature: null,
    maxOutputTokens: null,
    topP: null,
    frequencyPenalty: 0,
    presencePenalty: 0,
    streamingEnabled: true,
    reasoningMode: "standard",
  },
  memoryPreferences: {
    conversations: true,
    projects: true,
    research: true,
    resumes: true,
    interviews: true,
    career_goals: true,
    preferences: true,
    uploaded_files: true,
  },
  colorTheme: "midnight",
};

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ar", label: "Arabic" },
] as const;

export const SUPPORTED_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export const GEMINI_MODEL_OPTIONS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Fast, balanced — used for most generations." },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "Fastest, lighter-weight responses." },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Highest quality, slower and more thorough." },
] as const;

// ---------------------------------------------------------------------------
// Additive: static shortcuts reference list, displayed (not persisted) by
// components/settings/sections/ShortcutsSection.tsx. Doesn't touch anything
// above — that's still the single source of truth for DEFAULT_SETTINGS.
// ---------------------------------------------------------------------------
export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Ctrl K", label: "Search / command palette" },
  { keys: "Ctrl P", label: "Projects" },
  { keys: "Ctrl I", label: "Interview Lab" },
  { keys: "Ctrl R", label: "Research Papers" },
  { keys: "Ctrl N", label: "Notes" },
  { keys: "Ctrl A", label: "Assignments" },
  { keys: "Ctrl F", label: "Flashcards" },
  { keys: "Ctrl Q", label: "Quiz" },
  { keys: "Ctrl ,", label: "Settings" },
  { keys: "Ctrl B", label: "Bookmarks" },
];
