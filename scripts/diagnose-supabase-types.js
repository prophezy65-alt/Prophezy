#!/usr/bin/env node
/**
 * Diagnose why `profile.full_name` is typed `never`.
 *
 * Run from the repo root:  node diagnose-supabase-types.js
 *
 * The cause is almost always an INSTALLED @supabase/ssr in the 0.5.x range,
 * regardless of what package.json declares. This checks the real state.
 */
const fs = require("fs");
const path = require("path");

function read(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}
function ok(m) { console.log("  \u2705 " + m); }
function bad(m) { console.log("  \u274C " + m); }
function info(m) { console.log("     " + m); }

console.log("\n=== Supabase type-flow diagnostic ===\n");

let fail = false;

// 1 — declared vs installed -------------------------------------------------
console.log("[1] @supabase/ssr — declared vs INSTALLED");
const pkg = read("package.json");
const declared = pkg?.dependencies?.["@supabase/ssr"] ?? "(absent)";
let installed = null;
try {
  installed = read(require.resolve("@supabase/ssr/package.json"))?.version;
} catch { /* not installed */ }

info(`declared in package.json : ${declared}`);
info(`actually installed       : ${installed ?? "(not installed)"}`);

const major = installed ? installed.split(".").map(Number) : null;
const isOld = major && major[0] === 0 && major[1] < 12;

if (!installed) { bad("@supabase/ssr is not installed. Run: npm install"); fail = true; }
else if (isOld) {
  bad(`Installed ${installed} is the BROKEN range (< 0.12).`);
  info("This is the cause. package.json was edited but node_modules was not updated.");
  info("Fix:");
  info("  rm -rf node_modules package-lock.json");
  info("  npm install --legacy-peer-deps");
  fail = true;
} else ok(`Installed ${installed} is correct (>= 0.12).`);

// 2 — lockfile pinning ------------------------------------------------------
console.log("\n[2] Lockfile pinning");
const lock = read("package-lock.json");
if (!lock) info("no package-lock.json present");
else {
  const entries = Object.entries(lock.packages || {})
    .filter(([k]) => k.endsWith("node_modules/@supabase/ssr"));
  if (!entries.length) info("no @supabase/ssr entry in lockfile");
  else entries.forEach(([k, v]) => {
    const stale = v.version && Number(v.version.split(".")[1]) < 12
                  && v.version.startsWith("0.");
    (stale ? bad : ok)(`${k} -> ${v.version}`);
    if (stale) {
      fail = true;
      info("Lockfile pins the broken version. `npm ci` will reinstall it.");
      info("Delete package-lock.json and reinstall.");
    }
  });
}

// 3 — supabase-js version ---------------------------------------------------
console.log("\n[3] @supabase/supabase-js");
let sjs = null;
try { sjs = read(require.resolve("@supabase/supabase-js/package.json"))?.version; } catch {}
info(`installed: ${sjs ?? "(not installed)"}`);
if (sjs) {
  const [maj, min] = sjs.split(".").map(Number);
  if (maj === 2 && min >= 100) {
    ok("2.100+ — requires @supabase/ssr >= 0.12 for generics to flow.");
  } else info("older supabase-js; generic mismatch may not apply.");
}

// 4 — Database generic actually passed --------------------------------------
console.log("\n[4] Database generic in lib/supabase/server.ts");
const serverPath = path.join("lib", "supabase", "server.ts");
if (!fs.existsSync(serverPath)) { bad("lib/supabase/server.ts not found"); fail = true; }
else {
  const src = fs.readFileSync(serverPath, "utf8");
  if (/createServerClient<\s*Database\s*>/.test(src)) ok("createServerClient<Database>() — generic present");
  else { bad("Database generic NOT passed to createServerClient"); fail = true; }
  if (/import\s+type\s*\{\s*Database\s*\}/.test(src)) ok("Database type imported");
  else { bad("Database type not imported"); fail = true; }
}

// 5 — generated types content ----------------------------------------------
console.log("\n[5] lib/supabase/types.ts");
const typesPath = path.join("lib", "supabase", "types.ts");
if (!fs.existsSync(typesPath)) { bad("types.ts missing"); fail = true; }
else {
  const t = fs.readFileSync(typesPath, "utf8");
  const tables = (t.match(/^ {6}[a-z_]+: \{$/gm) || []).length;
  info(`table entries: ${tables}`);
  if (tables < 10) { bad("Looks like the OLD 3-table stub — copy the generated types.ts."); fail = true; }
  else ok("generated types present");
  /full_name/.test(t) ? ok("profiles.full_name defined") : bad("full_name missing");
  /__InternalSupabase/.test(t)
    ? ok("__InternalSupabase present (required by postgrest-js 2.x)")
    : bad("__InternalSupabase missing — queries resolve to never");
  /plan_tier/.test(t) ? ok("subscriptions.plan_tier present") : info("plan_tier not found");
}

console.log("\n=== " + (fail ? "PROBLEM FOUND (see \u274C above)" : "All checks passed") + " ===\n");
process.exit(fail ? 1 : 0);
