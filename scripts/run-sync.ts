/**
 * CLI entrypoint for the internship sync engine.
 *
 * Thin wrapper only — all real logic lives in lib/internships/jobs and
 * lib/internships/services. This file exists so GitHub Actions (and local
 * `npm run internships:*` scripts) have something to invoke.
 *
 * --------------------------------------------------------------------------
 * ENV LOADING — READ THIS BEFORE TOUCHING THE IMPORTS BELOW
 * --------------------------------------------------------------------------
 * This file used to rely on `tsx --env-file=.env` (an npm-script flag) to
 * populate process.env before anything ran. That flag is forwarded to Node
 * by tsx's own CLI, which is a mechanism this script has no control over and
 * cannot verify at runtime — if tsx (a particular version, a particular OS's
 * shell, a stale global install shadowing the local one, etc.) fails to
 * forward it for any reason, Node never reads .env, process.env silently
 * stays exactly as the parent shell's environment, and every
 * `process.env.SUPABASE_...` read later on correctly returns undefined —
 * which is exactly the "values exist in .env but are undefined at runtime"
 * symptom this file was rewritten to fix.
 *
 * The fix: load .env ourselves, synchronously, as the very first statement
 * in this file — before importing anything from lib/internships/* — using
 * Node's own zero-dependency `process.loadEnvFile()` (stable since Node 20.12
 * / 21.7; this repo already requires Node 20+). Static `import` declarations
 * are hoisted and evaluated before any of a module's own top-level code, so
 * putting env-loading logic at the "top" of the file textually would NOT
 * guarantee it runs before an imported module's top-level code (e.g.
 * lib/internships/utils/logger.ts reads process.env.INTERNSHIP_LOG_LEVEL at
 * module-eval time, not lazily). To make the ordering actually true, the
 * lib/internships imports below are dynamic (`await import(...)`) and only
 * happen inside main(), after loadEnv() has already run to completion.
 *
 * The old `--env-file=.env` flag has been removed from the npm scripts in
 * package.json — it's now redundant and was the actual point of failure.
 * --------------------------------------------------------------------------
 *
 * Usage:
 *   tsx scripts/run-sync.ts sync                 # incremental sync, all configured providers
 *   tsx scripts/run-sync.ts sync --full           # full re-sync (ignores last-synced cursor)
 *   tsx scripts/run-sync.ts sync --providers=greenhouse,lever
 *   tsx scripts/run-sync.ts health                # probe every registered provider
 *   tsx scripts/run-sync.ts notify --job=daily
 *   tsx scripts/run-sync.ts notify --job=deadlines
 */

/**
 * Loads .env into process.env, synchronously, before any other module in
 * this process is imported. Safe to call in CI (GitHub Actions) where no
 * .env file exists — secrets are already real env vars there — so a missing
 * file is not an error.
 */
function loadEnv(): void {
  const path = process.env.ENV_FILE ?? '.env';
  try {
    // @ts-expect-error — process.loadEnvFile exists at runtime (Node 20.12+ / 21.7+)
    // but may not yet be in the @types/node version pinned by this repo.
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
  // import, including the Supabase client and the logger) must not be
  // evaluated until loadEnv() above has already populated process.env.
  const { runScheduledSync, runHealthSweep, runNotificationJob } = await import('../lib/internships/jobs');
  const { createLogger } = await import('../lib/internships/utils/logger');
  type NotificationJob = Parameters<typeof runNotificationJob>[0];

  const log = createLogger('internships.cli');

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
      const summary = await runScheduledSync({
        full: has('full'),
        providers: providersArg ? providersArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });

      log.info('sync summary', {
        runId: summary.runId,
        providersRun: summary.providersRun,
        providersFailed: summary.providersFailed,
        totalFetched: summary.totalFetched,
        totalPersisted: summary.totalPersisted,
        totalDuplicates: summary.totalDuplicates,
        expiredClosed: summary.expiredClosed,
        staleClosed: summary.staleClosed,
      });

      for (const outcome of summary.outcomes) {
        const status = outcome.warnings.length > 0 ? 'partial' : 'ok';
        // eslint-disable-next-line no-console
        console.log(
          `  [${status}] ${outcome.provider}: fetched=${outcome.fetched} normalized=${outcome.normalized} ` +
            `duplicates=${outcome.duplicates} persisted=${outcome.persisted} (${outcome.durationMs}ms)`,
        );
        outcome.warnings.forEach((w) => console.log(`      warning: ${w}`));
      }

      if (summary.providersFailed > 0) {
        log.error('one or more providers failed this run', { providersFailed: summary.providersFailed });
        process.exitCode = 1;
      }
      break;
    }

    case 'health': {
      await runHealthSweep();
      break;
    }

    case 'notify': {
      const job = flag('job') as NotificationJob | undefined;
      if (!job) {
        log.error('notify requires --job=daily|weekly|alerts|deadlines');
        process.exitCode = 1;
        return;
      }
      const summary = await runNotificationJob(job);
      log.info('notification summary', { job, ...summary });
      break;
    }

    default: {
      console.error(
        'Usage: tsx scripts/run-sync.ts <sync|health|notify> [--full] [--providers=a,b] [--job=daily]',
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('run-sync crashed:', (error as Error).message, (error as Error).stack);
  process.exitCode = 1;
});
