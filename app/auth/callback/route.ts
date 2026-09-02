import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";

// Handles: Google/GitHub OAuth redirect, email signup confirmation links,
// and magic-link / password-reset links. All of these send the browser
// here with a `code` param that gets exchanged for a real session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Defense-in-depth: guarantee a profile row exists regardless of which
  // path brought the user here (OAuth first-login, email confirmation,
  // password recovery). Cheap no-op if it already exists.
  if (data.user) {
    await ensureProfile(supabase, data.user);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
