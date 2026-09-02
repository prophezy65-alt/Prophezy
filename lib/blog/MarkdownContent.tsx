"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyHeading } from "./slugify";

function headingText(children: React.ReactNode): string {
  return Array.isArray(children) ? children.map((c) => (typeof c === "string" ? c : "")).join("") : String(children ?? "");
}

export default function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-invert prose-headings:font-medium max-w-none prose-headings:tracking-tight prose-p:leading-relaxed prose-p:text-white/70 prose-li:text-white/70 prose-strong:text-white prose-a:text-[#5ff2ff] prose-code:text-[#5ff2ff] prose-h2:mt-10 prose-h2:text-xl prose-h3:mt-8 prose-h3:text-lg prose-pre:bg-white/[0.04] prose-pre:border prose-pre:border-white/[0.08]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 id={slugifyHeading(headingText(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={slugifyHeading(headingText(children))}>{children}</h3>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
