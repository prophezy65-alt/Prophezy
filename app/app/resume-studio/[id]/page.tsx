"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Save,
  Download,
  Trash2,
  History,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Gauge,
  CalendarDays,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type {
  Resume,
  ResumeContent,
  ResumeVersion,
  AtsReport,
  AiTaskType,
  AiGenerationResult,
  TemplateId,
  ExportFormat,
  ExperienceEntry,
  EducationEntry,
  ProjectEntry,
  SkillGroup,
  CertificateEntry,
  AchievementEntry,
  Link as ResumeLink,
} from "@/lib/resume-studio/models/resume.model";
import { listTemplates } from "@/lib/resume-studio/utils/resume-template";
import { newEntryId } from "@/lib/resume-studio/utils/resume-content";

import { apiFetch } from "@/lib/resume-studio/client/api";

type ToastKind = "success" | "error" | "info";

function useToast() {
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = (kind: ToastKind, message: string) => {
    setToast({ kind, message });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3500);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return { toast, show };
}

function ToastBanner({ toast }: { toast: { kind: ToastKind; message: string } | null }) {
  if (!toast) return null;
  const tone =
    toast.kind === "success"
      ? "border-emerald-500/30 bg-emerald-950/80 text-emerald-300"
      : toast.kind === "error"
        ? "border-red-500/30 bg-red-950/80 text-red-300"
        : "border-signal/30 bg-surface text-ink";
  return <div className={`fixed right-6 top-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${tone}`}>{toast.message}</div>;
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function csvToArray(text: string): string[] {
  return text
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast, show } = useToast();

  const { data: resume, isLoading, isError, error } = useQuery({
    queryKey: ["resume-studio", "detail", id],
    queryFn: () => apiFetch<Resume>(`/api/resume-studio/${id}`),
    retry: 1,
  });

  const [content, setContent] = useState<ResumeContent | null>(null);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("professional");
  const [targetRole, setTargetRole] = useState("");
  const [targetJobDescription, setTargetJobDescription] = useState("");
  const hydrated = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [panel, setPanel] = useState<"ats" | "ai" | "versions" | null>(null);

  useEffect(() => {
    if (resume && !hydrated.current) {
      setContent(resume.content);
      setTitle(resume.title);
      setTemplateId(resume.templateId);
      setTargetRole(resume.targetRole ?? "");
      setTargetJobDescription(resume.targetJobDescription ?? "");
      hydrated.current = true;
    }
  }, [resume]);

  const saveContentMutation = useMutation({
    mutationFn: (payload: { content: ResumeContent; changeSummary?: string }) =>
      apiFetch<Resume>(`/api/resume-studio/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["resume-studio", "detail", id], updated);
      setDirty(false);
    },
    onError: (err: Error) => show("error", `Autosave failed: ${err.message}`),
  });

  const saveMetaMutation = useMutation({
    mutationFn: (payload: { title?: string; templateId?: TemplateId; targetRole?: string; targetJobDescription?: string }) =>
      apiFetch<Resume>(`/api/resume-studio/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["resume-studio", "detail", id], updated);
      show("success", "Saved.");
    },
    onError: (err: Error) => show("error", err.message),
  });

  // Debounced autosave whenever content changes after hydration.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!hydrated.current || !content) return;
    setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveContentMutation.mutate({ content });
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch<null>(`/api/resume-studio/${id}`, { method: "DELETE" }),
    onSuccess: () => router.push("/app/resume-studio"),
    onError: (err: Error) => show("error", err.message),
  });

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  async function handleExport(format: ExportFormat) {
    setExporting(format);
    try {
      const res = await fetch(`/api/resume-studio/${id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match?.[1] ?? `resume.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const templates = useMemo(() => listTemplates(), []);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-mist">
        <Loader2 size={18} className="mr-2 animate-spin" /> Loading resume…
      </div>
    );
  }

  if (isError || !resume || !content) {
    return (
      <Card className="border-red-500/30">
        <CardDescription className="text-red-300">
          {error instanceof Error ? error.message : "Resume not found."}
        </CardDescription>
        <Button variant="ghost" className="mt-3" onClick={() => router.push("/app/resume-studio")}>
          Back to Resume Studio
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <ToastBanner toast={toast} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== resume.title) {
                saveMetaMutation.mutate({ title: title.trim() });
              }
            }}
            className="max-w-md text-lg font-medium"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist">
            <Badge tone={dirty || saveContentMutation.isPending ? "pulse" : "success"}>
              {saveContentMutation.isPending ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
            </Badge>
            <span>v{resume.currentVersion}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={templateId}
            onChange={(e) => {
              const next = e.target.value as TemplateId;
              setTemplateId(next);
              saveMetaMutation.mutate({ templateId: next });
            }}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <Button
            variant="ghost"
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              saveContentMutation.mutate({ content });
            }}
            disabled={saveContentMutation.isPending}
          >
            <Save size={16} className="mr-1.5" /> Save now
          </Button>

          <Button variant="ghost" onClick={() => setPanel(panel === "versions" ? null : "versions")}>
            <History size={16} className="mr-1.5" /> History
          </Button>
          <Button variant="ghost" onClick={() => setPanel(panel === "ats" ? null : "ats")}>
            <Gauge size={16} className="mr-1.5" /> ATS score
          </Button>
          <Button variant="ghost" onClick={() => setPanel(panel === "ai" ? null : "ai")}>
            <Sparkles size={16} className="mr-1.5" /> AI assist
          </Button>

          <ExportMenu exporting={exporting} onExport={handleExport} />

          <Button
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete "${resume.title}"? This can't be undone.`)) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Targeting</CardTitle>
          <CardDescription>Optional — sharpens ATS keyword matching and AI suggestions.</CardDescription>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Target role (e.g. Backend Engineer Intern)"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            onBlur={() => {
              if (targetRole !== (resume.targetRole ?? "")) {
                saveMetaMutation.mutate({ targetRole });
              }
            }}
          />
          <textarea
            placeholder="Paste a target job description (optional)"
            value={targetJobDescription}
            onChange={(e) => setTargetJobDescription(e.target.value)}
            onBlur={() => {
              if (targetJobDescription !== (resume.targetJobDescription ?? "")) {
                saveMetaMutation.mutate({ targetJobDescription });
              }
            }}
            rows={2}
            className="rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          />
        </div>
      </Card>

      {panel === "ats" && (
        <AtsPanel resumeId={id} defaultJobDescription={targetJobDescription} onError={(m) => show("error", m)} />
      )}
      {panel === "ai" && <AiPanel targetRole={targetRole} jobDescription={targetJobDescription} onError={(m) => show("error", m)} />}
      {panel === "versions" && (
        <VersionsPanel
          resumeId={id}
          currentVersion={resume.currentVersion}
          onRestored={(restored) => {
            queryClient.setQueryData(["resume-studio", "detail", id], restored);
            hydrated.current = false;
            show("success", "Version restored.");
          }}
          onError={(m) => show("error", m)}
        />
      )}

      <ContactEditor value={content.contact} onChange={(contact) => setContent({ ...content, contact })} />
      <SummaryEditor value={content.summary} onChange={(summary) => setContent({ ...content, summary })} />
      <ExperienceEditor value={content.experience} onChange={(experience) => setContent({ ...content, experience })} />
      <EducationEditor value={content.education} onChange={(education) => setContent({ ...content, education })} />
      <ProjectsEditor value={content.projects} onChange={(projects) => setContent({ ...content, projects })} />
      <SkillsEditor value={content.skills} onChange={(skills) => setContent({ ...content, skills })} />
      <CertificatesEditor value={content.certificates} onChange={(certificates) => setContent({ ...content, certificates })} />
      <AchievementsEditor value={content.achievements} onChange={(achievements) => setContent({ ...content, achievements })} />
    </div>
  );
}

