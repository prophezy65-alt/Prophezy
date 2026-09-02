"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "../Toggle";

interface MemoryPreferences {
  conversations: boolean;
  projects: boolean;
  research: boolean;
  resumes: boolean;
  interviews: boolean;
  career_goals: boolean;
  preferences: boolean;
  uploaded_files: boolean;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json: ApiEnvelope<T> = await res.json();
  if (!res.ok || !json.ok || json.data === undefined) throw new Error(json.error?.message ?? "Something went wrong.");
  return json.data;
}

const LABELS: { key: keyof MemoryPreferences; label: string }[] = [
  { key: "conversations", label: "Remember conversations" },
  { key: "projects", label: "Remember projects" },
  { key: "research", label: "Remember research" },
  { key: "resumes", label: "Remember resumes" },
  { key: "interviews", label: "Remember interviews" },
  { key: "career_goals", label: "Remember career goals" },
  { key: "preferences", label: "Remember preferences" },
  { key: "uploaded_files", label: "Remember uploaded files" },
];

export function MemorySection({ initial }: { initial: MemoryPreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [clearing, setClearing] = useState(false);

  async function toggle(key: keyof MemoryPreferences) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await apiRequest("/api/settings", { method: "PATCH", body: JSON.stringify({ memoryPreferences: next }) });
  }

  async function handleClear() {
    if (!confirm("Clear everything Prophezy AI remembers about you? This can't be undone.")) return;
    setClearing(true);
    const cleared = Object.fromEntries(Object.keys(prefs).map((k) => [k, false])) as unknown as MemoryPreferences;
    setPrefs(cleared);
    await apiRequest("/api/settings", { method: "PATCH", body: JSON.stringify({ memoryPreferences: cleared }) });
    setClearing(false);
  }

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium text-ink">AI Memory</h2>
        <span className="text-xs text-mist">
          {enabledCount}/{LABELS.length} categories enabled
        </span>
      </div>
      <p className="mt-1 text-xs text-mist">Control what Prophezy AI is allowed to remember about you across sessions.</p>

      <div className="mt-4 space-y-1.5">
        {LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-ink/5">
            <span className="text-sm text-ink">{label}</span>
            <Toggle checked={prefs[key]} onChange={() => toggle(key)} label={label} />
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing}>
          <Trash2 size={14} /> {clearing ? "Clearing…" : "Clear all memory"}
        </Button>
      </div>
    </Card>
  );
}
