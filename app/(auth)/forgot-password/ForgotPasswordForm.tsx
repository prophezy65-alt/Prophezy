"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { devResetPasswordAction } from "@/lib/auth/actions";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";

// DEV-ONLY: this form resets a password directly with no email step and
// no proof the requester owns the account — see the loud warning on
// devResetPasswordAction in lib/auth/actions.ts. It only works while
// NODE_ENV !== "production"; the server action itself refuses to run in
// prod even if this page ships by accident. Replace this with the real
// email-based flow (ForgotPasswordForm history / resetPasswordForEmail)
// once SMTP (e.g. Resend) is configured.
export default function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
    const result = await devResetPasswordAction(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 1200);
  };

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="Taking you to sign in…">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full animate-pulse rounded-full bg-[#34d399]" />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password."
      subtitle="Dev mode: set a new password directly, no email needed."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-[#34d399] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@college.edu"
          autoComplete="email"
          required
        />
        <FormField
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />
        <FormField
          label="Confirm password"
          type="password"
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
