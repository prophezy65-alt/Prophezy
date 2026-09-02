"use client";

import { Monitor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SecurityData } from "@/lib/settings/types";

export function SecuritySection({ security }: { security: SecurityData }) {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-medium text-ink">Security</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Stat label="Email" value={security.email} />
          <Stat
            label="Email verified"
            value={<Badge tone={security.emailConfirmed ? "success" : "pulse"}>{security.emailConfirmed ? "Verified" : "Unverified"}</Badge>}
          />
          <Stat label="Account created" value={security.accountCreatedAt ? new Date(security.accountCreatedAt).toLocaleDateString() : "Unknown"} />
          <Stat label="Last login" value={security.lastSignInAt ? new Date(security.lastSignInAt).toLocaleString() : "Unknown"} />
        </dl>
      </Card>

      <Card>
        <h3 className="font-display text-sm font-medium text-ink">This device</h3>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-signal/30 bg-signal/5 px-4 py-3">
          <Monitor size={18} className="text-signal" />
          <div>
            <p className="text-sm text-ink">
              {security.currentDevice.browser} on {security.currentDevice.os}
            </p>
            <p className="text-xs text-mist">Current session</p>
          </div>
          <Badge tone="success" className="ml-auto">
            Active now
          </Badge>
        </div>
        <p className="mt-3 text-xs text-mist">
          Listing every active session across all your devices requires reading Supabase Auth&apos;s session table
          directly, which isn&apos;t wired up yet — this shows your current session only, which is real and accurate.
        </p>
      </Card>
    </div>
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
