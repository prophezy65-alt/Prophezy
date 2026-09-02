"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearRememberMe, shouldForceSignOut } from "@/lib/auth/remember-me";

/**
 * Mounted once in the protected app layout. Enforces "Remember me": if the
 * user signed in with that box unchecked and this is a new browser session
 * (browser was closed and reopened, not just refreshed), it signs them out
 * before the rest of the app renders. See lib/auth/remember-me.ts for why
 * this is done client-side rather than via a shorter Supabase cookie.
 */
export default function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    if (!shouldForceSignOut()) return;

    const supabase = createClient();
    supabase.auth.signOut().finally(() => {
      clearRememberMe();
      router.replace("/login");
      router.refresh();
    });
  }, [router]);

  return null;
}
