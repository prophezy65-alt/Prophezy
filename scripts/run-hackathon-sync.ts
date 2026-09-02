/**
 * scripts/run-hackathon-sync.ts
 *
 * CLI entrypoint for the hackathon aggregation engine. Thin wrapper only —
 * all real logic lives in lib/hackathons/engine/jobs/sync.job.ts and the
 * services it composes. This file exists so GitHub Actions (and a local
 * `npx tsx scripts/run-hackathon-sync.ts ...`) have something to invoke.
 *
 * --------------------------------------------------------------------------
 * ENV LOADING — mirrors scripts/run-sync.ts's pattern exactly, same reason
 * --------------------------------------------------------------------------
 * The hackathon engine reuses lib/internships/utils/logger.ts and
 * lib/internships/db/client.ts directly (see lib/hackathons/engine/'s own
 * README — "reuse, don't duplicate"). Both may read process.env at module
 * evaluation time, not lazily inside a function. Static `import`
 * declarations are hoisted and evaluated before any of THIS file's own
 * top-level code runs — so if the lib/hackathons/engine import were static
 * and placed at the top of this file, it would still execute before any
 * env-loading logic below it, for the same reason run-sync.ts's own header
 * comment explains in detail. The fix is identical: load .env ourselves,
 * synchronously, as the very first statement in this file, then use
 * DYNAMIC `await import(...)` inside main() for everything from
 * lib/hackathons/* (and anything it transitively imports from
 * lib/internships/*) — so no module that might read process.env at
 * top-level is evaluated until loadEnv() has already run to completion.
 *
 * Usage:
 *   npx tsx scripts/run-hackathon-sync.ts sync                       # incremental sync, all implemented providers
 *   npx tsx scripts/run-hackathon-sync.ts sync --full                # full re-sync (ignores last-successful-sync cursor)
 *   npx tsx scripts/run-hackathon-sync.ts sync --providers=devpost,github_events
 *   npx tsx scripts/run-hackathon-sync.ts health                     # probe every registered provider (real + stub)
 *
 * No `notify` command — the hackathon engine doesn't have a notification-
 * job service (unlike the internship engine's runNotificationJob). If you
 * add one later, follow the same "command" case pattern below.
 */

export {};

/**
 * Loads .env into process.env, synchronously, before any other module in
 * this process is imported. Safe to call in CI (GitHub Actions) where no
 * .env file exists — secrets are already real env vars there — so a
 * missing file is not an error. Identical logic to run-sync.ts's loadEnv();
 * duplicated rather than imported from that file because importing
 * anything from scripts/run-sync.ts would itself trigger Node to evaluate
 * that file's own top-level code (including its loadEnv() call using ITS
 * default 'ENV_FILE'/'.env' resolution) before this script's argv-based
 * command dispatch even starts — two independent CLI entry points should
 * not have a runtime import dependency on each other regardless.
 */
function loadEnv(): void {
  const path = process.env.ENV_FILE ?? '.env';
  try {
    process.loadEnvFile(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      // No .env file — expected in CI, where secrets come from the environment directly.
      return;
    }
    throw error;
  }
}

loadEnv();

async function main(): Promise<void> {
  // Deliberately dynamic: these imports (and everything they transitively
  // import — including lib/internships/utils/logger.ts and
  // lib/internships/db/client.ts, reused directly by the hackathon engine)
  // must not be evaluated until loadEnv() above has already populated
  // process.env. See the file header for why.
  const { runHackathonSync, runHackathonHealthCheck } = await import('../lib/hackathons/engine/jobs/sync.job');
  const { createLogger } = await import('../lib/internships/utils/logger');

  const log = createLogger('hackathons.cli');

  function flag(name: string): string | undefined {
    const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : undefined;
  }

  function has(name: string): boolean {
    return process.argv.includes(`--${name}`);
  }

  const command = process.argv[2];

  switch (command) {
    case 'sync': {
      const providersArg = flag('providers');
      const summary = await runHackathonSync({
        mode: has('full') ? 'full' : 'incremental',
        only: providersArg ? providersArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });

      log.info('hackathon sync summary', {
        runId: summary.runId,
        mode: summary.mode,
        providersRun: summary.results.length,
        providersFailed: summary.totalFailed,
        totalInserted: summary.totalInserted,
        totalUpdated: summary.totalUpdated,
        totalDuplicates: summary.totalDuplicates,
      });

      for (const result of summary.results) {
        const statusLabel = result.status === 'success' && result.warnings.length > 0 ? 'partial' : result.status;
        // eslint-disable-next-line no-console
        console.log(
          `  [${statusLabel}] ${result.provider}: fetched=${result.fetched} normalized=${result.normalized} ` +
            `duplicates=${result.duplicates} inserted=${result.inserted} (${result.durationMs}ms)`,
        );
        if (result.error) console.log(`      error: ${result.error}`);
        result.warnings.forEach((w) => console.log(`      warning: ${w}`));
      }

      if (summary.totalFailed > 0) {
        log.error('one or more providers failed this run', { providersFailed: summary.totalFailed });
        process.exitCode = 1;
      }
      break;
    }

    case 'health': {
      const health = await runHackathonHealthCheck();
      log.info('hackathon provider health', { checkedAt: new Date().toISOString() });

      for (const h of health) {
        // eslint-disable-next-line no-console
        console.log(`  [${h.status}] ${h.key}${h.latencyMs !== undefined ? ` (${h.latencyMs}ms)` : ''}${h.message ? ` — ${h.message}` : ''}`);
      }

      const anyRealProviderDown = health.some((h) => h.status === 'down');
      if (anyRealProviderDown) {
        log.error('one or more implemented providers are down');
        process.exitCode = 1;
      }
      break;
    }

    default: {
      console.error('Usage: tsx scripts/run-hackathon-sync.ts <sync|health> [--full] [--providers=a,b]');
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('run-hackathon-sync crashed:', (error as Error).message, (error as Error).stack);
  process.exitCode = 1;
});
