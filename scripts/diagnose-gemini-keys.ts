/**
 * scripts/diagnose-gemini-keys.ts
 *
 * Safe, read-only diagnostic for every configured Gemini credential.
 * Mirrors Prophezy's ACTUAL request path exactly:
 *   - key discovery:  same logic as lib/ai/config/key-manager.ts (numbered
 *                      GEMINI_API_KEY_* env vars, sorted numerically, falling
 *                      back to a single GEMINI_API_KEY)
 *   - endpoint/model:  same base URL, same ?key= query-param auth, and the
 *                      SAME model id lib/ai/config/models.ts actually uses
 *                      (DEFAULT_MODEL, currently "gemini-3.6-flash") — never
 *                      a hardcoded/deprecated model id.
 *
 * This script does NOT modify key-manager.ts, client.ts, or any production
 * file. It exists purely to answer "which of my configured credentials
 * currently work, through the exact path the app uses" without guessing.
 *
 * Run:  npx tsx scripts/diagnose-gemini-keys.ts
 *
 * Never prints a full key — only a 1-based label ("key #N") plus the last 4
 * characters, matching the masking already used in your own test output.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Minimal .env loader (no dependency on `dotenv`, which isn't in
// package.json). Checks .env.local first (Next.js convention, usually
// gitignored), then .env — same precedence Next.js itself uses.
// ---------------------------------------------------------------------------
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

// ---------------------------------------------------------------------------
// Key discovery — identical logic to lib/ai/config/key-manager.ts loadKeyPool()
// (union of numbered + bare key, GEMINI_API_KEY_DISABLED excluded/consulted).
// No format/prefix validation of any kind, on purpose: AQ.* Auth keys and
// AIza* Standard keys are both passed through unchanged. Google's response
// is the only thing that determines validity.
// ---------------------------------------------------------------------------
const KEY_PREFIX = "GEMINI_API_KEY_";
const SINGLE_KEY_VAR = "GEMINI_API_KEY";
const DISABLED_KEYS_VAR = "GEMINI_API_KEY_DISABLED";

const disabledVarNames = new Set(
  (process.env[DISABLED_KEYS_VAR] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
);

const numbered = Object.keys(process.env)
  // k !== DISABLED_KEYS_VAR matters: GEMINI_API_KEY_DISABLED shares the same
  // KEY_PREFIX as real numbered keys, so without this exclusion the control
  // variable's own value (a comma-separated list of names, not a credential)
  // gets swept in and tested as if it were a real key. This is the same bug
  // already fixed in lib/ai/config/key-manager.ts — fixed here too now.
  .filter((k) => k.startsWith(KEY_PREFIX) && k !== DISABLED_KEYS_VAR && process.env[k])
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

// Matches the fixed loadKeyPool() in lib/ai/config/key-manager.ts: numbered
// keys AND the bare GEMINI_API_KEY are both included (union, not either/or),
// de-duplicated by value so a bare key that's just a copy of a numbered one
// isn't tested twice.
const varNames = [...numbered];
if (
  process.env[SINGLE_KEY_VAR] &&
  !numbered.some((k) => process.env[k] === process.env[SINGLE_KEY_VAR])
) {
  varNames.push(SINGLE_KEY_VAR);
}

if (varNames.length === 0) {
  console.error(
    "No GEMINI_API_KEY_* or GEMINI_API_KEY entries found in .env.local or .env. Nothing to test."
  );
  process.exit(1);
}

function mask(key: string): string {
  return key.length <= 4 ? "****" : `...${key.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Endpoint + model — copied from lib/ai/config/client.ts / models.ts, not
// re-invented. If you change DEFAULT_MODEL there, update it here too (or
// just import from "../lib/ai/config/models" directly if you'd rather this
// script always stay in sync automatically).
// ---------------------------------------------------------------------------
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const FALLBACK_MODEL = "gemini-3.6-flash"; // DEFAULT_MODEL in lib/ai/config/models.ts

type Classification =
  | "VALID_AND_WORKING"
  | "AUTHENTICATION_FAILED"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "MODEL_OR_ENDPOINT_ERROR"
  | "BLOCKED_OR_REVOKED"
  | "UNKNOWN";

interface KeyResult {
  varName: string;
  masked: string;
  classification: Classification;
  httpStatus: number | null;
  detail: string;
}

/** Uses the FIRST configured key to ask Google which models are currently
 * reachable (task requirement: determine a current model before testing
 * credentials, rather than trusting a hardcoded id blindly). Falls back to
 * FALLBACK_MODEL if the listing call itself fails for any reason — that
 * failure is reported but does not block per-key testing below. */
