import type { GeminiModelId } from "@/lib/ai/config/models";
import type { KeyHealth } from "@/lib/ai/config/key-manager";

export interface ProfileData {
  id: string;
  fullName: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  college: string | null;
  branch: string | null;
  semester: number | null;
  role: string;
  joinedAt: string;
  lastActiveAt: string | null;
  emailConfirmed: boolean;
  completionPercent: number;
}

export interface SubscriptionData {
  planTier: string;
  status: string;
  currentPeriodEnd: string | null;
}

export interface FeatureModelRoute {
  feature: string;
  modelId: GeminiModelId;
  displayName: string;
  contextWindow: number;
}

export interface UsageSummary {
  requestsToday: number;
  requestsThisMonth: number;
  tokensToday: number;
  tokensThisMonth: number;
  avgLatencyMs: number | null;
  successRatePercent: number | null;
}

export interface AIControlCenterData {
  defaultModel: GeminiModelId;
  featureRoutes: FeatureModelRoute[];
  keyCount: number;
  usage: UsageSummary;
}

export interface ApiKeyManagementData {
  keys: KeyHealth[];
  autoRotation: true;
  autoFailover: true;
  healthChecksEnabled: true;
}

export type ServiceHealthStatus = "green" | "yellow" | "red";

export interface ServiceHealth {
  id: string;
  label: string;
  status: ServiceHealthStatus;
  detail: string;
}

export interface StorageBreakdownItem {
  id: string;
  label: string;
  count: number;
  bytes: number | null;
}

export interface StorageData {
  totalUploadBytes: number;
  breakdown: StorageBreakdownItem[];
}

export interface LiveAnalyticsData {
  requestsToday: number;
  requestsThisMonth: number;
  tokensThisMonth: number;
  projectsGenerated: number;
  assignmentsGenerated: number;
  researchGenerated: number;
  quizGenerated: number;
  interviewSessions: number;
  resumeScans: number;
  bookmarks: number;
  studyHours: number;
}

export interface ConnectedServiceStatus {
  id: string;
  label: string;
  connected: boolean;
  lastSyncAt: string | null;
}

export interface SecurityData {
  email: string;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  accountCreatedAt: string | null;
  currentDevice: { browser: string; os: string };
}

/** Everything this module adds on top of the existing /api/settings
 * (theme/language/notifications/ai style/privacy/appearance/dashboard/
 * module preferences) — none of that is duplicated here. */
export interface SettingsInsightsData {
  profile: ProfileData;
  subscription: SubscriptionData;
  aiControlCenter: AIControlCenterData;
  apiKeys: ApiKeyManagementData;
  health: ServiceHealth[];
  storage: StorageData;
  analytics: LiveAnalyticsData;
  connectedServices: ConnectedServiceStatus[];
  security: SecurityData;
}
