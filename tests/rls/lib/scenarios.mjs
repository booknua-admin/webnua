// =============================================================================
// RLS test harness — reusable scenario builders.
//
// Most tenant-scoped tables share one shape, so two builders emit the standard
// cross-tenant matrix for them. The attacker is always `mark` (a Voltline
// client); the victim tenant is always FreshHome. accessible_client_ids() is
// symmetric, so one direction is representative — the suites add a couple of
// reverse-direction spot checks for defence in depth.
//
// Every probe row carries a harness-generated id, so persistence is verified
// by primary key — never by INSERT...RETURNING, which is itself subject to the
// SELECT policy (see migration 0028).
// =============================================================================

import { randomUUID } from 'node:crypto';
import {
  expectVisible,
  expectHidden,
  expectAbsent,
  expectPresent,
  expectUnchanged,
  expectStillExists,
  expectWriteOk,
} from './harness.mjs';

// Standard matrix for a table with a direct client_id column.
//   opts.table          — table name
//   opts.policy         — policy family name (for reporting)
//   opts.key            — fixture key (ctx.fixture.<tenant>[key])
//   opts.buildRow       — (clientId, id) => a full row object including `id`
//   opts.updateColumn   — a harmless text column the update test mutates
//   opts.clientWritable — false for operator-only-write tables (websites/funnels)
export function clientScoped(t, ctx, opts) {
  const { table, policy, key, buildRow, updateColumn, clientWritable = true } = opts;
  const mark = ctx.clients.mark;
  const op = ctx.operator;
  const voltRow = ctx.fixture.voltline[key];
  const freshRow = ctx.fixture.freshhome[key];

  t(
    { table, policy: `${policy}_select`, category: 'own', kind: 'positive', scenario: 'client reads a row in its own tenant' }, // prettier-ignore
    async () => expectVisible('own read', await mark.from(table).select('*').eq('id', voltRow)),
  );
  t(
    { table, policy: `${policy}_select`, category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant row' }, // prettier-ignore
    async () => expectHidden('cross read', await mark.from(table).select('*').eq('id', freshRow)),
  );

  if (clientWritable) {
    t(
      { table, policy: `${policy}_insert`, category: 'own', kind: 'positive', scenario: 'client can insert into its own tenant' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        const res = await mark.from(table).insert(buildRow(ctx.tenants.voltline, id));
        expectWriteOk('own insert', res);
        await expectPresent('own insert persisted', op, table, 'id', id);
        await op.from(table).delete().eq('id', id);
      },
    );
    t(
      { table, policy: `${policy}_insert`, category: 'tenant', kind: 'negative', scenario: 'client cannot insert into another tenant' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from(table).insert(buildRow(ctx.tenants.freshhome, id));
        await expectAbsent('cross insert', op, table, 'id', id);
      },
    );
  } else {
    t(
      { table, policy: `${policy}_insert`, category: 'capability', kind: 'negative', scenario: 'client cannot insert (operator-only write)' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from(table).insert(buildRow(ctx.tenants.voltline, id));
        await expectAbsent('client insert blocked', op, table, 'id', id);
      },
    );
  }

  if (updateColumn) {
    t(
      { table, policy: `${policy}_update`, category: 'tenant', kind: 'negative', scenario: 'client cannot update another tenant row' }, // prettier-ignore
      async () => {
        const attack = `rls-attacker-${randomUUID().slice(0, 8)}`;
        await mark.from(table).update({ [updateColumn]: attack }).eq('id', freshRow);
        await expectUnchanged('cross update', op, table, freshRow, updateColumn, attack);
      },
    );
  }

  t(
    { table, policy: `${policy}_delete`, category: 'tenant', kind: 'negative', scenario: 'client cannot delete another tenant row' }, // prettier-ignore
    async () => {
      await mark.from(table).delete().eq('id', freshRow);
      await expectStillExists('cross delete', op, table, freshRow);
    },
  );
}

// Matrix for a child table that resolves its tenant through a parent FK.
//   opts.parentKey — fixture key of the parent row
//   opts.buildRow  — (parentId, id, ctx) => a full row object including `id`
export function childCrossTenant(t, ctx, opts) {
  const { table, policy, key, parentKey, buildRow } = opts;
  const mark = ctx.clients.mark;
  const op = ctx.operator;

  t(
    { table, policy: `${policy}_select`, category: 'own', kind: 'positive', scenario: 'client reads own-tenant child row' }, // prettier-ignore
    async () =>
      expectVisible('own child', await mark.from(table).select('*').eq('id', ctx.fixture.voltline[key])),
  );
  t(
    { table, policy: `${policy}_select`, category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant child row' }, // prettier-ignore
    async () =>
      expectHidden('cross child', await mark.from(table).select('*').eq('id', ctx.fixture.freshhome[key])),
  );
  t(
    { table, policy: `${policy}_insert`, category: 'tenant', kind: 'negative', scenario: 'client cannot insert a child under another tenant parent' }, // prettier-ignore
    async () => {
      const id = randomUUID();
      await mark.from(table).insert(buildRow(ctx.fixture.freshhome[parentKey], id, ctx));
      await expectAbsent('cross child insert', op, table, 'id', id);
    },
  );
}
