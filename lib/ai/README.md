# Prophezy AI Core Engine — Complete

Full backend AI layer: foundation (config/utils/middleware/engine), every
feature's prompt template, every feature's service, and conversation memory
for the chat-style features. Nothing here is a stub — every function is a
real implementation.

## What's included

```
lib/ai/
  config/
    models.ts       Model registry + per-feature model routing (Flash/Pro/Lite)
    client.ts        Low-level Gemini REST wrapper: generate(), streamGenerate(), embed()
  utils/
    errors.ts        Shared error classes (AIRequestError, AITimeoutError, AISafetyBlockedError, AIValidationError)
    retry.ts          Exponential backoff, retries only transient failures (429/5xx/timeout)
    json.ts           Repairs/extracts JSON from raw model text (fences, trailing commas, preamble)
    parser.ts         Markdown section splitting, code block / Mermaid extraction, CSV parsing
    validator.ts      Dependency-free shape validation (+ a zod adapter if you add zod later)
    formatter.ts      Whitespace normalization, markdown -> plain text / HTML, truncation
    stream.ts         Turns streamGenerate()'s async generator into a Next.js SSE Response
    tokens.ts         Fast local token estimate + exact Gemini countTokens() call
    logger.ts         Structured JSON logging (swap the sink for Sentry/Axiom later)
  middleware/
    rate-limit.ts     Upstash Redis fixed-window rate limiter, per user + per feature
    cache.ts          Upstash Redis response/embedding cache, content-hashed keys
    safety.ts         Input sanitization, prompt-injection pattern flags, wraps untrusted
                      user content, reads Gemini's own safetyRatings off responses
    analytics.ts      Cost estimation + usage event logging (persist() is a no-op stub —
                      wire it to `ai_usage_events` once the DB branch adds that table)
  engine.ts           runAI() / runAIStream() — the ONLY functions feature services call
  prompts/
    _shared.ts        PromptDefinition type + JSON-only-output suffix shared by every prompt
    resume.ts, ats.ts, research.ts, assignment.ts, career.ts, project.ts,
    roadmap.ts, flashcards.ts, quiz.ts, mindmap.ts, humanizer.ts, notes.ts,
    ocr.ts            One PromptDefinition each: system prompt, user-prompt
                      builder, JSON response schema, generation params (temp/maxTokens)
    interview.ts      Conversational — exports a system-prompt builder instead
                      of a fixed schema, since interview prep is multi-turn
  services/
    _run-structured.ts  Shared runner: PromptDefinition -> runAI(jsonMode) -> typed result.
                        Every one-shot service below is a thin wrapper around this.
    resume.service.ts, ats.service.ts, research.service.ts, assignment.service.ts,
    career.service.ts, project.service.ts, roadmap.service.ts, flashcard.service.ts,
    quiz.service.ts, mindmap.service.ts, humanizer.service.ts, notes.service.ts
                        One-shot JSON features — call these directly from API routes.
    ocr.service.ts      Two-stage: Tesseract.js extracts raw text, then a Gemini
                        cleanup pass structures it. Falls back to Gemini vision
                        (native multimodal input) when Tesseract confidence is low.
    interview.service.ts  Conversational mock interview: session + streaming.
    chat.service.ts       Generic streaming chat for any feature that needs
                          open-ended follow-up beyond its one-shot result.
  memory/
    session.ts          Redis-persisted conversation sessions (24h idle TTL)
    context-manager.ts  Trims history that would exceed the model's context
                        window, folding dropped turns into a rolling summary
                        via a cheap summarization call instead of discarding them
```

## The one rule

**Every feature service goes through `runAI()` or `runAIStream()` in
`engine.ts`.** Never call `generate()`/`streamGenerate()` from
`config/client.ts` directly from a service or route handler — that's how
rate limiting, caching, and safety checks get silently skipped.

In practice you won't call `runAI` directly for most features — you'll call
the feature's service, which already wires up the right prompt template:

```ts
// One-shot feature (from an API route)
import { generateFlashcards } from "@/lib/ai/services/flashcard.service";

const result = await generateFlashcards(userId, {
  sourceText: uploadedNotesText,
  count: 20,
});
// result is fully typed as FlashcardsOutput
```

```ts
// Streaming/conversational feature
import { sendChatMessage } from "@/lib/ai/services/chat.service";
import { toSSEResponse } from "@/lib/ai/utils/stream";

export async function POST(req: Request) {
  const { sessionId, userId, message } = await req.json();
  return toSSEResponse(
    sendChatMessage({
      sessionId,
      userId,
      feature: "research",
      systemInstruction: "You are a research assistant...",
      userMessage: message,
    }),
    req.signal
  );
}
```

## Environment variables

```
GEMINI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Dependencies to install

```
npm install @upstash/redis tesseract.js
```

`config/client.ts` talks to Gemini over raw `fetch` rather than the
`@google/generative-ai` SDK, so that's one less dependency to version-pin —
streaming/timeout/abort behavior is fully under our control instead of the
SDK's.

## Explicitly NOT touched

- No database schema, tables, or SQL — that's the DB branch's job.
  `middleware/analytics.ts`'s `persist()` is intentionally a no-op stub with
  a comment showing exactly where to wire a Supabase insert once
  `ai_usage_events` exists.
- No frontend pages or components.
- No changes to auth.

## A note on two prompts

- **humanizer.ts** is written to make writing read more naturally in a
  requested tone (varied sentence rhythm, word choice) while preserving
  meaning exactly — it does not attempt to evade AI-detection or
  plagiarism tooling, and the system prompt says so explicitly.
- **assignment.ts** always returns full step-by-step reasoning, framed as
  tutoring (a student learning the method), not a bare final answer to
  copy — this is a deliberate product/prompt-design choice, easy to relax
  by editing the system prompt if you want a terser output shape instead.

## What's genuinely still open (by design, not oversight)

- `ai_usage_events` — wire `middleware/analytics.ts`'s `persist()` once the
  DB branch adds the table.
- Prompt-versioning history/rollback (currently just a version string
  baked into each `PromptDefinition` and appended to the system
  instruction) — fine for now, add a proper store if you need to A/B prompts.
- Function calling / tool use — Gemini supports it, but no feature here
  needs it yet; add a `tools` param to `GenerateOptions` in `client.ts`
  when one does.
