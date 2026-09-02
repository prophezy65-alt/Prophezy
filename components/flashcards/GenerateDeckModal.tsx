"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenerateDeck } from "./useFlashcardsApi";
import { useToast } from "./Toast";
import { CARD_TYPES, type CardType } from "@/lib/flashcards/models/flashcard.model";
import type { LearningMode, SourceType } from "@/lib/flashcards/models/deck.model";

const LEARNING_MODES: { value: LearningMode; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "exam", label: "Exam prep" },
  { value: "competitive_exam", label: "Competitive exam" },
  { value: "revision", label: "Revision" },
  { value: "quick_revision", label: "Quick revision" },
  { value: "long_term", label: "Long-term retention" },
];

const CARD_TYPE_LABELS: Record<CardType, string> = {
  qa: "Q&A",
  definition: "Definition",
  term: "Term",
  formula: "Formula",
  image_concept: "Image concept",
  diagram_labels: "Diagram labels",
  code_output: "Code → Output",
  output_code: "Output → Code",
  true_false: "True/False",
  fill_blank: "Fill in the blank",
  one_word: "One word",
  concept_recall: "Concept recall",
  step_ordering: "Step ordering",
  case_study: "Case study",
  programming_recall: "Programming",
  algorithm_recall: "Algorithm",
  medical_recall: "Medical",
  legal_recall: "Legal",
  business_recall: "Business",
  engineering_recall: "Engineering",
  vocabulary: "Vocabulary",
};

const DEFAULT_CARD_TYPES: CardType[] = ["qa", "definition", "true_false", "fill_blank"];

interface GenerateDeckModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GenerateDeckModal({ open, onClose }: GenerateDeckModalProps) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("plain_text");
  const [text, setText] = useState("");
  const [learningMode, setLearningMode] = useState<LearningMode>("intermediate");
  const [cardTypes, setCardTypes] = useState<CardType[]>(DEFAULT_CARD_TYPES);
  const [targetCardCount, setTargetCardCount] = useState(20);

  const generateDeck = useGenerateDeck();
  const toast = useToast();

  function toggleCardType(type: CardType) {
    setCardTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleGenerate() {
    if (!text.trim()) {
      toast.show("Paste some source content first.", "error");
      return;
    }
    if (cardTypes.length === 0) {
      toast.show("Pick at least one card type.", "error");
      return;
    }

    try {
      const result = await generateDeck.mutateAsync({
        title: title.trim() || undefined,
        sourceType,
        text: sourceType === "url" ? text.trim() : text,
        learningMode,
        cardTypes,
        targetCardCount,
      });
      toast.show(`Generated "${result.deck.title}" with ${result.cards.length} cards.`, "success");
      onClose();
      setText("");
      setTitle("");
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Failed to generate deck.", "error");
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
                <h2 className="font-display text-lg font-medium text-ink">Generate flashcards</h2>
              </div>
              <button onClick={onClose} className="text-mist hover:text-ink" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Deck title (optional)</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cell Biology — Chapter 4" />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Source</label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as SourceType)}
                  className="h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                >
                  <option value="plain_text">Paste text</option>
                  <option value="url">URL</option>
                  <option value="notes_ai">From my notes</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">
                  {sourceType === "url" ? "URL" : "Content"}
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={sourceType === "url" ? "https://..." : "Paste your notes, textbook excerpt, or study material here..."}
                  rows={sourceType === "url" ? 1 : 6}
                  className="w-full rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm text-ink placeholder:text-mist/70 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mist">Learning mode</label>
                  <select
                    value={learningMode}
                    onChange={(e) => setLearningMode(e.target.value as LearningMode)}
                    className="h-11 w-full rounded-xl border border-border bg-surface/40 px-4 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
                  >
                    {LEARNING_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-mist">Card count</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={targetCardCount}
                    onChange={(e) => setTargetCardCount(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-mist">Card types</label>
                <div className="flex flex-wrap gap-1.5">
                  {CARD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleCardType(type)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        cardTypes.includes(type)
                          ? "border-signal/40 bg-signal/10 text-signal"
                          : "border-border text-mist hover:text-ink"
                      }`}
                    >
                      {CARD_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generateDeck.isPending}>
                {generateDeck.isPending ? (
                  <>
                    <Loader2 size={16} className="mr-1.5 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="mr-1.5" /> Generate deck
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