function ExportMenu({ exporting, onExport }: { exporting: ExportFormat | null; onExport: (f: ExportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const formats: ExportFormat[] = ["pdf", "docx", "markdown", "json", "html"];
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)} disabled={exporting !== null}>
        {exporting ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Download size={16} className="mr-1.5" />}
        Export
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-border bg-surface p-1 shadow-lg">
          {formats.map((f) => (
            <button
              key={f}
              className="block w-full rounded px-3 py-1.5 text-left text-sm text-ink hover:bg-white/5"
              onClick={() => {
                setOpen(false);
                onExport(f);
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section editors
// ---------------------------------------------------------------------------

/** Freely-typable date field with an optional calendar picker. Typing
 *  directly into a plain text input avoids the native month-input's rigid
 *  two-segment UI (which shows "--/----" placeholders when empty). Clicking
 *  the calendar icon opens a real native month picker via showPicker() for
 *  people who'd rather click than type; picking a date there fills the same
 *  text value. */
// FIX (bug: "tech stack comma/space not being accepted"): the old inline
// input derived its displayed value directly from the parsed array via
// `.join(", ")` on every render. Since csvToArray() trims and drops empty
// tokens, typing "React, " (comma-space, mid-typing the next item) parsed
// to ["React"], which the very next render redisplayed as "React" — the
// comma and space the user just typed were wiped out immediately, making
// it impossible to ever type a second item. This component keeps its own
// local text buffer so what's on screen isn't forced to round-trip through
// the parsed array on every keystroke; the parent still receives the
// cleanly parsed array via onChange.
function TechStackField({
  value,
  onChange,
  className,
}: {
  value: string[] | undefined;
  onChange: (arr: string[]) => void;
  className?: string;
}) {
  const [text, setText] = useState((value ?? []).join(", "));
  const lastEmitted = useRef<string[]>(value ?? []);

  useEffect(() => {
    // Only resync from the parent when the array changed for a reason
    // OTHER than this field's own onChange (e.g. a different entry was
    // loaded, or an external reset) — not on every keystroke here.
    const incoming = value ?? [];
    if (JSON.stringify(incoming) !== JSON.stringify(lastEmitted.current)) {
      setText(incoming.join(", "));
      lastEmitted.current = incoming;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      placeholder="Tech stack (comma-separated)"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const arr = csvToArray(e.target.value);
        lastEmitted.current = arr;
        onChange(arr);
      }}
      className={className}
    />
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const yearPickerRef = useRef<HTMLInputElement>(null);
  // FIX (bug: "project date ONLY accepting YYYY-MM"): the free-text field
  // beside this button already accepted any text the user typed (including
  // a bare year) — but the calendar-icon button, the obvious/discoverable
  // way to enter a date, only ever opened a native <input type="month">,
  // which cannot select a year alone. That made it feel like YYYY-MM was
  // mandatory. A second "year only" picker mode is added so a bare-year
  // entry (e.g. graduation year) has a real picker too, not just the
  // text box.
  const [mode, setMode] = useState<"month" | "year">(/^\d{4}$/.test(value) ? "year" : "month");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-mist">{label}</label>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "month" ? "year" : "month"))}
          className="text-[10px] text-mist underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          {mode === "month" ? "Use year only" : "Use month + year"}
        </button>
      </div>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={mode === "year" ? "e.g. 2024" : "e.g. 2024-06"}
          className="pr-11"
        />
        <button
          type="button"
          aria-label="Pick date"
          onClick={() => {
            const picker = mode === "year" ? yearPickerRef.current : pickerRef.current;
            if (!picker) return;
            if ("showPicker" in picker && typeof picker.showPicker === "function") {
              try {
                picker.showPicker();
              } catch {
                picker.focus();
              }
            } else {
              picker.focus();
            }
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-mist hover:text-ink"
        >
          <CalendarDays size={16} />
        </button>
        {mode === "year" ? (
          <input
            ref={yearPickerRef}
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            step={1}
            value={/^\d{4}$/.test(value) ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            tabIndex={-1}
          />
        ) : (
          <input
            ref={pickerRef}
            type="month"
            value={/^\d{4}-\d{2}$/.test(value) ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            className="pointer-events-none absolute h-0 w-0 opacity-0"
            tabIndex={-1}
          />
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && children}
    </Card>
  );
}

function ContactEditor({ value, onChange }: { value: ResumeContent["contact"]; onChange: (v: ResumeContent["contact"]) => void }) {
  return (
    <SectionCard title="Contact">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input placeholder="Full name" value={value.fullName} onChange={(e) => onChange({ ...value, fullName: e.target.value })} />
        <Input placeholder="Email" value={value.email ?? ""} onChange={(e) => onChange({ ...value, email: e.target.value })} />
        <Input placeholder="Phone" value={value.phone ?? ""} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
        <Input placeholder="Location" value={value.location ?? ""} onChange={(e) => onChange({ ...value, location: e.target.value })} />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {value.links.map((link, i) => (
          <div key={i} className="flex gap-2">
            <Input
              placeholder="Label (e.g. GitHub)"
              value={link.label}
              onChange={(e) => {
                const links = [...value.links];
                links[i] = { ...link, label: e.target.value };
                onChange({ ...value, links });
              }}
              className="max-w-[160px]"
            />
            <Input
              placeholder="https://…"
              value={link.url}
              onChange={(e) => {
                const links = [...value.links];
                links[i] = { ...link, url: e.target.value };
                onChange({ ...value, links });
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => onChange({ ...value, links: value.links.filter((_, j) => j !== i) })}>
              <X size={14} />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            const newLink: ResumeLink = { label: "", url: "" };
            onChange({ ...value, links: [...value.links, newLink] });
          }}
        >
          <Plus size={14} className="mr-1" /> Add link
        </Button>
      </div>
    </SectionCard>
  );
}

function SummaryEditor({ value, onChange }: { value: ResumeContent["summary"]; onChange: (v: ResumeContent["summary"]) => void }) {
  return (
    <SectionCard title="Summary">
      <Input
        placeholder="Headline (e.g. Backend Engineering Intern | Distributed Systems)"
        value={value.headline ?? ""}
        onChange={(e) => onChange({ ...value, headline: e.target.value })}
        className="mb-3"
      />
      <textarea
        placeholder="2-3 sentence professional summary"
        value={value.summary ?? ""}
        onChange={(e) => onChange({ ...value, summary: e.target.value })}
        rows={4}
        className="w-full rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
      />
    </SectionCard>
  );
}

function ExperienceEditor({ value, onChange }: { value: ExperienceEntry[]; onChange: (v: ExperienceEntry[]) => void }) {
  return (
    <SectionCard
      title="Experience"
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange([
              ...value,
              { id: newEntryId(), company: "", role: "", dateRange: { start: "" }, bullets: [] },
            ])
          }
        >
          <Plus size={14} className="mr-1" /> Add
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {value.map((entry, i) => (
          <div key={entry.id} className="rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder="Company" value={entry.company} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, company: e.target.value } : v)))} />
              <Input placeholder="Role" value={entry.role} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, role: e.target.value } : v)))} />
              <DateField label="Start date" value={entry.dateRange.start} onChange={(v) => onChange(value.map((e2, j) => (j === i ? { ...e2, dateRange: { ...e2.dateRange, start: v } } : e2)))} />
              <DateField label="End date (blank = current)" value={entry.dateRange.end ?? ""} onChange={(v) => onChange(value.map((e2, j) => (j === i ? { ...e2, dateRange: { ...e2.dateRange, end: v, isCurrent: !v } } : e2)))} />
              <Input placeholder="Location" value={entry.location ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, location: e.target.value } : v)))} />
              <TechStackField value={entry.techStack} onChange={(arr) => onChange(value.map((v, j) => (j === i ? { ...v, techStack: arr } : v)))} />
            </div>
            <textarea
              placeholder="One bullet per line"
              value={entry.bullets.join("\n")}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, bullets: linesToArray(e.target.value) } : v)))}
              rows={3}
              className="mt-2 w-full rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            />
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 size={14} className="mr-1" /> Remove
            </Button>
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-mist">No experience entries yet.</p>}
      </div>
    </SectionCard>
  );
}

function EducationEditor({ value, onChange }: { value: EducationEntry[]; onChange: (v: EducationEntry[]) => void }) {
  return (
    <SectionCard
      title="Education"
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange([...value, { id: newEntryId(), institution: "", degree: "", dateRange: { start: "" } }])}
        >
          <Plus size={14} className="mr-1" /> Add
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {value.map((entry, i) => (
          <div key={entry.id} className="rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder="Institution" value={entry.institution} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, institution: e.target.value } : v)))} />
              <Input placeholder="Degree" value={entry.degree} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, degree: e.target.value } : v)))} />
              <Input placeholder="Field of study" value={entry.fieldOfStudy ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, fieldOfStudy: e.target.value } : v)))} />
              <Input placeholder="GPA" value={entry.gpa ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, gpa: e.target.value } : v)))} />
              <DateField label="Start date" value={entry.dateRange.start} onChange={(v) => onChange(value.map((e2, j) => (j === i ? { ...e2, dateRange: { ...e2.dateRange, start: v } } : e2)))} />
              <DateField label="End date (blank = current)" value={entry.dateRange.end ?? ""} onChange={(v) => onChange(value.map((e2, j) => (j === i ? { ...e2, dateRange: { ...e2.dateRange, end: v, isCurrent: !v } } : e2)))} />
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 size={14} className="mr-1" /> Remove
            </Button>
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-mist">No education entries yet.</p>}
      </div>
    </SectionCard>
  );
}

