"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

const ACCENT = "#5ff2ff";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  rightElement?: ReactNode;
  /** Show a lightweight strength meter under the field — use on signup,
   *  not on login (a login field just needs to accept whatever the user's
   *  existing password already is). */
  showStrength?: boolean;
}

function getStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: "Weak" };
  if (score <= 3) return { score: 2, label: "Okay" };
  if (score <= 4) return { score: 3, label: "Good" };
  return { score: 4, label: "Strong" };
}

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  rightElement,
  showStrength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = useMemo(() => getStrength(value), [value]);

  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-white/60">{label}</span>
        {rightElement}
      </div>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-white/30 transition-colors focus:outline-none"
          onFocus={(e) => (e.currentTarget.style.borderColor = `${ACCENT}66`)}
          onBlur={(e) => (e.currentTarget.style.borderColor = "")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 transition-colors hover:text-white/70"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {showStrength && value && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{
                  backgroundColor: i < strength.score ? ACCENT : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-white/35">{strength.label}</p>
        </div>
      )}
    </label>
  );
}
