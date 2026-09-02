export {};

// No GROK_API_KEY* set at all -> must behave EXACTLY like before this change:
// Gemini exhaustion throws AIAllKeysExhaustedError straight through, no crash.
process.env.GEMINI_API_KEY_1 = "fake-gemini-key-1";
delete process.env.GROK_API_KEY_1;
delete process.env.GROK_API_KEY;

// @ts-ignore
global.fetch = async (url: string) => {
  if (url.includes("generativelanguage.googleapis.com")) {
    return { ok: false, status: 429, json: async () => ({ error: { message: "quota exceeded" } }) } as any;
  }
  throw new Error("Grok must never be called - no keys configured: " + url);
};

async function main() {
  const { runAI } = await import("./lib/ai/engine");
  try {
    await runAI({
      feature: "career", userId: "u1", systemInstruction: "sys",
      messages: [{ role: "user", parts: [{ text: "hi" }] }],
      cacheable: false,
    });
    console.log("FAIL - expected throw");
    process.exit(1);
  } catch (err: any) {
    console.log("threw:", err.name, "-", err.message);
    if (err.name !== "AIAllKeysExhaustedError") { console.log("FAIL - wrong error type"); process.exit(1); }
    console.log("PASS - unchanged behavior when Grok isn't configured");
  }
}
main();
