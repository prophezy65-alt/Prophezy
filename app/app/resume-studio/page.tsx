"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Loader2, Sparkles, Upload } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Resume, TemplateId, ResumeContent } from "@/lib/resume-studio/models/resume.model";
import { listTemplates } from "@/lib/resume-studio/utils/resume-template";
import { createEmptyResumeContent, mergeIntoResumeContent } from "@/lib/resume-studio/utils/resume-content";

import { apiFetch } from "@/lib/resume-studio/client/api";

function useResumes() {
  return useQuery({
    queryKey: ["resume-studio", "list"],
    queryFn: () => apiFetch<Resume[]>("/api/resume-studio"),
    retry: 1,
  });
}

export default function ResumeStudioPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: resumes, isLoading, isError, error } = useResumes();
  const templates = useMemo(() => listTemplates(), []);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTemplate, setNewTemplate] = useState<TemplateId>("professional");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 3500);
  }

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; templateId: TemplateId }) =>
      apiFetch<Resume>("/api/resume-studio", {
        method: "POST",
        body: JSON.stringify({
          title: payload.title,
          templateId: payload.templateId,
          content: createEmptyResumeContent(),
        }),
      }),
    onSuccess: (resume) => {
      queryClient.invalidateQueries({ queryKey: ["resume-studio", "list"] });
      router.push(`/app/resume-studio/${resume.id}`);
    },
    onError: (err: Error) => showToast("error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/resume-studio/${id}`, { method: "DELETE" }),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["resume-studio", "list"] });
      const previous = queryClient.getQueryData<Resume[]>(["resume-studio", "list"]);
      queryClient.setQueryData<Resume[]>(["resume-studio", "list"], (old) =>
        (old ?? []).filter((r) => r.id !== id)
      );
      return { previous };
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["resume-studio", "list"], context.previous);
      showToast("error", err.message);
    },
    onSuccess: () => showToast("success", "Resume deleted."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["resume-studio", "list"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.kind === "success"
              ? "border-emerald-500/30 bg-emerald-950/80 text-emerald-300"
              : "border-red-500/30 bg-red-950/80 text-red-300"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Resume Studio</h1>
          <p className="mt-1 text-sm text-mist">Build, score, and refine your resume with real-time ATS feedback.</p>
        </div>
        <div className="flex gap-2">
          <ImportButton
            onImported={(resumeId) => router.push(`/app/resume-studio/${resumeId}`)}
            onError={(msg) => showToast("error", msg)}
          />
          <Button onClick={() => setCreating(true)} disabled={createMutation.isPending}>
            <Plus size={16} className="mr-1.5" /> New resume
          </Button>
        </div>
      </div>

      {creating && (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Create a new resume</CardTitle>
            <CardDescription>Give it a name and pick a starting template — you can change both later.</CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="e.g. Software Engineer Resume"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="sm:max-w-xs"
            />
            <select
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value as TemplateId)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!newTitle.trim()) {
                    showToast("error", "Give your resume a title first.");
                    return;
                  }
                  createMutation.mutate({ title: newTitle.trim(), templateId: newTemplate });
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Sparkles size={16} className="mr-1.5" />}
                Create
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)} disabled={createMutation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading && (
        <div className="flex min-h-[30vh] items-center justify-center text-sm text-mist">
          <Loader2 size={18} className="mr-2 animate-spin" /> Loading your resumes…
        </div>
      )}

      {isError && (
        <Card className="border-red-500/30">
          <CardDescription className="text-red-300">
            {error instanceof Error ? error.message : "Failed to load resumes."}
          </CardDescription>
        </Card>
      )}

      {!isLoading && !isError && resumes && resumes.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <FileText size={32} className="text-mist" strokeWidth={1.5} />
          <CardTitle>No resumes yet</CardTitle>
          <CardDescription>Create one from scratch, or import an existing PDF/DOCX to get started faster.</CardDescription>
          <div className="mt-2 flex gap-2">
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} className="mr-1.5" /> New resume
            </Button>
            <ImportButton
              onImported={(resumeId) => router.push(`/app/resume-studio/${resumeId}`)}
              onError={(msg) => showToast("error", msg)}
            />
          </div>
        </Card>
      )}

      {!isLoading && !isError && resumes && resumes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <Card key={resume.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate">{resume.title}</CardTitle>
                  <CardDescription>
                    Updated {new Date(resume.updatedAt).toLocaleDateString()} · v{resume.currentVersion}
                  </CardDescription>
                </div>
                <Badge tone="neutral">{resume.templateId}</Badge>
              </div>
              {resume.targetRole && <p className="text-xs text-mist">Targeting: {resume.targetRole}</p>}
              <div className="mt-auto flex gap-2">
                <Button className="flex-1" onClick={() => router.push(`/app/resume-studio/${resume.id}`)}>
                  Open
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete "${resume.title}"? This can't be undone.`)) {
                      deleteMutation.mutate(resume.id);
                    }
                  }}
                  disabled={deleteMutation.isPending && deleteMutation.variables === resume.id}
                >
                  {deleteMutation.isPending && deleteMutation.variables === resume.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportButton({
  onImported,
  onError,
}: {
  onImported: (resumeId: string) => void;
  onError: (message: string) => void;
}) {
  const [importing, setImporting] = useState(false);

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const parsed = await apiFetch<{ content: Partial<ResumeContent>; warnings: string[] }>(
        "/api/resume-studio/import",
        { method: "POST", body: formData }
      );
      const created = await apiFetch<Resume>("/api/resume-studio", {
        method: "POST",
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, "") || "Imported resume",
          templateId: "professional",
          content: mergeIntoResumeContent(parsed.content),
        }),
      });
      onImported(created.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center rounded-md border border-border bg-surface px-4 py-2 text-sm text-ink hover:bg-white/5">
      {importing ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Upload size={16} className="mr-1.5" />}
      Import PDF/DOCX
      <input
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        disabled={importing}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}
