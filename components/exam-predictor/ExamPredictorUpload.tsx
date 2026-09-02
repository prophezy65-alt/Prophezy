"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X, ClipboardPaste } from "lucide-react";
import { EXAM_PREDICTOR_COLORS as C } from "./palette";

interface Props {
  onAnalyze: (input: { syllabusFile: File | null; syllabusText: string; previousPapers: File[]; questionCount: number }) => void;
  disabled?: boolean;
}

const ACCEPT = ".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt";
const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 40;
const DEFAULT_QUESTIONS = 12;

function GhostButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-base font-medium transition-colors disabled:opacity-50"
      style={{ borderColor: C.lightSand, color: C.lightSand, background: "transparent" }}
    >
      {children}
    </button>
  );
}

export function ExamPredictorUpload({ onAnalyze, disabled }: Props) {
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusText, setSyllabusText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [previousPapers, setPreviousPapers] = useState<File[]>([]);
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTIONS);

  const syllabusInputRef = useRef<HTMLInputElement>(null);
  const papersInputRef = useRef<HTMLInputElement>(null);

  const canAnalyze = Boolean(syllabusFile || syllabusText.trim());

  return (
    <div className="w-full max-w-3xl rounded-2xl p-8 sm:p-10" style={{ background: C.canvas, border: `1px solid ${C.wineRed}` }}>
      <div className="mb-7">
        <h2 className="text-3xl font-bold tracking-tight" style={{ color: C.onCanvas }}>
          Predict your next exam
        </h2>
        <p className="mt-2 text-base" style={{ color: C.onCanvasMuted }}>
          Upload your syllabus and previous papers. I&apos;ll analyze the patterns and help you prepare.
        </p>
      </div>

      {/* Syllabus */}
      <div className="mb-6">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: C.onCanvasMuted }}>
          Syllabus
        </p>
        {syllabusFile ? (
          <div
            className="flex items-center justify-between rounded-lg px-4 py-3 text-base"
            style={{ background: C.wineRed, color: C.onWineRed }}
          >
            <span className="flex items-center gap-2 truncate">
              <FileText size={18} />
              {syllabusFile.name}
            </span>
            <button onClick={() => setSyllabusFile(null)} aria-label="Remove syllabus file" disabled={disabled}>
              <X size={18} />
            </button>
          </div>
        ) : showPaste ? (
          <textarea
            value={syllabusText}
            onChange={(e) => setSyllabusText(e.target.value)}
            placeholder="Paste your syllabus text here..."
            rows={6}
            disabled={disabled}
            className="w-full rounded-lg border p-4 text-base outline-none"
            style={{ borderColor: C.wineRed, color: C.onCanvas, background: C.wineRedFaint }}
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            <GhostButton disabled={disabled} onClick={() => syllabusInputRef.current?.click()}>
              <UploadCloud size={17} /> Upload Syllabus
            </GhostButton>
            <GhostButton disabled={disabled} onClick={() => setShowPaste(true)}>
              <ClipboardPaste size={17} /> Paste Syllabus
            </GhostButton>
          </div>
        )}
        <input
          ref={syllabusInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setSyllabusFile(file);
              setSyllabusText("");
              setShowPaste(false);
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* Previous papers */}
      <div className="mb-7">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: C.onCanvasMuted }}>
          Previous question papers (optional)
        </p>
        <div className="mb-2.5 flex flex-col gap-2">
          {previousPapers.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-lg border px-4 py-3 text-base"
              style={{ borderColor: C.wineRed, color: C.onCanvas }}
            >
              <span className="flex items-center gap-2 truncate">
                <FileText size={18} />
                {file.name}
              </span>
              <button
                onClick={() => setPreviousPapers((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
        <GhostButton disabled={disabled} onClick={() => papersInputRef.current?.click()}>
          <UploadCloud size={17} /> Upload Question Paper
        </GhostButton>
        <input
          ref={papersInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) setPreviousPapers((prev) => [...prev, ...files]);
            e.target.value = "";
          }}
        />
      </div>

      {/* Question count */}
      <div className="mb-7">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: C.onCanvasMuted }}>
          Number of questions
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={MIN_QUESTIONS}
            max={MAX_QUESTIONS}
            value={questionCount}
            disabled={disabled}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
            style={{ accentColor: C.lightSand, background: C.wineRed }}
          />
          <input
            type="number"
            min={MIN_QUESTIONS}
            max={MAX_QUESTIONS}
            value={questionCount}
            disabled={disabled}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setQuestionCount(Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, v)));
            }}
            className="w-16 rounded-lg border p-2 text-center text-sm outline-none"
            style={{ borderColor: C.wineRed, color: C.onCanvas, background: C.wineRedFaint }}
          />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: C.onCanvasMuted }}>
          Split roughly 40% high / 35% medium / 25% low probability.
        </p>
      </div>

      <button
        type="button"
        disabled={!canAnalyze || disabled}
        onClick={() => onAnalyze({ syllabusFile, syllabusText: syllabusText.trim(), previousPapers, questionCount })}
        className="w-full rounded-xl py-4 text-base font-semibold transition-opacity disabled:opacity-40"
        style={{ background: C.lightSand, color: C.onSand }}
      >
        Analyze &amp; Predict
      </button>
    </div>
  );
}
