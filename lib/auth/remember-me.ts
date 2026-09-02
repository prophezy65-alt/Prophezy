/**
 * "Remember me" preference.
 *
 * Supabase's browser client always writes a long-lived session cookie
 * (~400 days) — that part isn't configurable per sign-in. What "Remember
 * me" actually controls here is whether the session survives the browser
 * being *closed and reopened*:
 *
 *  - checked (default): do nothing extra. The session cookie persists
 *    normally, so the user is still signed in next time they open the app.
 *  - unchecked: record that preference in localStorage. SessionGuard
 *    (mounted once in the protected app layout) checks, on the first
 *    render of a fresh browser session, whether that preference is set —
 *    if so it signs the user out before anything protected renders.
 *
 * sessionStorage is the signal for "is this the same browser session":
 * it's cleared when the tab/browser closes but survives a plain refresh,
 * which is exactly the distinction we need.
 */
const REMEMBER_KEY = "prophezy:remember-me";
const SESSION_ALIVE_KEY = "prophezy:session-alive";

export function setRememberMe(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.removeItem(REMEMBER_KEY);
  } else {
    window.localStorage.setItem(REMEMBER_KEY, "0");
  }
  window.sessionStorage.setItem(SESSION_ALIVE_KEY, "1");
}

export function clearRememberMe() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REMEMBER_KEY);
  window.sessionStorage.removeItem(SESSION_ALIVE_KEY);
}

/** True when the user should be signed out: they previously unchecked
 *  "Remember me" and this is a new browser session (tab/browser reopened
 *  since then, not just a refresh). */
export function shouldForceSignOut(): boolean {
  if (typeof window === "undefined") return false;
  const declinedPersistence = window.localStorage.getItem(REMEMBER_KEY) === "0";
  const sameSession = window.sessionStorage.getItem(SESSION_ALIVE_KEY) === "1";
  return declinedPersistence && !sameSession;
}
