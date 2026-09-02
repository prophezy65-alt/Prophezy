"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenerateProject } from "./useProjectGeneratorApi";
import { useToast } from "./Toast";
import { ProjectDomain, DifficultyLevel, ProjectScale } from "@/lib/project-generator/models";

const DOMAIN_LABELS: Record<ProjectDomain, string> = {
  [ProjectDomain.AI]: "AI",
  [ProjectDomain.MACHINE_LEARNING]: "Machine Learning",
  [ProjectDomain.DEEP_LEARNING]: "Deep Learning",
  [ProjectDomain.LLM]: "LLMs",
  [ProjectDomain.WEB_APP]: "Web Apps",
  [ProjectDomain.ANDROID]: "Android",
  [ProjectDomain.IOS]: "iOS",
  [ProjectDomain.FLUTTER]: "Flutter",
  [ProjectDomain.REACT_NATIVE]: "React Native",
  [ProjectDomain.NEXTJS]: "Next.js",
  [ProjectDomain.PYTHON]: "Python",
  [ProjectDomain.JAVA]: "Java",
  [ProjectDomain.CPP]: "C++",
  [ProjectDomain.RUST]: "Rust",
  [ProjectDomain.GO]: "Go",
  [ProjectDomain.CYBER_SECURITY]: "Cyber Security",
  [ProjectDomain.BLOCKCHAIN]: "Blockchain",
  [ProjectDomain.IOT]: "IoT",
  [ProjectDomain.CLOUD]: "Cloud",
  [ProjectDomain.DATA_SCIENCE]: "Data Science",
  [ProjectDomain.DEVOPS]: "DevOps",
  [ProjectDomain.AR]: "AR",
  [ProjectDomain.VR]: "VR",
  [ProjectDomain.GAME_DEVELOPMENT]: "Game Dev",
  [ProjectDomain.COMPUTER_VISION]: "Computer Vision",
  [ProjectDomain.NLP]: "NLP",
};

const POPULAR_DOMAINS: ProjectDomain[] = [
  ProjectDomain.WEB_APP,
  ProjectDomain.AI,
  ProjectDomain.MACHINE_LEARNING,
  ProjectDomain.COMPUTER_VISION,
  ProjectDomain.NLP,
  ProjectDomain.ANDROID,
  ProjectDomain.CYBER_SECURITY,
  ProjectDomain.BLOCKCHAIN,
  ProjectDomain.IOT,
  ProjectDomain.CLOUD,
  ProjectDomain.DATA_SCIENCE,
  ProjectDomain.GAME_DEVELOPMENT,
];

const DIFFICULTY_OPTIONS: { value: DifficultyLevel; label: string }[] = [
  { value: DifficultyLevel.BEGINNER, label: "Beginner" },
  { value: DifficultyLevel.INTERMEDIATE, label: "Intermediate" },
  { value: DifficultyLevel.ADVANCED, label: "Advanced" },
  { value: DifficultyLevel.EXPERT, label: "Expert" },
];

const SCALE_OPTIONS: { value: ProjectScale; label: string }[] = [
  { value: ProjectScale.PROTOTYPE, label: "Prototype" },
  { value: ProjectScale.MVP, label: "MVP" },
  { value: ProjectScale.PRODUCTION, label: "Production" },
  { value: ProjectScale.ENTERPRISE, label: "Enterprise" },
];

interface GenerateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GenerateProjectModal({ open, onClose }: GenerateProjectModalProps) {
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [domains, setDomains] = useState<ProjectDomain[]>([]);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "">("");
  const [scale, setScale] = useState<ProjectScale | "">("");

  const generateProject = useGenerateProject();
  const toast = useToast();

  function toggleDomain(domain: ProjectDomain) {
    setDomains((prev) => (prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]));
  }

  async function handleGenerate() {
    if (!idea.trim()) {
      toast.show("Describe your project idea first.", "error");
      return;
    }

    try {
      const result = await generateProject.mutateAsync({
        idea: idea.trim(),
        title: title.trim() || undefined,
        preferredDomains: domains.length > 0 ? domains : undefined,
        targetDifficulty: difficulty || undefined,
        targetScale: scale || undefined,
      });
      toast.show(`Generated "${result.project.title}".`, "success");
      onClose();
      setIdea("");
      setTitle("");
      setDomains([]);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Failed to generate project.", "error");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel max-h-[85vh] w-full max-w-xl overflow-y-auto p-6"
          >
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-signal" />
                <h2 className="font-display text-lg font-medium text-ink">Generate project</h2>
              </div>
              <button onClick={onClose} className="text-mist hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Project title (optional)</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Campus Lost & Found App" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Describe your idea</label>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="e.g. An app that lets students report and search for lost items on campus, with AI-matched suggestions..."
                  rows={5}
                  className="w-full rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mist">Difficulty (optional)</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as DifficultyLevel | "")}
                    className="h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                  >
                    <option value="">Let AI decide</option>
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mist">Scale (optional)</label>
                  <select
                    value={scale}
                    onChange={(e) => setScale(e.target.value as ProjectScale | "")}
                    className="h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                  >
                    <option value="">Let AI decide</option>
                    {SCALE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Preferred domains (optional)</label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_DOMAINS.map((domain) => (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => toggleDomain(domain)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        domains.includes(domain)
                          ? "border-signal/40 bg-signal/10 text-signal"
                          : "border-border text-mist hover:text-ink"
                      }`}
                    >
                      {DOMAIN_LABELS[domain]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generateProject.isPending}>
                {generateProject.isPending ? (
                  <>
                    <Loader2 size={16} className="mr-1.5 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="mr-1.5" /> Generate project
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
