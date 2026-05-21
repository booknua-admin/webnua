// =============================================================================
// RLS cross-tenant test harness — entry point.
//
// Run with:  pnpm test:rls   (or  npm run test:rls  /  node tests/rls/run.mjs)
//
// Signs in as the seeded test users, seeds a disposable fixture in every
// tenant-scoped table for two tenants, runs the negative-test suites, prints a
// grouped pass/fail report, tears the fixture down, and exits non-zero if any
// scenario failed. See reference/rls-test-suite.md.
// =============================================================================

import { loadConfig } from './lib/env.mjs';
import { buildContext } from './lib/context.mjs';
import { runSuites, report } from './lib/harness.mjs';

import anonymous from './suites/anonymous.mjs';
import identity from './suites/identity.mjs';
import agency from './suites/agency.mjs';
import operational from './suites/operational.mjs';
import builder from './suites/builder.mjs';
import isolation from './suites/isolation.mjs';

const SUITES = [anonymous, identity, agency, operational, builder, isolation];

async function main() {
  process.stdout.write('\n  Webnua — RLS cross-tenant validation harness\n');
  process.stdout.write('  ' + '='.repeat(72) + '\n\n');

  const cfg = loadConfig();
  process.stdout.write(`  Project: ${cfg.url}\n`);

  const ctx = await buildContext(cfg);

  let ok = false;
  try {
    const results = await runSuites(SUITES, ctx);
    ok = report(results);
  } finally {
    process.stdout.write('  Tearing down disposable fixtures...\n');
    try {
      await ctx.teardown();
    } catch (err) {
      process.stdout.write(`  WARNING: teardown incomplete — ${err.message}\n`);
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`\n  RLS harness aborted: ${err.message}\n\n`);
  process.exit(1);
});
