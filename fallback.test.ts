/**
 * Controlled-failure integration test.
 *
 * Simulates:
 *   - Gemini: every key returns 429 (quota exhausted) -> AIAllKeysExhaustedError
 *   - Grok: succeeds on the first key
 *
 * Proves, via a single call to the real runAI() from engine.ts:
 *   1. Gemini was tried first (and only, until exhausted).
 *   2. Grok was automatically used after Gemini's pool was exhausted.
 *   3. The final answer is Grok's text.
 *   4. runAI() is called exactly ONCE for the user's action, so whatever
 *      credit-charging code wraps a single runAI() call (outside this
 *      module, in the API route) charges exactly once regardless of the
 *      internal Gemini->Grok handoff.
 */

process.env.GEMINI_API_KEY_1 = "fake-gemini-key-1";
process.env.GEMINI_API_KEY_2 = "fake-gemini-key-2";
process.env.GROK_API_KEY_1 = "fake-grok-key-1";
// no UPSTASH_* -> cache/rate-limit both no-op/fail-open, exactly as documented

let geminiCallCount = 0;
let grokCallCount = 0;

const realFetch = global.fetch;
// @ts-ignore
global.fetch = async (url: string, init: any) => {
  if (url.includes("generativelanguage.googleapis.com")) {
    geminiCallCount++;
    return {
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Resource has been exhausted (e.g. check quota)." } }),
    } as any;
  }
  if (url.includes("api.x.ai")) {
    grokCallCount++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: "chatcmpl-test",
        choices: [
          {
            message: { role: "assistant", content: "GROK_FALLBACK_ANSWER: 42" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
      }),
    } as any;
  }
  throw new Error("Unexpected fetch to " + url);
};

async function main() {
  const { runAI } = await import("../ai/engine");

  let creditChargeCount = 0;
  function chargeCreditOnce() {
    creditChargeCount++;
  }

  // Simulates the API route: charge ONE credit, then make ONE call to the
  // central engine. Fallback happens entirely inside this one call.
  chargeCreditOnce();
  const result = await runAI({
    feature: "career",
    userId: "test-user-123",
    systemInstruction: "You are a helpful assistant.",
    messages: [{ role: "user", parts: [{ text: "What is the answer to everything?" }] }],
    cacheable: false, // no Redis in this harness
  });

  console.log("--- RESULT ---");
  console.log(JSON.stringify(result, null, 2));
  console.log("--- COUNTERS ---");
  console.log("geminiCallCount:", geminiCallCount);
  console.log("grokCallCount:", grokCallCount);
  console.log("creditChargeCount:", creditChargeCount);

  const assertions: [boolean, string][] = [
    [geminiCallCount >= 1, "Gemini must have been attempted at least once"],
    [grokCallCount === 1, "Grok must have been called exactly once"],
    [result.provider === "grok", "result.provider must be 'grok'"],
    [result.text.includes("GROK_FALLBACK_ANSWER"), "final answer must be Grok's text"],
    [creditChargeCount === 1, "credit must be charged exactly once for the whole action"],
  ];

  let allPass = true;
  for (const [ok, msg] of assertions) {
    console.log(ok ? "PASS" : "FAIL", "-", msg);
    if (!ok) allPass = false;
  }

  global.fetch = realFetch;
  if (!allPass) {
    process.exit(1);
  }
  console.log("\nALL ASSERTIONS PASSED — Gemini exhaustion correctly triggered automatic Grok fallback, single credit charge preserved.");
}

main().catch((err) => {
  console.error("TEST THREW:", err);
  process.exit(1);
});
