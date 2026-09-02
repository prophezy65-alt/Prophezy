/**
 * app/app/interview-lab/page.tsx
 *
 * Interview Lab orchestrator. A small client-side state machine moves between
 * the session history, the setup form, the live runner, and the report —
 * all backed by the /api/interview routes and the Interview Intelligence
 * Engine in lib/interview.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionHistory } from "./components/SessionHistory";
import { SetupForm } from "./components/SetupForm";
import { SessionRunner } from "./components/SessionRunner";
import { ReportView } from "./components/ReportView";
import { ToastStack, Spinner, type ToastMessage, type ToastTone } from "./components/primitives";
import { useSessionDetail } from "./hooks";
import type {
  AnsweredItem,
  FinishedSession,
  InterviewQuestion,
  InterviewSession,
  SessionDetailItem,
  SessionListItem,
  SkillGap,
} from "./types";

function toAnsweredItems(items: SessionDetailItem[]): AnsweredItem[] {
  return items
    .filter(
      (i): i is SessionDetailItem & { answerText: string; evaluation: NonNullable<SessionDetailItem["evaluation"]> } =>
        i.evaluation !== null && i.answerText !== null,
    )
    .map((i) => ({ question: i.question, answerText: i.answerText, evaluation: i.evaluation }));
}

type View =
  | { kind: "history" }
  | { kind: "setup" }
  | { kind: "loading-detail"; item: SessionListItem }
  | { kind: "running"; session: InterviewSession; questions: InterviewQuestion[]; initialAnswered: AnsweredItem[] }
  | { kind: "report"; session: InterviewSession; items: AnsweredItem[]; overallScore: number; skillGap: SkillGap | null };

export default function InterviewLabPage() {
  const [view, setView] = useState<View>({ kind: "history" });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((message: string, tone: ToastTone) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const detailId = view.kind === "loading-detail" ? view.item.id : null;
  const detail = useSessionDetail(detailId);

  useEffect(() => {
    if (view.kind !== "loading-detail") return;
    if (detail.isError) {
      notify(detail.error instanceof Error ? detail.error.message : "Could not open session.", "error");
      setView({ kind: "history" });
      return;
    }
    const d = detail.data;
    if (!d) return;

    if (d.session.status === "active") {
      setView({
        kind: "running",
        session: d.session,
        questions: d.items.map((i) => i.question),
        initialAnswered: toAnsweredItems(d.items),
      });
    } else {
      setView({
        kind: "report",
        session: d.session,
        items: toAnsweredItems(d.items),
        overallScore: d.overallScore,
        skillGap: null,
      });
    }
  }, [view, detail.data, detail.isError, detail.error, notify]);

  const handleFinished = useCallback((result: FinishedSession) => {
    setView({
      kind: "report",
      session: result.session,
      items: result.items,
      overallScore: result.overallScore,
      skillGap: result.skillGap,
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      {view.kind === "history" && (
        <SessionHistory
          onNew={() => setView({ kind: "setup" })}
          onOpen={(item) => setView({ kind: "loading-detail", item })}
          notify={notify}
        />
      )}

      {view.kind === "setup" && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setView({ kind: "history" })}
            className="text-xs text-mist transition-colors hover:text-ink"
          >
            ← Back to history
          </button>
          <div>
            <h1 className="text-2xl font-medium text-ink" style={{ fontFamily: "var(--font-display)" }}>
              New mock interview
            </h1>
            <p className="mt-1 text-sm text-mist">
              Tell the AI interviewer what you&apos;re preparing for — it tailors the questions to you.
            </p>
          </div>
          <SetupForm
            notify={notify}
            onCreated={(data) =>
              setView({ kind: "running", session: data.session, questions: data.questions, initialAnswered: [] })
            }
          />
        </div>
      )}

      {view.kind === "loading-detail" && <Spinner label="Opening session…" />}

      {view.kind === "running" && (
        <SessionRunner
          session={view.session}
          questions={view.questions}
          initialAnswered={view.initialAnswered}
          onFinished={handleFinished}
          notify={notify}
        />
      )}

      {view.kind === "report" && (
        <ReportView
          session={view.session}
          items={view.items}
          overallScore={view.overallScore}
          skillGap={view.skillGap}
          onBack={() => setView({ kind: "history" })}
          onRestart={() => setView({ kind: "setup" })}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
