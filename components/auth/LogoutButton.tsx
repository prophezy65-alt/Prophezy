"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * Drop this anywhere a signed-in user needs to log out (Sidebar, Topbar,
 * Settings, a command-palette action, etc). Clears the Supabase session,
 * then does a hard full-page redirect to /login — not a client-side
 * router.push — so there's no window where a stale RSC payload, react-query
 * cache, or client component state could render protected content after
 * signOut() resolves. Middleware re-evaluates from scratch on the resulting
 * navigation, same as a fresh visit.
 */
export default function LogoutButton({ className, children }: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (loading) return; // guards against double-click / double-tap
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      window.location.href = "/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        aria-busy={loading}
        className={cn(
          "text-left text-sm text-white/60 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {children ?? (loading ? "Signing out…" : "Log out")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
