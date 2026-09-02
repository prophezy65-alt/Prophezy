"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useGenerateNote,
  useFolders,
  parseJsonResponse,
  type ApiFolder,
  type GenerateNotePayload,
} from "@/lib/notes/hooks/use-notes";
import type { NoteType } from "@/lib/notes/models/types";

const NOTE_TYPE_GROUPS: { label: string; options: { value: NoteType; label: string }[] }[] = [
  {
    label: "Study notes",
    options: [
      { value: "detailed", label: "Detailed notes" },
      { value: "short", label: "Short notes" },
      { value: "one_page", label: "One-page summary" },
      { value: "chapter", label: "Chapter notes" },
      { value: "unit", label: "Unit notes" },
      { value: "topic", label: "Topic notes" },
      { value: "lecture", label: "Lecture notes" },
      { value: "key_points", label: "Key points" },
    ],
  },
  {
    label: "Exam prep",
    options: [
      { value: "revision", label: "Revision notes" },
      { value: "exam", label: "Exam notes" },
      { value: "cheat_sheet", label: "Cheat sheet" },
    ],
  },
  {
    label: "Reference sheets",
    options: [
      { value: "formula_sheet", label: "Formula sheet" },
      { value: "definition_sheet", label: "Definition sheet" },
      { value: "comparison_table", label: "Comparison table" },
    ],
  },
  {
    label: "Visual & structured",
    options: [
      { value: "concept_map", label: "Concept map" },
      { value: "flow_notes", label: "Flow notes" },
      { value: "mindmap", label: "Mind map" },
      { value: "flashcards", label: "Flashcards" },
    ],
  },
];

const LEARNING_MODES = [
  "beginner", "intermediate", "advanced", "exam_prep", "revision",
  "last_minute", "quick_read", "deep_study", "concept_learning", "competitive_exam",
] as const;

export function GenerateNoteDialog({
  open,
  onClose,
  defaultFolderId,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  defaultFolderId?: string | null;
  onCreated: (noteId: string) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [noteType, setNoteType] = useState<NoteType>("detailed");
  const [sourceText, setSourceText] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [learningMode, setLearningMode] = useState<string>("");
  const [focusTopic, setFocusTopic] = useState("");
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<{ uploadId: string; sourceKind: GenerateNotePayload["sourceKind"] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: folders } = useFolders();
  const generate = useGenerateNote();

  if (!open) return null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadedFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/notes/upload", { method: "POST", body: formData });
      const body = await parseJsonResponse<{ uploadId: string; sourceKind: GenerateNotePayload["sourceKind"]; sourceText: string; sourceTitle?: string }>(res);

      setSourceText(body.sourceText);
      setSourceTitle(body.sourceTitle ?? file.name);
      setUploadInfo({ uploadId: body.uploadId, sourceKind: body.sourceKind });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to process the uploaded file");
      setUploadedFileName(null);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    if (!sourceText.trim()) {
      onError("Paste some text or upload a file first.");
      return;
    }

    const payload: GenerateNotePayload = {
      noteType,
      sourceKind: mode === "upload" && uploadInfo ? uploadInfo.sourceKind : "plain_text",
      sourceText,
      sourceTitle: sourceTitle || undefined,
      uploadId: uploadInfo?.uploadId,
      learningMode: (learningMode || undefined) as GenerateNotePayload["learningMode"],
      focusTopic: focusTopic || undefined,
      folderId: folderId || null,
    };

    generate.mutate(payload, {
      onSuccess: (data) => {
        onCreated(data.note.id);
        handleClose();
      },
      onError: (err) => onError(err instanceof Error ? err.message : "Failed to generate notes"),
    });
  }

  function handleClose() {
    setSourceText("");
    setSourceTitle("");
    setFocusTopic("");
    setUploadedFileName(null);
    setUploadInfo(null);
    setMode("paste");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-signal" />
            <h2 className="font-display text-lg font-medium text-ink">Generate notes with AI</h2>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1 text-mist hover:bg-ink/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-mist">Note type</label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as NoteType)}
              style={{ colorScheme: "dark" }}
              className="h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            >
              {NOTE_TYPE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label} className="bg-[#111214] text-white">
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#111214] text-white">
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex gap-2">
              <button
                onClick={() => setMode("paste")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === "paste" ? "bg-signal/10 text-signal" : "text-mist hover:bg-ink/5"
                )}
              >
                Paste text
              </button>
              <button
                onClick={() => setMode("upload")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  mode === "upload" ? "bg-signal/10 text-signal" : "text-mist hover:bg-ink/5"
                )}
              >
                Upload file
              </button>
            </div>

            {mode === "paste" ? (
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste your textbook chapter, lecture transcript, or any study material here…"
                rows={8}
                className="w-full rounded-xl border border-border bg-surface/40 p-4 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
              />
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/30 py-8 text-sm text-mist transition-colors hover:border-signal/50 hover:text-ink disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  {uploading ? "Extracting text…" : uploadedFileName ?? "Click to upload PDF, DOCX, TXT, or Markdown"}
                </button>
                {sourceText && !uploading && (
                  <p className="mt-2 text-xs text-mist">
                    {sourceText.trim().split(/\s+/).length.toLocaleString()} words extracted
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Title (optional)"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
            />
            <Input
              placeholder="Focus topic (optional)"
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={learningMode}
              onChange={(e) => setLearningMode(e.target.value)}
              style={{ colorScheme: "dark" }}
              className="h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            >
              <option value="" className="bg-[#111214] text-white">
                Learning mode (optional)
              </option>
              {LEARNING_MODES.map((m) => (
                <option key={m} value={m} className="bg-[#111214] text-white">
                  {m.replace(/_/g, " ")}
                </option>
              ))}
            </select>

            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              style={{ colorScheme: "dark" }}
              className="h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            >
              <option value="" className="bg-[#111214] text-white">
                No folder
              </option>
              {(folders ?? []).map((f: ApiFolder) => (
                <option key={f.id} value={f.id} className="bg-[#111214] text-white">
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={generate.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={generate.isPending || uploading}>
            {generate.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