function ProjectsEditor({ value, onChange }: { value: ProjectEntry[]; onChange: (v: ProjectEntry[]) => void }) {
  return (
    <SectionCard
      title="Projects"
      action={
        <Button variant="ghost" size="sm" onClick={() => onChange([...value, { id: newEntryId(), name: "", bullets: [] }])}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {value.map((entry, i) => (
          <div key={entry.id} className="rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder="Project name" value={entry.name} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))} />
              <Input placeholder="Link (optional)" value={entry.link ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, link: e.target.value } : v)))} />
              <TechStackField value={entry.techStack} onChange={(arr) => onChange(value.map((v, j) => (j === i ? { ...v, techStack: arr } : v)))} className="sm:col-span-2" />
            </div>
            <textarea
              placeholder="Description (optional)"
              value={entry.description ?? ""}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, description: e.target.value } : v)))}
              rows={2}
              className="mt-2 w-full rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            />
            <textarea
              placeholder="One bullet per line"
              value={entry.bullets.join("\n")}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, bullets: linesToArray(e.target.value) } : v)))}
              rows={3}
              className="mt-2 w-full rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            />
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 size={14} className="mr-1" /> Remove
            </Button>
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-mist">No projects yet.</p>}
      </div>
    </SectionCard>
  );
}

function SkillsEditor({ value, onChange }: { value: SkillGroup[]; onChange: (v: SkillGroup[]) => void }) {
  return (
    <SectionCard
      title="Skills"
      action={
        <Button variant="ghost" size="sm" onClick={() => onChange([...value, { id: newEntryId(), category: "", items: [] }])}>
          <Plus size={14} className="mr-1" /> Add group
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {value.map((group, i) => (
          <div key={group.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
            <Input placeholder="Category (e.g. Languages)" value={group.category} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, category: e.target.value } : v)))} className="sm:max-w-[200px]" />
            <Input placeholder="Skills, comma-separated" value={group.items.join(", ")} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, items: csvToArray(e.target.value) } : v)))} />
            <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X size={14} />
            </Button>
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-mist">No skill groups yet.</p>}
      </div>
    </SectionCard>
  );
}

