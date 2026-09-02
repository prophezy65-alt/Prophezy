/**
 * Supabase Auth returns error strings meant for logs, not students. This
 * maps the common ones to copy that says what happened and what to do
 * next. Anything not in the map is shown as-is rather than swallowed —
 * an unfamiliar error is still more useful than a generic fallback.
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Incorrect email or password.",
  "Email not confirmed": "Confirm your email before signing in — check your inbox.",
  "User already registered": "An account with this email already exists. Try signing in instead.",
  "Password should be at least 6 characters": "Password must be at least 8 characters.",
  "Email rate limit exceeded": "Too many attempts. Wait a minute and try again.",
  "Signups not allowed for this instance": "Sign-ups are temporarily disabled.",
  "For security purposes, you can only request this after 60 seconds":
    "Please wait a minute before requesting another email.",
};

export function friendlyAuthError(message: string | null | undefined): string {
  if (!message) return "Something went wrong. Please try again.";
  return FRIENDLY_MESSAGES[message] ?? message;
}
