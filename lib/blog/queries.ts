import { createClient } from "@/lib/supabase/server";
import type { BlogAuthor, BlogCategory, BlogPost, BlogPostSummary, BlogTag } from "./types";

interface RawCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}
interface RawTag {
  id: string;
  slug: string;
  name: string;
}
interface RawAuthor {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
}
interface RawPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_markdown: string;
  cover_image_url: string | null;
  author_name: string;
  read_time_minutes: number;
  is_featured: boolean;
  view_count: number;
  published_at: string | null;
  category: RawCategory | null;
  author: RawAuthor | null;
  blog_post_tags: { blog_tags: RawTag }[] | null;
}

const POST_SELECT = `
  id, slug, title, excerpt, content_markdown, cover_image_url,
  author_name, read_time_minutes, is_featured,
  view_count, published_at,
  category:blog_categories ( id, slug, name, description ),
  author:blog_authors ( id, slug, name, bio, avatar_url ),
  blog_post_tags ( blog_tags ( id, slug, name ) )
`;

const PAGE_SIZE = 9;

function mapCategory(c: RawCategory | null): BlogCategory | null {
  if (!c) return null;
  return { id: c.id, slug: c.slug, name: c.name, description: c.description };
}

function mapAuthor(a: RawAuthor | null, fallbackName: string): BlogAuthor | null {
  if (!a) return { id: "unknown", slug: "prophezy-team", name: fallbackName, bio: null, avatarUrl: null };
  return { id: a.id, slug: a.slug, name: a.name, bio: a.bio, avatarUrl: a.avatar_url };
}

function mapTags(joins: RawPostRow["blog_post_tags"]): BlogTag[] {
  if (!joins) return [];
  return joins.map((j) => ({ id: j.blog_tags.id, slug: j.blog_tags.slug, name: j.blog_tags.name }));
}

function mapSummary(row: RawPostRow): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    authorName: row.author?.name ?? row.author_name,
    authorAvatarUrl: row.author?.avatar_url ?? null,
    readTimeMinutes: row.read_time_minutes,
    isFeatured: row.is_featured,
    viewCount: row.view_count,
    publishedAt: row.published_at,
    category: mapCategory(row.category),
    tags: mapTags(row.blog_post_tags),
    author: mapAuthor(row.author, row.author_name),
  };
}

function mapFull(row: RawPostRow): BlogPost {
  return { ...mapSummary(row), contentMarkdown: row.content_markdown };
}

export async function getFeaturedPost(): Promise<BlogPostSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .eq("is_featured", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle<RawPostRow>();
  return data ? mapSummary(data) : null;
}

export async function getLatestPosts(limit = 6, excludeSlug?: string): Promise<BlogPostSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (excludeSlug) query = query.neq("slug", excludeSlug);
  const { data } = await query.returns<RawPostRow[]>();
  return (data ?? []).map(mapSummary);
}

export async function getPopularPosts(limit = 5): Promise<BlogPostSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("view_count", { ascending: false })
    .limit(limit)
    .returns<RawPostRow[]>();
  return (data ?? []).map(mapSummary);
}

// "Trending" = most-viewed in the last 7 days, via the trending_post_slugs()
// RPC (see 20260807b_blog_expansion.sql). Falls back to all-time popular if
// the RPC isn't available yet (e.g. migration not run) so the page never
// breaks — it just won't reflect a real weekly window until it's applied.
export async function getTrendingPosts(limit = 5): Promise<BlogPostSummary[]> {
  const supabase = await createClient();
  const { data: trending, error } = await supabase.rpc("trending_post_slugs", { p_limit: limit });
  if (error || !trending || trending.length === 0) {
    return getPopularPosts(limit);
  }
  const slugs: string[] = trending.map((t: { slug: string }) => t.slug);
  const { data } = await supabase.from("blog_posts").select(POST_SELECT).in("slug", slugs).returns<RawPostRow[]>();
  const bySlug = new Map((data ?? []).map((r) => [r.slug, mapSummary(r)]));
  return slugs.map((s) => bySlug.get(s)).filter((p): p is BlogPostSummary => Boolean(p));
}

export async function getAllCategories(): Promise<BlogCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("blog_categories").select("id, slug, name, description").order("name");
  return (data ?? []) as BlogCategory[];
}

export async function getAllTags(): Promise<BlogTag[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("blog_tags").select("id, slug, name").order("name");
  return (data ?? []) as BlogTag[];
}

export interface SearchOpts {
  query?: string;
  categorySlug?: string;
  tagSlug?: string;
  page?: number;
}

export interface SearchResult {
  posts: BlogPostSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export async function searchPosts(opts: SearchOpts): Promise<SearchResult> {
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase.from("blog_posts").select(POST_SELECT, { count: "exact" }).eq("status", "published");

  // PostgREST doesn't restrict parent rows by filtering an embedded
  // resource's column unless that join is `!inner` — .eq("category.slug", x)
  // on a plain embed silently matches nothing. Resolve the category to its
  // id first and filter on the real foreign key column instead.
  if (opts.categorySlug) {
    const { data: cat } = await supabase.from("blog_categories").select("id").eq("slug", opts.categorySlug).maybeSingle();
    if (cat) q = q.eq("category_id", cat.id);
    else q = q.eq("category_id", "00000000-0000-0000-0000-000000000000"); // unknown category → no results, not all results
  }
  if (opts.query && opts.query.trim()) {
    const term = opts.query.trim();
    q = q.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
  }
  if (opts.tagSlug) {
    const { data: tag } = await supabase.from("blog_tags").select("id").eq("slug", opts.tagSlug).maybeSingle();
    if (tag) {
      const { data: postTagRows } = await supabase.from("blog_post_tags").select("post_id").eq("tag_id", tag.id);
      const postIds = (postTagRows ?? []).map((r) => r.post_id);
      q = q.in("id", postIds.length > 0 ? postIds : ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  q = q.order("published_at", { ascending: false }).range(from, to);

  const { data, count } = await q.returns<RawPostRow[]>();
  return { posts: (data ?? []).map(mapSummary), total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle<RawPostRow>();
  return data ? mapFull(data) : null;
}

export async function getAdjacentPosts(
  publishedAt: string | null
): Promise<{ prev: BlogPostSummary | null; next: BlogPostSummary | null }> {
  const supabase = await createClient();
  if (!publishedAt) return { prev: null, next: null };

  const [{ data: prevData }, { data: nextData }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select(POST_SELECT)
      .eq("status", "published")
      .lt("published_at", publishedAt)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle<RawPostRow>(),
    supabase
      .from("blog_posts")
      .select(POST_SELECT)
      .eq("status", "published")
      .gt("published_at", publishedAt)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle<RawPostRow>(),
  ]);

  return {
    prev: prevData ? mapSummary(prevData) : null,
    next: nextData ? mapSummary(nextData) : null,
  };
}

export async function getRelatedPosts(categoryId: string | undefined, excludeSlug: string, limit = 3): Promise<BlogPostSummary[]> {
  const supabase = await createClient();
  if (!categoryId) return getLatestPosts(limit, excludeSlug);

  const { data } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .eq("category_id", categoryId)
    .neq("slug", excludeSlug)
    .order("published_at", { ascending: false })
    .limit(limit)
    .returns<RawPostRow[]>();

  const results = (data ?? []).map(mapSummary);
  if (results.length < limit) {
    const fill = await getLatestPosts(limit - results.length, excludeSlug);
    const seen = new Set(results.map((r) => r.id));
    for (const f of fill) if (!seen.has(f.id)) results.push(f);
  }
  return results;
}

export async function recordPostView(slug: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_blog_view", { p_slug: slug });
}
