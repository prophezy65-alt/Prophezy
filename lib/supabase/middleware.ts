import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that don't require a signed-in user.
// "/auth/*" (OAuth + email-link callback) is matched separately below.
// "/api/payments/webhook" is Cashfree's server calling us directly — it
// will never carry a Supabase session cookie, and authenticity is
// verified independently via HMAC signature verification inside that
// route (see lib/payments/cashfree.client.ts verifyCashfreeWebhookSignature),
// not via login. Without this exemption every webhook delivery gets
// redirected to /login with a 307 and Cashfree never reaches the actual
// handler — payments then appear to "hang" forever on /pricing/return
// even though Cashfree successfully charged the customer.
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/payments/webhook",
];

/**
 * Headers used to forward the already-verified user identity to route
 * handlers/server components, so they don't have to pay a second
 * network round trip to Supabase Auth to re-verify the same session
 * middleware just verified. Always set on every request (to the real
 * value, or cleared) so a client can never spoof them — see the
 * unconditional `.set()` calls below, which overwrite whatever the
 * incoming request had regardless of branch.
 */
const TRUSTED_USER_ID_HEADER = "x-prophezy-user-id";
const TRUSTED_USER_EMAIL_HEADER = "x-prophezy-user-email";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_ROUTES.some(
    (route) => path === route || path.startsWith("/auth"),
  );

  if (!user && !isPublic) {
    // API routes must get a real 401 JSON response, never a redirect.
    // fetch() automatically follows a 307/308 redirect and resends the
    // ORIGINAL method to the new location — so a POST to a protected API
    // route (e.g. /api/payments/create-order with an expired/missing
    // session) was being redirected to /login, and fetch dutifully
    // re-POSTed to /login, which is a page route that only accepts GET.
    // That surfaced as a confusing "405 Invalid Request Method" /
    // "server returned an empty response" instead of a clean 401 that
    // client code already knows how to handle (send the person to sign
    // in, then bring them back). Page navigations are unaffected — they
    // still redirect to /login below exactly as before.
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
        { status: 401 },
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  // NOTE: redirects to /app (the OS shell), not /dashboard — /dashboard
  // doesn't exist in this project. If that ever changes, update here too.
  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  // Forward the verified identity downstream instead of making every
  // route handler call supabase.auth.getUser() again (that call hits
  // Supabase's Auth server over the network — doing it twice per request
  // doubled auth latency on every single API call and server component).
  // Unconditional .set() on both branches means a client-supplied value
  // for either header can never survive — it's always replaced with what
  // middleware itself just verified.
  request.headers.set(TRUSTED_USER_ID_HEADER, user?.id ?? "");
  request.headers.set(TRUSTED_USER_EMAIL_HEADER, user?.email ?? "");

  const finalResponse = NextResponse.next({ request });
  supabaseResponse.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
  return finalResponse;
}
