# Prophezy AI Chat Assistant — Master Orchestrator

Central conversational entry point: classifies intent, extracts entities,
plans multi-module execution in dependency order, routes to module
adapters, synthesizes a unified response, and persists durable
conversation history alongside the AI Core Engine's existing Redis working
memory. Every AI call goes through `runAI`/`runStructured`/`runAIStream` —
this module never calls Gemini directly.

## What's included

```
lib/chat/
  types/
    chat.types.ts                 Domain types, mirrors the DB schema, ModuleAdapter contract
  intent/
    intent-detection.prompt.ts    Classifies a message into 0+ of 14 modules, confidence + entities
    intent.service.ts             Wraps the prompt via runStructured, validates output against the enum
  entities/
    entity-normalizer.ts          Deadline parsing, common-entity accessors shared across module adapters
  planner/
    planner.service.ts            Builds a dependency-ordered ExecutionPlan matching the mission's own example flows
  router/
    module-registry.ts            The 14-module adapter registry — see "What's real" below
    router.service.ts             Invokes an adapter, turns ModuleNotWiredError into an honest user-facing message
  memory/
    memory.service.ts             Bridges Redis working memory (lib/ai/memory/session.ts) with durable Postgres history
  context/
    context.service.ts            Session-level orchestration state: active plan, pending clarification
  services/
    chat.service.ts               THE entry point — sendMessage(), composes orchestrator + AI Core's chat.service.ts
    conversation.service.ts       Session list/history/rename/archive CRUD, feedback submission
    response.service.ts           Synthesizes multiple module results into one reply
    response-synthesis.prompt.ts  The synthesis prompt itself
  orchestrator/
    orchestrator.service.ts       handleUserMessage(): intent -> plan -> route -> synthesize -> persist
  analytics/
    analytics.service.ts          Module usage stats, feedback summary, clarification-rate tracking
  validation/
    chat-schemas.ts               Zod request schemas
  utils/
    security.ts                   Prompt-injection pre-screening for raw chat input
  providers/
    supabase-chat.provider.ts     All raw Supabase reads/writes for the 4 new tables

supabase/migrations/
  0029_chat_enums.sql                    chat_message_role, chat_session_status, assistant_feedback_rating, chat_module
  0030_chat_sessions_messages.sql        chat_sessions, chat_messages
  0031_conversation_summaries_feedback.sql  conversation_summaries, assistant_feedback
  0032_chat_rls.sql                      RLS for all 4 tables
```

## Verification this session actually did

Every migration in this delivery (0029–0032) was applied against a **real
local Postgres 16 + pgvector instance** — not just read back — chained
after your existing 0002/0003/0006–0009 migrations (reused verbatim from
the earlier Quiz Engine delivery's context) plus minimal stand-ins for the
0001/0005 migrations this session hasn't seen. Real rows were inserted
through the full FK chain for both `chat_sessions -> chat_messages ->
conversation_summaries` and `assistant_feedback`, and the UNIQUE
`(message_id, user_id)` constraint was confirmed to actually reject a
duplicate rating. All TypeScript in `lib/chat/` (and `lib/quiz/`) passes a
`tsc --strict` compile with zero errors, checked against stub doubles built
from the **real** signatures of every `lib/ai/*` file provided across this
conversation (`engine.ts`, `_run-structured.ts`, `_shared.ts`, `validator.ts`,
`formatter.ts`, `ocr.service.ts`, `session.ts`, `context-manager.ts`,
`models.ts`, `chat.service.ts`, `interview.service.ts`, `prompts/interview.ts`).

## What's real vs. what's flagged

**Real, working, built against verified signatures:**
- `quiz_ai` adapter — calls `lib/quiz/generator/generator.service.ts#generateAndValidateQuiz` (this project's own prior delivery)
- `interview_ai` adapter — calls the real `interview.service.ts#startInterviewSession`, reuses the chat session id as the interview's Redis session id
- The plain-conversation path — falls through to the real `lib/ai/services/chat.service.ts#sendChatMessage`, not reimplemented
- Memory bridging — reuses `session.ts`/`context-manager.ts` exactly as `interview.service.ts` and `chat.service.ts` already do; adds Postgres persistence on top rather than duplicating the trimming/summarization logic

**Explicitly flagged, not faked** — the other 12 modules (`resume_studio`,
`research_ai`, `project_generator`, `syllabus_ai`, `assignment_ai`,
`notes_ai`, `flashcards_ai`, `career_guidance_ai`,
`internship_discovery_ai`, `hackathon_ai`, `humanizer_ai`,
`document_intelligence_engine`) are registered in `module-registry.ts` with
adapters that throw `ModuleNotWiredError`, naming the exact missing service
file. `router.service.ts` catches that specific error and turns it into an
honest "that integration isn't finished yet" message rather than a crash —
the orchestrator degrades gracefully today and each adapter becomes a
same-shaped, real implementation the moment its module's real service file
is available. This mirrors the PDF/DOCX stub pattern from the Quiz Engine
delivery: flag the gap precisely rather than invent a signature that would
silently be wrong.

**One design gap I caught and fixed mid-build, worth knowing about:** the
Redis working-memory session only gets appended to by
`lib/ai/services/chat.service.ts` in the plain-conversation path. The
module-execution and clarification paths don't go through that file, so
without `memory.service.ts#syncTurnToWorkingMemory` (added specifically for
this), next-turn intent detection would have silently used stale Redis
context while Postgres held the true history. Both non-plain-chat paths
call it now.

## One unverified import path

Same as the Quiz Engine: `providers/supabase-chat.provider.ts` assumes
`createServerClient` at `@/lib/supabase/server`. One-line fix if your actual
export differs.

## Wiring a new module adapter

1. Get the module's real service file (signature, not a filename guess).
2. Write an adapter function in `module-registry.ts` following the
   `quizAdapter`/`interviewAdapter` pattern: pull entities via
   `commonEntities()`, call the real service, return a `ModuleResult`.
3. Swap the registry entry from `notWired(...)` to the new function.
4. Add the module id to `WIRED_MODULES` in the same file.

Nothing in `orchestrator.service.ts`, `planner.service.ts`, or
`router.service.ts` needs to change — that's the point of the adapter
contract.

## Dependencies

`zod` (already used), `@upstash/redis` (already used by `session.ts`). No
new dependencies introduced by this delivery.
