"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Toggle } from "../Toggle";
import { THEME_LIST } from "@/lib/settings/themes";
import { cn } from "@/lib/utils";

type ReasoningMode = "fast" | "standard" | "deep";
type ColorTheme = "midnight" | "amoled" | "carbon" | "glass" | "ocean" | "purple" | "neon" | "solar";

interface AiGenerationOverrides {
  temperature: number | null;
  maxOutputTokens: number | null;
  topP: number | null;
  frequencyPenalty: number;
  presencePenalty: number;
  streamingEnabled: boolean;
  reasoningMode: ReasoningMode;
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

const REASONING_MODES: ReasoningMode[] = ["fast", "standard", "deep"];

export function AiGenerationOverridesSection({
  initial,
  initialColorTheme,
}: {
  initial: AiGenerationOverrides;
  initialColorTheme: ColorTheme;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [colorTheme, setColorTheme] = useState(initialColorTheme);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-app-theme", colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setSaving(true);
      try {
        await apiRequest("/api/settings", { method: "PATCH", body: JSON.stringify({ aiGenerationOverrides: prefs }) });
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  async function chooseTheme(theme: ColorTheme) {
    setColorTheme(theme);
    await apiRequest("/api/settings", { method: "PATCH", body: JSON.stringify({ colorTheme: theme }) });
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-display text-lg font-medium text-ink">Color theme</h2>
        <p className="mt-1 text-xs text-mist">Dark mode only. Applies instantly.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {THEME_LIST.map((theme) => (
            <button
              key={theme.id}
              onClick={() => chooseTheme(theme.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4 text-left transition-transform hover:scale-[1.02]",
                colorTheme === theme.id ? "border-signal ring-2 ring-signal/30" : "border-border/60",
              )}
              style={{ backgroundColor: `hsl(${theme.vars.surface})` }}
            >
              {colorTheme === theme.id && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-signal text-white">
                  <Check size={12} />
                </span>
              )}
              <div className="mb-3 flex gap-1.5">
                <span className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${theme.vars.void})` }} />
                <span className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${theme.vars.signal})` }} />
                <span className="h-6 w-6 rounded-full" style={{ backgroundColor: `hsl(${theme.vars.pulse})` }} />
              </div>
              <p className="text-sm font-medium" style={{ color: `hsl(${theme.vars.signal})` }}>
                {theme.label}
              </p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-medium text-ink">Generation parameters</h3>
          {saving ? (
            <span className="flex items-center gap-1 text-xs text-mist">
              <Loader2 size={12} className="animate-spin" /> Saving…
            </span>
          ) : (
            saved && <Check size={14} className="text-success" />
          )}
        </div>
        <p className="mt-1 text-xs text-mist">Overrides layered onto each model&apos;s defaults. Leave at &quot;default&quot; to use it.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SliderField label="Temperature" value={prefs.temperature} min={0} max={2} step={0.05} onChange={(v) => setPrefs((p) => ({ ...p, temperature: v }))} />
          <SliderField label="Top P" value={prefs.topP} min={0} max={1} step={0.05} onChange={(v) => setPrefs((p) => ({ ...p, topP: v }))} />
          <SliderField label="Frequency penalty" value={prefs.frequencyPenalty} min={-2} max={2} step={0.1} onChange={(v) => setPrefs((p) => ({ ...p, frequencyPenalty: v ?? 0 }))} />
          <SliderField label="Presence penalty" value={prefs.presencePenalty} min={-2} max={2} step={0.1} onChange={(v) => setPrefs((p) => ({ ...p, presencePenalty: v ?? 0 }))} />
          <NumberField label="Max output tokens" value={prefs.maxOutputTokens} onChange={(v) => setPrefs((p) => ({ ...p, maxOutputTokens: v }))} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-mist">Reasoning mode</span>
            <select
              value={prefs.reasoningMode}
              onChange={(e) => setPrefs((p) => ({ ...p, reasoningMode: e.target.value as ReasoningMode }))}
              className="h-10 w-full rounded-xl border border-border bg-surface/40 px-3 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            >
              {REASONING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode[0]?.toUpperCase() + mode.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm text-ink">Streaming enabled</p>
            <p className="text-xs text-mist">Stream tokens as they generate instead of waiting for the full response.</p>
          </div>
          <Toggle checked={prefs.streamingEnabled} onChange={(v) => setPrefs((p) => ({ ...p, streamingEnabled: v }))} />
        </div>
      </Card>
    </div>
  );
}

function SliderField({ label, value, min, max, step, onChange }: { label: string; value: number | null; min: number; max: number; step: number; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-mist">
        {label}
        <span className="text-ink">{value ?? "default"}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value ?? (min + max) / 2} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-signal" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-mist">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        placeholder="default"
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="h-10 w-full rounded-xl border border-border bg-surface/40 px-3 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
      />
    </label>
  );
}
