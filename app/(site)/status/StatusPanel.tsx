"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type ServiceStatus = "operational" | "degraded" | "down" | "not_configured";

interface CheckResult {
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail?: string;
}

interface StatusResponse {
  overall: ServiceStatus;
  checkedAt: string;
  totalLatencyMs: number;
  services: CheckResult[];
}

const STATUS_COLOR: Record<ServiceStatus, string> = {
  operational: "#4ade80",
  degraded: "#facc15",
  down: "#f87171",
  not_configured: "#6b7280",
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not configured",
};

const POLL_INTERVAL_MS = 30000;

export default function StatusPanel() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`Status check failed (HTTP ${res.status})`);
      const json = (await res.json()) as StatusResponse;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-white/50">
        <Loader2 size={16} className="animate-spin" /> Running live health checks…
      </div>
    );
  }

  if (error || !data) {
    return <p className="py-16 text-sm text-red-400">{error ?? "Status unavailable."}</p>;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between rounded-xl border border-white/[0.08] p-6">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: STATUS_COLOR[data.overall], boxShadow: `0 0 10px ${STATUS_COLOR[data.overall]}` }}
          />
          <span className="text-base font-medium text-white">
            {data.overall === "operational" ? "All systems operational" : STATUS_LABEL[data.overall]}
          </span>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchStatus();
          }}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {data.services.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded-lg border border-white/[0.06] px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[s.status] }} />
              <span className="text-sm text-white/85">{s.name}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
              {s.latencyMs !== null && <span>{s.latencyMs}ms</span>}
              <span style={{ color: STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
        Last checked {new Date(data.checkedAt).toLocaleTimeString()} · Auto-refreshes every 30s
      </p>
    </div>
  );
}
