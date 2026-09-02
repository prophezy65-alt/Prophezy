"use client";

import { useState } from "react";
import { ExamPredictorOrb, type OrbState } from "./ExamPredictorOrb";
import { ExamPredictorUpload } from "./ExamPredictorUpload";
import { PredictionResults } from "./PredictionResults";
import { ExamPredictorChat } from "./ExamPredictorChat";
import { ExamPredictorHistory } from "./ExamPredictorHistory";
import { EXAM_PREDICTOR_COLORS as C } from "./palette";
import type { ExtractedSyllabus, PaperPrediction, PyqMapResult, PredictedQuestion } from "@/lib/syllabus/models/syllabus.types";

interface AnalyzeResponse {
  id: string | null;
  syllabus: ExtractedSyllabus;
  prediction: PaperPrediction;
  pyqMap: PyqMapResult | null;
  previousPapersUsed: number;
  warnings: string[];
}

// Client-side ceiling. The server has its own per-stage 60s timeouts, but if
// something upstream of Next.js (proxy, browser extension, etc.) swallows the
// response entirely, this guarantees the spinner never runs forever.
const CLIENT_TIMEOUT_MS = 100_000;

export default function ExamPredictorClient() {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [externalPrompt, setExternalPrompt] = useState<{ text: string; mode?: "explain" | "solve" | "exam-answer" | "simplify" | "example" | "ask"; nonce: number } | null>(null);
  // Bumped after a new analysis is saved so ExamPredictorHistory refetches.
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [loadingHistoryItem, setLoadingHistoryItem] = useState(false);

  const analyzing = orbState === "reading" || orbState === "comparing" || orbState === "predicting";

  async function handleAnalyze(input: { syllabusFile: File | null; syllabusText: string; previousPapers: File[]; questionCount: number }) {
    setError(null);
    setOrbState("reading");

    const formData = new FormData();
    if (input.syllabusFile) formData.append("syllabusFile", input.syllabusFile);
    if (input.syllabusText) formData.append("syllabusText", input.syllabusText);
    for (const file of input.previousPapers) formData.append("previousPapers", file);
    formData.append("questionCount", String(input.questionCount));

    if (input.previousPapers.length > 0) {
      // Purely cosmetic staging — no artificial delay, just reflects the
      // pipeline's real stages as the single request runs.
      setTimeout(() => setOrbState((s) => (s === "reading" ? "comparing" : s)), 400);
      setTimeout(() => setOrbState((s) => (s === "comparing" ? "predicting" : s)), 900);
    } else {
      setTimeout(() => setOrbState((s) => (s === "reading" ? "predicting" : s)), 400);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/exam-predictor/analyze", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        // Some middleware / other API routes in this app return
        // { ok: false, error: { code, message } } instead of a flat
        // string — handle both shapes so the banner never shows "[object Object]".
        const message =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.code === "UNAUTHORIZED"
              ? "Your session looks signed out. Please log in again and retry."
              : data?.error?.message || data?.message || "Analysis failed.";
        throw new Error(message);
      }
      setResult(data as AnalyzeResponse);
      setOrbState("done");
      setHistoryRefreshKey((k) => k + 1);
    } catch (err) {
      clearTimeout(timeoutId);
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "This is taking much longer than expected (>100s) and was cancelled. Try again, or with a smaller file."
          : err instanceof Error
            ? err.message
            : "Something went wrong.";
      setError(message);
      setOrbState("idle");
    }
  }

  async function handleSelectHistoryItem(id: string) {
    setError(null);
    setLoadingHistoryItem(true);
    try {
      const res = await fetch(`/api/exam-predictor/history/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't load that prediction.");
      setResult(data as AnalyzeResponse);
      setOrbState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that prediction.");
    } finally {
      setLoadingHistoryItem(false);
    }
  }

  // Returns to the same idle hub screen — orb prompt, upload form, and the
  // history list below it — whether the current result came from a fresh
  // analysis or from reopening a saved one.
  function handleBack() {
    setResult(null);
    setError(null);
    setOrbState("idle");
  }

  async function handleDeleteCurrent() {
    if (!result?.id) {
      // A prediction that failed to save (see the analyze route's
      // best-effort save) has no id to delete — just go back.
      handleBack();
      return;
    }
    if (!window.confirm(`Delete the prediction for "${result.syllabus.subjectName}"? This can't be undone.`)) return;

    try {
      const res = await fetch(`/api/exam-predictor/history/${result.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Couldn't delete that prediction.");
      setHistoryRefreshKey((k) => k + 1);
      handleBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that prediction.");
    }
  }

  function handleGetAnswer(q: PredictedQuestion) {
    setExternalPrompt({ text: q.question, mode: "ask", nonce: Date.now() });
  }

  function handleAskStrategy() {
    setExternalPrompt({
      text: "Based on everything you've analyzed, give me a concise exam preparation strategy.",
      mode: "ask",
      nonce: Date.now(),
    });
  }

  return (
    <div className="min-h-screen w-full" style={{ background: C.canvas }}>
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-4 py-14">
        <ExamPredictorOrb state={orbState} />

        {error && (
          <div
            role="alert"
            className="w-full max-w-2xl rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: C.wineRed, color: C.onWineRed, border: `2px solid ${C.lightSand}` }}
          >
            {error}
          </div>
        )}

        {!result && (
          <>
            <ExamPredictorUpload onAnalyze={handleAnalyze} disabled={analyzing || loadingHistoryItem} />
            <ExamPredictorHistory
              refreshKey={historyRefreshKey}
              onSelect={handleSelectHistoryItem}
              disabled={analyzing || loadingHistoryItem}
            />
          </>
        )}

        {result && (
          <>
            <PredictionResults
              syllabus={result.syllabus}
              prediction={result.prediction}
              pyqMap={result.pyqMap}
              previousPapersUsed={result.previousPapersUsed}
              onGetAnswer={handleGetAnswer}
              onAskStrategy={handleAskStrategy}
              onBack={handleBack}
              onDelete={handleDeleteCurrent}
            />
            <ExamPredictorChat syllabus={result.syllabus} prediction={result.prediction} externalPrompt={externalPrompt} />
          </>
        )}
      </div>
    </div>
  );
}
