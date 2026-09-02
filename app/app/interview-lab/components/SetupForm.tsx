/**
 * app/app/interview-lab/components/SetupForm.tsx
 *
 * Configures and starts a mock interview.
 *
 * For College Viva / School Viva the form swaps the company/skills/JD fields
 * for a document upload (syllabus / notes / photo / PDF / Word). The uploaded
 * file's text is extracted server-side and used to ground the viva questions,
 * so the interviewer asks strictly from the student's own material.
 */
"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Building2, FileText, Loader2, Play, Search, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./primitives";
import { useCompanyLookup, useCreateSession, useCreateSessionFromDocument } from "../hooks";
import {
  INTERVIEW_TYPES,
  SENIORITIES,
  type CompanyContext,
  type CreateSessionResponse,
  type StartSessionForm,
} from "../types";

const QUESTION_COUNTS = [4, 6, 8, 10, 12];

const ACCEPTED = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.md,application/pdf,image/*";

const fieldClass =
  "h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink transition-colors focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30";

function isVivaType(t: StartSessionForm["interviewType"]): boolean {
  return t === "college-viva" || t === "school-viva";
}

export function SetupForm({
  onCreated,
  notify,
}: {
  onCreated: (data: CreateSessionResponse) => void;
  notify: (message: string, tone: "success" | "error" | "info") => void;
}) {
  const [form, setForm] = useState<StartSessionForm>({
    role: "",
    interviewType: "technical",
    seniority: "mid",
    company: "",
    jobDescription: "",
    skills: "",
    questionCount: 8,
  });
  const [roleError, setRoleError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyContext | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [customCount, setCustomCount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const create = useCreateSession();
  const createFromDoc = useCreateSessionFromDocument();
  const lookup = useCompanyLookup();

  const isViva = isVivaType(form.interviewType);
  const busy = create.isPending || createFromDoc.isPending;

  function update<K extends keyof StartSessionForm>(key: K, value: StartSessionForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleStart() {
    if (form.role.trim().length < 2) {
      setRoleError(isViva ? "Enter the subject or course." : "Enter the role you're interviewing for.");
      return;
    }
    setRoleError(null);

    const onSuccess = (data: CreateSessionResponse) => {
      notify(`Generated ${data.questions.length} questions. Good luck!`, "success");
      onCreated(data);
    };
    const onError = (err: unknown) =>
      notify(err instanceof Error ? err.message : "Failed to start.", "error");

    if (isViva) {
      if (!file) {
        notify("Upload your syllabus / notes to start the viva.", "info");
        return;
      }
      createFromDoc.mutate({ form, file }, { onSuccess, onError });
      return;
    }

    create.mutate(form, { onSuccess, onError });
  }

  function handleLookup() {
    if (!form.company.trim()) {
      notify("Enter a company name first.", "info");
      return;
    }
    lookup.mutate(
      { company: form.company.trim(), role: form.role.trim() || undefined },
      {
        onSuccess: (data) => setCompany(data),
        onError: (err) => notify(err instanceof Error ? err.message : "Lookup failed.", "error"),
      },
    );
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel space-y-6 p-6"
    >
      <div>
        <SectionLabel>{isViva ? "Subject / course *" : "Role *"}</SectionLabel>
        <Input
          value={form.role}
          onChange={(e) => update("role", e.target.value)}
          placeholder={isViva ? "e.g. Data Structures, Class 10 Science" : "e.g. Frontend Engineer"}
          error={roleError ?? undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <SectionLabel>Interview type</SectionLabel>
          <select
            className={fieldClass}
            value={form.interviewType}
            onChange={(e) => update("interviewType", e.target.value as StartSessionForm["interviewType"])}
          >
            {INTERVIEW_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-surface text-ink">
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <SectionLabel>{isViva ? "Level" : "Seniority"}</SectionLabel>
          <select
            className={fieldClass}
            value={form.seniority}
            onChange={(e) => update("seniority", e.target.value as StartSessionForm["seniority"])}
          >
            {SENIORITIES.map((s) => (
              <option key={s.value} value={s.value} className="bg-surface text-ink">
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isViva ? (
        /* ---- Viva: upload syllabus / notes instead of company/skills/JD ---- */
        <div>
          <SectionLabel>Upload syllabus / notes *</SectionLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            onChange={onFilePicked}
            className="hidden"
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-signal/40 bg-signal/[0.06] p-3">
              <FileText size={18} className="shrink-0 text-signal" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{file.name}</p>
                <p className="text-xs text-mist">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="shrink-0 text-mist transition-colors hover:text-danger"
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 p-6 text-center transition-colors hover:border-signal/50"
            >
              <Upload size={20} className="text-signal" />
              <span className="text-sm text-ink">Click to upload</span>
              <span className="text-xs text-mist">PDF, Word, image, or text · max 15 MB</span>
            </button>
          )}
          <p className="mt-2 text-xs text-mist">
            Aria will ask viva questions strictly from the material you upload.
          </p>
        </div>
      ) : (
        /* ---- Standard interview: company / skills / job description ---- */
        <>
          <div>
            <SectionLabel>Target company (optional)</SectionLabel>
            <div className="flex gap-2">
              <Input
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="e.g. Stripe"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleLookup}
                disabled={lookup.isPending}
                className="shrink-0"
              >
                {lookup.isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Preview
              </Button>
            </div>
            {company && (
              <div className="mt-3 space-y-2 rounded-xl border border-border bg-ink/[0.02] p-3 text-sm">
                <p className="flex items-center gap-1.5 text-xs font-medium text-signal">
                  <Building2 size={13} /> {form.company}
                </p>
                {company.typicalRounds.length > 0 && (
                  <p className="text-ink/80">
                    <span className="text-mist">Typical rounds: </span>
                    {company.typicalRounds.join(" → ")}
                  </p>
                )}
                {company.knownFocusAreas.length > 0 && (
                  <p className="text-ink/80">
                    <span className="text-mist">Focus: </span>
                    {company.knownFocusAreas.join(", ")}
                  </p>
                )}
                {company.notes && <p className="text-mist">{company.notes}</p>}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Skills (optional, comma-separated)</SectionLabel>
            <Input
              value={form.skills}
              onChange={(e) => update("skills", e.target.value)}
              placeholder="React, TypeScript, System Design"
            />
          </div>

          <div>
            <SectionLabel>Job description / context (optional)</SectionLabel>
            <textarea
              className={cn(fieldClass, "h-28 resize-none py-3 leading-relaxed")}
              value={form.jobDescription}
              onChange={(e) => update("jobDescription", e.target.value)}
              placeholder="Paste the job description to ground questions in the real requirements."
            />
          </div>
        </>
      )}

      <div>
        <SectionLabel>Number of questions</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          {QUESTION_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setCustomCount(false);
                update("questionCount", n);
              }}
              className={cn(
                "h-9 w-11 rounded-lg border text-sm transition-colors",
                !customCount && form.questionCount === n
                  ? "border-signal bg-signal/10 text-signal"
                  : "border-border text-mist hover:text-ink",
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomCount(true)}
            className={cn(
              "h-9 rounded-lg border px-3 text-sm transition-colors",
              customCount
                ? "border-signal bg-signal/10 text-signal"
                : "border-border text-mist hover:text-ink",
            )}
          >
            Custom
          </button>
          {customCount && (
            <input
              type="number"
              min={1}
              max={30}
              value={form.questionCount}
              onChange={(e) => {
                const raw = Number(e.target.value);
                const clamped = Number.isFinite(raw) ? Math.max(1, Math.min(30, Math.round(raw))) : 1;
                update("questionCount", clamped);
              }}
              className="h-9 w-20 rounded-lg border border-signal bg-surface/40 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-signal/30"
              aria-label="Custom number of questions"
            />
          )}
        </div>
        {customCount && <p className="mt-1.5 text-xs text-mist">Enter any number from 1 to 30.</p>}
      </div>

      <Button type="button" onClick={handleStart} disabled={busy} size="lg" className="w-full">
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {isViva ? "Reading your document & generating…" : "Generating your interview…"}
          </>
        ) : (
          <>
            <Play size={16} /> {isViva ? "Start viva" : "Start interview"}
          </>
        )}
      </Button>
    </motion.div>
  );
}
