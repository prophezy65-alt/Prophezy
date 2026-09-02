"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Clock, ChevronLeft, ChevronRight, CheckCircle2, Info, X } from "lucide-react";

const ACCENT = "#5ff2ff";

interface SanitizedQuestion {
  id: string;
  position: number;
  questionText: string;
  questionType: string;
  marks: number;
  options: { key: string; text: string }[] | null;
  metadata:
    | { kind: "multiple_select"; options: { key: string; text: string }[] }
    | { kind: "ordering"; items: string[] }
    | { kind: "match_following"; lefts: string[]; rights: string[] }
    | { kind: "code"; language: string; starterCode?: string }
    | { kind: "subject_response" }
    | { kind: "generic" };
}

interface QuizDetail {
  id: string;
  title: string;
  timeLimitSec: number | null;
  questionCount: number;
  difficulty: string;
}

function TakeQuizInner() {
  const { quizId } = useParams<{ quizId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shortfall = Number(searchParams.get("shortfall") ?? 0);
  const requested = Number(searchParams.get("requested") ?? 0);
  const [showShortfallNotice, setShowShortfallNotice] = useState(shortfall > 0);

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [questions, setQuestions] = useState<SanitizedQuestion[] | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const questionStartRef = useRef<number>(Date.now());
  const submittedRef = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [quizRes, attemptRes] = await Promise.all([
        fetch(`/api/quiz/${quizId}`),
        fetch(`/api/quiz/${quizId}/attempts`, { method: "POST" }),
      ]);
      const quizData = await quizRes.json();
      if (!quizRes.ok) throw new Error(quizData.error ?? "Failed to load quiz.");
      const attemptData = await attemptRes.json();
      if (!attemptRes.ok) throw new Error(attemptData.error ?? "Failed to start attempt.");

      setQuiz(quizData.quiz);
      setQuestions(quizData.questions.sort((a: SanitizedQuestion, b: SanitizedQuestion) => a.position - b.position));
      setAttemptId(attemptData.attempt.id);
      if (quizData.quiz.timeLimitSec) setRemainingSec(quizData.quiz.timeLimitSec);
      questionStartRef.current = Date.now();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load quiz.");
    }
  }, [quizId]);

  useEffect(() => {
    load();
  }, [load]);

  const finalizeAttempt = useCallback(async () => {
    if (!attemptId || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quiz/attempts/${attemptId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed.");
      router.push(`/app/quiz/attempts/${attemptId}`);
    } catch (err) {
      submittedRef.current = false;
      setSubmitError(err instanceof Error ? err.message : "Submit failed.");
      setSubmitting(false);
    }
  }, [attemptId, router]);

  // Countdown timer, auto-submits at zero.
  useEffect(() => {
    if (remainingSec === null) return;
    if (remainingSec <= 0) {
      finalizeAttempt();
      return;
    }
    const t = setTimeout(() => setRemainingSec((s) => (s !== null ? s - 1 : s)), 1000);
    return () => clearTimeout(t);
  }, [remainingSec, finalizeAttempt]);

  async function submitAnswer(question: SanitizedQuestion, response: unknown) {
    setAnswers((prev) => ({ ...prev, [question.id]: response }));
    if (!attemptId) return;
    const timeSpentSec = Math.round((Date.now() - questionStartRef.current) / 1000);
    try {
      await fetch(`/api/quiz/attempts/${attemptId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, response, timeSpentSec, hintUsed: false }),
      });
    } catch {
      // Live-save failures are non-fatal — submitAttempt() re-grades any
      // question that never made it through, so nothing is lost.
    }
  }

  function goTo(nextIndex: number) {
    setIndex(nextIndex);
    questionStartRef.current = Date.now();
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">
        {loadError}{" "}
        <button onClick={load} className="underline">
          Retry
        </button>
      </div>
    );
  }

  if (!quiz || !questions || !attemptId) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 size={14} className="animate-spin" /> Setting up your quiz…
      </div>
    );
  }

  const question = questions[index];
  const answered = Object.keys(answers).length;
  const minutes = remainingSec !== null ? Math.floor(remainingSec / 60) : null;
  const seconds = remainingSec !== null ? remainingSec % 60 : null;

  if (!question) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 size={14} className="animate-spin" /> Loading question…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => {
          if (confirm("Leave this quiz? Your progress is saved, but the attempt will stay unfinished until you retry it.")) {
            router.push("/app/quiz");
          }
        }}
        className="mb-4 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70"
      >
        <ChevronLeft size={14} /> Exit quiz
      </button>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-white sm:text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            {quiz.title}
          </h1>
          <p className="mt-1 text-xs text-white/40">
            Question {index + 1} of {questions.length} · {answered} answered
          </p>
        </div>
        {remainingSec !== null && (
          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
            style={{ borderColor: remainingSec < 60 ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.1)", color: remainingSec < 60 ? "#f87171" : "white" }}
          >
            <Clock size={14} />
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        )}
      </div>

      {showShortfallNotice && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">
            You asked for {requested} questions — {shortfall} didn't meet quality checks (e.g. an incomplete or ambiguous answer key) and were
            skipped, so this quiz has {questions.length} instead.
          </span>
          <button onClick={() => setShowShortfallNotice(false)} className="shrink-0 text-amber-200/50 hover:text-amber-200">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%`, backgroundColor: ACCENT }} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <p className="mb-5 text-[10px] uppercase tracking-[0.12em] text-white/40">
          {question.questionType.replace("_", " ")} · {question.marks} mark{question.marks === 1 ? "" : "s"}
        </p>
        <p className="mb-6 text-lg leading-relaxed text-white">{question.questionText}</p>

        <div className="flex flex-col gap-2">
          {question.questionType === "true_false" ? (
            ["true", "false"].map((opt) => (
              <OptionButton key={opt} selected={answers[question.id] === opt} onClick={() => submitAnswer(question, opt)} label={opt === "true" ? "True" : "False"} />
            ))
          ) : question.questionType === "multiple_select" && question.metadata.kind === "multiple_select" ? (
            <MultipleSelectInput
              options={question.metadata.options}
              selected={(answers[question.id] as string[] | undefined) ?? []}
              onChange={(next) => submitAnswer(question, next)}
            />
          ) : question.questionType === "ordering" && question.metadata.kind === "ordering" ? (
            <OrderingInput
              items={question.metadata.items}
              order={(answers[question.id] as number[] | undefined) ?? question.metadata.items.map((_, i) => i)}
              onChange={(next) => submitAnswer(question, next)}
            />
          ) : question.questionType === "match_following" && question.metadata.kind === "match_following" ? (
            <MatchFollowingInput
              lefts={question.metadata.lefts}
              rights={question.metadata.rights}
              pairs={(answers[question.id] as Array<{ left: string; right: string }> | undefined) ?? []}
              onChange={(next) => submitAnswer(question, next)}
            />
          ) : question.options ? (
            question.options.map((opt) => (
              <OptionButton key={opt.key} selected={answers[question.id] === opt.key} onClick={() => submitAnswer(question, opt.key)} label={`${opt.key}. ${opt.text}`} />
            ))
          ) : (
            <textarea
              value={(answers[question.id] as string) ?? ""}
              onChange={(e) => submitAnswer(question, e.target.value)}
              placeholder="Type your answer…"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          )}
        </div>
      </div>

      {question.questionType === "ordering" && (
        <p className="mt-2 text-xs text-white/30">Use the arrows to arrange these in the correct order.</p>
      )}
      {question.questionType === "match_following" && (
        <p className="mt-2 text-xs text-white/30">Pick a match for every item on the left.</p>
      )}
      {question.questionType === "multiple_select" && (
        <p className="mt-2 text-xs text-white/30">Select every answer that applies.</p>
      )}

      {submitError && <p className="mt-4 text-sm text-red-400">{submitError}</p>}

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => goTo(Math.max(0, index - 1))}
          disabled={index === 0}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 disabled:opacity-30"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        {index < questions.length - 1 ? (
          <button
            onClick={() => goTo(index + 1)}
            className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-black"
            style={{ backgroundColor: ACCENT }}
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={finalizeAttempt}
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-black disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {submitting ? "Grading…" : "Submit quiz"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function TakeQuizPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      }
    >
      <TakeQuizInner />
    </Suspense>
  );
}

