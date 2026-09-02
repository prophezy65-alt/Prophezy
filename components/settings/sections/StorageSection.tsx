"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { clearAnalyticsHistory } from "@/lib/settings/actions";
import type { StorageData } from "@/lib/settings/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageSection({ storage }: { storage: StorageData }) {
  const [clearing, setClearing] = useState(false);

  async function handleClearCache() {
    setClearing(true);
    await clearAnalyticsHistory();
    setClearing(false);
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-medium text-ink">Storage</h2>
        <p className="mt-1 text-2xl font-display text-ink">{formatBytes(storage.totalUploadBytes)}</p>
        <p className="text-xs text-mist">Total uploaded file size across all documents</p>

        <div className="mt-4 space-y-1.5">
          {storage.breakdown.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-ink/5">
              <span className="text-ink">{item.label}</span>
              <span className="text-mist">
                {item.count} item{item.count === 1 ? "" : "s"}
                {item.bytes !== null && ` · ${formatBytes(item.bytes)}`}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-sm font-medium text-ink">Cache</h3>
        <p className="mt-1 text-xs text-mist">
          Clears your AI usage analytics history (used for the Live Analytics and AI Control Center panels). Doesn&apos;t
          delete any of your notes, projects, or generated content.
        </p>
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={handleClearCache} disabled={clearing}>
            <Trash2 size={14} /> {clearing ? "Clearing…" : "Clear cache"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
