"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { KeyHealth } from "@/lib/ai/config/key-manager";
import type { ServiceHealth, ServiceHealthStatus } from "@/lib/settings/types";

const STATUS_TONE: Record<ServiceHealthStatus, "success" | "pulse" | "signal"> = {
  green: "success",
  yellow: "pulse",
  red: "pulse",
};

export function HealthMonitorSection({
  initialChecks,
  initialKeys,
}: {
  initialChecks: ServiceHealth[];
  initialKeys: KeyHealth[];
}) {
  const [checks, setChecks] = useState(initialChecks);
  const [keys, setKeys] = useState(initialKeys);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/settings/health");
      if (res.ok) {
        const data = (await res.json()) as { checks: ServiceHealth[]; keys: KeyHealth[]; checkedAt: string };
        setChecks(data.checks);
        setKeys(data.keys);
        setCheckedAt(data.checkedAt);
      }
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-ink">AI Health Monitor</h2>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-mist hover:bg-ink/5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <p className="mt-1 text-xs text-mist">
          Auto-refreshes every 30s{checkedAt ? ` · last checked ${new Date(checkedAt).toLocaleTimeString()}` : " · checking…"}
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {checks.map((check) => (
            <div key={check.id} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={
                    "h-2.5 w-2.5 rounded-full " +
                    (check.status === "green" ? "bg-success" : check.status === "yellow" ? "bg-pulse" : "bg-danger")
                  }
                />
                <span className="text-sm text-ink">{check.label}</span>
              </div>
              <Badge tone={STATUS_TONE[check.status]}>{check.detail}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-sm font-medium text-ink">Key pool</h3>
        <div className="mt-3 space-y-1.5">
          {keys.map((key) => (
            <div key={key.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
              <span className="font-mono capitalize text-ink">{key.label}</span>
              <Badge tone={key.status === "healthy" ? "success" : "pulse"}>{key.status.replace("_", " ")}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