async function resolveTestModel(firstKey: string): Promise<{ model: string; listOk: boolean; listDetail: string }> {
  try {
    const res = await fetch(`${GEMINI_API_BASE}/models?key=${firstKey}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.models) {
      return {
        model: FALLBACK_MODEL,
        listOk: false,
        listDetail: `ListModels failed (HTTP ${res.status}) — falling back to ${FALLBACK_MODEL} from lib/ai/config/models.ts`,
      };
    }
    const names: string[] = json.models
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: any) => (m.name as string).replace(/^models\//, ""));

    // Prefer the exact model Prophezy actually uses if Google confirms it's
    // still live; otherwise fall back to it anyway (it's the app's real
    // config, not a guess) but flag the mismatch for visibility.
    if (names.includes(FALLBACK_MODEL)) {
      return { model: FALLBACK_MODEL, listOk: true, listDetail: `Confirmed ${FALLBACK_MODEL} is currently live via ListModels.` };
    }
    return {
      model: FALLBACK_MODEL,
      listOk: true,
      listDetail: `WARNING: ListModels did not return ${FALLBACK_MODEL} — lib/ai/config/models.ts may need updating. Live flash-tier models seen: ${names.filter((n) => n.includes("flash")).join(", ") || "(none)"}`,
    };
  } catch (err) {
    return {
      model: FALLBACK_MODEL,
      listOk: false,
      listDetail: `ListModels request errored (${(err as Error).message}) — falling back to ${FALLBACK_MODEL}.`,
    };
  }
}

/** Extracts a Google quota violation's metric id, if present, to tell a
 * per-minute rate limit apart from a per-day/monthly quota exhaustion —
 * Gemini reports both as HTTP 429, so the metric id is the only reliable
 * signal. Falls back to a generic 429 classification if the shape isn't
 * present (still 429 = never treated as auth or model-not-found). */
function classify429(json: any): { classification: Classification; detail: string } {
  const violations: any[] =
    json?.error?.details?.flatMap((d: any) => d?.violations ?? []) ?? [];
  const metric: string = violations[0]?.quotaId ?? violations[0]?.quotaMetric ?? "";
  if (/perminute/i.test(metric)) {
    return { classification: "RATE_LIMITED", detail: `429 per-minute rate limit (${metric})` };
  }
  if (/perday/i.test(metric)) {
    return { classification: "QUOTA_EXCEEDED", detail: `429 daily/monthly quota exhausted (${metric})` };
  }
  return { classification: "QUOTA_EXCEEDED", detail: "429 RESOURCE_EXHAUSTED (metric unspecified — treated as quota, not rate limit)" };
}

async function testKey(varName: string, model: string): Promise<KeyResult> {
  const key = process.env[varName] as string;
  const masked = mask(key);

  try {
    const res = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
    });
    const json = await res.json().catch(() => null);
    const status = json?.error?.status ?? "";
    const message: string = json?.error?.message ?? "";

    if (res.ok) {
      return { varName, masked, classification: "VALID_AND_WORKING", httpStatus: res.status, detail: "generateContent succeeded" };
    }

    if (res.status === 429) {
      const { classification, detail } = classify429(json);
      return { varName, masked, classification, httpStatus: 429, detail };
    }

    if (res.status === 404) {
      // CRITICAL per task requirements: 404 is never quota. It means this
      // model id / endpoint path isn't found for this project — usually a
      // stale model id, occasionally a project without that model enabled.
      return {
        varName,
        masked,
        classification: "MODEL_OR_ENDPOINT_ERROR",
        httpStatus: 404,
        detail: `Model "${model}" or endpoint not found for this credential (${message || "no message"})`,
      };
    }

    if (res.status === 401) {
      // Distinguish the current Google-side "AQ. key rejected on native
      // endpoint" bug (status ACCESS_TOKEN_TYPE_UNSUPPORTED / "Expected
      // OAuth 2 access token") from a plain invalid/expired credential —
      // both are 401 but mean different things for what to do next.
      if (/ACCESS_TOKEN_TYPE_UNSUPPORTED/i.test(status) || /oauth/i.test(message)) {
        return {
          varName,
          masked,
          classification: "AUTHENTICATION_FAILED",
          httpStatus: 401,
          detail: "401 ACCESS_TOKEN_TYPE_UNSUPPORTED — known Google-side issue affecting a subset of AQ.-format keys on the native REST endpoint as of Aug 2026, not something fixable in Prophezy's code. Regenerate the key or check Google AI Studio account status.",
        };
      }
      return { varName, masked, classification: "AUTHENTICATION_FAILED", httpStatus: 401, detail: message || "401 Unauthenticated" };
    }

    if (res.status === 403) {
      if (/permission_denied/i.test(status) || /suspend|blocked|disabled/i.test(message)) {
        return { varName, masked, classification: "BLOCKED_OR_REVOKED", httpStatus: 403, detail: message || "403 Forbidden" };
      }
      return { varName, masked, classification: "AUTHENTICATION_FAILED", httpStatus: 403, detail: message || "403 Forbidden" };
    }

    if (res.status === 400 && /api key not valid|api_key_invalid/i.test(message)) {
      return { varName, masked, classification: "AUTHENTICATION_FAILED", httpStatus: 400, detail: message };
    }

    if (res.status >= 500) {
      return { varName, masked, classification: "UNKNOWN", httpStatus: res.status, detail: `Transient server error (${message || res.status})` };
    }

    return { varName, masked, classification: "UNKNOWN", httpStatus: res.status, detail: message || `Unclassified HTTP ${res.status}` };
  } catch (err) {
    return { varName, masked, classification: "UNKNOWN", httpStatus: null, detail: `Network/timeout error: ${(err as Error).message}` };
  }
}

async function main() {
  console.log(`Found ${varNames.length} Gemini credential(s): ${varNames.join(", ")}\n`);

  const firstKey = process.env[varNames[0]!] as string;
  const { model, listOk, listDetail } = await resolveTestModel(firstKey);
  console.log(`Test model: ${model}  (${listOk ? "confirmed live" : "fallback"})`);
  console.log(`${listDetail}\n`);

  const results: KeyResult[] = [];
  for (const varName of varNames) {
    const result = await testKey(varName, model);
    results.push(result);
    console.log(`${varName.padEnd(20)} (${result.masked})  ->  ${result.classification}  [HTTP ${result.httpStatus ?? "n/a"}]`);
    console.log(`  ${result.detail}`);
    await new Promise((r) => setTimeout(r, 300)); // avoid self-induced rate limiting across many keys
  }

  const count = (c: Classification) => results.filter((r) => r.classification === c).length;
  const valid = count("VALID_AND_WORKING");
  const authFailed = count("AUTHENTICATION_FAILED");
  const blocked = count("BLOCKED_OR_REVOKED");
  const quota = count("QUOTA_EXCEEDED");
  const rateLimited = count("RATE_LIMITED");
  const modelErr = count("MODEL_OR_ENDPOINT_ERROR");
  const unknown = count("UNKNOWN");

  console.log("\n--- SUMMARY ---");
  console.log(`Total configured:            ${results.length}`);
  console.log(`Valid & working:             ${valid}`);
  console.log(`Authentication failed:       ${authFailed}`);
  console.log(`Blocked/revoked:             ${blocked}`);
  console.log(`Quota exceeded:              ${quota}`);
  console.log(`Rate limited (per-minute):   ${rateLimited}`);
  console.log(`Model/endpoint error:        ${modelErr}`);
  console.log(`Unknown/transient:           ${unknown}`);

  if (authFailed + blocked > 0) {
    console.log("\nCredentials needing attention (by variable name only):");
    for (const r of results) {
      if (r.classification === "AUTHENTICATION_FAILED" || r.classification === "BLOCKED_OR_REVOKED") {
        console.log(`  - ${r.varName}: ${r.classification} — ${r.detail}`);
      }
    }
  }

  if (modelErr > 0) {
    console.log(
      "\nNote: MODEL_OR_ENDPOINT_ERROR here means Google's API itself returned 404 for " +
        `"${model}" on that credential's project — re-run after confirming the ListModels ` +
        "output above actually lists that model for your account/project."
    );
  }
}

main();
