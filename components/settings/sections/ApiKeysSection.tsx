"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApiKeyManagementData } from "@/lib/settings/types";

export function ApiKeysSection({ data }: { data: ApiKeyManagementData }) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-signal" />
          <h2 className="font-display text-lg font-medium text-ink">API Key Management</h2>
        </div>
        <p className="mt-1 text-xs text-mist">
          {data.keys.length} Gemini key{data.keys.length === 1 ? "" : "s"} configured. Keys are never displayed — only
          live health status.
        </p>

        <div className="mt-4 space-y-2">
          {data.keys.length === 0 ? (
            <p className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              No GEMINI_API_KEY_* environment variables detected.
            </p>
          ) : (
            data.keys.map((key) => (
              <div key={key.label} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm capitalize text-ink">{key.label}</span>
                  {key.isPreferred && <Badge tone="signal">preferred</Badge>}
                </div>
                <div className="flex items-center gap-3 text-xs text-mist">
                  {key.status === "cooling_down" ? (
                    <span>
                      Cooling down · {Math.ceil(key.cooldownRemainingMs / 1000)}s remaining
                      {key.lastFailureReason ? ` · ${key.lastFailureReason}` : ""}
                    </span>
                  ) : (
                    <span>Healthy</span>
                  )}
                  <Badge tone={key.status === "healthy" ? "success" : "pulse"}>{key.status.replace("_", " ")}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-signal" />
          <h3 className="font-display text-sm font-medium text-ink">Rotation &amp; failover</h3>
        </div>
        <p className="mt-1 text-xs text-mist">
          Always on — the key manager automatically rotates to the next healthy key and retries on quota, server, or
          transient errors. This isn&apos;t user-configurable because disabling it would mean a single quota hit takes
          the whole app down.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <FeatureRow label="Auto rotation" enabled />
          <FeatureRow label="Auto failover" enabled />
          <FeatureRow label="Retry failed requests" enabled />
          <FeatureRow label="Health checks" enabled />
        </div>
      </Card>
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink/[0.02] px-3 py-2 text-sm">
      <span className="text-ink">{label}</span>
      <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "On" : "Off"}</Badge>
    </div>
  );
}
