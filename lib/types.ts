// AUTO-GENERATED from supabase/migrations/*.sql — do not edit by hand.
// Regenerate against the live project once it is provisioned:
//   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type ApplicationStatus = "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
export type AssistantFeedbackRating = "thumbs_up" | "thumbs_down";
export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatModule = "resume_studio" | "research_ai" | "project_generator" | "syllabus_ai" | "assignment_ai" | "notes_ai" | "flashcards_ai" | "quiz_ai" | "interview_ai" | "career_guidance_ai" | "internship_discovery_ai" | "hackathon_ai" | "humanizer_ai" | "document_intelligence_engine";
export type ChatSessionStatus = "active" | "archived";
export type EmploymentType = "internship" | "apprenticeship" | "co_op" | "trainee" | "fellowship" | "part_time" | "full_time" | "contract" | "volunteer";
export type FlashcardRating = "again" | "hard" | "good" | "easy";
export type GenerationKind = "notes" | "revision_notes" | "one_day_revision" | "flashcards" | "quiz" | "mind_map" | "formula_sheet" | "important_questions" | "expected_questions" | "mcqs" | "assignment" | "eli_beginner" | "eli_professor";
export type InternshipType = "internship" | "part_time" | "full_time";
export type NotificationChannel = "in_app" | "email" | "push";
export type NotificationKind = "daily_digest" | "weekly_digest" | "new_internship" | "deadline_reminder" | "matching_internship" | "company_alert" | "role_alert";
export type NotificationType = "generation_complete" | "subscription" | "internship" | "research" | "system" | "admin";
export type PlanTier = "free" | "pro";
export type ProjectStatus = "idea" | "in_progress" | "completed" | "archived";
export type ProviderStatus = "active" | "degraded" | "disabled" | "unsupported" | "unconfigured";
export type QuizAttemptStatus = "in_progress" | "submitted" | "graded" | "abandoned";
export type QuizDifficulty = "easy" | "medium" | "hard" | "expert";
export type QuizExamMode = "practice" | "timed_test" | "mock_exam" | "competitive_exam" | "revision_test" | "chapter_test" | "unit_test" | "semester_exam" | "final_exam" | "custom_exam";
export type QuizGradingMethod = "exact_match" | "set_match" | "ai_graded";
export type QuizQuestionType = "mcq" | "true_false" | "fill_in_blank" | "one_word" | "multiple_select" | "match_following" | "ordering" | "short_answer" | "long_answer" | "essay" | "case_study" | "programming" | "debugging" | "sql" | "mathematics" | "physics" | "chemistry" | "biology" | "engineering" | "medical" | "law" | "business" | "ai_ml" | "coding_challenge";
export type ResumeStatus = "draft" | "final";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none";
export type SyncStatus = "running" | "success" | "partial" | "failed";
export type UploadStatus = "pending" | "processing" | "ready" | "failed";
export type UserRole = "student" | "admin";
export type WorkMode = "remote" | "hybrid" | "onsite";
// Preserved aliases from the original hand-written file.

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12.2.3";
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_table: string | null;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          action?: string;
          target_table?: string | null;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          internship_id: string;
          status: "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
          applied_at: string | null;
          interview_at: string | null;
          decision_at: string | null;
          deadline_at: string | null;
          notes: string | null;
          documents: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          internship_id: string;
          status?: "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
          applied_at?: string | null;
          interview_at?: string | null;
          decision_at?: string | null;
          deadline_at?: string | null;
          notes?: string | null;
          documents?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          internship_id?: string;
          status?: "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
          applied_at?: string | null;
          interview_at?: string | null;
          decision_at?: string | null;
          deadline_at?: string | null;
          notes?: string | null;
          documents?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assignment_questions: {
        Row: {
          id: string;
          assignment_id: string;
          position: number;
          question_text: string;
          marks: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          position?: number;
          question_text: string;
          marks?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          position?: number;
          question_text?: string;
          marks?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          generation_id: string;
          instructions: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          generation_id: string;
          instructions: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          generation_id?: string;
          instructions?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assistant_feedback: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          rating: "thumbs_up" | "thumbs_down";
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          rating: "thumbs_up" | "thumbs_down";
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          user_id?: string;
          rating?: "thumbs_up" | "thumbs_down";
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ats_checks: {
        Row: {
          id: string;
          resume_id: string;
          job_description: string;
          score: number;
          feedback: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          resume_id: string;
          job_description: string;
          score: number;
          feedback?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          resume_id?: string;
          job_description?: string;
          score?: number;
          feedback?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entity_type?: string;
          entity_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          modules_invoked: "resume_studio" | "research_ai" | "project_generator" | "syllabus_ai" | "assignment_ai" | "notes_ai" | "flashcards_ai" | "quiz_ai" | "interview_ai" | "career_guidance_ai" | "internship_discovery_ai" | "hackathon_ai" | "humanizer_ai" | "document_intelligence_engine"[] | null;
          extracted: unknown | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          modules_invoked?: "resume_studio" | "research_ai" | "project_generator" | "syllabus_ai" | "assignment_ai" | "notes_ai" | "flashcards_ai" | "quiz_ai" | "interview_ai" | "career_guidance_ai" | "internship_discovery_ai" | "hackathon_ai" | "humanizer_ai" | "document_intelligence_engine"[] | null;
          extracted?: unknown | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: "user" | "assistant" | "system";
          content?: string;
          modules_invoked?: "resume_studio" | "research_ai" | "project_generator" | "syllabus_ai" | "assignment_ai" | "notes_ai" | "flashcards_ai" | "quiz_ai" | "interview_ai" | "career_guidance_ai" | "internship_discovery_ai" | "hackathon_ai" | "humanizer_ai" | "document_intelligence_engine"[] | null;
          extracted?: unknown | null;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_sessions: {
        Row: {
          id: string;
          not: unknown;
          title: string;
          status: "active" | "archived";
          last_message_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          not?: unknown;
          title?: string;
          status?: "active" | "archived";
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          not?: unknown;
          title?: string;
          status?: "active" | "archived";
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          slug: string;
          name: string;
          website: string | null;
          domain: string | null;
          logo_url: string | null;
          description: string | null;
          industry: string | null;
          hq_country: string | null;
          posting_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          website?: string | null;
          domain?: string | null;
          logo_url?: string | null;
          description?: string | null;
          industry?: string | null;
          hq_country?: string | null;
          posting_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          website?: string | null;
          domain?: string | null;
          logo_url?: string | null;
          description?: string | null;
          industry?: string | null;
          hq_country?: string | null;
          posting_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_skills: {
        Row: {
          company_id: string;
          skill: string;
          count: number;
        };
        Insert: {
          company_id: string;
          skill: string;
          count?: number;
        };
        Update: {
          company_id?: string;
          skill?: string;
          count?: number;
        };
        Relationships: [];
      };
      conversation_summaries: {
        Row: {
          id: string;
          session_id: string;
          summary_text: string;
          message_count_covered: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          summary_text: string;
          message_count_covered: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          summary_text?: string;
          message_count_covered?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      document_analytics: {
        Row: {
          id: string;
          document_id: string;
          event: string;
          duration_ms: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          event: string;
          duration_ms?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          event?: string;
          duration_ms?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          upload_id: string;
          chunk_index: number;
          content: string;
          token_count: number;
          embedding: unknown | null;
          created_at: string;
          stable: unknown;
          text: string;
          strategy: string;
          start_page_index: number;
          end_page_index: number;
          token_estimate: number;
          metadata: Json;
        };
        Insert: {
          id?: string;
          upload_id: string;
          chunk_index: number;
          content: string;
          token_count: number;
          embedding?: unknown | null;
          created_at?: string;
          stable: unknown;
          text: string;
          strategy: string;
          start_page_index?: number;
          end_page_index?: number;
          token_estimate?: number;
          metadata?: Json;
        };
        Update: {
          id?: string;
          upload_id?: string;
          chunk_index?: number;
          content?: string;
          token_count?: number;
          embedding?: unknown | null;
          created_at?: string;
          stable?: unknown;
          text?: string;
          strategy?: string;
          start_page_index?: number;
          end_page_index?: number;
          token_estimate?: number;
          metadata?: Json;
        };
        Relationships: [];
      };
      document_embeddings: {
        Row: {
          chunk_id: string;
          embedding: number[];
          model: string;
          dimensions: number;
          created_at: string;
        };
        Insert: {
          chunk_id?: string;
          embedding: number[];
          model?: string;
          dimensions?: number;
          created_at?: string;
        };
        Update: {
          chunk_id?: string;
          embedding?: number[];
          model?: string;
          dimensions?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      document_metadata: {
        Row: {
          document_id: string;
          title: string | null;
          subtitle: string | null;
          authors: string[];
          institution: string | null;
          created_date: string | null;
          modified_date: string | null;
          page_count: number;
          word_count: number;
          file_size_bytes: number;
          mime_type: string;
          has_toc: boolean;
          has_bookmarks: boolean;
          custom: Json;
        };
        Insert: {
          document_id?: string;
          title?: string | null;
          subtitle?: string | null;
          authors?: string[];
          institution?: string | null;
          created_date?: string | null;
          modified_date?: string | null;
          page_count?: number;
          word_count?: number;
          file_size_bytes?: number;
          mime_type?: string;
          has_toc?: boolean;
          has_bookmarks?: boolean;
          custom?: Json;
        };
        Update: {
          document_id?: string;
          title?: string | null;
          subtitle?: string | null;
          authors?: string[];
          institution?: string | null;
          created_date?: string | null;
          modified_date?: string | null;
          page_count?: number;
          word_count?: number;
          file_size_bytes?: number;
          mime_type?: string;
          has_toc?: boolean;
          has_bookmarks?: boolean;
          custom?: Json;
        };
        Relationships: [];
      };
      document_search_index: {
        Row: {
          id: string;
          document_id: string;
          kind: string;
          ref_id: string | null;
          null: unknown | null;
          text: string;
          weight: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          kind: string;
          ref_id?: string | null;
          null?: unknown | null;
          text: string;
          weight?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          kind?: string;
          ref_id?: string | null;
          null?: unknown | null;
          text?: string;
          weight?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          owner_module: string | null;
          null: unknown;
          format: string;
          status: string;
          metadata: Json;
          summary: string | null;
          language: string | null;
          reading_time_minutes: number | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          owner_module?: string | null;
          null: unknown;
          format: string;
          status?: string;
          metadata?: Json;
          summary?: string | null;
          language?: string | null;
          reading_time_minutes?: number | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          owner_module?: string | null;
          null?: unknown;
          format?: string;
          status?: string;
          metadata?: Json;
          summary?: string | null;
          language?: string | null;
          reading_time_minutes?: number | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      flashcard_concepts: {
        Row: {
          id: string;
          deck_id: string;
          name: string;
          kind: string;
          weight: number;
          card_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          deck_id: string;
          name: string;
          kind?: string;
          weight?: number;
          card_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          deck_id?: string;
          name?: string;
          kind?: string;
          weight?: number;
          card_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      flashcard_decks: {
        Row: {
          id: string;
          generation_id: string;
          title: string;
          card_count: number;
          created_at: string;
          updated_at: string;
          learning_mode: string;
          add: unknown;
        };
        Insert: {
          id?: string;
          generation_id: string;
          title: string;
          card_count?: number;
          created_at?: string;
          updated_at?: string;
          learning_mode?: string;
          add?: unknown;
        };
        Update: {
          id?: string;
          generation_id?: string;
          title?: string;
          card_count?: number;
          created_at?: string;
          updated_at?: string;
          learning_mode?: string;
          add?: unknown;
        };
        Relationships: [];
      };
      flashcard_reviews: {
        Row: {
          id: string;
          flashcard_id: string;
          rating: "again" | "hard" | "good" | "easy";
          interval_before: number;
          interval_after: number;
          reviewed_at: string;
        };
        Insert: {
          id?: string;
          flashcard_id: string;
          rating: "again" | "hard" | "good" | "easy";
          interval_before: number;
          interval_after: number;
          reviewed_at?: string;
        };
        Update: {
          id?: string;
          flashcard_id?: string;
          rating?: "again" | "hard" | "good" | "easy";
          interval_before?: number;
          interval_after?: number;
          reviewed_at?: string;
        };
        Relationships: [];
      };
      flashcard_study_sessions: {
        Row: {
          id: string;
          deck_id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          cards_seen: number;
          cards_correct: number;
        };
        Insert: {
          id?: string;
          deck_id: string;
          user_id: string;
          started_at?: string;
          ended_at?: string | null;
          cards_seen?: number;
          cards_correct?: number;
        };
        Update: {
          id?: string;
          deck_id?: string;
          user_id?: string;
          started_at?: string;
          ended_at?: string | null;
          cards_seen?: number;
          cards_correct?: number;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          deck_id: string;
          front: string;
          back: string;
          position: number;
          ease_factor: number;
          interval_days: number;
          repetitions: number;
          due_at: string;
          created_at: string;
          updated_at: string;
          card_type: string;
          add: unknown | null;
        };
        Insert: {
          id?: string;
          deck_id: string;
          front: string;
          back: string;
          position?: number;
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          due_at?: string;
          created_at?: string;
          updated_at?: string;
          card_type?: string;
          add?: unknown | null;
        };
        Update: {
          id?: string;
          deck_id?: string;
          front?: string;
          back?: string;
          position?: number;
          ease_factor?: number;
          interval_days?: number;
          repetitions?: number;
          due_at?: string;
          created_at?: string;
          updated_at?: string;
          card_type?: string;
          add?: unknown | null;
        };
        Relationships: [];
      };
      generations: {
        Row: {
          id: string;
          user_id: string;
          upload_id: string | null;
          kind: "notes" | "revision_notes" | "one_day_revision" | "flashcards" | "quiz" | "mind_map" | "formula_sheet" | "important_questions" | "expected_questions" | "mcqs" | "assignment" | "eli_beginner" | "eli_professor";
          title: string;
          status: "pending" | "processing" | "ready" | "failed";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          upload_id?: string | null;
          kind: "notes" | "revision_notes" | "one_day_revision" | "flashcards" | "quiz" | "mind_map" | "formula_sheet" | "important_questions" | "expected_questions" | "mcqs" | "assignment" | "eli_beginner" | "eli_professor";
          title: string;
          status?: "pending" | "processing" | "ready" | "failed";
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          upload_id?: string | null;
          kind?: "notes" | "revision_notes" | "one_day_revision" | "flashcards" | "quiz" | "mind_map" | "formula_sheet" | "important_questions" | "expected_questions" | "mcqs" | "assignment" | "eli_beginner" | "eli_professor";
          title?: string;
          status?: "pending" | "processing" | "ready" | "failed";
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      internship_applications: {
        Row: {
          id: string;
          user_id: string;
          internship_id: string;
          status: "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
          notes: string | null;
          applied_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          internship_id: string;
          status?: "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
          notes?: string | null;
          applied_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          internship_id?: string;
          status?: "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
          notes?: string | null;
          applied_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      internship_profiles: {
        Row: {
          id: string;
          degree: string | null;
          branch: string | null;
          graduation_year: number | null;
          cgpa: number | null;
          skills: string[];
          preferred_roles: string[];
          preferred_locations: string[];
          preferred_work_modes: string[];
          min_stipend_inr: number | null;
          resume_text: string | null;
          resume_embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          degree?: string | null;
          branch?: string | null;
          graduation_year?: number | null;
          cgpa?: number | null;
          skills?: string[];
          preferred_roles?: string[];
          preferred_locations?: string[];
          preferred_work_modes?: string[];
          min_stipend_inr?: number | null;
          resume_text?: string | null;
          resume_embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          degree?: string | null;
          branch?: string | null;
          graduation_year?: number | null;
          cgpa?: number | null;
          skills?: string[];
          preferred_roles?: string[];
          preferred_locations?: string[];
          preferred_work_modes?: string[];
          min_stipend_inr?: number | null;
          resume_text?: string | null;
          resume_embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      internship_skills: {
        Row: {
          internship_id: string;
          skill: string;
          weight: number;
        };
        Insert: {
          internship_id: string;
          skill: string;
          weight?: number;
        };
        Update: {
          internship_id?: string;
          skill?: string;
          weight?: number;
        };
        Relationships: [];
      };
      internships: {
        Row: {
          id: string;
          company_name: string;
          role_title: string;
          description: string;
          location: string | null;
          type: "internship" | "part_time" | "full_time";
          stipend: string | null;
          apply_url: string;
          source: string | null;
          posted_at: string | null;
          deadline_at: string | null;
          created_at: string;
          updated_at: string;
          fingerprint: string;
          title: string;
          normalized_title: string;
          company_id: string | null;
          company_slug: string;
          company_website: string | null;
          company_logo_url: string | null;
          company_domain: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          location_raw: string | null;
          work_mode: "remote" | "hybrid" | "onsite";
          employment_type: "internship" | "apprenticeship" | "co_op" | "trainee" | "fellowship" | "part_time" | "full_time" | "contract" | "volunteer";
          stipend_min: number | null;
          stipend_max: number | null;
          stipend_currency: string | null;
          stipend_period: string | null;
          is_unpaid: boolean;
          stipend_monthly_inr: number | null;
          stipend_raw: string | null;
          duration_months: number | null;
          duration_raw: string | null;
          skills: string[];
          degrees: string[];
          branches: string[];
          eligible_years: number[];
          min_cgpa: number | null;
          eligibility_notes: string[];
          description_html: string | null;
          tags: string[];
          sources: Json;
          source_confidence: number;
          is_active: boolean;
          view_count: number;
          apply_count: number;
          quality_score: number;
          embedding: number[] | null;
          so: unknown | null;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          company_name: string;
          role_title: string;
          description?: string;
          location?: string | null;
          type?: "internship" | "part_time" | "full_time";
          stipend?: string | null;
          apply_url: string;
          source?: string | null;
          posted_at?: string | null;
          deadline_at?: string | null;
          created_at?: string;
          updated_at?: string;
          fingerprint: string;
          title: string;
          normalized_title?: string;
          company_id?: string | null;
          company_slug: string;
          company_website?: string | null;
          company_logo_url?: string | null;
          company_domain?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          location_raw?: string | null;
          work_mode?: "remote" | "hybrid" | "onsite";
          employment_type?: "internship" | "apprenticeship" | "co_op" | "trainee" | "fellowship" | "part_time" | "full_time" | "contract" | "volunteer";
          stipend_min?: number | null;
          stipend_max?: number | null;
          stipend_currency?: string | null;
          stipend_period?: string | null;
          is_unpaid?: boolean;
          stipend_monthly_inr?: number | null;
          stipend_raw?: string | null;
          duration_months?: number | null;
          duration_raw?: string | null;
          skills?: string[];
          degrees?: string[];
          branches?: string[];
          eligible_years?: number[];
          min_cgpa?: number | null;
          eligibility_notes?: string[];
          description_html?: string | null;
          tags?: string[];
          sources?: Json;
          source_confidence?: number;
          is_active?: boolean;
          view_count?: number;
          apply_count?: number;
          quality_score?: number;
          embedding?: number[] | null;
          so?: unknown | null;
          search_vector?: string | null;
        };
        Update: {
          id?: string;
          company_name?: string;
          role_title?: string;
          description?: string;
          location?: string | null;
          type?: "internship" | "part_time" | "full_time";
          stipend?: string | null;
          apply_url?: string;
          source?: string | null;
          posted_at?: string | null;
          deadline_at?: string | null;
          created_at?: string;
          updated_at?: string;
          fingerprint?: string;
          title?: string;
          normalized_title?: string;
          company_id?: string | null;
          company_slug?: string;
          company_website?: string | null;
          company_logo_url?: string | null;
          company_domain?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          location_raw?: string | null;
          work_mode?: "remote" | "hybrid" | "onsite";
          employment_type?: "internship" | "apprenticeship" | "co_op" | "trainee" | "fellowship" | "part_time" | "full_time" | "contract" | "volunteer";
          stipend_min?: number | null;
          stipend_max?: number | null;
          stipend_currency?: string | null;
          stipend_period?: string | null;
          is_unpaid?: boolean;
          stipend_monthly_inr?: number | null;
          stipend_raw?: string | null;
          duration_months?: number | null;
          duration_raw?: string | null;
          skills?: string[];
          degrees?: string[];
          branches?: string[];
          eligible_years?: number[];
          min_cgpa?: number | null;
          eligibility_notes?: string[];
          description_html?: string | null;
          tags?: string[];
          sources?: Json;
          source_confidence?: number;
          is_active?: boolean;
          view_count?: number;
          apply_count?: number;
          quality_score?: number;
          embedding?: number[] | null;
          so?: unknown | null;
          search_vector?: string | null;
        };
        Relationships: [];
      };
      interview_analytics_snapshots: {
        Row: {
          user_id: string;
          total_attempts: number;
          average_score: number;
          strong_areas: string[];
          weak_areas: string[];
          last_computed_at: string;
        };
        Insert: {
          user_id?: string;
          total_attempts?: number;
          average_score?: number;
          strong_areas?: string[];
          weak_areas?: string[];
          last_computed_at?: string;
        };
        Update: {
          user_id?: string;
          total_attempts?: number;
          average_score?: number;
          strong_areas?: string[];
          weak_areas?: string[];
          last_computed_at?: string;
        };
        Relationships: [];
      };
      interview_answers: {
        Row: {
          id: string;
          question_id: string;
          session_id: string;
          answer_text: string;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          session_id: string;
          answer_text: string;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          session_id?: string;
          answer_text?: string;
          submitted_at?: string;
        };
        Relationships: [];
      };
      interview_evaluations: {
        Row: {
          id: string;
          answer_id: string;
          correctness: number;
          communication: number;
          technical_depth: number;
          confidence: number;
          problem_solving: number;
          clarity: number;
          grammar: number;
          completeness: number;
          logic: number;
          professionalism: number;
          overall_score: number;
          strengths: string[];
          weaknesses: string[];
          model_answer: string;
          alternative_answer: string;
          improvement_plan: string;
          suggested_resources: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          answer_id: string;
          correctness: number;
          communication: number;
          technical_depth: number;
          confidence: number;
          problem_solving: number;
          clarity: number;
          grammar: number;
          completeness: number;
          logic: number;
          professionalism: number;
          overall_score: number;
          strengths?: string[];
          weaknesses?: string[];
          model_answer?: string;
          alternative_answer?: string;
          improvement_plan?: string;
          suggested_resources?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          answer_id?: string;
          correctness?: number;
          communication?: number;
          technical_depth?: number;
          confidence?: number;
          problem_solving?: number;
          clarity?: number;
          grammar?: number;
          completeness?: number;
          logic?: number;
          professionalism?: number;
          overall_score?: number;
          strengths?: string[];
          weaknesses?: string[];
          model_answer?: string;
          alternative_answer?: string;
          improvement_plan?: string;
          suggested_resources?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      interview_questions: {
        Row: {
          id: string;
          session_id: string;
          order_index: number;
          question: string;
          topic: string;
          difficulty: string;
          question_type: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          order_index: number;
          question: string;
          topic: string;
          difficulty: string;
          question_type: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          order_index?: number;
          question?: string;
          topic?: string;
          difficulty?: string;
          question_type?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      interview_sessions: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          company: string | null;
          interview_type: string;
          seniority: string;
          status: string;
          started_at: string;
          ended_at: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          company?: string | null;
          interview_type: string;
          seniority?: string;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          company?: string | null;
          interview_type?: string;
          seniority?: string;
          status?: string;
          started_at?: string;
          ended_at?: string | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      interview_skill_scores: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          skill: string;
          score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          skill: string;
          score: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          skill?: string;
          score?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          generation_id: string;
          content_md: string;
          word_count: number;
          created_at: string;
          updated_at: string;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          generation_id: string;
          content_md: string;
          word_count?: number;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Update: {
          id?: string;
          generation_id?: string;
          content_md?: string;
          word_count?: number;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          daily_digest: boolean;
          weekly_digest: boolean;
          new_internship_alerts: boolean;
          deadline_reminders: boolean;
          match_alerts: boolean;
          followed_companies: string[];
          followed_roles: string[];
          min_match_score: number;
          channels: string[];
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          daily_digest?: boolean;
          weekly_digest?: boolean;
          new_internship_alerts?: boolean;
          deadline_reminders?: boolean;
          match_alerts?: boolean;
          followed_companies?: string[];
          followed_roles?: string[];
          min_match_score?: number;
          channels?: string[];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          daily_digest?: boolean;
          weekly_digest?: boolean;
          new_internship_alerts?: boolean;
          deadline_reminders?: boolean;
          match_alerts?: boolean;
          followed_companies?: string[];
          followed_roles?: string[];
          min_match_score?: number;
          channels?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: "generation_complete" | "subscription" | "internship" | "research" | "system" | "admin";
          title: string;
          body: string | null;
          link_url: string | null;
          is_read: boolean;
          created_at: string;
          kind: "daily_digest" | "weekly_digest" | "new_internship" | "deadline_reminder" | "matching_internship" | "company_alert" | "role_alert";
          channel: "in_app" | "email" | "push";
          payload: Json;
          read_at: string | null;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: "generation_complete" | "subscription" | "internship" | "research" | "system" | "admin";
          title: string;
          body?: string | null;
          link_url?: string | null;
          is_read?: boolean;
          created_at?: string;
          kind: "daily_digest" | "weekly_digest" | "new_internship" | "deadline_reminder" | "matching_internship" | "company_alert" | "role_alert";
          channel?: "in_app" | "email" | "push";
          payload?: Json;
          read_at?: string | null;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "generation_complete" | "subscription" | "internship" | "research" | "system" | "admin";
          title?: string;
          body?: string | null;
          link_url?: string | null;
          is_read?: boolean;
          created_at?: string;
          kind?: "daily_digest" | "weekly_digest" | "new_internship" | "deadline_reminder" | "matching_internship" | "company_alert" | "role_alert";
          channel?: "in_app" | "email" | "push";
          payload?: Json;
          read_at?: string | null;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          id: string;
          subscription_id: string;
          amount: number;
          currency: string;
          status: string;
          provider_payment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          amount: number;
          currency?: string;
          status: string;
          provider_payment_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
          provider_payment_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      processed_files: {
        Row: {
          content_hash: string;
          see: unknown;
          storage_ref: string | null;
          size_bytes: number;
          mime_type: string;
          created_at: string;
        };
        Insert: {
          content_hash?: string;
          see: unknown;
          storage_ref?: string | null;
          size_bytes: number;
          mime_type: string;
          created_at?: string;
        };
        Update: {
          content_hash?: string;
          see?: unknown;
          storage_ref?: string | null;
          size_bytes?: number;
          mime_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: "student" | "admin";
          full_name: string;
          avatar_url: string | null;
          college: string | null;
          branch: string | null;
          semester: number | null;
          theme_preference: string;
          onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role?: "student" | "admin";
          full_name: string;
          avatar_url?: string | null;
          college?: string | null;
          branch?: string | null;
          semester?: number | null;
          theme_preference?: string;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: "student" | "admin";
          full_name?: string;
          avatar_url?: string | null;
          college?: string | null;
          branch?: string | null;
          semester?: number | null;
          theme_preference?: string;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          is_completed: boolean;
          position: number;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          is_completed?: boolean;
          position?: number;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          is_completed?: boolean;
          position?: number;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          generation_id: string | null;
          title: string;
          description: string | null;
          tech_stack: string[];
          status: "idea" | "in_progress" | "completed" | "archived";
          repo_url: string | null;
          created_at: string;
          updated_at: string;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          generation_id?: string | null;
          title: string;
          description?: string | null;
          tech_stack?: string[];
          status?: "idea" | "in_progress" | "completed" | "archived";
          repo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          generation_id?: string | null;
          title?: string;
          description?: string | null;
          tech_stack?: string[];
          status?: "idea" | "in_progress" | "completed" | "archived";
          repo_url?: string | null;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Relationships: [];
      };
      providers: {
        Row: {
          key: string;
          label: string;
          status: "active" | "degraded" | "disabled" | "unsupported" | "unconfigured";
          reachable: boolean;
          latency_ms: number | null;
          message: string | null;
          consecutive_failures: number;
          checked_at: string;
          created_at: string;
        };
        Insert: {
          key?: string;
          label?: string;
          status?: "active" | "degraded" | "disabled" | "unsupported" | "unconfigured";
          reachable?: boolean;
          latency_ms?: number | null;
          message?: string | null;
          consecutive_failures?: number;
          checked_at?: string;
          created_at?: string;
        };
        Update: {
          key?: string;
          label?: string;
          status?: "active" | "degraded" | "disabled" | "unsupported" | "unconfigured";
          reachable?: boolean;
          latency_ms?: number | null;
          message?: string | null;
          consecutive_failures?: number;
          checked_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          id: string;
          quiz_id: string;
          user_id: string;
          status: "in_progress" | "submitted" | "graded" | "abandoned";
          started_at: string;
          submitted_at: string | null;
          time_taken_sec: number | null;
          raw_score: number | null;
          before: unknown | null;
          max_score: number;
          accuracy_pct: number | null;
          not: unknown;
          is_adaptive_run: boolean;
          next_difficulty: "easy" | "medium" | "hard" | "expert" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          user_id: string;
          status?: "in_progress" | "submitted" | "graded" | "abandoned";
          started_at?: string;
          submitted_at?: string | null;
          time_taken_sec?: number | null;
          raw_score?: number | null;
          before?: unknown | null;
          max_score?: number;
          accuracy_pct?: number | null;
          not?: unknown;
          is_adaptive_run?: boolean;
          next_difficulty?: "easy" | "medium" | "hard" | "expert" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          user_id?: string;
          status?: "in_progress" | "submitted" | "graded" | "abandoned";
          started_at?: string;
          submitted_at?: string | null;
          time_taken_sec?: number | null;
          raw_score?: number | null;
          before?: unknown | null;
          max_score?: number;
          accuracy_pct?: number | null;
          not?: unknown;
          is_adaptive_run?: boolean;
          next_difficulty?: "easy" | "medium" | "hard" | "expert" | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quiz_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_key: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_key: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          badge_key?: string;
        };
        Relationships: [];
      };
      quiz_leaderboard_entries: {
        Row: {
          id: string;
          user_id: string;
          scope: string;
          subject: string | null;
          score: number;
          attempts_count: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scope: string;
          subject?: string | null;
          score?: number;
          attempts_count?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scope?: string;
          subject?: string | null;
          score?: number;
          attempts_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_question_reviews: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          marked_for_review: boolean;
          reported_issue: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          marked_for_review?: boolean;
          reported_issue?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          user_id?: string;
          marked_for_review?: boolean;
          reported_issue?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          position: number;
          question_text: string;
          options: Json;
          explanation: string | null;
          created_at: string;
          question_type: "mcq" | "true_false" | "fill_in_blank" | "one_word" | "multiple_select" | "match_following" | "ordering" | "short_answer" | "long_answer" | "essay" | "case_study" | "programming" | "debugging" | "sql" | "mathematics" | "physics" | "chemistry" | "biology" | "engineering" | "medical" | "law" | "business" | "ai_ml" | "coding_challenge";
          add: unknown[];
          right: unknown | null;
          embedding: unknown | null;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          position?: number;
          question_text: string;
          options: Json;
          explanation?: string | null;
          created_at?: string;
          question_type?: "mcq" | "true_false" | "fill_in_blank" | "one_word" | "multiple_select" | "match_following" | "ordering" | "short_answer" | "long_answer" | "essay" | "case_study" | "programming" | "debugging" | "sql" | "mathematics" | "physics" | "chemistry" | "biology" | "engineering" | "medical" | "law" | "business" | "ai_ml" | "coding_challenge";
          add?: unknown[];
          right?: unknown | null;
          embedding?: unknown | null;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          position?: number;
          question_text?: string;
          options?: Json;
          explanation?: string | null;
          created_at?: string;
          question_type?: "mcq" | "true_false" | "fill_in_blank" | "one_word" | "multiple_select" | "match_following" | "ordering" | "short_answer" | "long_answer" | "essay" | "case_study" | "programming" | "debugging" | "sql" | "mathematics" | "physics" | "chemistry" | "biology" | "engineering" | "medical" | "law" | "business" | "ai_ml" | "coding_challenge";
          add?: unknown[];
          right?: unknown | null;
          embedding?: unknown | null;
        };
        Relationships: [];
      };
      quiz_responses: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          code: unknown;
          is_correct: boolean | null;
          marks_awarded: number | null;
          ai_feedback: string | null;
          time_spent_sec: number | null;
          hint_used: boolean;
          answered_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          code?: unknown;
          is_correct?: boolean | null;
          marks_awarded?: number | null;
          ai_feedback?: string | null;
          time_spent_sec?: number | null;
          hint_used?: boolean;
          answered_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          code?: unknown;
          is_correct?: boolean | null;
          marks_awarded?: number | null;
          ai_feedback?: string | null;
          time_spent_sec?: number | null;
          hint_used?: boolean;
          answered_at?: string;
        };
        Relationships: [];
      };
      quiz_streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_activity_date: string | null;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          current_streak?: number;
          longest_streak?: number;
          last_activity_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_topic_mastery: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          attempts_count: number;
          correct_count: number;
          mastery_score: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          attempts_count?: number;
          correct_count?: number;
          mastery_score?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string;
          attempts_count?: number;
          correct_count?: number;
          mastery_score?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      quiz_topics: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          name: string;
          subject: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_id?: string | null;
          name: string;
          subject?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_id?: string | null;
          name?: string;
          subject?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quizzes: {
        Row: {
          id: string;
          generation_id: string;
          title: string;
          created_at: string;
          updated_at: string;
          exam_mode: "practice" | "timed_test" | "mock_exam" | "competitive_exam" | "revision_test" | "chapter_test" | "unit_test" | "semester_exam" | "final_exam" | "custom_exam";
          add: unknown;
        };
        Insert: {
          id?: string;
          generation_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
          exam_mode?: "practice" | "timed_test" | "mock_exam" | "competitive_exam" | "revision_test" | "chapter_test" | "unit_test" | "semester_exam" | "final_exam" | "custom_exam";
          add?: unknown;
        };
        Update: {
          id?: string;
          generation_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          exam_mode?: "practice" | "timed_test" | "mock_exam" | "competitive_exam" | "revision_test" | "chapter_test" | "unit_test" | "semester_exam" | "final_exam" | "custom_exam";
          add?: unknown;
        };
        Relationships: [];
      };
      recommendations: {
        Row: {
          user_id: string;
          internship_id: string;
          resume_match: number;
          ats_match: number;
          eligibility_score: number;
          application_readiness: number;
          ranking_score: number;
          recommendation_score: number;
          eligible: boolean;
          matched_skills: string[];
          missing_skills: string[];
          skill_gaps: Json;
          explanation: Json;
          suggested_projects: string[];
          suggested_courses: string[];
          interview_prep: string[];
          model: string;
          computed_at: string;
        };
        Insert: {
          user_id: string;
          internship_id: string;
          resume_match?: number;
          ats_match?: number;
          eligibility_score?: number;
          application_readiness?: number;
          ranking_score?: number;
          recommendation_score?: number;
          eligible?: boolean;
          matched_skills?: string[];
          missing_skills?: string[];
          skill_gaps?: Json;
          explanation?: Json;
          suggested_projects?: string[];
          suggested_courses?: string[];
          interview_prep?: string[];
          model?: string;
          computed_at?: string;
        };
        Update: {
          user_id?: string;
          internship_id?: string;
          resume_match?: number;
          ats_match?: number;
          eligibility_score?: number;
          application_readiness?: number;
          ranking_score?: number;
          recommendation_score?: number;
          eligible?: boolean;
          matched_skills?: string[];
          missing_skills?: string[];
          skill_gaps?: Json;
          explanation?: Json;
          suggested_projects?: string[];
          suggested_courses?: string[];
          interview_prep?: string[];
          model?: string;
          computed_at?: string;
        };
        Relationships: [];
      };
      research_papers: {
        Row: {
          id: string;
          user_id: string;
          upload_id: string | null;
          title: string;
          authors: string[];
          source_url: string | null;
          abstract: string | null;
          summary_md: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          upload_id?: string | null;
          title: string;
          authors?: string[];
          source_url?: string | null;
          abstract?: string | null;
          summary_md?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          upload_id?: string | null;
          title?: string;
          authors?: string[];
          source_url?: string | null;
          abstract?: string | null;
          summary_md?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Relationships: [];
      };
      resume_versions: {
        Row: {
          id: string;
          resume_id: string;
          content: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          resume_id: string;
          content: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          resume_id?: string;
          content?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          template: string;
          content: Json;
          status: "draft" | "final";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          template?: string;
          content?: Json;
          status?: "draft" | "final";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          template?: string;
          content?: Json;
          status?: "draft" | "final";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_internships: {
        Row: {
          id: string;
          user_id: string;
          internship_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          internship_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          internship_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      study_sessions: {
        Row: {
          id: string;
          user_id: string;
          subject: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_tier: "free" | "pro";
          status: "active" | "trialing" | "past_due" | "canceled" | "none";
          provider: string | null;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_tier?: "free" | "pro";
          status?: "active" | "trialing" | "past_due" | "canceled" | "none";
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_tier?: "free" | "pro";
          status?: "active" | "trialing" | "past_due" | "canceled" | "none";
          provider?: string | null;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_logs: {
        Row: {
          id: string;
          provider: string;
          run_id: string;
          status: "running" | "success" | "partial" | "failed";
          fetched: number;
          normalized: number;
          duplicates: number;
          inserted: number;
          updated: number;
          duration_ms: number;
          error: string | null;
          warnings: string[];
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          provider: string;
          run_id: string;
          status: "running" | "success" | "partial" | "failed";
          fetched?: number;
          normalized?: number;
          duplicates?: number;
          inserted?: number;
          updated?: number;
          duration_ms?: number;
          error?: string | null;
          warnings?: string[];
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          provider?: string;
          run_id?: string;
          status?: "running" | "success" | "partial" | "failed";
          fetched?: number;
          normalized?: number;
          duplicates?: number;
          inserted?: number;
          updated?: number;
          duration_ms?: number;
          error?: string | null;
          warnings?: string[];
          started_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      trending_research_topics: {
        Row: {
          id: string;
          title: string;
          field: string;
          summary: string | null;
          source_url: string | null;
          trend_score: number;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          search_vector: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          field: string;
          summary?: string | null;
          source_url?: string | null;
          trend_score?: number;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          field?: string;
          summary?: string | null;
          source_url?: string | null;
          trend_score?: number;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          search_vector?: string | null;
        };
        Relationships: [];
      };
      uploads: {
        Row: {
          id: string;
          user_id: string;
          bucket_id: string;
          storage_path: string;
          file_name: string;
          file_type: string;
          file_size_bytes: number;
          page_count: number | null;
          status: "pending" | "processing" | "ready" | "failed";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bucket_id?: string;
          storage_path: string;
          file_name: string;
          file_type: string;
          file_size_bytes: number;
          page_count?: number | null;
          status?: "pending" | "processing" | "ready" | "failed";
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bucket_id?: string;
          storage_path?: string;
          file_name?: string;
          file_type?: string;
          file_size_bytes?: number;
          page_count?: number | null;
          status?: "pending" | "processing" | "ready" | "failed";
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_conversion_funnel: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_flashcards_due: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_internship_feed: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_most_viewed_internships: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_popular_skills: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_provider_health: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_trending_companies: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_trending_roles: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
      v_upcoming_deadlines: {
        Row: { [key: string]: Json | null };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      application_status: "saved" | "applied" | "interview_scheduled" | "rejected" | "offer" | "accepted" | "withdrawn";
      assistant_feedback_rating: "thumbs_up" | "thumbs_down";
      chat_message_role: "user" | "assistant" | "system";
      chat_module: "resume_studio" | "research_ai" | "project_generator" | "syllabus_ai" | "assignment_ai" | "notes_ai" | "flashcards_ai" | "quiz_ai" | "interview_ai" | "career_guidance_ai" | "internship_discovery_ai" | "hackathon_ai" | "humanizer_ai" | "document_intelligence_engine";
      chat_session_status: "active" | "archived";
      employment_type: "internship" | "apprenticeship" | "co_op" | "trainee" | "fellowship" | "part_time" | "full_time" | "contract" | "volunteer";
      flashcard_rating: "again" | "hard" | "good" | "easy";
      generation_kind: "notes" | "revision_notes" | "one_day_revision" | "flashcards" | "quiz" | "mind_map" | "formula_sheet" | "important_questions" | "expected_questions" | "mcqs" | "assignment" | "eli_beginner" | "eli_professor";
      internship_type: "internship" | "part_time" | "full_time";
      notification_channel: "in_app" | "email" | "push";
      notification_kind: "daily_digest" | "weekly_digest" | "new_internship" | "deadline_reminder" | "matching_internship" | "company_alert" | "role_alert";
      notification_type: "generation_complete" | "subscription" | "internship" | "research" | "system" | "admin";
      plan_tier: "free" | "pro";
      project_status: "idea" | "in_progress" | "completed" | "archived";
      provider_status: "active" | "degraded" | "disabled" | "unsupported" | "unconfigured";
      quiz_attempt_status: "in_progress" | "submitted" | "graded" | "abandoned";
      quiz_difficulty: "easy" | "medium" | "hard" | "expert";
      quiz_exam_mode: "practice" | "timed_test" | "mock_exam" | "competitive_exam" | "revision_test" | "chapter_test" | "unit_test" | "semester_exam" | "final_exam" | "custom_exam";
      quiz_grading_method: "exact_match" | "set_match" | "ai_graded";
      quiz_question_type: "mcq" | "true_false" | "fill_in_blank" | "one_word" | "multiple_select" | "match_following" | "ordering" | "short_answer" | "long_answer" | "essay" | "case_study" | "programming" | "debugging" | "sql" | "mathematics" | "physics" | "chemistry" | "biology" | "engineering" | "medical" | "law" | "business" | "ai_ml" | "coding_challenge";
      resume_status: "draft" | "final";
      subscription_status: "active" | "trialing" | "past_due" | "canceled" | "none";
      sync_status: "running" | "success" | "partial" | "failed";
      upload_status: "pending" | "processing" | "ready" | "failed";
      user_role: "student" | "admin";
      work_mode: "remote" | "hybrid" | "onsite";
    };
    CompositeTypes: Record<string, never>;
  };
}
