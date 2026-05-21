// =============================================================================
// RLS test harness — runner, assertions, reporter.
//
// A negative-test harness: it does not trust error codes, it verifies state.
// Supabase RLS denies a SELECT by returning ZERO ROWS (not an error), and a
// blocked write can still appear to "error" while the row was in fact written
// (an INSERT whose WITH CHECK passes but whose RETURNING row fails the SELECT
// policy raises 42501 — see migration 0028). So every write assertion confirms
// the actual persisted state through an operator/service-role client rather
// than reading the attacker's error.
//
// Test categories (the six the brief names, plus the unauthenticated baseline):
//   own        — same user, own resource             (positive)
//   tenant     — same user, another tenant's resource (negative — the core)
//   agency     — cross-agency isolation               (where applicable)
//   workspace  — cross-workspace isolation             (junior-operator scoping)
//   capability — a capability-gated path without the capability
//   service    — service-role bypass (intentional)
//   anon       — unauthenticated access
// =============================================================================

export const CATEGORY = {
  own: 'own-resource access',
  tenant: 'cross-tenant isolation',
  agency: 'cross-agency isolation',
  workspace: 'cross-workspace isolation',
  capability: 'capability-gated access',
  service: 'service-role bypass',
  anon: 'unauthenticated access',
};

export class AssertionError extends Error {}
export class SkipError extends Error {}

export function fail(message) {
  throw new AssertionError(message);
}
export function skip(reason) {
  throw new SkipError(reason);
}

function fmtErr(error) {
  if (!error) return 'no error';
  return `[${error.code || '?'}] ${error.message || String(error)}`;
}

function rowCount(data) {
  if (Array.isArray(data)) return data.length;
  return data ? 1 : 0;
}

// --- SELECT assertions -------------------------------------------------------

// A read that RLS should ALLOW: no error, at least one row.
export function expectVisible(label, result) {
  if (result.error) fail(`${label}: SELECT errored — expected rows — ${fmtErr(result.error)}`);
  if (rowCount(result.data) === 0)
    fail(`${label}: expected the row to be VISIBLE, but RLS returned 0 rows`);
}

// A read that RLS should DENY. RLS hides rows by omission, so "denied" means
// zero rows (an explicit permission error also counts).
export function expectHidden(label, result) {
  if (result.error) return; // a hard permission error is also a valid denial
  const n = rowCount(result.data);
  if (n > 0) fail(`${label}: HOLE — RLS should hide this row but ${n} row(s) leaked`);
}

// --- write assertions --------------------------------------------------------

// A write that RLS should ALLOW.
export function expectWriteOk(label, result) {
  if (result.error)
    fail(`${label}: expected the write to SUCCEED but it was blocked — ${fmtErr(result.error)}`);
}

// A write that RLS should REJECT — the error is informative only. The
// authoritative check is expectAbsent()/expectUnchanged() against real state.
export function expectWriteRejected(label, result) {
  if (!result.error)
    fail(`${label}: expected the write to be REJECTED (no error returned — verify persistence)`);
}

// Authoritative INSERT check: confirm — through a privileged verifier client —
// that NO row with the sentinel value actually reached the table. Any leaked
// rows are deleted before the failure is raised so the harness self-cleans.
export async function expectAbsent(label, verifier, table, column, value) {
  const { data, error } = await verifier.from(table).select('id').eq(column, value);
  if (error) fail(`${label}: could not verify persistence of "${table}" — ${fmtErr(error)}`);
  if (data && data.length > 0) {
    const ids = data.map((r) => r.id).filter(Boolean);
    if (ids.length) await verifier.from(table).delete().in('id', ids);
    fail(
      `${label}: HOLE — ${data.length} row(s) were written to "${table}" ` +
        `despite the cross-tenant RLS boundary (cleaned up)`,
    );
  }
}

// Authoritative INSERT check for a write that SHOULD have persisted.
export async function expectPresent(label, verifier, table, column, value) {
  const { data, error } = await verifier.from(table).select('id').eq(column, value);
  if (error) fail(`${label}: could not verify persistence of "${table}" — ${fmtErr(error)}`);
  if (!data || data.length === 0)
    fail(`${label}: expected the row to be written to "${table}" but it was not`);
}

