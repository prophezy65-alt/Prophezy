"use client";

import { useState } from "react";
import type { SettingsInsightsData } from "@/lib/settings/types";
import type {
  AiGenerationOverrides,
  ColorTheme,
  MemoryPreferences,
} from "@/lib/settings/models/settings.model";
import { ProfileSection } from "@/components/settings/sections/ProfileSection";
import { AIControlCenterSection } from "@/components/settings/sections/AIControlCenterSection";
import { AiGenerationOverridesSection } from "@/components/settings/sections/AiGenerationOverridesSection";
import { ApiKeysSection } from "@/components/settings/sections/ApiKeysSection";
import { MemorySection } from "@/components/settings/sections/MemorySection";
import { ConnectedServicesSection } from "@/components/settings/sections/ConnectedServicesSection";
import { StorageSection } from "@/components/settings/sections/StorageSection";
import { SecuritySection } from "@/components/settings/sections/SecuritySection";
import { ShortcutsSection } from "@/components/settings/sections/ShortcutsSection";
import { HealthMonitorSection } from "@/components/settings/sections/HealthMonitorSection";
import { AnalyticsSection } from "@/components/settings/sections/AnalyticsSection";

interface SettingsInsightsProps {
  initialData: SettingsInsightsData;
  initialAiOverrides: AiGenerationOverrides;
  initialMemory: MemoryPreferences;
  initialColorTheme: ColorTheme;
}

/** Everything the Settings module adds beyond the existing preferences
 * system (SettingsClient.tsx / /api/settings): real profile editing, AI
 * Control Center usage + generation overrides, live API key health, a
 * color-theme picker, memory controls, storage, security, health
 * monitoring, live analytics, connected services, and shortcuts. */
export function SettingsInsights({ initialData, initialAiOverrides, initialMemory, initialColorTheme }: SettingsInsightsProps) {
  const [data] = useState(initialData);

  return (
    <div className="space-y-4">
      <ProfileSection profile={data.profile} subscription={data.subscription} />
      <AIControlCenterSection data={data.aiControlCenter} />
      <AiGenerationOverridesSection initial={initialAiOverrides} initialColorTheme={initialColorTheme} />
      <ApiKeysSection data={data.apiKeys} />
      <MemorySection initial={initialMemory} />
      <StorageSection storage={data.storage} />
      <SecuritySection security={data.security} />
      <HealthMonitorSection initialChecks={data.health} initialKeys={data.apiKeys.keys} />
      <AnalyticsSection analytics={data.analytics} />
      <ConnectedServicesSection services={data.connectedServices} />
      <ShortcutsSection />
    </div>
  );
}
