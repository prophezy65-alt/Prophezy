"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ClipboardList, FileUp, Loader2, Search, Trash2, TriangleAlert, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DocumentSummary } from "@/lib/assignment-db/mappers";
import type { ListDocumentsResult } from "@/lib/assignment-db/repository";

interface AssignmentsWorkspaceProps {
  initialResult: ListDocumentsResult;
}

const STATUS_TONE: Record<DocumentSummary["status"], "signal" | "success" | "pulse"> = {
  processing: "pulse",
  ready: "success",
  failed: "pulse",
};

const DIFFICULTY_OPTIONS = ["", "easy", "medium", "hard", "expert"] as const;

export function AssignmentsWorkspace({ initialResult }: AssignmentsWorkspaceProps) {
  const [result, setResult] = useState<ListDocumentsResult>(initialResult);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [page, setPage] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [uploadSubject, setUploadSubject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async (opts: { search: string; subject: string; difficulty: string; page: number }) => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ page: String(opts.page), pageSize: "20" });
      if (opts.search.trim()) params.set("search", opts.search.trim());
      if (opts.subject.trim()) params.set("subject", opts.subject.trim());
      if (opts.difficulty) params.set("difficulty", opts.difficulty);

      const res = await fetch(`/api/assignment?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as ListDocumentsResult;
      setResult(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchDocuments({ search, subject, difficulty, page });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, subject, difficulty, page, fetchDocuments]);

  async function handleUpload() {
    if (files.length === 0) {
      setUploadError("Choose at least one file to upload.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      if (uploadSubject.trim()) formData.append("subject", uploadSubject.trim());

      const res = await fetch("/api/assignment/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? data.error ?? `Upload failed (${res.status})`);

      setFiles([]);
      setUploadSubject("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocuments({ search, subject, difficulty, page: 0 });
      setPage(0);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    try {
      const res = await fetch(`/api/assignment/${documentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setResult((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== documentId),
        total: Math.max(0, prev.total - 1),
      }));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to delete assignment");
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Assignment AI</h1>
        <p className="mt-1 text-sm text-mist">
          Upload an assignment, notes, or worksheet — get step-by-step AI solutions per question, in the depth mode you
          need, exportable to PDF, DOCX, or Markdown.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <FileUp size={18} className="text-signal" />
          <h2 className="font-display text-base font-medium text-ink">Upload an assignment</h2>
        </div>

        <div className="mt-4 space-y-3">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 text-center transition-colors hover:border-signal/50 hover:bg-signal/5",
            )}
          >
            <UploadCloud size={22} className="text-mist" />
            <span className="text-sm text-ink">
              {files.length > 0 ? `${files.length} file(s) selected` : "Click to choose files, or drag them here"}
            </span>
            <span className="text-xs text-mist">PDF, DOCX, TXT, Markdown, images, ZIP, PPTX — up to 50MB each</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              accept=".pdf,.docx,.doc,.txt,.md,.markdown,.png,.jpg,.jpeg,.webp,.zip,.ppt,.pptx"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Subject (optional — e.g. Thermodynamics)"
              value={uploadSubject}
              onChange={(e) => setUploadSubject(e.target.value)}
              className="sm:flex-1"
            />
            <Button onClick={handleUpload} disabled={uploading || files.length === 0}>
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <FileUp size={16} /> Upload &amp; Solve
                </>
              )}
            </Button>
          </div>

          {uploadError && (
            <p className="flex items-center gap-1.5 text-xs text-danger">
              <TriangleAlert size={13} /> {uploadError}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
            <Input
              placeholder="Search your assignments by question text or title…"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="Filter by subject"
            value={subject}
            onChange={(e) => {
              setPage(0);
              setSubject(e.target.value);
            }}
            className="sm:w-48"
          />
          <select
            value={difficulty}
            onChange={(e) => {
              setPage(0);
              setDifficulty(e.target.value);
            }}
            className="h-11 rounded-xl border border-border bg-surface/40 px-3 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30 sm:w-40"
          >
            <option value="">Any difficulty</option>
            {DIFFICULTY_OPTIONS.filter(Boolean).map((d) => (
              <option key={d} value={d}>
                {d[0]?.toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {listError && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <TriangleAlert size={16} /> {listError}
        </div>
      )}

      {listLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink/5" />
          ))}
        </div>
      ) : result.documents.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <ClipboardList size={26} className="text-mist" />
          <p className="text-sm font-medium text-ink">No assignments yet</p>
          <p className="max-w-sm text-xs text-mist">
            Upload a document above and Assignment AI will detect every question and generate step-by-step solutions on
            demand.
          </p>
        </Card>
      ) : (
        <motion.div layout className="grid gap-3 sm:grid-cols-2">
          {result.documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDelete={() => handleDelete(doc.id)} />
          ))}
        </motion.div>
      )}

      {result.total > result.pageSize && (
        <div className="flex items-center justify-between text-sm text-mist">
          <span>
            Page {page + 1} of {totalPages} · {result.total} assignment{result.total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCard({ doc, onDelete }: { doc: DocumentSummary; onDelete: () => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/app/assignments/${doc.id}`} className="min-w-0 flex-1">
          <h3 className="truncate font-display text-sm font-medium text-ink hover:text-signal">{doc.title}</h3>
        </Link>
        <Badge tone={STATUS_TONE[doc.status]}>{doc.status}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-mist">
        <span>{doc.subject || doc.detectedSubjectArea || "General"}</span>
        <span>·</span>
        <span>
          {doc.questionCount} question{doc.questionCount === 1 ? "" : "s"}
        </span>
        <span>·</span>
        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
      </div>

      {doc.status === "failed" && doc.errorMessage && (
        <p className="text-xs text-danger">{doc.errorMessage}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        <Link href={`/app/assignments/${doc.id}`}>
          <Button variant="secondary" size="sm">
            Continue working
          </Button>
        </Link>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-mist transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="Delete assignment"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </Card>
  );
}
