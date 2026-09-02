import type { Heading } from "./slugify";

const ACCENT = "#5ff2ff";

export default function TableOfContents({ headings }: { headings: Heading[] }) {
  if (headings.length === 0) return null;
  return (
    <nav className="sticky top-24 hidden xl:block">
      <div className="mb-3 text-xs uppercase tracking-[0.12em] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
        On this page
      </div>
      <ul className="space-y-2 border-l border-white/[0.08] pl-4">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? "ml-3" : ""}>
            <a
              href={`#${h.id}`}
              className="block text-xs leading-relaxed text-white/45 transition-colors hover:text-white"
              style={{ ["--tw-hover-color" as string]: ACCENT }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
