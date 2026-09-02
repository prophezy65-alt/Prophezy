"use client";

import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ConnectedServiceStatus } from "@/lib/settings/types";

export function ConnectedServicesSection({ services }: { services: ConnectedServiceStatus[] }) {
  const oauthPending = services.filter((s) => !["supabase", "gemini"].includes(s.id));

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-medium text-ink">Connected Services</h2>
        <div className="mt-4 space-y-1.5">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm text-ink">{service.label}</p>
                {service.lastSyncAt && (
                  <p className="text-xs text-mist">Last sync: {new Date(service.lastSyncAt).toLocaleString()}</p>
                )}
              </div>
              <Badge tone={service.connected ? "success" : "neutral"}>
                {service.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          ))}
        </div>
      </Card>

      {oauthPending.length > 0 && (
        <Card>
          <div className="flex gap-2 text-xs text-mist">
            <Info size={14} className="mt-0.5 shrink-0" />
            <p>
              {oauthPending.map((s) => s.label).join(", ")} require OAuth app registration (client ID/secret) that
              hasn&apos;t been configured for this project yet. Rather than show a &quot;Connect&quot; button that
              can&apos;t actually authenticate, these stay marked Disconnected until real OAuth credentials are added.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
