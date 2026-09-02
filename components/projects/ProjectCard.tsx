"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FolderKanban, Trash2, ArrowRight, Star, Archive, Copy, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SavedProject } from "./useProjectGeneratorApi";

interface ProjectCardProps {
  project: SavedProject;
  onDelete: (projectId: string) => void;
  onToggleFavorite: (projectId: string, favorite: boolean) => void;
  onDuplicate: (projectId: string) => void;
  onArchive: (projectId: string) => void;
  isDeleting: boolean;
  isDuplicating: boolean;
}

const STATUS_TONE: Record<SavedProject["status"], "signal" | "neutral" | "danger" | "success"> = {
  draft: "neutral",
  generating: "signal",
  ready: "success",
  failed: "danger",
};

export default function ProjectCard({
  project,
  onDelete,
  onToggleFavorite,
  onDuplicate,
  onArchive,
  isDeleting,
  isDuplicating,
}: ProjectCardProps) {
  const isGenerating = project.status === "generating";

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
      <Card className="group relative h-full">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal/10 text-signal">
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FolderKanban size={16} />}
            </div>
            <div className="min-w-0">
              <CardTitle className="line-clamp-1">{project.title}</CardTitle>
              <CardDescription className="line-clamp-1">{project.tagline ?? "No tagline yet"}</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleFavorite(project.id, !project.is_favorite);
              }}
              className={project.is_favorite ? "text-pulse" : "text-mist hover:text-pulse"}
              aria-label={project.is_favorite ? "Remove favorite" : "Mark favorite"}
            >
              <Star size={15} fill={project.is_favorite ? "currentColor" : "none"} />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onDuplicate(project.id);
              }}
              disabled={isDuplicating}
              className="text-mist hover:text-ink"
              aria-label="Duplicate project"
            >
              <Copy size={15} />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onArchive(project.id);
              }}
              className="text-mist hover:text-ink"
              aria-label="Archive project"
            >
              <Archive size={15} />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(project.id);
              }}
              disabled={isDeleting}
              className="text-mist hover:text-danger"
              aria-label="Delete project"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </CardHeader>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
          {project.domains.slice(0, 2).map((domain) => (
            <Badge key={domain} tone="neutral">
              {domain.replace(/_/g, " ")}
            </Badge>
          ))}
          {project.domains.length > 2 && <Badge tone="neutral">+{project.domains.length - 2}</Badge>}
        </div>

        {project.status === "ready" && (
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface/60">
            <div className="h-full rounded-full bg-signal transition-all" style={{ width: `${project.progress_percent}%` }} />
          </div>
        )}

        {project.status === "failed" && project.error_message && (
          <p className="mb-3 line-clamp-2 text-xs text-danger">{project.error_message}</p>
        )}

        {project.status === "generating" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-mist">
            <Loader2 size={14} className="animate-spin" /> Generating...
          </span>
        ) : (
          <Link
            href={`/app/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-signal hover:underline"
          >
            Open project <ArrowRight size={14} />
          </Link>
        )}
      </Card>
    </motion.div>
  );
}
