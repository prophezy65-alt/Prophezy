"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth/error-messages";
import AuthCard from "@/components/auth/AuthCard";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });

    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }
    setResent(true);
  };

  return (
    <AuthCard
      title="Check your inbox."
      subtitle={email ? `We sent a confirmation link to ${email}.` : "We sent you a confirmation link."}
    >
      <p className="text-xs leading-relaxed text-white/50">
        Click the link in that email to activate your account. It can take a minute or two to arrive — check spam if
        you don&apos;t see it.
      </p>
      <button
        type="button"
        onClick={handleResend}
        disabled={loading || !email}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm text-white transition-colors hover:border-white/25 disabled:opacity-50"
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {loading ? "Resending…" : resent ? "Sent again ✓" : "Resend email"}
      </button>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </AuthCard>
  );
}
