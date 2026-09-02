/**
 * module-providers.adapter.ts
 *
 * Real implementations of every `CareerModuleProviders` interface
 * (lib/career/providers/module-providers.ts), reading directly from the
 * Supabase tables each existing module already owns. This file is the only
 * place the Career Guidance module touches another module's schema — the
 * services themselves stay DB-agnostic per lib/career/README.md.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  AssignmentAiProvider,
  CareerModuleProviders,
  FlashcardsAiProvider,
  InterviewAiProvider,
  NotesAiProvider,
  ProjectGeneratorProvider,
  QuizAiProvider,
  ResearchAiProvider,
  ResumeStudioProvider,
  SyllabusAiProvider,
} from "../providers/module-providers";
import type { UserId } from "../models/career.model";

type DB = SupabaseClient<Database>;

function createResumeStudioProvider(db: DB): ResumeStudioProvider {
  return {
    async getLatestResumeSummary(userId: UserId) {
      const { data: resume } = await db
        .from("resumes")
        .select("id, content")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!resume) return null;

      const content = resume.content as {
        contact?: { links?: { type?: string; url?: string }[] };
        summary?: { summary?: string; headline?: string };
        skills?: { items?: string[] }[];
        experience?: { bullets?: string[] }[];
        projects?: { bullets?: string[] }[];
      } | null;

      const skills = (content?.skills ?? []).flatMap((group) => group.items ?? []);
      const links = content?.contact?.links ?? [];
      const githubUrl = links.find((l) => l.type === "github")?.url;
      const linkedinUrl = links.find((l) => l.type === "linkedin")?.url;

      const resumeText = [
        content?.summary?.headline,
        content?.summary?.summary,
        ...(content?.experience ?? []).flatMap((e) => e.bullets ?? []),
        ...(content?.projects ?? []).flatMap((p) => p.bullets ?? []),
      ]
        .filter(Boolean)
        .join(" ");

      const { data: atsCheck } = await db
        .from("ats_checks")
        .select("score")
        .eq("resume_id", resume.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        resumeText: resumeText || "No resume content yet.",
        atsScore: atsCheck?.score ?? 0,
        skills,
        githubUrl,
        linkedinUrl,
      };
    },
  };
}

function createInterviewAiProvider(db: DB): InterviewAiProvider {
  return {
    async getPerformanceSummary(userId: UserId) {
      const { data } = await db
        .from("interview_analytics_snapshots")
        .select("average_score, total_attempts, strong_areas, weak_areas, last_computed_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!data) return null;

      return {
        averageScore: Number(data.average_score),
        sessionsCompleted: data.total_attempts,
        strongAreas: data.strong_areas ?? [],
        weakAreas: data.weak_areas ?? [],
        lastSessionAt: data.last_computed_at,
      };
    },
  };
}

function createQuizAiProvider(db: DB): QuizAiProvider {
  return {
    async getPerformanceSummary(userId: UserId) {
      const { data: attempts } = await db
        .from("quiz_attempts")
        .select("final_score, max_score")
        .eq("user_id", userId)
        .eq("status", "graded");

      const { data: mastery } = await db
        .from("quiz_topic_mastery")
        .select("topic_id, mastery_score")
        .eq("user_id", userId);

      if ((!attempts || attempts.length === 0) && (!mastery || mastery.length === 0)) return null;

      const scored = (attempts ?? []).filter((a) => (a.max_score ?? 0) > 0);
      const averageScore =
        scored.length > 0
          ? Math.round(
              (scored.reduce((sum, a) => sum + (Number(a.final_score) / Number(a.max_score)) * 100, 0) /
                scored.length) *
                10
            ) / 10
          : 0;

      let strongTopics: string[] = [];
      let weakTopics: string[] = [];

      if (mastery && mastery.length > 0) {
        const topicIds = mastery.map((m) => m.topic_id);
        const { data: topics } = await db.from("quiz_topics").select("id, name").in("id", topicIds);
        const nameById = new Map((topics ?? []).map((t) => [t.id, t.name]));

        strongTopics = mastery
          .filter((m) => Number(m.mastery_score) >= 80)
          .map((m) => nameById.get(m.topic_id))
          .filter((name): name is string => !!name);

        weakTopics = mastery
          .filter((m) => Number(m.mastery_score) < 50)
          .map((m) => nameById.get(m.topic_id))
          .filter((name): name is string => !!name);
      }

      return {
        averageScore,
        quizzesTaken: attempts?.length ?? 0,
        strongTopics,
        weakTopics,
      };
    },
  };
}

function createFlashcardsAiProvider(db: DB): FlashcardsAiProvider {
  return {
    async getAnalyticsSummary(userId: UserId) {
      const { data: generations } = await db
        .from("generations")
        .select("id")
        .eq("user_id", userId)
        .eq("kind", "flashcards");

      const generationIds = (generations ?? []).map((g) => g.id);
      if (generationIds.length === 0) return null;

      const { data: decks } = await db
        .from("flashcard_decks")
        .select("id, card_count")
        .in("generation_id", generationIds);

      const deckIds = (decks ?? []).map((d) => d.id);
      if (deckIds.length === 0) return null;

      const { data: concepts } = await db
        .from("flashcard_concepts")
        .select("name")
        .in("deck_id", deckIds)
        .eq("kind", "topic");

      const { data: cards } = await db.from("flashcards").select("id").in("deck_id", deckIds);
      const cardIds = (cards ?? []).map((c) => c.id);

      let retentionRatePercent = 0;
      if (cardIds.length > 0) {
        const { data: reviews } = await db
          .from("flashcard_reviews")
          .select("rating")
          .in("flashcard_id", cardIds);

        if (reviews && reviews.length > 0) {
          const retained = reviews.filter((r) => r.rating === "good" || r.rating === "easy").length;
          retentionRatePercent = Math.round((retained / reviews.length) * 100);
        }
      }

      return {
        retentionRatePercent,
        cardsReviewed: cardIds.length,
        topicsCovered: [...new Set((concepts ?? []).map((c) => c.name))],
      };
    },
  };
}

function createNotesAiProvider(db: DB): NotesAiProvider {
  return {
    async getSummary(userId: UserId) {
      const { data: generations } = await db
        .from("generations")
        .select("id, title")
        .eq("user_id", userId)
        .in("kind", [
          "notes",
          "revision_notes",
          "one_day_revision",
          "mind_map",
          "formula_sheet",
          "important_questions",
          "expected_questions",
          "eli_beginner",
          "eli_professor",
        ]);

      if (!generations || generations.length === 0) return null;

      return {
        topicsCovered: generations.map((g) => g.title),
        totalNotes: generations.length,
      };
    },
  };
}

function createAssignmentAiProvider(db: DB): AssignmentAiProvider {
  return {
    async getSummary(userId: UserId) {
      const { data: generations } = await db
        .from("generations")
        .select("id, title, status")
        .eq("user_id", userId)
        .eq("kind", "assignment");

      if (!generations || generations.length === 0) return null;

      const completed = generations.filter((g) => g.status === "ready").length;

      return {
        completionRatePercent: Math.round((completed / generations.length) * 100),
        totalAssignments: generations.length,
        subjectsCovered: [...new Set(generations.map((g) => g.title))],
      };
    },
  };
}

function createResearchAiProvider(db: DB): ResearchAiProvider {
  return {
    async getSummary(userId: UserId) {
      const { data: papers } = await db.from("research_papers").select("title").eq("user_id", userId);

      if (!papers || papers.length === 0) return null;

      return {
        papersCount: papers.length,
        topics: papers.map((p) => p.title),
      };
    },
  };
}

function createProjectGeneratorProvider(db: DB): ProjectGeneratorProvider {
  return {
    async getSummary(userId: UserId) {
      const { data: projects } = await db
        .from("projects")
        .select("title, tech_stack")
        .eq("user_id", userId);

      if (!projects || projects.length === 0) return null;

      return {
        projectsCount: projects.length,
        techStacksUsed: [...new Set(projects.flatMap((p) => p.tech_stack ?? []))],
        projectTitles: projects.map((p) => p.title),
      };
    },
  };
}

/**
 * There is no persisted syllabus-progress table yet (lib/syllabus works on
 * ingestion/generation, not a stored progress rollup). Returning null here
 * is an honest "no data available" — CareerService already treats provider
 * misses as safe degradation, not a mock value.
 */
function createSyllabusAiProvider(): SyllabusAiProvider {
  return {
    async getProgressSummary() {
      return null;
    },
  };
}

export function createCareerModuleProviders(db: DB): CareerModuleProviders {
  return {
    resumeStudio: createResumeStudioProvider(db),
    interviewAi: createInterviewAiProvider(db),
    quizAi: createQuizAiProvider(db),
    flashcardsAi: createFlashcardsAiProvider(db),
    notesAi: createNotesAiProvider(db),
    assignmentAi: createAssignmentAiProvider(db),
    researchAi: createResearchAiProvider(db),
    projectGenerator: createProjectGeneratorProvider(db),
    syllabusAi: createSyllabusAiProvider(),
  };
}
