"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

// lucide-react dropped brand/logo icons (including GitHub's) in a past
// major version for trademark reasons, so there's no "Github" export to
// import anymore -- using this repo's own inline mark instead, sized to
// match lucide's icon props for a drop-in swap.
function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.2 1.76 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.72 0-1.26.45-2.3 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.6.23 2.76.11 3.05.74.8 1.19 1.84 1.19 3.1 0 4.45-2.7 5.42-5.27 5.71.42.36.78 1.07.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .3.21.66.8.55A10.53 10.53 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
import type { LibraryProjectListItem } from "./useProjectLibraryApi";

const DIFFICULTY_LABEL: Record<LibraryProjectListItem["difficulty"], string> = {
  beginner: "BEGINNER",
  intermediate: "INTERMEDIATE",
  advanced: "ADVANCED",
};

export default function ProjectLibraryCard({ project }: { project: LibraryProjectListItem }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative rounded-2xl border border-white/[0.08] bg-[#131318] p-7 transition-colors hover:border-[#FF5A36]/50"
    >
      {/* ember glow on hover — the one bit of boldness on an otherwise quiet card */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(160px_100px_at_20%_0%,rgba(255,90,54,0.12),transparent)]" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#FF5A36]">
            {project.domain}
          </span>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[#8B8A96]">
            {DIFFICULTY_LABEL[project.difficulty]}
          </span>
        </div>

        <h3 className="mb-2 text-2xl font-bold leading-snug text-[#F3F1EC]">{project.title}</h3>
        {project.subdomain && <p className="mb-3 text-sm text-[#8B8A96]">{project.subdomain}</p>}

        <p className="mb-6 line-clamp-4 text-[15px] leading-relaxed text-[#A5A4AF]">{project.description}</p>

        {project.techStack.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {project.techStack.slice(0, 6).map((tech) => (
              <span
                key={tech}
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-[#B9B8C2]"
              >
                {tech}
              </span>
            ))}
            {project.techStack.length > 6 && (
              <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-[#8B8A96]">
                +{project.techStack.length - 6}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
          <Link
            href={`/app/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 text-base font-semibold text-[#F3F1EC] transition-colors hover:text-[#FF5A36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A36]"
          >
            View project <ArrowUpRight size={16} />
          </Link>
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on GitHub"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#8B8A96] transition-colors hover:bg-white/[0.06] hover:text-[#F3F1EC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5A36]"
            >
              <GithubMark size={18} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
