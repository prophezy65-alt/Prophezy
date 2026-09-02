/**
 * lib/flashcards/services/concept.service.ts
 *
 * Persists extracted concepts to `flashcard_concepts` (additive, 0021) and
 * computes per-concept retention ("weak topics" / "strong topics") by
 * joining concept.card_ids against flashcard_reviews.
 */

import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { AIValidationError } from "@/lib/ai/utils/errors";
import type { MergedConcept } from "../generator/concept-extractor";
import type { Flashcard } from "../models/flashcard.model";
import { rowToConcept, type Concept, type ConceptRow } from "../models/concept.model";
import type { TopicStrength } from "../models/analytics.model";

const CORRECT_RATINGS = new Set(["easy", "medium"]);
const MIN_ATTEMPTS_FOR_RANKING = 2;
const MAX_TOPICS = 5;

export const conceptService = {
  /**
   * Naively assigns every card to every concept whose name appears in the
   * card's front/back/explanation text — cheap and good enough for
   * "which topics does this deck cover" without another AI round-trip.
   */
  async saveConcepts(deckId: string, concepts: MergedConcept[], cards: Flashcard[]): Promise<Concept[]> {
    if (concepts.length === 0) return [];

    const supabase = await getSupabaseServerClient();

    const rows = concepts.map((c) => {
      const needle = c.name.toLowerCase();
      const cardIds = cards
        .filter((card) =>
          `${card.front} ${card.back} ${card.explanation ?? ""}`.toLowerCase().includes(needle)
        )
        .map((card) => card.id);

      return {
        deck_id: deckId,
        name: c.name,
        kind: c.kind,
        weight: c.weight,
        card_ids: cardIds,
      };
    });

    const { data, error } = await supabase
      .from("flashcard_concepts")
      .upsert(rows, { onConflict: "deck_id,name,kind" })
      .select();

    if (error || !data) {
      throw new AIValidationError("Failed to save flashcard concepts.", { cause: error?.message });
    }
    return (data as ConceptRow[]).map(rowToConcept);
  },

  async listConceptsForDeck(deckId: string): Promise<Concept[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("flashcard_concepts")
      .select()
      .eq("deck_id", deckId)
      .order("weight", { ascending: false });

    if (error) throw new AIValidationError("Failed to list concepts.", { cause: error.message });
    return (data as ConceptRow[]).map(rowToConcept);
  },

  /**
   * For every concept, computes retention across all reviews of its linked
   * cards, then splits into weak (lowest retention) vs strong (highest)
   * topics, ignoring concepts with too little review data to be meaningful.
   */
  async getTopicStrength(deckId: string): Promise<{ weakTopics: TopicStrength[]; strongTopics: TopicStrength[] }> {
    const supabase = await getSupabaseServerClient();
    const concepts = await this.listConceptsForDeck(deckId);

    if (concepts.length === 0) return { weakTopics: [], strongTopics: [] };

    const allCardIds = Array.from(new Set(concepts.flatMap((c) => c.cardIds)));
    if (allCardIds.length === 0) return { weakTopics: [], strongTopics: [] };

    const { data: reviewRows, error } = await supabase
      .from("flashcard_reviews")
      .select("flashcard_id, rating")
      .in("flashcard_id", allCardIds);

    if (error) throw new AIValidationError("Failed to compute topic strength.", { cause: error.message });

    const reviewsByCard = new Map<string, { rating: string }[]>();
    for (const r of (reviewRows as { flashcard_id: string; rating: string }[]) ?? []) {
      const list = reviewsByCard.get(r.flashcard_id) ?? [];
      list.push({ rating: r.rating });
      reviewsByCard.set(r.flashcard_id, list);
    }

    const strengths: TopicStrength[] = concepts
      .map((concept) => {
        const reviews = concept.cardIds.flatMap((id) => reviewsByCard.get(id) ?? []);
        const attempts = reviews.length;
        const correct = reviews.filter((r) => CORRECT_RATINGS.has(r.rating)).length;
        return {
          concept: concept.name,
          kind: concept.kind,
          attempts,
          retentionRate: attempts > 0 ? correct / attempts : 0,
        };
      })
      .filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_RANKING);

    const sorted = [...strengths].sort((a, b) => a.retentionRate - b.retentionRate);

    return {
      weakTopics: sorted.slice(0, MAX_TOPICS),
      strongTopics: sorted.slice(-MAX_TOPICS).reverse(),
    };
  },
};
