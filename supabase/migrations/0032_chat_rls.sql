-- ============================================================================
-- PROPHEZY — 0032_chat_rls.sql
-- Purpose : Row-level security for chat_sessions, chat_messages,
--           conversation_summaries, assistant_feedback.
-- Depends : 0030_chat_sessions_messages.sql, 0031_conversation_summaries_feedback.sql
-- ============================================================================

alter table public.chat_sessions            enable row level security;
alter table public.chat_messages            enable row level security;
alter table public.conversation_summaries   enable row level security;
alter table public.assistant_feedback       enable row level security;

-- chat_sessions: owned directly by user_id
create policy chat_sessions_owner_all on public.chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- chat_messages: ownership via parent session
create policy chat_messages_owner_all on public.chat_messages
  for all using (
    exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.chat_sessions s where s.id = chat_messages.session_id and s.user_id = auth.uid())
  );

-- conversation_summaries: ownership via parent session
create policy conversation_summaries_owner_all on public.conversation_summaries
  for all using (
    exists (select 1 from public.chat_sessions s where s.id = conversation_summaries.session_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.chat_sessions s where s.id = conversation_summaries.session_id and s.user_id = auth.uid())
  );

-- assistant_feedback: owned directly by user_id
create policy assistant_feedback_owner_all on public.assistant_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
