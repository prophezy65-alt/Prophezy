"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Search,
  Map,
  NotebookPen,
  Layers,
  Brain,
  Mic,
  ClipboardList,
  FolderKanban,
  FileText,
  GraduationCap,
  UploadCloud,
  Sparkle,
} from "lucide-react";
import { uploadStudyFile, type StudyArtifactKind } from "@/lib/study-hub/api";

// ---------------------------------------------------------------------------
// Static config — example prompts and tab definitions. Not user data, not
// fetched data — just UI copy, same as any nav label elsewhere in the app.
// ---------------------------------------------------------------------------


const ARTIFACT_TABS: { kind: StudyArtifactKind | "overview"; label: string; icon: typeof Map; color: string; href: string | null }[] = [
  { kind: "overview", label: "Overview", icon: Sparkle, color: "#00B8D9", href: null },
  { kind: "roadmap", label: "Roadmap", icon: Map, color: "#3B82F6", href: "/app/career" },
  { kind: "notes", label: "Notes", icon: NotebookPen, color: "#8B5CF6", href: "/app/notes" },
  { kind: "flashcards", label: "Flashcards", icon: Layers, color: "#14B8A6", href: "/app/flashcards" },
  { kind: "quiz", label: "Quiz", icon: Brain, color: "#F97316", href: "/app/quiz" },
  { kind: "interviewQuestions", label: "Interview", icon: Mic, color: "#EC4899", href: "/app/interview-lab" },
  { kind: "assignments", label: "Assignment Solver", icon: ClipboardList, color: "#6366F1", href: "/app/assignments" },
  { kind: "projects", label: "Projects", icon: FolderKanban, color: "#22C55E", href: "/app/projects" },
  { kind: "researchPapers", label: "Research", icon: FileText, color: "#EF4444", href: "/app/research-papers" },
  { kind: "resumeSkills", label: "Resume", icon: GraduationCap, color: "#EAB308", href: "/app/resume-studio" },
];

function tabColor(kind: StudyArtifactKind | "overview"): string {
  return ARTIFACT_TABS.find((t) => t.kind === kind)?.color ?? "#00B8D9";
}

// ---------------------------------------------------------------------------
// Local light-theme primitives — deliberately not reusing components/ui's
// Card/Button, which are tuned for the dark app shell (text-ink, .glass).
// Study Hub gets its own visual identity, contained to this file.
// ---------------------------------------------------------------------------

function LightCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-[#C3D0DE] bg-[#EAF6FB] shadow-[0_6px_24px_rgb(15,23,42,0.10)] transition-all hover:border-[#00B8D9]/50 hover:shadow-[0_10px_32px_rgb(0,184,217,0.18)] ${className}`}
    >
      {children}
    </div>
  );
}

