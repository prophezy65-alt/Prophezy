import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Flame } from "lucide-react";
import { getAllCategories, getFeaturedPost, getPopularPosts, getTrendingPosts, searchPosts } from "@/lib/blog/queries";
import PostCover from "@/lib/blog/PostCover";
import NewsletterForm from "@/lib/blog/NewsletterForm";
import BlogSearch from "./BlogSearch";

const ACCENT = "#5ff2ff";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog — Prophezy",
  description: "Internship guides, resume advice, and roadmaps for students, written by the Prophezy team.",
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { q = "", category, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [featured, categories, popular, trending, results] = await Promise.all([
    getFeaturedPost(),
    getAllCategories(),
    getPopularPosts(5),
    getTrendingPosts(4),
    searchPosts({ query: q, categorySlug: category, page }),
  ]);

  const isFiltering = Boolean(q || category);
  const { posts, total, pageSize } = results;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-14">
        <div className="mb-3 text-xs uppercase tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
          Blog
        </div>
        <h1
          className="max-w-2xl text-[clamp(30px,4.5vw,48px)] font-medium leading-[1.1] tracking-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Career and study advice, written for students.
        </h1>
      </div>

      {featured && !isFiltering && page === 1 && (
        <Link
          href={`/blog/${featured.slug}`}
          className="mb-10 grid gap-0 overflow-hidden rounded-2xl border border-white/[0.08] transition-colors hover:border-white/20 sm:grid-cols-2"
        >
          <PostCover slug={featured.slug} categorySlug={featured.category?.slug} title={featured.title} className="aspect-[16/9] sm:aspect-auto" />
          <div className="p-8 sm:p-10">
            <div className="mb-3 text-xs uppercase tracking-[0.12em]" style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}>
              Featured{featured.category ? ` · ${featured.category.name}` : ""}
            </div>
            <h2 className="text-2xl font-medium text-white sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
              {featured.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{featured.excerpt}</p>
            <div className="mt-5 text-xs text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
              {featured.authorName} · {formatDate(featured.publishedAt)} · {featured.readTimeMinutes} min read
            </div>
          </div>
        </Link>
      )}

      {trending.length > 0 && !isFiltering && page === 1 && (
        <div className="mb-16">
          <div className="mb-5 flex items-center gap-2 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            <Flame size={14} style={{ color: ACCENT }} />
            Trending this week
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            {trending.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                <PostCover slug={post.slug} categorySlug={post.category?.slug} title={post.title} className="mb-3 aspect-[16/9] overflow-hidden rounded-lg" />
                <h3 className="text-sm font-medium leading-snug text-white/85 group-hover:text-white">{post.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/blog"
            className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
              !category ? "border-white/30 text-white" : "border-white/[0.08] text-white/50 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/blog?category=${c.slug}`}
              className={`rounded-full border px-4 py-1.5 text-xs transition-colors ${
                category === c.slug ? "border-white/30 text-white" : "border-white/[0.08] text-white/50 hover:text-white"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <BlogSearch initialQuery={q} />
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_280px]">
        <div>
          <h2 className="mb-6 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
            {isFiltering ? `${total} result${total === 1 ? "" : "s"}` : "Latest articles"}
          </h2>
          {posts.length === 0 && (
            <p className="text-sm text-white/50">No articles match that search yet — try a different term or category.</p>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="overflow-hidden rounded-xl border border-white/[0.08] transition-colors hover:border-white/20"
              >
                <PostCover slug={post.slug} categorySlug={post.category?.slug} title={post.title} className="aspect-[16/9]" />
                <div className="p-5">
                  {post.category && (
                    <div className="mb-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}>
                      {post.category.name}
                    </div>
                  )}
                  <h3 className="text-base font-medium leading-snug text-white">{post.title}</h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/50">{post.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-white/35" style={{ fontFamily: "var(--font-mono)" }}>
                    <span>
                      {formatDate(post.publishedAt)} · {post.readTimeMinutes} min read
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={11} /> {post.viewCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (category) params.set("category", category);
                if (p > 1) params.set("page", String(p));
                const href = `/blog${params.toString() ? `?${params.toString()}` : ""}`;
                return (
                  <Link
                    key={p}
                    href={href}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${
                      p === page ? "text-[#050505]" : "text-white/50 hover:text-white"
                    }`}
                    style={p === page ? { backgroundColor: ACCENT } : undefined}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-12">
          <div>
            <h2 className="mb-6 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
              Popular
            </h2>
            <div className="space-y-4">
              {popular.map((post, i) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="flex gap-3 group">
                  <span className="text-sm text-white/25" style={{ fontFamily: "var(--font-mono)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-sm leading-snug text-white/80 group-hover:text-white">{post.title}</h3>
                    <div className="mt-1 text-[11px] text-white/35" style={{ fontFamily: "var(--font-mono)" }}>
                      {post.readTimeMinutes} min read
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] p-5">
            <h3 className="mb-2 text-sm font-medium text-white">Get new articles by email</h3>
            <p className="mb-4 text-xs leading-relaxed text-white/50">
              One email when something genuinely useful goes up — no spam, unsubscribe anytime.
            </p>
            <NewsletterForm />
          </div>
        </aside>
      </div>
    </div>
  );
}
