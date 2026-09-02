-- ============================================================================
-- PROPHEZY — 0031_conversation_summaries_feedback.sql
-- Purpose : conversation_summaries mirrors lib/ai/memory/context-manager.ts's
--           rolling-summary mechanism, but as a persisted, timestamped log
--           (context-manager.ts only ever keeps ONE current summary string
--           in Redis, overwritten each time it trims) — useful for a
--           session-history view like "what did we cover in this chat" and
--           for conversation_summaries-driven analytics. assistant_feedback
--           is thumbs up/down (+ optional comment) per assistant message.
-- Depends : 0030_chat_sessions_messages.sql
-- ============================================================================

create table public.conversation_summaries (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.chat_sessions (id) on delete cascade,
  summary_text          text not null,
  message_count_covered integer not null,
  created_at            timestamptz not null default now()
);

comment on table public.conversation_summaries is
  'Append-only log of rolling summaries as a session grows, written by memory.service.ts whenever context-manager.ts#ensureWithinContextWindow trims (that function only keeps the latest summary in Redis; this table keeps the history of them).';

create table public.assistant_feedback (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.chat_messages (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  rating       public.assistant_feedback_rating not null,
  comment      text,
  created_at   timestamptz not null default now(),

  unique (message_id, user_id)
);

comment on table public.assistant_feedback is
  'One feedback row per (message, user) — a user can change their mind (upsert), not stack duplicate ratings on the same message.';

create index if not exists conversation_summaries_session_idx on public.conversation_summaries (session_id, created_at desc);
create index if not exists assistant_feedback_message_idx on public.assistant_feedback (message_id);
