import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://prophezy.app";

const STATIC_ROUTES = [
  "",
  "/about",
  "/careers",
  "/blog",
  "/docs",
  "/support",
  "/status",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
  "/legal/ai-usage",
  "/legal/data-retention",
  "/legal/acceptable-use",
];

interface BlogPostRow {
  slug: string;
  published_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("blog_posts" as any)
      .select("slug, published_at")
      .eq("status", "published") as unknown as { data: BlogPostRow[] | null };

    const postEntries: MetadataRoute.Sitemap = (data ?? []).map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.published_at ? new Date(p.published_at) : new Date(),
    }));

    return [...staticEntries, ...postEntries];
  } catch {
    // If Supabase isn't reachable at build time, still ship the static routes.
    return staticEntries;
  }
}
