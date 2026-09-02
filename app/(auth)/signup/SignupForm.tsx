"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/AuthCard";
import FormField from "@/components/auth/FormField";
import GoogleButton from "@/components/auth/GoogleButton";
import GithubButton from "@/components/auth/GithubButton";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/app";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // If email confirmation is required, Supabase returns a user with no
    // session — send them to the "check your inbox" screen. If confirmation
    // is disabled in your Supabase Auth settings, a session comes back
    // immediately and we can drop them straight into the app. This path
    // never hits /auth/callback, so make sure the profile row exists here.
    if (data.session && data.user) {
      const { ensureProfile } = await import("@/lib/auth/ensure-profile");
      await ensureProfile(supabase, data.user);
      setLoading(false);
      router.push(redirectTo);
      router.refresh();
    } else {
      setLoading(false);
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <AuthCard
      title="Create your account."
      subtitle="Everything a student needs, in one operating system."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-[#34d399] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-2.5">
        <GoogleButton redirectTo={redirectTo} />
        <GithubButton redirectTo={redirectTo} />
      </div>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Full name" value={fullName} onChange={setFullName} placeholder="Asha Sharma" autoComplete="name" required />
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
          label="Password"
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
          className="w-full rounded-full bg-gradient-to-r from-[#10b981] to-[#34d399] py-2.5 text-sm font-medium text-[#0a1410] shadow-[0_8px_24px_-8px_rgba(52,211,153,0.5)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-white/40">
          By continuing you agree to Prophezy&apos;s Terms of Service and Privacy Policy.
        </p>
      </form>
    </AuthCard>
  );
}
