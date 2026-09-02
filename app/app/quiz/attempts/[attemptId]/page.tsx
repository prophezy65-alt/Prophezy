"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, RotateCcw, ArrowLeft } from "lucide-react";

const ACCENT = "#5ff2ff";

interface ResultResponse {
  attempt: { id: string; quizId: string; finalScore: number | null; maxScore: number; accuracyPct: number | null; completionPct: number; timeTakenSec: number | null };
  responses: Array<{ questionId: string; response: unknown; isCorrect: boolean | null; marksAwarded: number | null }>;
  weakTopics: Array<{ topicName: string; accuracyPct: number }>;
  strongTopics: Array<{ topicName: string; accuracyPct: number }>;
  revisionSuggestions: string[];
}

interface FullQuestion {
  id: string;
  questionText: string;
  options: { key: string; text: string }[] | null;
  correctOption: string | null;
  explanation: string | null;
}

export default function QuizResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();

  const [result, setResult] = useState<ResultResponse | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/quiz/attempts/${attemptId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load result.");
      setResult(data.result);
      setQuestions(data.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load result.");
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  async function retry() {
    if (!result) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/quiz/${result.attempt.quizId}/attempts`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start a new attempt.");
      router.push(`/app/quiz/${result.attempt.quizId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start a new attempt.");
      setRetrying(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">
        {error}{" "}
        <button onClick={load} className="underline">
          Retry
        </button>
      </div>
    );
  }

  if (!result || !questions) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 size={14} className="animate-spin" /> Loading result…
      </div>
    );
  }

  const { attempt } = result;
  const scorePct = attempt.maxScore > 0 ? Math.round(((attempt.finalScore ?? 0) / attempt.maxScore) * 10000) / 100 : 0;
  const responseByQuestion = new Map(result.responses.map((r) => [r.questionId, r]));

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => router.push("/app/quiz")} className="mb-4 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
        <ArrowLeft size={14} /> Back to quizzes
      </button>

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Your score</p>
        <p className="mt-2 text-5xl font-medium" style={{ fontFamily: "var(--font-display)", color: ACCENT }}>
          {scorePct}%
        </p>
        <p className="mt-2 text-sm text-white/50">
          {attempt.finalScore ?? 0} / {attempt.maxScore} marks · {attempt.completionPct}% completed
          {attempt.timeTakenSec ? ` · ${Math.round(attempt.timeTakenSec / 60)} min` : ""}
        </p>
        <button
          onClick={retry}
          disabled={retrying}
          className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-black disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {retrying ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
          Retry quiz
        </button>
      </div>

      {(result.weakTopics.length > 0 || result.strongTopics.length > 0) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {result.weakTopics.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Weak topics</p>
              {result.weakTopics.map((t) => (
                <p key={t.topicName} className="text-sm text-white/70">
                  {t.topicName} — {t.accuracyPct}%
                </p>
              ))}
            </div>
          )}
          {result.strongTopics.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Strong topics</p>
              {result.strongTopics.map((t) => (
                <p key={t.topicName} className="text-sm text-white/70">
                  {t.topicName} — {t.accuracyPct}%
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {result.revisionSuggestions.length > 0 && (
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">Suggestions</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-white/60">
            {result.revisionSuggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.12em] text-white/40">Question review</h2>
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => {
          const response = responseByQuestion.get(q.id);
          const isCorrect = response?.isCorrect;
          return (
            <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-2 flex items-start gap-2">
                {isCorrect === true ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : isCorrect === false ? (
                  <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                ) : null}
                <p className="text-sm text-white">
                  {i + 1}. {q.questionText}
                </p>
              </div>
              {q.options && (
                <div className="ml-6 flex flex-col gap-1">
                  {q.options.map((opt) => {
                    const isUserChoice = response?.response === opt.key;
                    const isRightAnswer = q.correctOption === opt.key;
                    return (
                      <p
                        key={opt.key}
                        className="text-sm"
                        style={{
                          color: isRightAnswer ? "#34d399" : isUserChoice ? "#f87171" : "rgba(255,255,255,0.5)",
                        }}
                      >
                        {opt.key}. {opt.text}
                        {isRightAnswer ? " ✓" : isUserChoice ? " ✗ (your answer)" : ""}
                      </p>
                    );
                  })}
                </div>
              )}
              {q.explanation && <p className="ml-6 mt-2 text-xs text-white/40">{q.explanation}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
