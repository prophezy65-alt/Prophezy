"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/error-messages";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // This page is only reachable with a valid recovery session — the user
  // arrives here via /auth/callback, which already exchanged the reset
  // link's code for a session before redirecting. If there's no session,
  // the link was invalid, expired, or opened directly.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setValidSession(!!user);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/app");
      router.refresh();
    }, 1500);
  };

  if (checking) {
    return (
      <AuthCard title="Checking your link…">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[#34d399]" />
        </div>
      </AuthCard>
    );
  }

  if (!validSession) {
    return (
      <AuthCard title="Link expired" subtitle="This password reset link is invalid or has already been used.">
        <Link
          href="/forgot-password"
          className="block w-full rounded-full bg-gradient-to-r from-[#10b981] to-[#34d399] py-2.5 text-center text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(52,211,153,0.5)] transition-transform hover:-translate-y-0.5"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="Taking you into Prophezy…">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full animate-pulse rounded-full bg-[#34d399]" />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password." subtitle="Choose something you haven't used before.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          showStrength
        />
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#10b981] to-[#34d399] py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(52,211,153,0.5)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}
