#!/usr/bin/env node
/**
 * scripts/check-keys.js
 *
 * Live health check for every configured Gemini AND Grok API key.
 * Makes one minimal, near-zero-token request per key (does NOT burn
 * meaningful quota) and reports whether each one is actually working
 * right now — not just "present in .env".
 *
 * Usage:
 *   node scripts/check-keys.js
 *
 * If you keep secrets in .env / .env.local and don't already export them
 * into your shell, load them first:
 *   node -r dotenv/config scripts/check-keys.js dotenv_config_path=.env.local
 * (requires `npm i -D dotenv` — optional, this script also works with keys
 * exported directly into the shell environment, e.g. via `export` or your
 * process manager / CI secrets.)
 *
 * Exit code: 0 if every configured key is healthy, 1 if any key failed or
 * no keys are configured at all. Useful as a pre-deploy / cron check.
 */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// Keys in GROK_API_KEY_* are Groq (GroqCloud, gsk_...) keys, not xAI Grok
// keys, so this probes Groq's OpenAI-compatible endpoint — matches the
// same fix made in lib/ai/config/grok-client.ts.
const GROK_API_BASE = "https://api.groq.com/openai/v1";

// Keep this in sync with config/models.ts's DEFAULT_MODEL / GROK_MODELS
// default if you change either — only used to run the cheapest possible
// live probe per key, not to reflect what your app actually routes to.
const GEMINI_PROBE_MODEL = process.env.GEMINI_PROBE_MODEL || "gemini-3.6-flash";
const GROK_PROBE_MODEL = process.env.GROK_PROBE_MODEL || process.env.GROK_MODEL_ID || "openai/gpt-oss-120b";

const TIMEOUT_MS = 15_000;

function collectKeys(prefix, singleVar, disabledVar) {
  const disabled = new Set(
    (process.env[disabledVar] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const numbered = Object.keys(process.env)
    .filter((k) => k.startsWith(prefix) && k !== disabledVar && process.env[k])
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const entries = numbered.map((name) => ({
    name,
    key: process.env[name],
    disabled: disabled.has(name),
  }));

  const single = process.env[singleVar];
  if (single && !entries.some((e) => e.key === single)) {
    entries.push({ name: singleVar, key: single, disabled: disabled.has(singleVar) });
  }

  return entries;
}

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function checkGeminiKey(entry) {
  if (entry.disabled) return { ...entry, status: "SKIPPED", detail: "disabled via env config" };

  const { signal, clear } = withTimeout(null, TIMEOUT_MS);
  try {
    const url = `${GEMINI_API_BASE}/models/${GEMINI_PROBE_MODEL}:generateContent?key=${entry.key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1, temperature: 0 },
      }),
    });
    const json = await res.json().catch(() => ({}));
    clear();

    if (res.ok) return { ...entry, status: "OK", detail: `${res.status}` };

    const msg = (json?.error?.message || `HTTP ${res.status}`).slice(0, 140);
    if (res.status === 429) return { ...entry, status: "QUOTA", detail: msg };
    if (res.status === 403) return { ...entry, status: "INVALID/BLOCKED", detail: msg };
    if (res.status >= 500) return { ...entry, status: "SERVER ERROR", detail: msg };
    return { ...entry, status: "FAILED", detail: msg };
  } catch (err) {
    clear();
    const isAbort = err && err.name === "AbortError";
    return { ...entry, status: isAbort ? "TIMEOUT" : "FAILED", detail: isAbort ? `> ${TIMEOUT_MS}ms` : String(err.message || err) };
  }
}

async function checkGrokKey(entry) {
  if (entry.disabled) return { ...entry, status: "SKIPPED", detail: "disabled via env config" };

  const { signal, clear } = withTimeout(null, TIMEOUT_MS);
  try {
    const res = await fetch(`${GROK_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${entry.key}`,
      },
      signal,
      body: JSON.stringify({
        model: GROK_PROBE_MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0,
      }),
    });
    const json = await res.json().catch(() => ({}));
    clear();

    if (res.ok) return { ...entry, status: "OK", detail: `${res.status}` };

    const msg = (json?.error?.message || `HTTP ${res.status}`).slice(0, 140);
    if (res.status === 429) return { ...entry, status: "QUOTA", detail: msg };
    if (res.status === 401 || res.status === 403) return { ...entry, status: "INVALID", detail: msg };
    if (res.status >= 500) return { ...entry, status: "SERVER ERROR", detail: msg };
    return { ...entry, status: "FAILED", detail: msg };
  } catch (err) {
    clear();
    const isAbort = err && err.name === "AbortError";
    return { ...entry, status: isAbort ? "TIMEOUT" : "FAILED", detail: isAbort ? `> ${TIMEOUT_MS}ms` : String(err.message || err) };
  }
}

function maskKey(key) {
  if (!key || key.length < 8) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function printTable(rows) {
  const headers = ["PROVIDER", "ENV VAR", "KEY", "STATUS", "DETAIL"];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  );
  const line = (cols) => cols.map((c, i) => String(c).padEnd(widths[i])).join("  ");

  console.log(line(headers));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(r));
}

async function main() {
  const geminiEntries = collectKeys("GEMINI_API_KEY_", "GEMINI_API_KEY", "GEMINI_API_KEY_DISABLED");
  const grokEntries = collectKeys("GROK_API_KEY_", "GROK_API_KEY", "GROK_API_KEY_DISABLED");

  if (geminiEntries.length === 0 && grokEntries.length === 0) {
    console.error("No GEMINI_API_KEY* or GROK_API_KEY* environment variables found.");
    process.exit(1);
  }

  console.log(`Checking ${geminiEntries.length} Gemini key(s) and ${grokEntries.length} Grok key(s)...\n`);

  const [geminiResults, grokResults] = await Promise.all([
    Promise.all(geminiEntries.map(checkGeminiKey)),
    Promise.all(grokEntries.map(checkGrokKey)),
  ]);

  const rows = [
    ...geminiResults.map((r) => ["Gemini", r.name, maskKey(r.key), r.status, r.detail]),
    ...grokResults.map((r) => ["Grok", r.name, maskKey(r.key), r.status, r.detail]),
  ];

  printTable(rows);

  const all = [...geminiResults, ...grokResults];
  const healthy = all.filter((r) => r.status === "OK").length;
  const failed = all.filter((r) => r.status !== "OK" && r.status !== "SKIPPED");

  console.log(`\n${healthy}/${all.length} key(s) healthy.`);
  if (failed.length > 0) {
    console.log(`${failed.length} key(s) NOT working — see DETAIL column above.`);
    process.exit(1);
  }
  console.log("All configured keys are working.");
  process.exit(0);
}

main().catch((err) => {
  console.error("check-keys.js crashed:", err);
  process.exit(1);
});