function PrimaryButton({
  onClick,
  children,
  disabled,
  className = "",
  type = "button",
}: {
  onClick?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00B8D9] to-[#3B82F6] px-4 py-2.5 text-sm font-medium text-white shadow-[0_4px_14px_rgb(0,184,217,0.35)] transition-all hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({ onClick, children, className = "" }: { onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#C3D0DE] bg-[#EAF6FB] px-3 py-2 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F4F7FA] active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function StudyHubClient({ firstName }: { firstName: string | null }) {
  const [topicInput, setTopicInput] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const greeting = getGreeting();

  const openTopic = async (topic: string) => {
    setActiveTopic(topic);
    try {
      const res = await fetch("/api/study-hub/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: topic }),
      });
      const json = await res.json();
      if (json.ok) setSessionId(json.data.id as string);
    } catch {
      // Session tracking failing shouldn't block the actual workspace from opening.
    }
  };

  const closeTopic = async () => {
    setActiveTopic(null);
    if (sessionId) {
      fetch(`/api/study-hub/sessions/${sessionId}/end`, { method: "POST", credentials: "include" }).catch(() => {});
      setSessionId(null);
    }
  };

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] rounded-3xl bg-gradient-to-br from-[#BFE6F5] via-[#D6EEF9] to-[#E9F7FC] p-6 lg:-m-10 lg:p-10">
      {!activeTopic ? (
        <Hero greeting={greeting} firstName={firstName} topicInput={topicInput} setTopicInput={setTopicInput} onStart={openTopic} />
      ) : (
        <TopicWorkspace topic={activeTopic} onBack={closeTopic} />
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({
  greeting,
  firstName,
  topicInput,
  setTopicInput,
  onStart,
}: {
  greeting: string;
  firstName: string | null;
  topicInput: string;
  setTopicInput: (v: string) => void;
  onStart: (topic: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center lg:py-24">
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#C3D0DE] bg-[#EAF6FB] px-3 py-1 text-xs font-medium text-[#00B8D9]">
        <Sparkles size={12} /> AI Learning Workspace
      </div>

      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-[#111827] lg:text-5xl">
        {greeting}
        {firstName ? `, ${firstName}` : ""}
        <br />
        <span className="bg-gradient-to-r from-[#00B8D9] via-[#14B8A6] to-[#3B82F6] bg-clip-text text-transparent">
          What do you want to master today?
        </span>
      </h1>

      <form
        className="mt-10 w-full max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (topicInput.trim()) onStart(topicInput.trim());
        }}
      >
        <div className="flex flex-col gap-3 rounded-2xl border border-[#C3D0DE] bg-[#EAF6FB] p-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)] focus-within:border-[#00B8D9] focus-within:ring-2 focus-within:ring-[#00B8D9]/20 sm:flex-row sm:items-center sm:p-2 sm:pl-5">
          <div className="flex flex-1 items-center gap-3">
            <Search size={20} className="shrink-0 text-[#9CA3AF]" />
            <input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="e.g. Machine Learning, DBMS, React..."
              className="h-12 flex-1 bg-transparent text-base text-[#111827] outline-none placeholder:text-[#9CA3AF]"
            />
          </div>
          <PrimaryButton type="submit" disabled={!topicInput.trim()} className="h-11 w-full px-5 sm:w-auto">
            <Sparkles size={16} /> Start learning
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Topic workspace
// ---------------------------------------------------------------------------

function TopicWorkspace({ topic, onBack }: { topic: string; onBack: () => void }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <button type="button" onClick={onBack} className="text-sm text-[#6B7280] hover:text-[#111827]">
            ← Back
          </button>
          <h1 className="mt-1 text-2xl font-semibold text-[#111827] lg:text-3xl">{topic}</h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 overflow-x-auto rounded-2xl border border-[#C3D0DE] bg-[#EAF6FB] p-1.5">
        {ARTIFACT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isOverview = tab.kind === "overview";
          return (
            <button
              key={tab.kind}
              type="button"
              onClick={() => {
                if (tab.href) router.push(tab.href);
              }}
              style={isOverview ? { backgroundColor: tab.color } : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isOverview ? "text-white" : "text-[#6B7280] hover:bg-[#F4F7FA]"
              }`}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      <OverviewTab topic={topic} />
    </div>
  );
}

const ARTIFACT_DESCRIPTIONS: Record<StudyArtifactKind, string> = {
  roadmap: "A week-by-week learning plan for this topic, broken into milestones you can check off as you go.",
  notes: "Structured study notes covering the core concepts, so you're not starting from a blank page.",
  flashcards: "Spaced-repetition flashcards for quick recall practice — good for the facts you keep forgetting.",
  quiz: "A practice quiz to test what's actually sticking, before it's tested for real.",
  interviewQuestions: "Common interview questions on this topic, with the reasoning behind strong answers.",
  assignments: "Practice problems and assignments to apply the topic, not just read about it.",
  projects: "Project ideas scoped to this topic, sized for a portfolio piece.",
  researchPapers: "Relevant research papers and where this topic sits in current work.",
  resumeSkills: "How this topic translates into resume-ready skill language recruiters recognize.",
  githubIdeas: "Concrete GitHub project ideas to build and show your work.",
  resources: "Curated external resources — docs, courses, references — worth reading next.",
  dailyPlan: "A day-by-day study plan broken into manageable daily sessions.",
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ENTITY_LABELS: Record<string, string> = {
  note: "Note",
  flashcard_deck: "Flashcards",
  assignment: "Assignment",
  quiz: "Quiz",
  project: "Project",
  resume: "Resume",
  research_paper: "Research paper",
  trending_research_topic: "Research topic",
  internship: "Internship",
};

interface ContentViewItem {
  entityType: string;
  entityId: string;
  viewedAt: string;
}

function RecentlyStudiedCard() {
  const [views, setViews] = useState<ContentViewItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/study-hub/content-views", { credentials: "include" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.ok) setViews(json.data as ContentViewItem[]);
      })
      .catch(() => {
        if (!cancelled) setViews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LightCard className="p-5">
      <h3 className="text-sm font-semibold text-[#111827]">Recently studied</h3>
      {views === null && <p className="mt-2 text-sm text-[#9CA3AF]">Loading…</p>}
      {views !== null && views.length === 0 && (
        <p className="mt-2 text-sm text-[#9CA3AF]">Nothing yet — generate a quiz or note and it'll show up here.</p>
      )}
      {views !== null && views.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {views.map((v, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-[#374151]">{ENTITY_LABELS[v.entityType] ?? v.entityType}</span>
              <span className="text-xs text-[#9CA3AF]">{formatRelativeTime(v.viewedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </LightCard>
  );
}

function OverviewTab({ topic }: { topic: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      <LightCard className="p-6">
        <h3 className="text-base font-semibold text-[#111827]">Everything for {topic}, in one place</h3>
        <p className="mt-1.5 text-sm text-[#6B7280]">
          Here's what each part of Prophezy does for you on this topic. Click any card to open that module.
        </p>
      </LightCard>

      <RecentlyStudiedCard />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARTIFACT_TABS.filter((t) => t.kind !== "overview").map((tab) => {
          const kind = tab.kind as StudyArtifactKind;
          const Icon = tab.icon;
          return (
            <button key={kind} type="button" onClick={() => tab.href && router.push(tab.href)} className="text-left">
              <LightCard className="flex h-full flex-col gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${tab.color}18` }}>
                  <Icon size={18} style={{ color: tab.color }} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#111827]">{tab.label}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{ARTIFACT_DESCRIPTIONS[kind]}</p>
                </div>
              </LightCard>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload dropzone
// ---------------------------------------------------------------------------

function UploadDropzone({ topic }: { topic: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "notConnected">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setStatus("uploading");
    try {
      await uploadStudyFile({ file: files[0]! });
    } catch {
      setStatus("notConnected");
    }
  };

  return (
    <div className="mt-5">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C3D0DE] bg-[#F4F7FA]/50 px-6 py-8 text-center transition-colors hover:border-[#00B8D9]/50 hover:bg-[#00B8D9]/5"
      >
        <UploadCloud size={22} className="text-[#00B8D9]" />
        <p className="text-sm text-[#374151]">
          Drop a PDF, DOCX, PPT, TXT, or image for {topic} — or <span className="text-[#00B8D9]">browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.ppt,.pptx,.txt,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg bg-[#F4F7FA] px-3 py-2 text-xs text-[#374151]">
              <span className="truncate">{f.name}</span>
              <span className="text-[#9CA3AF]">{(f.size / 1024).toFixed(0)} KB</span>
            </div>
          ))}
          <GhostButton onClick={handleUpload} className="self-start">
            {status === "uploading" ? "Uploading…" : "Upload & process"}
          </GhostButton>
          {status === "notConnected" && (
            <p className="rounded-xl bg-[#FEF3C7] px-3 py-2 text-xs text-[#92400E]">
              Upload isn't wired to a processing endpoint yet — files are selected but not sent anywhere.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

