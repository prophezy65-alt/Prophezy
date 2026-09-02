export {};

process.env.GEMINI_API_KEY_1 = "fake-gemini-key-1";
process.env.GROK_API_KEY_1 = "fake-grok-key-1";

let geminiCalls = 0, grokCalls = 0;
// @ts-ignore
global.fetch = async (url: string) => {
  if (url.includes("generativelanguage.googleapis.com")) {
    geminiCalls++;
    return { ok: true, status: 200, json: async () => ({
      candidates: [{ content: { parts: [{ text: "GEMINI_ANSWER" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, totalTokenCount: 13 },
    })} as any;
  }
  if (url.includes("api.x.ai")) { grokCalls++; throw new Error("Grok should never be called here"); }
  throw new Error("unexpected url " + url);
};

async function main() {
  const { runAI } = await import("./lib/ai/engine");
  const result = await runAI({
    feature: "career", userId: "u1",
    systemInstruction: "sys",
    messages: [{ role: "user", parts: [{ text: "hi" }] }],
    cacheable: false,
  });
  console.log("provider:", result.provider, "geminiCalls:", geminiCalls, "grokCalls:", grokCalls);
  if (result.provider !== "gemini" || grokCalls !== 0) { console.log("FAIL"); process.exit(1); }
  console.log("PASS - Grok never touched when Gemini succeeds");
}
main().catch((e) => { console.error(e); process.exit(1); });
