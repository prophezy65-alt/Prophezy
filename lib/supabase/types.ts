export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string | null
          created_at: string
          deadline_at: string | null
          decision_at: string | null
          documents: Json
          id: string
          internship_id: string
          interview_at: string | null
          notes: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          deadline_at?: string | null
          decision_at?: string | null
          documents?: Json
          id?: string
          internship_id: string
          interview_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          deadline_at?: string | null
          decision_at?: string | null
          documents?: Json
          id?: string
          internship_id?: string
          interview_at?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "v_most_viewed_internships"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_questions: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          marks: number
          position: number
          question_text: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          marks?: number
          position?: number
          question_text: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          marks?: number
          position?: number
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_questions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string
          generation_id: string
          id: string
          instructions: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          generation_id: string
          id?: string
          instructions: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          generation_id?: string
          id?: string
          instructions?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          message_id: string
          rating: Database["public"]["Enums"]["assistant_feedback_rating"]
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id: string
          rating: Database["public"]["Enums"]["assistant_feedback_rating"]
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          message_id?: string
          rating?: Database["public"]["Enums"]["assistant_feedback_rating"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_checks: {
        Row: {
          created_at: string
          feedback: Json
          id: string
          job_description: string
          resume_id: string
          score: number
        }
        Insert: {
          created_at?: string
          feedback?: Json
          id?: string
          job_description: string
          resume_id: string
          score: number
        }
        Update: {
          created_at?: string
          feedback?: Json
          id?: string
          job_description?: string
          resume_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ats_checks_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          intent: Json | null
          modules_invoked: Database["public"]["Enums"]["chat_module"][] | null
          role: Database["public"]["Enums"]["chat_message_role"]
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          intent?: Json | null
          modules_invoked?: Database["public"]["Enums"]["chat_module"][] | null
          role: Database["public"]["Enums"]["chat_message_role"]
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          intent?: Json | null
          modules_invoked?: Database["public"]["Enums"]["chat_module"][] | null
          role?: Database["public"]["Enums"]["chat_message_role"]
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          metadata: Json
          status: Database["public"]["Enums"]["chat_session_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["chat_session_status"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          metadata?: Json
          status?: Database["public"]["Enums"]["chat_session_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          description: string | null
          domain: string | null
          hq_country: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          posting_count: number
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain?: string | null
          hq_country?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          posting_count?: number
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          domain?: string | null
          hq_country?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          posting_count?: number
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      company_skills: {
        Row: {
          company_id: string
          count: number
          skill: string
        }
        Insert: {
          company_id: string
          count?: number
          skill: string
        }
        Update: {
          company_id?: string
          count?: number
          skill?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_trending_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_summaries: {
        Row: {
          created_at: string
          id: string
          message_count_covered: number
          session_id: string
          summary_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_count_covered: number
          session_id: string
          summary_text: string
        }
        Update: {
          created_at?: string
          id?: string
          message_count_covered?: number
          session_id?: string
          summary_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_analytics: {
        Row: {
          created_at: string
          document_id: string
          duration_ms: number | null
          event: string
          id: string
          metadata: Json
        }
        Insert: {
          created_at?: string
          document_id: string
          duration_ms?: number | null
          event: string
          id?: string
          metadata?: Json
        }
        Update: {
          created_at?: string
          document_id?: string
          duration_ms?: number | null
          event?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_analytics_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          chunk_index: number
          created_at: string
          document_id: string
          end_page_index: number
          id: string
          metadata: Json
          start_page_index: number
          strategy: string
          text: string
          token_estimate: number
        }
        Insert: {
          chunk_index: number
          created_at?: string
          document_id: string
          end_page_index?: number
          id: string
          metadata?: Json
          start_page_index?: number
          strategy: string
          text: string
          token_estimate?: number
        }
        Update: {
          chunk_index?: number
          created_at?: string
          document_id?: string
          end_page_index?: number
          id?: string
          metadata?: Json
          start_page_index?: number
          strategy?: string
          text?: string
          token_estimate?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          chunk_id: string
          created_at: string
          dimensions: number
          embedding: string
          model: string
        }
        Insert: {
          chunk_id: string
          created_at?: string
          dimensions?: number
          embedding: string
          model?: string
        }
        Update: {
          chunk_id?: string
          created_at?: string
          dimensions?: number
          embedding?: string
          model?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: true
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      document_metadata: {
        Row: {
          authors: string[]
          created_date: string | null
          custom: Json
          document_id: string
          file_size_bytes: number
          has_bookmarks: boolean
          has_toc: boolean
          institution: string | null
          mime_type: string
          modified_date: string | null
          page_count: number
          subtitle: string | null
          title: string | null
          word_count: number
        }
        Insert: {
          authors?: string[]
          created_date?: string | null
          custom?: Json
          document_id: string
          file_size_bytes?: number
          has_bookmarks?: boolean
          has_toc?: boolean
          institution?: string | null
          mime_type?: string
          modified_date?: string | null
          page_count?: number
          subtitle?: string | null
          title?: string | null
          word_count?: number
        }
        Update: {
          authors?: string[]
          created_date?: string | null
          custom?: Json
          document_id?: string
          file_size_bytes?: number
          has_bookmarks?: boolean
          has_toc?: boolean
          institution?: string | null
          mime_type?: string
          modified_date?: string | null
          page_count?: number
          subtitle?: string | null
          title?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_metadata_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_search_index: {
        Row: {
          created_at: string
          document_id: string
          id: string
          kind: string
          page_index: number | null
          ref_id: string | null
          text: string
          weight: number
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          kind: string
          page_index?: number | null
          ref_id?: string | null
          text: string
          weight?: number
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          kind?: string
          page_index?: number | null
          ref_id?: string | null
          text?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_search_index_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          error_message: string | null
          filename: string
          format: string
          id: string
          language: string | null
          metadata: Json
          owner_module: string | null
          processed_at: string | null
          reading_time_minutes: number | null
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          filename: string
          format: string
          id?: string
          language?: string | null
          metadata?: Json
          owner_module?: string | null
          processed_at?: string | null
          reading_time_minutes?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          filename?: string
          format?: string
          id?: string
          language?: string | null
          metadata?: Json
          owner_module?: string | null
          processed_at?: string | null
          reading_time_minutes?: number | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_concepts: {
        Row: {
          card_ids: string[]
          created_at: string
          deck_id: string
          id: string
          kind: string
          name: string
          weight: number
        }
        Insert: {
          card_ids?: string[]
          created_at?: string
          deck_id: string
          id?: string
          kind?: string
          name: string
          weight?: number
        }
        Update: {
          card_ids?: string[]
          created_at?: string
          deck_id?: string
          id?: string
          kind?: string
          name?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_concepts_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_decks: {
        Row: {
          card_count: number
          created_at: string
          generation_id: string
          id: string
          learning_mode: string
          metadata: Json
          source_ref: string | null
          source_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          card_count?: number
          created_at?: string
          generation_id: string
          id?: string
          learning_mode?: string
          metadata?: Json
          source_ref?: string | null
          source_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          card_count?: number
          created_at?: string
          generation_id?: string
          id?: string
          learning_mode?: string
          metadata?: Json
          source_ref?: string | null
          source_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_reviews: {
        Row: {
          flashcard_id: string
          id: string
          interval_after: number
          interval_before: number
          rating: Database["public"]["Enums"]["flashcard_rating"]
          reviewed_at: string
        }
        Insert: {
          flashcard_id: string
          id?: string
          interval_after: number
          interval_before: number
          rating: Database["public"]["Enums"]["flashcard_rating"]
          reviewed_at?: string
        }
        Update: {
          flashcard_id?: string
          id?: string
          interval_after?: number
          interval_before?: number
          rating?: Database["public"]["Enums"]["flashcard_rating"]
          reviewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "v_flashcards_due"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_study_sessions: {
        Row: {
          cards_correct: number
          cards_seen: number
          deck_id: string
          ended_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          cards_correct?: number
          cards_seen?: number
          deck_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          cards_correct?: number
          cards_seen?: number
          deck_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_study_sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          card_type: string
          confidence: number
          created_at: string
          deck_id: string
          difficulty: number
          due_at: string
          duplicate_of: string | null
          ease_factor: number
          embedding: string | null
          explanation: string | null
          front: string
          hint: string | null
          id: string
          image_url: string | null
          interval_days: number
          metadata: Json
          mnemonic: string | null
          position: number
          repetitions: number
          source_excerpt: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          back: string
          card_type?: string
          confidence?: number
          created_at?: string
          deck_id: string
          difficulty?: number
          due_at?: string
          duplicate_of?: string | null
          ease_factor?: number
          embedding?: string | null
          explanation?: string | null
          front: string
          hint?: string | null
          id?: string
          image_url?: string | null
          interval_days?: number
          metadata?: Json
          mnemonic?: string | null
          position?: number
          repetitions?: number
          source_excerpt?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          back?: string
          card_type?: string
          confidence?: number
          created_at?: string
          deck_id?: string
          difficulty?: number
          due_at?: string
          duplicate_of?: string | null
          ease_factor?: number
          embedding?: string | null
          explanation?: string | null
          front?: string
          hint?: string | null
          id?: string
          image_url?: string | null
          interval_days?: number
          metadata?: Json
          mnemonic?: string | null
          position?: number
          repetitions?: number
          source_excerpt?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "v_flashcards_due"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          kind: Database["public"]["Enums"]["generation_kind"]
          status: Database["public"]["Enums"]["upload_status"]
          title: string
          updated_at: string
          upload_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          kind: Database["public"]["Enums"]["generation_kind"]
          status?: Database["public"]["Enums"]["upload_status"]
          title: string
          updated_at?: string
          upload_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["generation_kind"]
          status?: Database["public"]["Enums"]["upload_status"]
          title?: string
          updated_at?: string
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      humanizer_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          rewrite_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          rewrite_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          rewrite_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      humanizer_history: {
        Row: {
          changes_summary: string | null
          created_at: string
          domain: string | null
          embedding: string | null
          grammar_score_after: number | null
          grammar_score_before: number | null
          id: string
          original_text: string
          readability_after: number | null
          readability_before: number | null
          rewrite_id: string
          rewritten_text: string
          style: string
          tone: string | null
          user_id: string
        }
        Insert: {
          changes_summary?: string | null
          created_at?: string
          domain?: string | null
          embedding?: string | null
          grammar_score_after?: number | null
          grammar_score_before?: number | null
          id?: string
          original_text: string
          readability_after?: number | null
          readability_before?: number | null
          rewrite_id: string
          rewritten_text: string
          style: string
          tone?: string | null
          user_id: string
        }
        Update: {
          changes_summary?: string | null
          created_at?: string
          domain?: string | null
          embedding?: string | null
          grammar_score_after?: number | null
          grammar_score_before?: number | null
          id?: string
          original_text?: string
          readability_after?: number | null
          readability_before?: number | null
          rewrite_id?: string
          rewritten_text?: string
          style?: string
          tone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      internship_profiles: {
        Row: {
          branch: string | null
          cgpa: number | null
          created_at: string
          degree: string | null
          graduation_year: number | null
          id: string
          min_stipend_inr: number | null
          preferred_locations: string[]
          preferred_roles: string[]
          preferred_work_modes: string[]
          resume_embedding: string | null
          resume_text: string | null
          skills: string[]
          updated_at: string
        }
        Insert: {
          branch?: string | null
          cgpa?: number | null
          created_at?: string
          degree?: string | null
          graduation_year?: number | null
          id: string
          min_stipend_inr?: number | null
          preferred_locations?: string[]
          preferred_roles?: string[]
          preferred_work_modes?: string[]
          resume_embedding?: string | null
          resume_text?: string | null
          skills?: string[]
          updated_at?: string
        }
        Update: {
          branch?: string | null
          cgpa?: number | null
          created_at?: string
          degree?: string | null
          graduation_year?: number | null
          id?: string
          min_stipend_inr?: number | null
          preferred_locations?: string[]
          preferred_roles?: string[]
          preferred_work_modes?: string[]
          resume_embedding?: string | null
          resume_text?: string | null
          skills?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      internship_skills: {
        Row: {
          internship_id: string
          skill: string
          weight: number
        }
        Insert: {
          internship_id: string
          skill: string
          weight?: number
        }
        Update: {
          internship_id?: string
          skill?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "internship_skills_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_skills_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "v_most_viewed_internships"
            referencedColumns: ["id"]
          },
        ]
      }
      internships: {
        Row: {
          apply_count: number
          apply_url: string
          branches: string[]
          city: string | null
          company_domain: string | null
          company_id: string | null
          company_logo_url: string | null
          company_name: string
          company_slug: string
          company_website: string | null
          country: string | null
          created_at: string
          deadline_at: string | null
          degrees: string[]
          description: string
          description_html: string | null
          duration_months: number | null
          duration_raw: string | null
          eligibility_notes: string[]
          eligible_years: number[]
          embedding: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          fingerprint: string
          id: string
          is_active: boolean
          is_unpaid: boolean
          location_raw: string | null
          min_cgpa: number | null
          normalized_title: string
          posted_at: string | null
          quality_score: number
          search_vector: unknown
          skills: string[]
          source_confidence: number
          sources: Json
          state: string | null
          stipend_currency: string | null
          stipend_max: number | null
          stipend_min: number | null
          stipend_monthly_inr: number | null
          stipend_period: string | null
          stipend_raw: string | null
          tags: string[]
          title: string
          updated_at: string
          view_count: number
          work_mode: Database["public"]["Enums"]["work_mode"]
        }
        Insert: {
          apply_count?: number
          apply_url: string
          branches?: string[]
          city?: string | null
          company_domain?: string | null
          company_id?: string | null
          company_logo_url?: string | null
          company_name: string
          company_slug: string
          company_website?: string | null
          country?: string | null
          created_at?: string
          deadline_at?: string | null
          degrees?: string[]
          description?: string
          description_html?: string | null
          duration_months?: number | null
          duration_raw?: string | null
          eligibility_notes?: string[]
          eligible_years?: number[]
          embedding?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          fingerprint: string
          id?: string
          is_active?: boolean
          is_unpaid?: boolean
          location_raw?: string | null
          min_cgpa?: number | null
          normalized_title?: string
          posted_at?: string | null
          quality_score?: number
          search_vector?: unknown
          skills?: string[]
          source_confidence?: number
          sources?: Json
          state?: string | null
          stipend_currency?: string | null
          stipend_max?: number | null
          stipend_min?: number | null
          stipend_monthly_inr?: number | null
          stipend_period?: string | null
          stipend_raw?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
          work_mode?: Database["public"]["Enums"]["work_mode"]
        }
        Update: {
          apply_count?: number
          apply_url?: string
          branches?: string[]
          city?: string | null
          company_domain?: string | null
          company_id?: string | null
          company_logo_url?: string | null
          company_name?: string
          company_slug?: string
          company_website?: string | null
          country?: string | null
          created_at?: string
          deadline_at?: string | null
          degrees?: string[]
          description?: string
          description_html?: string | null
          duration_months?: number | null
          duration_raw?: string | null
          eligibility_notes?: string[]
          eligible_years?: number[]
          embedding?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          fingerprint?: string
          id?: string
          is_active?: boolean
          is_unpaid?: boolean
          location_raw?: string | null
          min_cgpa?: number | null
          normalized_title?: string
          posted_at?: string | null
          quality_score?: number
          search_vector?: unknown
          skills?: string[]
          source_confidence?: number
          sources?: Json
          state?: string | null
          stipend_currency?: string | null
          stipend_max?: number | null
          stipend_min?: number | null
          stipend_monthly_inr?: number | null
          stipend_period?: string | null
          stipend_raw?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
          work_mode?: Database["public"]["Enums"]["work_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "internships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_trending_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_analytics_snapshots: {
        Row: {
          average_score: number
          last_computed_at: string
          strong_areas: string[]
          total_attempts: number
          user_id: string
          weak_areas: string[]
        }
        Insert: {
          average_score?: number
          last_computed_at?: string
          strong_areas?: string[]
          total_attempts?: number
          user_id: string
          weak_areas?: string[]
        }
        Update: {
          average_score?: number
          last_computed_at?: string
          strong_areas?: string[]
          total_attempts?: number
          user_id?: string
          weak_areas?: string[]
        }
        Relationships: []
      }
      interview_answers: {
        Row: {
          answer_text: string
          id: string
          question_id: string
          session_id: string
          submitted_at: string
        }
        Insert: {
          answer_text: string
          id?: string
          question_id: string
          session_id: string
          submitted_at?: string
        }
        Update: {
          answer_text?: string
          id?: string
          question_id?: string
          session_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_evaluations: {
        Row: {
          alternative_answer: string
          answer_id: string
          clarity: number
          communication: number
          completeness: number
          confidence: number
          correctness: number
          created_at: string
          grammar: number
          id: string
          improvement_plan: string
          logic: number
          model_answer: string
          overall_score: number
          problem_solving: number
          professionalism: number
          strengths: string[]
          suggested_resources: string[]
          technical_depth: number
          weaknesses: string[]
        }
        Insert: {
          alternative_answer?: string
          answer_id: string
          clarity: number
          communication: number
          completeness: number
          confidence: number
          correctness: number
          created_at?: string
          grammar: number
          id?: string
          improvement_plan?: string
          logic: number
          model_answer?: string
          overall_score: number
          problem_solving: number
          professionalism: number
          strengths?: string[]
          suggested_resources?: string[]
          technical_depth: number
          weaknesses?: string[]
        }
        Update: {
          alternative_answer?: string
          answer_id?: string
          clarity?: number
          communication?: number
          completeness?: number
          confidence?: number
          correctness?: number
          created_at?: string
          grammar?: number
          id?: string
          improvement_plan?: string
          logic?: number
          model_answer?: string
          overall_score?: number
          problem_solving?: number
          professionalism?: number
          strengths?: string[]
          suggested_resources?: string[]
          technical_depth?: number
          weaknesses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "interview_evaluations_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "interview_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          order_index: number
          question: string
          question_type: string
          session_id: string
          source: string
          topic: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          id?: string
          order_index: number
          question: string
          question_type: string
          session_id: string
          source?: string
          topic: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          order_index?: number
          question?: string
          question_type?: string
          session_id?: string
          source?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          company: string | null
          ended_at: string | null
          id: string
          interview_type: string
          metadata: Json
          role: string
          seniority: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          company?: string | null
          ended_at?: string | null
          id?: string
          interview_type: string
          metadata?: Json
          role: string
          seniority?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          company?: string | null
          ended_at?: string | null
          id?: string
          interview_type?: string
          metadata?: Json
          role?: string
          seniority?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_skill_scores: {
        Row: {
          created_at: string
          id: string
          score: number
          session_id: string
          skill: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          score: number
          session_id: string
          skill: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          score?: number
          session_id?: string
          skill?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_skill_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content_md: string
          created_at: string
          generation_id: string
          id: string
          search_vector: unknown
          updated_at: string
          word_count: number
        }
        Insert: {
          content_md: string
          created_at?: string
          generation_id: string
          id?: string
          search_vector?: unknown
          updated_at?: string
          word_count?: number
        }
        Update: {
          content_md?: string
          created_at?: string
          generation_id?: string
          id?: string
          search_vector?: unknown
          updated_at?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "notes_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channels: string[]
          daily_digest: boolean
          deadline_reminders: boolean
          followed_companies: string[]
          followed_roles: string[]
          match_alerts: boolean
          min_match_score: number
          new_internship_alerts: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          channels?: string[]
          daily_digest?: boolean
          deadline_reminders?: boolean
          followed_companies?: string[]
          followed_roles?: string[]
          match_alerts?: boolean
          min_match_score?: number
          new_internship_alerts?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          channels?: string[]
          daily_digest?: boolean
          deadline_reminders?: boolean
          followed_companies?: string[]
          followed_roles?: string[]
          match_alerts?: boolean
          min_match_score?: number
          new_internship_alerts?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload: Json
          read_at: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          read_at?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          payload?: Json
          read_at?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          provider_payment_id: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          provider_payment_id?: string | null
          status: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_files: {
        Row: {
          content_hash: string
          created_at: string
          document_id: string
          mime_type: string
          size_bytes: number
          storage_ref: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          document_id: string
          mime_type: string
          size_bytes: number
          storage_ref?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          document_id?: string
          mime_type?: string
          size_bytes?: number
          storage_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processed_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch: string | null
          college: string | null
          created_at: string
          full_name: string
          id: string
          onboarded_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          semester: number | null
          theme_preference: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          full_name: string
          id: string
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          semester?: number | null
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          branch?: string | null
          college?: string | null
          created_at?: string
          full_name?: string
          id?: string
          onboarded_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          semester?: number | null
          theme_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_milestones: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          is_completed: boolean
          position: number
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          position?: number
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_completed?: boolean
          position?: number
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          generation_id: string | null
          id: string
          repo_url: string | null
          search_vector: unknown
          status: Database["public"]["Enums"]["project_status"]
          tech_stack: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          generation_id?: string | null
          id?: string
          repo_url?: string | null
          search_vector?: unknown
          status?: Database["public"]["Enums"]["project_status"]
          tech_stack?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          generation_id?: string | null
          id?: string
          repo_url?: string | null
          search_vector?: unknown
          status?: Database["public"]["Enums"]["project_status"]
          tech_stack?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          checked_at: string
          consecutive_failures: number
          created_at: string
          key: string
          label: string
          latency_ms: number | null
          message: string | null
          reachable: boolean
          status: Database["public"]["Enums"]["provider_status"]
        }
        Insert: {
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          key: string
          label?: string
          latency_ms?: number | null
          message?: string | null
          reachable?: boolean
          status?: Database["public"]["Enums"]["provider_status"]
        }
        Update: {
          checked_at?: string
          consecutive_failures?: number
          created_at?: string
          key?: string
          label?: string
          latency_ms?: number | null
          message?: string | null
          reachable?: boolean
          status?: Database["public"]["Enums"]["provider_status"]
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          accuracy_pct: number | null
          completion_pct: number
          created_at: string
          final_score: number | null
          id: string
          is_adaptive_run: boolean
          max_score: number
          next_difficulty: Database["public"]["Enums"]["quiz_difficulty"] | null
          quiz_id: string
          raw_score: number | null
          started_at: string
          status: Database["public"]["Enums"]["quiz_attempt_status"]
          submitted_at: string | null
          time_taken_sec: number | null
          user_id: string
        }
        Insert: {
          accuracy_pct?: number | null
          completion_pct?: number
          created_at?: string
          final_score?: number | null
          id?: string
          is_adaptive_run?: boolean
          max_score?: number
          next_difficulty?:
            | Database["public"]["Enums"]["quiz_difficulty"]
            | null
          quiz_id: string
          raw_score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          submitted_at?: string | null
          time_taken_sec?: number | null
          user_id: string
        }
        Update: {
          accuracy_pct?: number | null
          completion_pct?: number
          created_at?: string
          final_score?: number | null
          id?: string
          is_adaptive_run?: boolean
          max_score?: number
          next_difficulty?:
            | Database["public"]["Enums"]["quiz_difficulty"]
            | null
          quiz_id?: string
          raw_score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          submitted_at?: string | null
          time_taken_sec?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_badges: {
        Row: {
          awarded_at: string
          badge_key: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_key: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_key?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_leaderboard_entries: {
        Row: {
          attempts_count: number
          id: string
          scope: string
          score: number
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number
          id?: string
          scope: string
          score?: number
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number
          id?: string
          scope?: string
          score?: number
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_question_reviews: {
        Row: {
          created_at: string
          id: string
          marked_for_review: boolean
          question_id: string
          reported_issue: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_for_review?: boolean
          question_id: string
          reported_issue?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_for_review?: boolean
          question_id?: string
          reported_issue?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_question_reviews_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_question_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          concept_tags: string[]
          correct_option: string | null
          created_at: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          embedding: string | null
          explanation: string | null
          grading_method: Database["public"]["Enums"]["quiz_grading_method"]
          hint: string | null
          id: string
          marks: number
          metadata: Json
          options: Json | null
          position: number
          question_text: string
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
          step_solution: string | null
          topic_id: string | null
        }
        Insert: {
          concept_tags?: string[]
          correct_option?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          embedding?: string | null
          explanation?: string | null
          grading_method?: Database["public"]["Enums"]["quiz_grading_method"]
          hint?: string | null
          id?: string
          marks?: number
          metadata?: Json
          options?: Json | null
          position?: number
          question_text: string
          question_type?: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
          step_solution?: string | null
          topic_id?: string | null
        }
        Update: {
          concept_tags?: string[]
          correct_option?: string | null
          created_at?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          embedding?: string | null
          explanation?: string | null
          grading_method?: Database["public"]["Enums"]["quiz_grading_method"]
          hint?: string | null
          id?: string
          marks?: number
          metadata?: Json
          options?: Json | null
          position?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id?: string
          step_solution?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "quiz_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          ai_feedback: string | null
          answered_at: string
          attempt_id: string
          hint_used: boolean
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          question_id: string
          response: Json
          time_spent_sec: number | null
        }
        Insert: {
          ai_feedback?: string | null
          answered_at?: string
          attempt_id: string
          hint_used?: boolean
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id: string
          response?: Json
          time_spent_sec?: number | null
        }
        Update: {
          ai_feedback?: string | null
          answered_at?: string
          attempt_id?: string
          hint_used?: boolean
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id?: string
          response?: Json
          time_spent_sec?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_streaks: {
        Row: {
          current_streak: number
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_topic_mastery: {
        Row: {
          attempts_count: number
          correct_count: number
          id: string
          last_attempt_at: string | null
          mastery_score: number
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts_count?: number
          correct_count?: number
          id?: string
          last_attempt_at?: string | null
          mastery_score?: number
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts_count?: number
          correct_count?: number
          id?: string
          last_attempt_at?: string | null
          mastery_score?: number
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_topic_mastery_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "quiz_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_topic_mastery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_topics: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "quiz_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          exam_mode: Database["public"]["Enums"]["quiz_exam_mode"]
          generation_id: string
          id: string
          is_adaptive: boolean
          negative_marking: number
          question_count: number
          source_upload_id: string | null
          time_limit_sec: number | null
          title: string
          topic_ids: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          exam_mode?: Database["public"]["Enums"]["quiz_exam_mode"]
          generation_id: string
          id?: string
          is_adaptive?: boolean
          negative_marking?: number
          question_count?: number
          source_upload_id?: string | null
          time_limit_sec?: number | null
          title: string
          topic_ids?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          exam_mode?: Database["public"]["Enums"]["quiz_exam_mode"]
          generation_id?: string
          id?: string
          is_adaptive?: boolean
          negative_marking?: number
          question_count?: number
          source_upload_id?: string | null
          time_limit_sec?: number | null
          title?: string
          topic_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_source_upload_id_fkey"
            columns: ["source_upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          application_readiness: number
          ats_match: number
          computed_at: string
          eligibility_score: number
          eligible: boolean
          explanation: Json
          internship_id: string
          interview_prep: string[]
          matched_skills: string[]
          missing_skills: string[]
          model: string
          ranking_score: number
          recommendation_score: number
          resume_match: number
          skill_gaps: Json
          suggested_courses: string[]
          suggested_projects: string[]
          user_id: string
        }
        Insert: {
          application_readiness?: number
          ats_match?: number
          computed_at?: string
          eligibility_score?: number
          eligible?: boolean
          explanation?: Json
          internship_id: string
          interview_prep?: string[]
          matched_skills?: string[]
          missing_skills?: string[]
          model?: string
          ranking_score?: number
          recommendation_score?: number
          resume_match?: number
          skill_gaps?: Json
          suggested_courses?: string[]
          suggested_projects?: string[]
          user_id: string
        }
        Update: {
          application_readiness?: number
          ats_match?: number
          computed_at?: string
          eligibility_score?: number
          eligible?: boolean
          explanation?: Json
          internship_id?: string
          interview_prep?: string[]
          matched_skills?: string[]
          missing_skills?: string[]
          model?: string
          ranking_score?: number
          recommendation_score?: number
          resume_match?: number
          skill_gaps?: Json
          suggested_courses?: string[]
          suggested_projects?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "v_most_viewed_internships"
            referencedColumns: ["id"]
          },
        ]
      }
      research_citations: {
        Row: {
          authors: string[]
          created_at: string
          doi: string | null
          id: string
          paper_id: string
          raw_text: string
          title: string | null
          url: string | null
          year: number | null
        }
        Insert: {
          authors?: string[]
          created_at?: string
          doi?: string | null
          id?: string
          paper_id: string
          raw_text: string
          title?: string | null
          url?: string | null
          year?: number | null
        }
        Update: {
          authors?: string[]
          created_at?: string
          doi?: string | null
          id?: string
          paper_id?: string
          raw_text?: string
          title?: string | null
          url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "research_citations_paper_id_fkey"
            columns: ["paper_id"]
            isOneToOne: false
            referencedRelation: "research_papers"
            referencedColumns: ["id"]
          },
        ]
      }
      research_knowledge_graphs: {
        Row: {
          created_at: string
          graph: Json
          id: string
          paper_ids: string[]
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          graph?: Json
          id?: string
          paper_ids?: string[]
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          graph?: Json
          id?: string
          paper_ids?: string[]
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_knowledge_graphs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_papers: {
        Row: {
          abstract: string | null
          authors: string[]
          created_at: string
          document_id: string | null
          id: string
          published_at: string | null
          search_vector: unknown
          source_url: string | null
          summary_md: string | null
          title: string
          updated_at: string
          upload_id: string | null
          user_id: string
        }
        Insert: {
          abstract?: string | null
          authors?: string[]
          created_at?: string
          document_id?: string | null
          id?: string
          published_at?: string | null
          search_vector?: unknown
          source_url?: string | null
          summary_md?: string | null
          title: string
          updated_at?: string
          upload_id?: string | null
          user_id: string
        }
        Update: {
          abstract?: string | null
          authors?: string[]
          created_at?: string
          document_id?: string | null
          id?: string
          published_at?: string | null
          search_vector?: unknown
          source_url?: string | null
          summary_md?: string | null
          title?: string
          updated_at?: string
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_papers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_papers_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_papers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_versions: {
        Row: {
          content: Json
          created_at: string
          id: string
          resume_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          resume_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          resume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          content: Json
          created_at: string
          id: string
          status: Database["public"]["Enums"]["resume_status"]
          template: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["resume_status"]
          template?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["resume_status"]
          template?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_internships: {
        Row: {
          created_at: string
          id: string
          internship_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          internship_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          internship_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_internships_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_internships_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "v_most_viewed_internships"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_tier: Database["public"]["Enums"]["plan_tier"]
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_tier?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          duplicates: number
          duration_ms: number
          error: string | null
          fetched: number
          finished_at: string | null
          id: string
          inserted: number
          normalized: number
          provider: string
          run_id: string
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
          updated: number
          warnings: string[]
        }
        Insert: {
          duplicates?: number
          duration_ms?: number
          error?: string | null
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          normalized?: number
          provider: string
          run_id: string
          started_at?: string
          status: Database["public"]["Enums"]["sync_status"]
          updated?: number
          warnings?: string[]
        }
        Update: {
          duplicates?: number
          duration_ms?: number
          error?: string | null
          fetched?: number
          finished_at?: string | null
          id?: string
          inserted?: number
          normalized?: number
          provider?: string
          run_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          updated?: number
          warnings?: string[]
        }
        Relationships: []
      }
      trending_research_topics: {
        Row: {
          created_at: string
          field: string
          id: string
          published_at: string | null
          search_vector: unknown
          source_url: string | null
          summary: string | null
          title: string
          trend_score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          published_at?: string | null
          search_vector?: unknown
          source_url?: string | null
          summary?: string | null
          title: string
          trend_score?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          published_at?: string | null
          search_vector?: unknown
          source_url?: string | null
          summary?: string | null
          title?: string
          trend_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          bucket_id: string
          created_at: string
          error_message: string | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id: string
          page_count: number | null
          status: Database["public"]["Enums"]["upload_status"]
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket_id?: string
          created_at?: string
          error_message?: string | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id?: string
          page_count?: number | null
          status?: Database["public"]["Enums"]["upload_status"]
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          page_count?: number | null
          status?: Database["public"]["Enums"]["upload_status"]
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_conversion_funnel: {
        Row: {
          applications: number | null
          offers: number | null
          views: number | null
        }
        Relationships: []
      }
      v_flashcards_due: {
        Row: {
          back: string | null
          created_at: string | null
          deck_id: string | null
          deck_title: string | null
          due_at: string | null
          ease_factor: number | null
          front: string | null
          id: string | null
          interval_days: number | null
          owner_id: string | null
          position: number | null
          repetitions: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_user_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_most_viewed_internships: {
        Row: {
          company_name: string | null
          count: number | null
          id: string | null
          title: string | null
        }
        Relationships: []
      }
      v_popular_skills: {
        Row: {
          count: number | null
          skill: string | null
        }
        Relationships: []
      }
      v_provider_health: {
        Row: {
          checked_at: string | null
          consecutive_failures: number | null
          key: string | null
          last_success_at: string | null
          latency_ms: number | null
          reachable: boolean | null
          runs_24h: number | null
          status: Database["public"]["Enums"]["provider_status"] | null
        }
        Insert: {
          checked_at?: string | null
          consecutive_failures?: number | null
          key?: string | null
          last_success_at?: never
          latency_ms?: number | null
          reachable?: boolean | null
          runs_24h?: never
          status?: Database["public"]["Enums"]["provider_status"] | null
        }
        Update: {
          checked_at?: string | null
          consecutive_failures?: number | null
          key?: string | null
          last_success_at?: never
          latency_ms?: number | null
          reachable?: boolean | null
          runs_24h?: never
          status?: Database["public"]["Enums"]["provider_status"] | null
        }
        Relationships: []
      }
      v_trending_companies: {
        Row: {
          company_name: string | null
          count: number | null
          id: string | null
        }
        Relationships: []
      }
      v_trending_roles: {
        Row: {
          count: number | null
          normalized_title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_flashcard_review: {
        Args: {
          p_flashcard_id: string
          p_rating: Database["public"]["Enums"]["flashcard_rating"]
        }
        Returns: {
          back: string
          card_type: string
          confidence: number
          created_at: string
          deck_id: string
          difficulty: number
          due_at: string
          duplicate_of: string | null
          ease_factor: number
          embedding: string | null
          explanation: string | null
          front: string
          hint: string | null
          id: string
          image_url: string | null
          interval_days: number
          metadata: Json
          mnemonic: string | null
          position: number
          repetitions: number
          source_excerpt: string | null
          tags: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "flashcards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_dashboard_summary: {
        Args: never
        Returns: {
          flashcards_due: number
          saved_internships: number
          total_bookmarks: number
          total_generations: number
          total_projects: number
          total_resumes: number
          unread_notifications: number
        }[]
      }
      increment_internship_counter: {
        Args: { counter: string; internship_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      match_document_chunks: {
        Args: {
          match_document_id?: string
          match_limit?: number
          query_embedding: string
        }
        Returns: {
          document_id: string
          id: string
          similarity: number
          start_page_index: number
          text: string
        }[]
      }
      match_flashcards: {
        Args: {
          match_deck_id?: string
          match_limit?: number
          query_embedding: string
        }
        Returns: {
          back: string
          card_type: string
          confidence: number
          created_at: string
          deck_id: string
          difficulty: number
          due_at: string
          duplicate_of: string | null
          ease_factor: number
          embedding: string | null
          explanation: string | null
          front: string
          hint: string | null
          id: string
          image_url: string | null
          interval_days: number
          metadata: Json
          mnemonic: string | null
          position: number
          repetitions: number
          source_excerpt: string | null
          tags: string[]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "flashcards"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      match_humanizer_history: {
        Args: {
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          created_at: string
          rewrite_id: string
          rewritten_text: string
          similarity: number
        }[]
      }
      match_internships: {
        Args: {
          filter_active_only?: boolean
          filter_country?: string
          filter_min_stipend?: number
          filter_work_modes?: string[]
          match_count?: number
          query_embedding: string
        }
        Returns: {
          apply_count: number
          apply_url: string
          branches: string[]
          city: string
          company_domain: string
          company_id: string
          company_logo_url: string
          company_name: string
          company_slug: string
          company_website: string
          country: string
          created_at: string
          deadline_at: string
          degrees: string[]
          description: string
          description_html: string
          duration_months: number
          duration_raw: string
          eligibility_notes: string[]
          eligible_years: number[]
          embedding: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          fingerprint: string
          id: string
          is_active: boolean
          is_unpaid: boolean
          location_raw: string
          min_cgpa: number
          normalized_title: string
          posted_at: string
          quality_score: number
          search_vector: unknown
          similarity: number
          skills: string[]
          source_confidence: number
          sources: Json
          state: string
          stipend_currency: string
          stipend_max: number
          stipend_min: number
          stipend_monthly_inr: number
          stipend_period: string
          stipend_raw: string
          tags: string[]
          title: string
          updated_at: string
          view_count: number
          work_mode: Database["public"]["Enums"]["work_mode"]
        }[]
      }
      match_quiz_questions: {
        Args: {
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          concept_tags: string[]
          correct_option: string
          created_at: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          explanation: string
          grading_method: Database["public"]["Enums"]["quiz_grading_method"]
          hint: string
          id: string
          marks: number
          metadata: Json
          options: Json
          position: number
          question_text: string
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
          similarity: number
          step_solution: string
          topic_id: string
        }[]
      }
      search_notes: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          content_md: string
          created_at: string
          generation_id: string
          id: string
          search_vector: unknown
          updated_at: string
          word_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_projects: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          created_at: string
          description: string | null
          generation_id: string | null
          id: string
          repo_url: string | null
          search_vector: unknown
          status: Database["public"]["Enums"]["project_status"]
          tech_stack: string[]
          title: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_research_papers: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          abstract: string | null
          authors: string[]
          created_at: string
          id: string
          published_at: string | null
          search_vector: unknown
          source_url: string | null
          summary_md: string | null
          title: string
          updated_at: string
          upload_id: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "research_papers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_trending_topics: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          created_at: string
          field: string
          id: string
          published_at: string | null
          search_vector: unknown
          source_url: string | null
          summary: string | null
          title: string
          trend_score: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trending_research_topics"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      application_status:
        | "saved"
        | "applied"
        | "interviewing"
        | "offer"
        | "rejected"
        | "interview_scheduled"
        | "accepted"
        | "withdrawn"
      assistant_feedback_rating: "thumbs_up" | "thumbs_down"
      chat_message_role: "user" | "assistant" | "system"
      chat_module:
        | "resume_studio"
        | "research_ai"
        | "project_generator"
        | "syllabus_ai"
        | "assignment_ai"
        | "notes_ai"
        | "flashcards_ai"
        | "quiz_ai"
        | "interview_ai"
        | "career_guidance_ai"
        | "internship_discovery_ai"
        | "hackathon_ai"
        | "humanizer_ai"
        | "document_intelligence_engine"
      chat_session_status: "active" | "archived"
      employment_type:
        | "internship"
        | "apprenticeship"
        | "co_op"
        | "trainee"
        | "fellowship"
        | "part_time"
        | "full_time"
        | "contract"
        | "volunteer"
      flashcard_rating: "again" | "hard" | "good" | "easy"
      generation_kind:
        | "notes"
        | "revision_notes"
        | "one_day_revision"
        | "flashcards"
        | "quiz"
        | "mind_map"
        | "formula_sheet"
        | "important_questions"
        | "expected_questions"
        | "mcqs"
        | "assignment"
        | "eli_beginner"
        | "eli_professor"
      internship_type: "internship" | "part_time" | "full_time"
      notification_channel: "in_app" | "email" | "push"
      notification_kind:
        | "daily_digest"
        | "weekly_digest"
        | "new_internship"
        | "deadline_reminder"
        | "matching_internship"
        | "company_alert"
        | "role_alert"
      notification_type:
        | "generation_complete"
        | "subscription"
        | "internship"
        | "research"
        | "system"
        | "admin"
      plan_tier: "free" | "pro"
      project_status: "idea" | "in_progress" | "completed" | "archived"
      provider_status:
        | "active"
        | "degraded"
        | "disabled"
        | "unsupported"
        | "unconfigured"
      quiz_attempt_status: "in_progress" | "submitted" | "graded" | "abandoned"
      quiz_difficulty: "easy" | "medium" | "hard" | "expert"
      quiz_exam_mode:
        | "practice"
        | "timed_test"
        | "mock_exam"
        | "competitive_exam"
        | "revision_test"
        | "chapter_test"
        | "unit_test"
        | "semester_exam"
        | "final_exam"
        | "custom_exam"
      quiz_grading_method: "exact_match" | "set_match" | "ai_graded"
      quiz_question_type:
        | "mcq"
        | "true_false"
        | "fill_in_blank"
        | "one_word"
        | "multiple_select"
        | "match_following"
        | "ordering"
        | "short_answer"
        | "long_answer"
        | "essay"
        | "case_study"
        | "programming"
        | "debugging"
        | "sql"
        | "mathematics"
        | "physics"
        | "chemistry"
        | "biology"
        | "engineering"
        | "medical"
        | "law"
        | "business"
        | "ai_ml"
        | "coding_challenge"
      resume_status: "draft" | "final"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "none"
      sync_status: "running" | "success" | "partial" | "failed"
      upload_status: "pending" | "processing" | "ready" | "failed"
      user_role: "student" | "admin"
      work_mode: "remote" | "hybrid" | "onsite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_status: [
        "saved",
        "applied",
        "interviewing",
        "offer",
        "rejected",
        "interview_scheduled",
        "accepted",
        "withdrawn",
      ],
      assistant_feedback_rating: ["thumbs_up", "thumbs_down"],
      chat_message_role: ["user", "assistant", "system"],
      chat_module: [
        "resume_studio",
        "research_ai",
        "project_generator",
        "syllabus_ai",
        "assignment_ai",
        "notes_ai",
        "flashcards_ai",
        "quiz_ai",
        "interview_ai",
        "career_guidance_ai",
        "internship_discovery_ai",
        "hackathon_ai",
        "humanizer_ai",
        "document_intelligence_engine",
      ],
      chat_session_status: ["active", "archived"],
      employment_type: [
        "internship",
        "apprenticeship",
        "co_op",
        "trainee",
        "fellowship",
        "part_time",
        "full_time",
        "contract",
        "volunteer",
      ],
      flashcard_rating: ["again", "hard", "good", "easy"],
      generation_kind: [
        "notes",
        "revision_notes",
        "one_day_revision",
        "flashcards",
        "quiz",
        "mind_map",
        "formula_sheet",
        "important_questions",
        "expected_questions",
        "mcqs",
        "assignment",
        "eli_beginner",
        "eli_professor",
      ],
      internship_type: ["internship", "part_time", "full_time"],
      notification_channel: ["in_app", "email", "push"],
      notification_kind: [
        "daily_digest",
        "weekly_digest",
        "new_internship",
        "deadline_reminder",
        "matching_internship",
        "company_alert",
        "role_alert",
      ],
      notification_type: [
        "generation_complete",
        "subscription",
        "internship",
        "research",
        "system",
        "admin",
      ],
      plan_tier: ["free", "pro"],
      project_status: ["idea", "in_progress", "completed", "archived"],
      provider_status: [
        "active",
        "degraded",
        "disabled",
        "unsupported",
        "unconfigured",
      ],
      quiz_attempt_status: ["in_progress", "submitted", "graded", "abandoned"],
      quiz_difficulty: ["easy", "medium", "hard", "expert"],
      quiz_exam_mode: [
        "practice",
        "timed_test",
        "mock_exam",
        "competitive_exam",
        "revision_test",
        "chapter_test",
        "unit_test",
        "semester_exam",
        "final_exam",
        "custom_exam",
      ],
      quiz_grading_method: ["exact_match", "set_match", "ai_graded"],
      quiz_question_type: [
        "mcq",
        "true_false",
        "fill_in_blank",
        "one_word",
        "multiple_select",
        "match_following",
        "ordering",
        "short_answer",
        "long_answer",
        "essay",
        "case_study",
        "programming",
        "debugging",
        "sql",
        "mathematics",
        "physics",
        "chemistry",
        "biology",
        "engineering",
        "medical",
        "law",
        "business",
        "ai_ml",
        "coding_challenge",
      ],
      resume_status: ["draft", "final"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "none",
      ],
      sync_status: ["running", "success", "partial", "failed"],
      upload_status: ["pending", "processing", "ready", "failed"],
      user_role: ["student", "admin"],
      work_mode: ["remote", "hybrid", "onsite"],
    },
  },
} as const

export type UserRole = Database["public"]["Enums"]["user_role"];