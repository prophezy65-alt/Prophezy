import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import {
  getPostBySlug,
  getRelatedPosts,
  getAdjacentPosts,
  recordPostView,
} from "@/lib/blog/queries";
import MarkdownContent from "@/lib/blog/MarkdownContent";
import PostCover from "@/lib/blog/PostCover";
import TableOfContents from "@/lib/blog/TableOfContents";
import ReadingProgressBar from "@/lib/blog/ReadingProgressBar";
import LikeButton from "@/lib/blog/LikeButton";
import BookmarkButton from "@/lib/blog/BookmarkButton";
import ShareButtons from "@/lib/blog/ShareButtons";
import NewsletterForm from "@/lib/blog/NewsletterForm";
import { extractHeadings } from "@/lib/blog/slugify";

const ACCENT = "#5ff2ff";
const SITE_URL = "https://prophezy.app";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Article not found — Prophezy" };
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} — Prophezy Blog`,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url,
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.authorName],
      tags: post.tags.map((t) => t.name),
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  void recordPostView(slug);

  const [related, adjacent] = await Promise.all([
    getRelatedPosts(post.category?.id, slug, 3),
    getAdjacentPosts(post.publishedAt),
  ]);

  const headings = extractHeadings(post.contentMarkdown);
  const url = `${SITE_URL}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    author: { "@type": "Organization", name: post.authorName },
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: { "@type": "Organization", name: "Prophezy" },
  };

  return (
    <>
      <ReadingProgressBar targetId="article-body" />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-6xl px-6 py-20">
        <Link href="/blog" className="text-xs text-white/40 hover:text-white" style={{ fontFamily: "var(--font-mono)" }}>
          ← Back to blog
        </Link>

        <div className="grid gap-12 xl:grid-cols-[1fr_800px_220px]">
          <div className="hidden xl:block" />

          <article id="article-body" className="mt-6 max-w-3xl justify-self-center">
            <PostCover
              slug={post.slug}
              categorySlug={post.category?.slug}
              title={post.title}
              className="mb-8 aspect-[21/9] rounded-2xl"
            />

            {post.category && (
              <div className="mb-3 text-xs uppercase tracking-[0.12em]" style={{ color: ACCENT, fontFamily: "var(--font-mono)" }}>
                {post.category.name}
              </div>
            )}
            <h1
              className="text-[clamp(28px,4.5vw,44px)] font-medium leading-[1.15] tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {post.title}
            </h1>
            <p className="mt-4 text-base text-white/60">{post.excerpt}</p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
              <span>{post.authorName}</span>
              <span>·</span>
              <span>{formatDate(post.publishedAt)}</span>
              <span>·</span>
              <span>{post.readTimeMinutes} min read</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Eye size={12} /> {post.viewCount}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <LikeButton slug={post.slug} initialCount={0} />
              <BookmarkButton slug={post.slug} />
              <ShareButtons title={post.title} />
            </div>

            {post.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <Link
                    key={t.id}
                    href={`/blog?q=${encodeURIComponent(t.name)}`}
                    className="rounded-full border border-white/[0.08] px-3 py-1 text-[11px] text-white/50 hover:text-white"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="my-10 border-t border-white/[0.06]" />

            <MarkdownContent markdown={post.contentMarkdown} />

            {post.author?.bio && (
              <div className="mt-14 flex items-center gap-4 rounded-xl border border-white/[0.08] p-5">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium"
                  style={{ backgroundColor: `${ACCENT}22`, color: ACCENT }}
                >
                  {post.authorName.slice(0, 1)}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{post.authorName}</div>
                  <p className="mt-0.5 text-xs text-white/50">{post.author.bio}</p>
                </div>
              </div>
            )}

            <div className="mt-14 grid gap-3 border-t border-white/[0.06] pt-8 sm:grid-cols-2">
              {adjacent.prev ? (
                <Link href={`/blog/${adjacent.prev.slug}`} className="rounded-xl border border-white/[0.08] p-4 hover:border-white/20">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-white/35" style={{ fontFamily: "var(--font-mono)" }}>
                    ← Previous
                  </div>
                  <div className="mt-1 text-sm text-white/80">{adjacent.prev.title}</div>
                </Link>
              ) : (
                <div />
              )}
              {adjacent.next && (
                <Link href={`/blog/${adjacent.next.slug}`} className="rounded-xl border border-white/[0.08] p-4 text-right hover:border-white/20">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-white/35" style={{ fontFamily: "var(--font-mono)" }}>
                    Next →
                  </div>
                  <div className="mt-1 text-sm text-white/80">{adjacent.next.title}</div>
                </Link>
              )}
            </div>

            {related.length > 0 && (
              <div className="mt-16">
                <h2 className="mb-6 text-sm uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                  Related articles
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {related.map((p) => (
                    <Link key={p.id} href={`/blog/${p.slug}`} className="overflow-hidden rounded-xl border border-white/[0.08] hover:border-white/20">
                      <PostCover slug={p.slug} categorySlug={p.category?.slug} title={p.title} className="aspect-[16/9]" />
                      <div className="p-4 text-sm text-white/80">{p.title}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-16 rounded-2xl border border-white/[0.08] p-8 text-center">
              <h3 className="text-lg font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
                Want more like this?
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-white/60">
                One email when something genuinely useful goes up.
              </p>
              <div className="mt-5 flex justify-center">
                <NewsletterForm />
              </div>
            </div>
          </article>

          <TableOfContents headings={headings} />
        </div>
      </div>
    </>
  );
}
