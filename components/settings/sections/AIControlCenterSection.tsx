"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AIControlCenterData } from "@/lib/settings/types";

/** Read-only real usage/routing data for the AI Control Center. Editable
 * generation-parameter overrides live in AiGenerationOverridesSection,
 * which talks to /api/settings (theirs) — not duplicated here. */
export function AIControlCenterSection({ data }: { data: AIControlCenterData }) {
  return (
    <Card>
      <h2 className="font-display text-lg font-medium text-ink">AI Control Center</h2>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Stat label="Default model" value={<Badge tone="signal">{data.defaultModel}</Badge>} />
        <Stat label="Configured keys" value={String(data.keyCount)} />
        <Stat label="AI status" value={data.keyCount > 0 ? <Badge tone="success">Online</Badge> : <Badge tone="pulse">No keys</Badge>} />
        <Stat label="Avg response time" value={data.usage.avgLatencyMs !== null ? `${data.usage.avgLatencyMs}ms` : "No data yet"} />
        <Stat label="Success rate (today)" value={data.usage.successRatePercent !== null ? `${data.usage.successRatePercent}%` : "No data yet"} />
        <Stat label="Daily requests" value={String(data.usage.requestsToday)} />
        <Stat label="Today's tokens" value={data.usage.tokensToday.toLocaleString()} />
        <Stat label="Monthly requests" value={String(data.usage.requestsThisMonth)} />
        <Stat label="Monthly tokens" value={data.usage.tokensThisMonth.toLocaleString()} />
      </dl>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="font-display text-sm font-medium text-ink">Feature → model routing</h3>
        <div className="mt-3 space-y-1.5">
          {data.featureRoutes.map((route) => (
            <div key={route.feature} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-ink/5">
              <span className="text-ink">{route.feature.replace(/_/g, " ")}</span>
              <div className="flex items-center gap-2 text-xs text-mist">
                <Badge tone="neutral">{route.displayName}</Badge>
                <span>{route.contextWindow.toLocaleString()} ctx</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
