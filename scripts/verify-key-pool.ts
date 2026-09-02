/**
 * scripts/verify-key-pool.ts
 *
 * Unlike diagnose-gemini-keys.ts (which re-implements the discovery logic
 * to test credentials directly against Google), this script imports and
 * calls the REAL production module — lib/ai/config/key-manager.ts — so the
 * numbers it prints are not "should be 15", they're what the actual pool
 * client.ts/generate()/streamGenerate()/embed() will use for the next
 * request, right now, in this process.
 *
 * Does not send any request to Google — it only exercises key discovery,
 * filtering (GEMINI_API_KEY_DISABLED), and the health-snapshot function
 * that already exists for Settings > AI Health Monitor.
 *
 * Run:  npx tsx scripts/verify-key-pool.ts
 *
 * Prerequisite: add the two confirmed-blocked keys to .env (see the chat
 * response for why these two specifically):
 *   GEMINI_API_KEY_DISABLED=GEMINI_API_KEY_5,GEMINI_API_KEY_18
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

async function main() {
  // How many credentials are actually present in .env, before any
  // filtering — for the "configured: N" line. Purely a count of what's
  // present; the real pool composition below comes from the production
  // module itself, not from re-deriving it here.
  const KEY_PREFIX = "GEMINI_API_KEY_";
  const SINGLE_KEY_VAR = "GEMINI_API_KEY";
  const DISABLED_KEYS_VAR = "GEMINI_API_KEY_DISABLED";

  const numbered = Object.keys(process.env).filter(
    (k) => k.startsWith(KEY_PREFIX) && k !== DISABLED_KEYS_VAR && process.env[k]
  );
  const hasSingle = Boolean(process.env[SINGLE_KEY_VAR]);
  const configuredCount = numbered.length + (hasSingle ? 1 : 0);

  const disabledVarNames = (process.env[DISABLED_KEYS_VAR] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  // Import the REAL production module. Path is relative to this file
  // (scripts/verify-key-pool.ts -> lib/ai/config/key-manager.ts).
  const keyManager = await import("../lib/ai/config/key-manager");

  const usable = keyManager.keyCount();
  const snapshot = keyManager.getKeySnapshot();
  const order = keyManager.getKeyOrder();

  console.log("=== Production key-manager pool (live, from lib/ai/config/key-manager.ts) ===\n");
  console.log(`configured: ${configuredCount}`);
  console.log(`usable:     ${usable}`);
  console.log(`blocked:    ${disabledVarNames.length}${disabledVarNames.length ? `  (${disabledVarNames.join(", ")})` : ""}\n`);

  if (configuredCount - disabledVarNames.length !== usable) {
    console.warn(
      `WARNING: configured (${configuredCount}) - blocked (${disabledVarNames.length}) = ` +
        `${configuredCount - disabledVarNames.length}, but the production pool loaded ${usable}. ` +
        "This usually means a name in GEMINI_API_KEY_DISABLED doesn't exactly match a variable " +
        "name in .env (check for typos/whitespace), or a duplicate key value was de-duplicated."
    );
  } else {
    console.log(`Confirmed: the production key manager currently sees exactly ${usable} usable credentials.\n`);
  }

  console.log("Per-key snapshot (never prints key material, only labels — same shape used by Settings > AI Health Monitor):");
  for (const key of snapshot) {
    console.log(
      `  ${key.label.padEnd(8)} status=${key.status}${key.isPreferred ? "  (preferred)" : ""}` +
        (key.lastFailureReason ? `  lastFailure=${key.lastFailureReason}` : "")
    );
  }

  console.log(`\nNext request will try keys in this order: ${order.map((k) => `#${k.index + 1}`).join(", ") || "(pool is empty)"}`);

  if (disabledVarNames.length === 0) {
    console.log(
      "\nNote: GEMINI_API_KEY_DISABLED is not set. If GEMINI_API_KEY_5 and GEMINI_API_KEY_18 are " +
        "still project-denied, add GEMINI_API_KEY_DISABLED=GEMINI_API_KEY_5,GEMINI_API_KEY_18 to " +
        ".env and re-run this script."
    );
  }
}

main();
