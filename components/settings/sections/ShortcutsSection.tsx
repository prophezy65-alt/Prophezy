import { Card } from "@/components/ui/card";
import { SHORTCUTS } from "@/lib/settings/defaults";

export function ShortcutsSection() {
  return (
    <Card>
      <h2 className="font-display text-lg font-medium text-ink">Keyboard Shortcuts</h2>
      <div className="mt-4 space-y-1">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-ink/5">
            <span className="text-ink">{s.label}</span>
            <div className="flex gap-1">
              {s.keys.split(" ").map((key) => (
                <kbd key={key} className="rounded-md border border-border bg-ink/5 px-2 py-0.5 font-mono text-xs text-mist">
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
