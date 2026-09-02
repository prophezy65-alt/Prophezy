"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadPaper } from "./useResearchQueries";
import { useResearchToast } from "./ResearchToast";
import { ResearchApiError } from "./researchApi";

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const upload = useUploadPaper();
  const toast = useResearchToast();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported.");
      return;
    }
    try {
      const { paper } = await upload.mutateAsync(file);
      toast.success(`"${paper.title}" uploaded and processed.`);
    } catch (err) {
      toast.error(err instanceof ResearchApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFile(e.dataTransfer.files[0]);
      }}
      className={`glass-panel flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors ${
        isDragging ? "border-signal/60 bg-surface" : "border-border/60"
      }`}
    >
      <UploadCloud className="h-6 w-6 text-signal" />
      <p className="text-sm text-ink">Drag a PDF here, or</p>
      <Button
        variant="secondary"
        size="sm"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Processing…
          </>
        ) : (
          "Choose file"
        )}
      </Button>
      <p className="text-xs text-mist">OCR, chunking, and embeddings run automatically after upload.</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