function CertificatesEditor({ value, onChange }: { value: CertificateEntry[]; onChange: (v: CertificateEntry[]) => void }) {
  return (
    <SectionCard
      title="Certificates"
      action={
        <Button variant="ghost" size="sm" onClick={() => onChange([...value, { id: newEntryId(), name: "" }])}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {value.map((entry, i) => (
          <div key={entry.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
            <Input placeholder="Name" value={entry.name} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))} />
            <Input placeholder="Issuer" value={entry.issuer ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, issuer: e.target.value } : v)))} />
            <Input placeholder="Date" value={entry.date ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, date: e.target.value } : v)))} />
            <div className="flex gap-2">
              <Input placeholder="URL" value={entry.url ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, url: e.target.value } : v)))} />
              <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={14} />
              </Button>
            </div>
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-mist">No certificates yet.</p>}
      </div>
    </SectionCard>
  );
}

function AchievementsEditor({ value, onChange }: { value: AchievementEntry[]; onChange: (v: AchievementEntry[]) => void }) {
  return (
    <SectionCard
      title="Achievements"
      action={
        <Button variant="ghost" size="sm" onClick={() => onChange([...value, { id: newEntryId(), title: "" }])}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {value.map((entry, i) => (
          <div key={entry.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
            <Input placeholder="Title" value={entry.title} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, title: e.target.value } : v)))} />
            <Input placeholder="Date" value={entry.date ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, date: e.target.value } : v)))} />
            <div className="flex gap-2">
              <Input placeholder="Description" value={entry.description ?? ""} onChange={(e) => onChange(value.map((v, j) => (j === i ? { ...v, description: e.target.value } : v)))} />
              <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <X size={14} />
              </Button>
            </div>
          </div>
        ))}
        {value.length === 0 && <p className="text-sm text-mist">No achievements yet.</p>}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// ATS panel
