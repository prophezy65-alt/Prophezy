import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on every route except static assets, images, favicon, and the
    // two SEO/crawler files (sitemap.xml, robots.txt). Those must be
    // reachable by search engine crawlers, which never carry a Supabase
    // session cookie — routing them through updateSession() meant every
    // crawler request had no `user` and got redirected to /login. Excluding
    // them here means middleware never runs on these two paths at all, so
    // they always return a plain 200, and every other route's existing
    // auth behavior (PUBLIC_ROUTES, redirects, etc.) is completely
    // unchanged.
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
