import type { MetadataRoute } from "next";

// Same domain fix as sitemap.ts — must be the real production host so
// the sitemap URL advertised here actually resolves.
const SITE_URL = "https://www.prophezy.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authenticated app surfaces and API routes out of the crawl —
      // they'd redirect to /login for an unauthenticated crawler anyway,
      // so there's nothing useful there for search engines to index.
      disallow: ["/app/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
