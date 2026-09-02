"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles, Upload, FileText, X, ArrowLeft, ClipboardPaste } from "lucide-react";

const ACCENT = "#5ff2ff";

export default function PasteOrUploadAssignmentPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"paste" | "upload">("paste");

  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSolvePasted(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 5) {
      setSolveError("Paste in the question text first.");
      return;
    }
    setSolving(true);
    setSolveError(null);
    try {
      const res = await fetch("/api/assignment/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), subject: subject.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to solve.");
      router.push(`/app/assignments/${data.document.id}`);
    } catch (err) {
      setSolveError(err instanceof Error ? err.message : "Failed to solve.");
    } finally {
      setSolving(false);
    }
  }

  async function handleUploadAndSolve(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError("Choose a file first.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("files", file);
      if (subject.trim()) body.append("subject", subject.trim());
      const res = await fetch("/api/assignment/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Upload failed.");
      const first = data.documents?.[0];
      if (first?.id) router.push(`/app/assignments/${first.id}`);
      else router.push("/app/assignments");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/app/assignments" className="mb-4 flex w-fit items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <ArrowLeft size={14} /> Back to assignments
      </Link>
      <h1 className="mb-6 text-2xl font-medium text-white" style={{ fontFamily: "var(--font-display)" }}>
        Solve a question
      </h1>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs"
          style={{ borderColor: mode === "paste" ? ACCENT : "rgba(255,255,255,0.1)", color: mode === "paste" ? ACCENT : "rgba(255,255,255,0.6)" }}
        >
          <ClipboardPaste size={13} /> Paste a question
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs"
          style={{ borderColor: mode === "upload" ? ACCENT : "rgba(255,255,255,0.1)", color: mode === "upload" ? ACCENT : "rgba(255,255,255,0.6)" }}
        >
          <Upload size={13} /> Upload a file
        </button>
      </div>

      {mode === "paste" ? (
        <form onSubmit={handleSolvePasted} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Paste your question(s)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste one or more questions here — e.g. 'Explain the difference between TCP and UDP.'"
            rows={8}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          <label className="mb-1.5 mt-4 block text-[11px] uppercase tracking-[0.1em] text-white/40">Subject (optional)</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Computer Networks"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          {solveError && <p className="mt-3 text-sm text-red-400">{solveError}</p>}
          <button
            type="submit"
            disabled={solving}
            className="mt-5 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-black transition-all disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {solving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {solving ? "Solving…" : "Solve"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleUploadAndSolve} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <label className="mb-1.5 block text-[11px] uppercase tracking-[0.1em] text-white/40">Upload a PDF, Word doc, or image</label>
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-sm text-white/40 hover:border-white/30 hover:text-white/60"
            >
              <Upload size={18} />
              Click to choose a file, or drag it here
              <span className="text-xs text-white/25">PDF, DOCX, TXT, Markdown, images, ZIP, PPTX — up to 50MB each</span>
            </button>
          ) : (
            <div className="flex h-11 items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4">
              <span className="flex items-center gap-2 truncate text-sm text-white/80">
                <FileText size={14} className="shrink-0" style={{ color: ACCENT }} />
                <span className="truncate">{file.name}</span>
              </span>
              <button type="button" onClick={() => setFile(null)} className="shrink-0 text-white/30 hover:text-white/60">
                <X size={14} />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <label className="mb-1.5 mt-4 block text-[11px] uppercase tracking-[0.1em] text-white/40">Subject (optional)</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Thermodynamics"
            className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
          {uploadError && <p className="mt-3 text-sm text-red-400">{uploadError}</p>}
          <button
            type="submit"
            disabled={uploading}
            className="mt-5 flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-black transition-all disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? "Uploading & solving…" : "Upload & Solve"}
          </button>
        </form>
      )}
    </div>
  );
}
