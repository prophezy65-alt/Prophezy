-- ============================================================================
-- PROPHEZY — 0030_chat_sessions_messages.sql
-- Purpose : Durable conversation history. lib/ai/memory/session.ts (Redis,
--           24h TTL) is the working-memory layer the AI call itself reads/
--           trims from; these tables are the permanent record — session
--           list in a sidebar, full history on reload after the Redis TTL
--           has expired, analytics, feedback attachment.
-- Depends : 0003_profiles.sql, 0029_chat_enums.sql
-- ============================================================================

create table public.chat_sessions (
  id              uuid primary key default gen_random_uuid(),
  -- Same id used as the Redis session key (lib/ai/memory/session.ts) — this
  -- row and the Redis record are two views of the same logical session, not
  -- two separate ones. Redis is ephemeral; this row outlives it.
  user_id         uuid not null references public.profiles (id) on delete cascade,
  title           text not null default 'New conversation',
  status          public.chat_session_status not null default 'active',
  last_message_at timestamptz not null default now(),
  -- Orchestrator working state that needs to survive a page reload: the
  -- current multi-step plan (if a planner.service.ts plan is mid-execution),
  -- pending clarification question, etc. Shape owned by lib/chat/types/, not
  -- fixed here so the orchestrator can evolve it without a migration.
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.chat_sessions is
  'Durable record of a conversation. id matches the Redis session key in lib/ai/memory/session.ts — same session, two storage layers with different retention.';

create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.chat_sessions (id) on delete cascade,
  role            public.chat_message_role not null,
  content         text not null,
  -- Which modules this message's response drew on, e.g. ['syllabus_ai',
  -- 'notes_ai'] for "I have an exam tomorrow" — null for plain user turns.
  modules_invoked public.chat_module[],
  -- Snapshot of intent.service.ts's classification for this turn: detected
  -- module(s), confidence, extracted entities. Null for assistant turns.
  intent          jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.chat_messages is
  'One row per turn (user or assistant). modules_invoked/intent are populated by orchestrator.service.ts after routing, not by the raw chat.service.ts call.';

create index if not exists chat_sessions_user_idx on public.chat_sessions (user_id, last_message_at desc);
create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);