// ---------------------------------------------------------------------------

function AtsPanel({ resumeId, defaultJobDescription, onError }: { resumeId: string; defaultJobDescription: string; onError: (m: string) => void }) {
  const [jd, setJd] = useState(defaultJobDescription);
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<AtsReport>(`/api/resume-studio/${resumeId}/ats`, {
        method: "POST",
        body: JSON.stringify({ jobDescription: jd || undefined, includeAiAnalysis: true }),
      }),
    onError: (err: Error) => onError(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>ATS Score</CardTitle>
        <CardDescription>Runs a keyword, formatting, and content check — paste a job description for targeted matching.</CardDescription>
      </CardHeader>
      <textarea
        placeholder="Paste a job description for keyword matching (optional)"
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        rows={3}
        className="mb-3 w-full rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
      />
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Gauge size={16} className="mr-1.5" />}
        Run ATS scan
      </Button>

      {mutation.data && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-semibold text-ink">{mutation.data.overallScore}</div>
            <div className="text-sm text-mist">/ 100 overall</div>
          </div>
          <p className="text-sm text-mist">{mutation.data.summary}</p>

          {mutation.data.missingKeywords.length > 0 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-mist">Missing keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {mutation.data.missingKeywords.map((k) => (
                  <Badge key={k} tone="pulse">{k}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {mutation.data.categoryScores.map((cat) => (
              <div key={cat.category} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize text-ink">{cat.category.replace(/_/g, " ")}</span>
                  <span className="text-mist">{cat.score}/{cat.maxScore}</span>
                </div>
                {cat.issues.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-mist">
                    {cat.issues.map((issue, idx) => (
                      <li key={idx}>
                        <span className={issue.severity === "high" ? "text-red-400" : issue.severity === "medium" ? "text-amber-400" : "text-mist"}>
                          {issue.message}
                        </span>
                        {issue.suggestion && <span className="block text-mist/70">→ {issue.suggestion}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AI panel
// ---------------------------------------------------------------------------

const AI_TASKS: { value: AiTaskType; label: string }[] = [
  { value: "improve_summary", label: "Improve summary" },
  { value: "rewrite_experience", label: "Rewrite experience bullet" },
  { value: "improve_project", label: "Improve project description" },
  { value: "improve_skills", label: "Improve skills phrasing" },
  { value: "generate_achievement", label: "Generate achievement" },
  { value: "generate_internship", label: "Generate bullets from raw description" },
  { value: "optimize_keywords", label: "Optimize keywords" },
  { value: "suggest_missing_skills", label: "Suggest missing skills" },
  { value: "improve_grammar", label: "Fix grammar" },
  { value: "improve_readability", label: "Improve readability" },
  { value: "reduce_repetition", label: "Reduce repetition" },
  { value: "generate_cover_letter", label: "Generate cover letter" },
  { value: "generate_linkedin_about", label: "Generate LinkedIn About" },
  { value: "generate_portfolio_bio", label: "Generate portfolio bio" },
  { value: "generate_github_bio", label: "Generate GitHub bio" },
  { value: "humanize", label: "Humanize AI-sounding text" },
];

function AiPanel({ targetRole, jobDescription, onError }: { targetRole: string; jobDescription: string; onError: (m: string) => void }) {
  const [task, setTask] = useState<AiTaskType>("improve_summary");
  const [input, setInput] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<AiGenerationResult>("/api/resume-studio/ai", {
        method: "POST",
        body: JSON.stringify({
          task,
          input,
          context: { targetRole: targetRole || undefined, jobDescription: jobDescription || undefined },
        }),
      }),
    onError: (err: Error) => onError(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Suggestions</CardTitle>
        <CardDescription>Paste text from any section and pick a task — copy the result back into the field you're editing.</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-3">
        <select
          value={task}
          onChange={(e) => setTask(e.target.value as AiTaskType)}
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink"
        >
          {AI_TASKS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <textarea
          placeholder="Paste the text you want help with…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-border bg-surface/40 px-4 py-2 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
        />
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !input.trim()} className="self-start">
          {mutation.isPending ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Sparkles size={16} className="mr-1.5" />}
          Generate
        </Button>

        {mutation.data && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="whitespace-pre-wrap text-sm text-ink">{mutation.data.output}</p>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => navigator.clipboard.writeText(mutation.data!.output)}
            >
              Copy
            </Button>
            {mutation.data.alternatives?.map((alt, i) => (
              <div key={i} className="border-t border-border pt-2">
                <p className="whitespace-pre-wrap text-sm text-mist">{alt}</p>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => navigator.clipboard.writeText(alt)}>
                  Copy alternative
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Versions panel
// ---------------------------------------------------------------------------

function VersionsPanel({
  resumeId,
  currentVersion,
  onRestored,
  onError,
}: {
  resumeId: string;
  currentVersion: number;
  onRestored: (resume: Resume) => void;
  onError: (m: string) => void;
}) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ["resume-studio", "versions", resumeId],
    queryFn: () => apiFetch<ResumeVersion[]>(`/api/resume-studio/${resumeId}/versions`),
    retry: 1,
  });

  const restoreMutation = useMutation({
    mutationFn: (version: number) =>
      apiFetch<Resume>(`/api/resume-studio/${resumeId}/versions`, {
        method: "POST",
        body: JSON.stringify({ version }),
      }),
    onSuccess: onRestored,
    onError: (err: Error) => onError(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version history</CardTitle>
        <CardDescription>Every saved content change is snapshotted — restore any prior version.</CardDescription>
      </CardHeader>
      {isLoading && (
        <div className="flex items-center text-sm text-mist">
          <Loader2 size={16} className="mr-2 animate-spin" /> Loading history…
        </div>
      )}
      <div className="flex flex-col gap-2">
        {versions?.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
            <div>
              <span className="font-medium text-ink">v{v.version}</span>
              {v.version === currentVersion && <Badge tone="success" className="ml-2">Current</Badge>}
              <span className="ml-2 text-mist">{new Date(v.createdAt).toLocaleString()}</span>
              {v.changeSummary && <p className="mt-0.5 text-xs text-mist">{v.changeSummary}</p>}
            </div>
            {v.version !== currentVersion && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm(`Restore v${v.version}? This creates a new version from it — nothing is lost.`)) {
                    restoreMutation.mutate(v.version);
                  }
                }}
                disabled={restoreMutation.isPending}
              >
                Restore
              </Button>
            )}
          </div>
        ))}
        {versions && versions.length === 0 && <p className="text-sm text-mist">No version history yet — save a change to create one.</p>}
      </div>
    </Card>
  );
}
