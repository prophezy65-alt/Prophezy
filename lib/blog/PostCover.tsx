import { generateCoverSvg } from "./coverGenerator";

export default function PostCover({
  slug,
  categorySlug,
  title,
  className,
}: {
  slug: string;
  categorySlug?: string | null;
  title: string;
  className?: string;
}) {
  const svg = generateCoverSvg({ slug, categorySlug, title });
  return (
    <div
      className={`overflow-hidden ${className ?? ""}`}
      // Generated locally from the post's slug/category — not user input,
      // so this is safe to inject directly.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
