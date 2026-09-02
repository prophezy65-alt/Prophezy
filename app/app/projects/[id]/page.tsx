"use client";

/**
 * app/projects/[id]/page.tsx
 *
 * Renders exactly the stored project_library row. No AI fills in gaps —
 * a missing field simply doesn't render its section at all, rather than
 * a guess.
 */

import { useParams } from "next/navigation";
import { ExternalLink, BookOpen, ArrowLeft, Layers } from "lucide-react";

// Same inline mark as ProjectLibraryCard.tsx -- lucide-react dropped
// brand/logo icons (including GitHub's) in a past major version.
function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.2 1.76 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.72 0-1.26.45-2.3 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.6.23 2.76.11 3.05.74.8 1.19 1.84 1.19 3.1 0 4.45-2.7 5.42-5.27 5.71.42.36.78 1.07.78 2.17 0 1.57-.01 2.83-.01 3.21 0 .3.21.66.8.55A10.53 10.53 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
import Link from "next/link";
import { useProjectLibraryDetail } from "../useProjectLibraryApi";

function ReadmeImages({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  return (
    <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable dimensions from arbitrary repos
        <img
          key={src}
          src={src}
          alt={`Screenshot ${i + 1} from the project's README`}
          className="h-48 w-full rounded-xl border border-white/[0.08] bg-[#131318] object-cover"
          loading="lazy"
          onError={(e) => {
            // A real README image can 404 (renamed file, private repo
            // asset, etc.) -- hide it rather than show a broken-image
            // icon. Never substitute a placeholder image in its place.
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ))}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#FF5A36]">{children}</p>;
}

function ReadmeExcerpt({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <Eyebrow>From the README</Eyebrow>
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#B9B8C2]">{text}</p>
    </div>
  );
}

function Section({ label, value }: { label: string; value: string | null }) {
  if (!value || value.trim().length === 0) return null;
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="text-[15px] leading-relaxed text-[#B9B8C2]">{value}</p>
    </div>
  );
}

function ListSection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-[#B9B8C2]">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#FF5A36]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-xs text-[#B9B8C2]">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const { project, isLoading, error } = useProjectLibraryDetail(params.id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-8 w-2/3 rounded bg-white/[0.06]" />
          <div className="h-4 w-1/3 rounded bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0B0B0F] px-6 py-16 sm:px-10">
        <p className="text-sm text-red-400">{error ?? "Project not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0F] font-[family-name:var(--font-body)]">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <Link href="/app/projects" className="mb-8 inline-flex items-center gap-1.5 text-sm text-[#9A99A6] transition-colors hover:text-[#F3F1EC]">
          <ArrowLeft size={14} /> All projects
        </Link>

        <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#FF5A36]">
          <Layers size={13} />
          {project.domain}
          {project.subdomain && <span className="text-[#8B8A96]">/ {project.subdomain}</span>}
        </div>
        <h1 className="mb-4 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight text-[#F3F1EC] sm:text-4xl">
          {project.title}
        </h1>
        <span className="mb-8 inline-block rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-[#9A99A6]">
          {project.difficulty}
        </span>

        <div className="mb-10 flex flex-wrap gap-3">
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF5A36] px-5 py-3 text-sm font-bold text-[#0B0B0F] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3F1EC]"
            >
              <GithubMark size={16} /> View on GitHub
            </a>
          )}
          {project.demoUrl && (
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-[#F3F1EC] transition-colors hover:border-white/[0.2]"
            >
              <ExternalLink size={15} /> Live demo
            </a>
          )}
          {project.documentationUrl && (
            <a
              href={project.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-[#F3F1EC] transition-colors hover:border-white/[0.2]"
            >
              <BookOpen size={15} /> Docs
            </a>
          )}
          {project.tutorialUrl && (
            <a
              href={project.tutorialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-[#F3F1EC] transition-colors hover:border-white/[0.2]"
            >
              <BookOpen size={15} /> Tutorial
            </a>
          )}
        </div>

        <ReadmeImages images={project.readmeImages} />

        <div className="space-y-8 border-t border-white/[0.06] pt-8">
          <Section label="Overview" value={project.description} />
          <ReadmeExcerpt text={project.readmeExcerpt} />
          <Section label="Problem" value={project.problemStatement} />
          <Section label="Solution" value={project.solutionOverview} />
          <Section label="Architecture" value={project.architecture} />
          <ListSection label="Modules" items={project.modules} />
          <ChipRow label="Tech Stack" items={project.techStack} />
          <ChipRow label="Skills" items={project.skills} />
          <ListSection label="Prerequisites" items={project.prerequisites} />
          <ListSection label="Development Steps" items={project.developmentSteps} />
          <Section label="Expected Output" value={project.expectedOutput} />

          {(project.estimatedHoursMin || project.teamSizeMin) && (
            <div className="grid grid-cols-2 gap-6">
              <Section
                label="Estimated Time"
                value={project.estimatedHoursMin && project.estimatedHoursMax ? `${project.estimatedHoursMin}–${project.estimatedHoursMax} hours` : null}
              />
              <Section
                label="Team Size"
                value={project.teamSizeMin && project.teamSizeMax ? `${project.teamSizeMin}–${project.teamSizeMax} people` : null}
              />
            </div>
          )}

          <Section label="Dataset / API Info" value={[project.datasetInfo, project.apiInfo].filter(Boolean).join(" · ") || null} />

          <div className="flex items-center gap-2 border-t border-white/[0.06] pt-6 font-mono text-xs text-[#8B8A96]">
            SOURCE: {project.source}
            {project.sourceUrl && (
              <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#FF5A36] hover:underline">
                verify →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
