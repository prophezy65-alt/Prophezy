/**
 * app/app/interview-lab/components/SessionRunner.tsx
 *
 * The live interview loop: presents one question at a time, collects the
 * candidate's answer (typed or dictated), submits it for Gemini evaluation,
 * shows the feedback, and advances. Finishing computes the skill-gap
 * roadmap + analytics and hands a completed bundle to the report view.
 */
"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Code2, Flag, Loader2, Mic, MicOff, Send, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EvaluationCard } from "./EvaluationCard";
import { InterviewerAvatar } from "./InterviewerAvatar";
import { CodeAnswer } from "./CodeAnswer";
import { SectionLabel } from "./primitives";
import { useVoiceInput } from "../useVoiceInput";
import { useCompleteSession, useSubmitAnswer } from "../hooks";
import { interviewTypeLabel } from "../types";
import { languageLabel } from "../languages";
import type {
  AnsweredItem,
  FinishedSession,
  InterviewEvaluation,
  InterviewQuestion,
  InterviewSession,
} from "../types";

const DIFFICULTY_TONE = {
  easy: "success",
  medium: "signal",
  hard: "pulse",
} as const;

export function SessionRunner({
  session,
  questions,
  initialAnswered = [],
  onFinished,
  notify,
}: {
  session: InterviewSession;
  questions: InterviewQuestion[];
  initialAnswered?: AnsweredItem[];
  onFinished: (result: FinishedSession) => void;
  notify: (message: string, tone: "success" | "error" | "info") => void;
}) {
  const [answers, setAnswers] = useState<Record<string, AnsweredItem>>(() =>
    Object.fromEntries(initialAnswered.map((a) => [a.question.id, a])),
  );
  const firstUnanswered = questions.findIndex((q) => !answers[q.id]);
  const [index, setIndex] = useState(firstUnanswered === -1 ? questions.length - 1 : firstUnanswered);
  const [draft, setDraft] = useState("");
  // Coding editor only appears for interview types that actually involve code.
  const CODING_TYPES: ReadonlySet<string> = new Set([
    "coding",
    "technical",
    "frontend",
    "backend",
    "full-stack",
    "software-engineering",
    "ai-ml",
    "data-science",
    "devops",
    "cloud",
    "cyber-security",
  ]);
  const codingCapable = CODING_TYPES.has(session.interviewType);
  // Coding-test state. Defaults ON only for pure coding (DSA) interviews; the
  // toggle is offered on other code-capable types, and hidden entirely for
  // non-coding interviews (HR, behavioral, viva, etc.).
  const [codeMode, setCodeMode] = useState(session.interviewType === "coding");
  const [language, setLanguage] = useState("python");

  const submit = useSubmitAnswer(session.id);
  const complete = useCompleteSession(session.id);

  const current = questions[index];
  const currentEvaluation: InterviewEvaluation | null = current ? answers[current.id]?.evaluation ?? null : null;
  const answeredCount = Object.keys(answers).length;

  const voice = useVoiceInput((text) => setDraft((d) => (d ? `${d} ${text}` : text)));

  const overallScore = useMemo(() => {
    const evals = Object.values(answers);
    if (evals.length === 0) return 0;
    return (
      Math.round(
        (evals.reduce((sum, a) => sum + a.evaluation.overallScore, 0) / evals.length) * 10,
      ) / 10
    );
  }, [answers]);

  function speakQuestion() {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !current) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(current.question));
  }

  function handleSubmit() {
    if (!current || draft.trim().length === 0) {
      notify(codeMode ? "Write your solution before submitting." : "Write an answer before submitting.", "info");
      return;
    }
    if (voice.listening) voice.stop();

    // In code mode, wrap the submission as a fenced code block tagged with the
    // chosen language so Gemini evaluates it as code, not prose.
    const answerText = codeMode
      ? `Language: ${languageLabel(language)}\n\n\`\`\`${language}\n${draft}\n\`\`\``
      : draft.trim();

    submit.mutate(
      { questionId: current.id, answerText },
      {
        onSuccess: (res) => {
          setAnswers((prev) => ({
            ...prev,
            [current.id]: { question: current, answerText, evaluation: res.evaluation },
          }));
          setDraft("");
          notify(`Scored ${res.evaluation.overallScore.toFixed(1)}/10`, "success");
        },
        onError: (err) => notify(err instanceof Error ? err.message : "Evaluation failed.", "error"),
      },
    );
  }

  function goNext() {
    if (index < questions.length - 1) setIndex((i) => i + 1);
  }

  function handleFinish() {
    complete.mutate(answeredCount > 0 ? "completed" : "abandoned", {
      onSuccess: (res) => {
        const items = questions
          .map((q) => answers[q.id])
          .filter((a): a is AnsweredItem => Boolean(a));
        onFinished({
          session,
          items,
          overallScore,
          skillGap: res.skillGap,
          analytics: res.analytics,
        });
      },
      onError: (err) => notify(err instanceof Error ? err.message : "Could not finish session.", "error"),
    });
  }

  if (!current) return null;

  const progressPct = (answeredCount / questions.length) * 100;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="glass-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-medium text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {session.role}
            </p>
            <p className="mt-0.5 text-xs text-mist">
              {interviewTypeLabel(session.interviewType)} · {session.seniority}
              {session.company ? ` · ${session.company}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mist" style={{ fontFamily: "var(--font-mono)" }}>
              {answeredCount}/{questions.length} answered
            </p>
            {answeredCount > 0 && (
              <p className="text-sm text-ink">Avg {overallScore.toFixed(1)}/10</p>
            )}
          </div>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink/5">
          <motion.div
            className="h-full rounded-full bg-signal"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* question navigator */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setIndex(i)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors",
              i === index && "ring-2 ring-signal/40",
              answers[q.id]
                ? "border-success/40 bg-success/10 text-success"
                : "border-border text-mist hover:text-ink",
            )}
            aria-label={`Question ${i + 1}`}
          >
            {answers[q.id] ? <CheckCircle2 size={14} /> : i + 1}
          </button>
        ))}
      </div>

      {/* cartoon interviewer — reads the question aloud while you answer */}
      {!currentEvaluation && (
        <InterviewerAvatar key={`avatar-${current.id}`} text={current.question} questionNumber={index + 1} />
      )}

      {/* current question */}
      <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-mist" style={{ fontFamily: "var(--font-mono)" }}>
            Question {index + 1}
          </span>
          <Badge tone={DIFFICULTY_TONE[current.difficulty]}>{current.difficulty}</Badge>
          <Badge tone="neutral">{current.topic}</Badge>
          <button
            type="button"
            onClick={speakQuestion}
            className="ml-auto text-mist transition-colors hover:text-signal"
            aria-label="Read question aloud"
            title="Read aloud"
          >
            <Volume2 size={16} />
          </button>
        </div>
        {/* While Aria is asking (answering phase) the question is shown beside her,
            so we don't repeat it here. On the review screen we show it for context. */}
        {currentEvaluation && (
          <p className="text-base leading-relaxed text-ink">{current.question}</p>
        )}
      </motion.div>

      {/* answer / feedback */}
      {currentEvaluation ? (
        <>
          <div className="glass-panel p-5">
            <SectionLabel>Your answer</SectionLabel>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
              {answers[current.id]?.answerText}
            </p>
          </div>
          <EvaluationCard evaluation={currentEvaluation} />
          <div className="flex justify-end gap-3">
            {index < questions.length - 1 ? (
              <Button type="button" onClick={goNext}>
                Next question <ArrowRight size={16} />
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish} disabled={complete.isPending}>
                {complete.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Building report…
                  </>
                ) : (
                  <>
                    <Flag size={16} /> Finish & see report
                  </>
                )}
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="glass-panel space-y-3 p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>{codeMode ? "Your solution" : "Your answer"}</SectionLabel>
            <div className="flex items-center gap-2">
              {codingCapable && (
                <button
                  type="button"
                  onClick={() => setCodeMode((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
                    codeMode ? "bg-signal/10 text-signal" : "bg-ink/5 text-mist hover:text-ink",
                  )}
                  title="Toggle code editor"
                >
                  <Code2 size={13} /> {codeMode ? "Coding" : "Answer with code"}
                </button>
              )}
              {!codeMode && voice.supported && (
                <button
                  type="button"
                  onClick={voice.toggle}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors",
                    voice.listening ? "bg-danger/10 text-danger" : "bg-ink/5 text-mist hover:text-ink",
                  )}
                >
                  {voice.listening ? <MicOff size={13} /> : <Mic size={13} />}
                  {voice.listening ? "Stop" : "Dictate"}
                </button>
              )}
            </div>
          </div>

          {codeMode ? (
            <CodeAnswer code={draft} onCodeChange={setDraft} language={language} onLanguageChange={setLanguage} />
          ) : (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your answer, or use the mic to dictate…"
                className="h-40 w-full resize-none rounded-xl border border-border bg-surface/40 p-4 text-sm leading-relaxed text-ink transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
              />
              <span className="text-xs text-mist">{draft.trim().length} characters</span>
            </>
          )}

          <div className="flex items-center justify-end">
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={handleFinish} disabled={complete.isPending}>
                <Flag size={15} /> End interview
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submit.isPending}>
                {submit.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Evaluating…
                  </>
                ) : (
                  <>
                    <Send size={16} /> Submit {codeMode ? "solution" : "answer"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