function OptionButton({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border px-4 py-3 text-left text-sm transition-colors"
      style={{
        borderColor: selected ? ACCENT : "rgba(255,255,255,0.1)",
        backgroundColor: selected ? `${ACCENT}14` : "transparent",
        color: selected ? "white" : "rgba(255,255,255,0.7)",
      }}
    >
      {label}
    </button>
  );
}

function MultipleSelectInput({
  options,
  selected,
  onChange,
}: {
  options: { key: string; text: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }
  return (
    <>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.key);
        return (
          <button
            key={opt.key}
            onClick={() => toggle(opt.key)}
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors"
            style={{
              borderColor: isSelected ? ACCENT : "rgba(255,255,255,0.1)",
              backgroundColor: isSelected ? `${ACCENT}14` : "transparent",
              color: isSelected ? "white" : "rgba(255,255,255,0.7)",
            }}
          >
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
              style={{ borderColor: isSelected ? ACCENT : "rgba(255,255,255,0.3)", backgroundColor: isSelected ? ACCENT : "transparent" }}
            >
              {isSelected && <CheckCircle2 size={12} color="black" />}
            </span>
            {opt.key}. {opt.text}
          </button>
        );
      })}
    </>
  );
}

function OrderingInput({ items, order, onChange }: { items: string[]; order: number[]; onChange: (next: number[]) => void }) {
  function move(position: number, direction: -1 | 1) {
    const next = [...order];
    const target = position + direction;
    if (target < 0 || target >= next.length) return;
    [next[position], next[target]] = [next[target]!, next[position]!];
    onChange(next);
  }
  return (
    <>
      {order.map((itemIndex, position) => (
        <div key={itemIndex} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
          <span className="w-5 shrink-0 text-xs text-white/40">{position + 1}.</span>
          <span className="flex-1 text-sm text-white/80">{items[itemIndex]}</span>
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              onClick={() => move(position, -1)}
              disabled={position === 0}
              className="rounded px-1.5 text-xs text-white/50 hover:text-white disabled:opacity-20"
              aria-label="Move up"
            >
              ▲
            </button>
            <button
              onClick={() => move(position, 1)}
              disabled={position === order.length - 1}
              className="rounded px-1.5 text-xs text-white/50 hover:text-white disabled:opacity-20"
              aria-label="Move down"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function MatchFollowingInput({
  lefts,
  rights,
  pairs,
  onChange,
}: {
  lefts: string[];
  rights: string[];
  pairs: Array<{ left: string; right: string }>;
  onChange: (next: Array<{ left: string; right: string }>) => void;
}) {
  function setMatch(left: string, right: string) {
    const next = pairs.filter((p) => p.left !== left);
    if (right) next.push({ left, right });
    onChange(next);
  }
  return (
    <>
      {lefts.map((left) => {
        const current = pairs.find((p) => p.left === left)?.right ?? "";
        return (
          <div key={left} className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3">
            <span className="flex-1 text-sm text-white/80">{left}</span>
            <select
              value={current}
              onChange={(e) => setMatch(left, e.target.value)}
              className="h-9 shrink-0 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-white focus:outline-none"
            >
              <option value="" className="bg-[#0a0a0a]">
                Choose a match…
              </option>
              {rights.map((right) => (
                <option key={right} value={right} className="bg-[#0a0a0a]">
                  {right}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </>
  );
}