// Authoritative UPDATE check: confirm a column did NOT take the attacker value.
export async function expectUnchanged(label, verifier, table, id, column, attackerValue) {
  const { data, error } = await verifier.from(table).select(column).eq('id', id).maybeSingle();
  if (error) fail(`${label}: could not verify "${table}" — ${fmtErr(error)}`);
  if (!data) fail(`${label}: verifier could not find row ${id} in "${table}"`);
  if (data[column] === attackerValue)
    fail(`${label}: HOLE — a cross-tenant UPDATE changed "${table}.${column}"`);
}

// Authoritative DELETE check: confirm the row still exists.
export async function expectStillExists(label, verifier, table, id) {
  const { data, error } = await verifier.from(table).select('id').eq('id', id).maybeSingle();
  if (error) fail(`${label}: could not verify "${table}" — ${fmtErr(error)}`);
  if (!data) fail(`${label}: HOLE — a cross-tenant DELETE removed row ${id} from "${table}"`);
}

// --- runner ------------------------------------------------------------------

export function createRegistrar() {
  const tests = [];
  // case(meta, fn) — meta: { table, policy, category, kind, scenario }
  const t = (meta, fn) => tests.push({ meta, fn });
  t.tests = tests;
  return t;
}

export async function runSuites(suites, ctx) {
  const results = [];
  for (const suite of suites) {
    process.stdout.write(`\n  ${suite.name}\n`);
    const t = createRegistrar();
    await suite.register(ctx, t);
    for (const { meta, fn } of t.tests) {
      let status = 'pass';
      let detail = '';
      try {
        await fn();
      } catch (err) {
        if (err instanceof SkipError) {
          status = 'skip';
          detail = err.message;
        } else {
          status = 'fail';
          detail = err.message || String(err);
        }
      }
      results.push({ ...meta, suite: suite.name, status, detail });
      const icon = status === 'pass' ? 'PASS' : status === 'skip' ? 'SKIP' : 'FAIL';
      process.stdout.write(
        `    [${icon}] ${meta.table}.${meta.policy} · ${meta.category} · ${meta.scenario}\n`,
      );
      if (detail) process.stdout.write(`           ${detail}\n`);
    }
  }
  return results;
}

// --- reporter ----------------------------------------------------------------

export function report(results) {
  const total = results.length;
  const failed = results.filter((r) => r.status === 'fail');
  const skipped = results.filter((r) => r.status === 'skip');
  const passed = total - failed.length - skipped.length;

  process.stdout.write('\n  ' + '='.repeat(72) + '\n');
  process.stdout.write('  Coverage by category (positive = access works · negative = RLS blocks)\n');
  process.stdout.write('  ' + '-'.repeat(72) + '\n');
  for (const [key, label] of Object.entries(CATEGORY)) {
    const inCat = results.filter((r) => r.category === key);
    if (inCat.length === 0) continue;
    const pos = inCat.filter((r) => r.kind === 'positive' && r.status !== 'skip').length;
    const neg = inCat.filter((r) => r.kind === 'negative' && r.status !== 'skip').length;
    const f = inCat.filter((r) => r.status === 'fail').length;
    const s = inCat.filter((r) => r.status === 'skip').length;
    const warn = pos === 0 || neg === 0 ? '  <-- missing a positive or negative assertion' : '';
    process.stdout.write(
      `  ${label.padEnd(26)} ${String(inCat.length).padStart(3)} tests · ` +
        `${pos} positive · ${neg} negative · ${f} fail · ${s} skip${warn}\n`,
    );
  }
  process.stdout.write('  ' + '-'.repeat(72) + '\n');

  if (failed.length) {
    process.stdout.write(`\n  ${failed.length} FAILURE(S):\n`);
    for (const r of failed) {
      process.stdout.write(`    ✗ ${r.table}.${r.policy} · ${r.category} · ${r.scenario}\n`);
      process.stdout.write(`      ${r.detail}\n`);
    }
  }

  process.stdout.write(
    `\n  TOTAL: ${total}   PASS: ${passed}   FAIL: ${failed.length}   SKIP: ${skipped.length}\n`,
  );
  process.stdout.write('  ' + '='.repeat(72) + '\n\n');
  return failed.length === 0;
}
