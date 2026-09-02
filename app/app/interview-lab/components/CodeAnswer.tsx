/**
 * app/app/interview-lab/components/CodeAnswer.tsx
 *
 * A lightweight code editor for coding-test answers: a language picker (full
 * catalogue) + a monospaced editor with tab-to-indent, no spellcheck, and a
 * line/char counter. Controlled — the parent owns `code` and `language`.
 */
"use client";

import { Code2 } from "lucide-react";
import { CODE_LANGUAGES } from "../languages";

export function CodeAnswer({
  code,
  onCodeChange,
  language,
  onLanguageChange,
}: {
  code: string;
  onCodeChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${code.slice(0, start)}  ${code.slice(end)}`;
    onCodeChange(next);
    // restore caret after the inserted two spaces
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 2;
    });
  }

  const lineCount = code.length === 0 ? 0 : code.split("\n").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Code2 size={14} className="text-signal" />
        <span
          className="text-[11px] uppercase tracking-[0.14em] text-mist"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Language
        </span>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-surface/40 px-2 text-xs text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value} className="bg-surface text-ink">
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={`// Write your ${language} solution here…`}
        className="h-64 w-full resize-y rounded-xl border border-border bg-[#0b1116] p-4 text-sm leading-relaxed text-ink transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
        style={{ fontFamily: "var(--font-mono)", tabSize: 2 }}
      />

      <div className="flex items-center justify-between text-xs text-mist">
        <span>
          {lineCount} lines · {code.length} chars
        </span>
        <span style={{ fontFamily: "var(--font-mono)" }}>Tab to indent</span>
      </div>
    </div>
  );
}
