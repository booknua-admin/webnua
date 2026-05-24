// =============================================================================
// Suite — automation engine (Phase 8 Session 1).
//
// Three new resources:
//   • automations          — clientScoped, client-readable, operator-write.
//                            Covered by the operational suite (already
//                            uses the new schema after migration 0076).
//   • automation_actions   — childCrossTenant via parent automation.
//                            Covered by the operational suite.
//   • automation_runs      — clientScoped SELECT only; INSERT/UPDATE/DELETE
//                            are service-role only (no `authenticated`
//                            policy). This suite covers it.
//
// automation_runs INSERTs require service-role access (no authenticated
// policy). The suite skips if SUPABASE_SERVICE_ROLE_KEY isn't configured.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { expectVisible, expectHidden, expectAbsent } from '../lib/harness.mjs';

export default {
  name: 'Automation engine (automation_runs)',
  register(ctx, t) {
    const { mark } = ctx.clients;
    const op = ctx.operator;
    const svc = ctx.svc;

    // Probe ids — operator-seeded runs that the suite reads through `mark`
    // (the Voltline client) and the operator (FreshHome run is the
    // cross-tenant probe).
    const voltRunId = randomUUID();
    const freshRunId = randomUUID();

    if (!svc) {
      t(
        { table: 'automation_runs', policy: 'automation_runs_seed', category: 'capability', kind: 'positive', scenario: 'suite skipped — SUPABASE_SERVICE_ROLE_KEY not set' },
        async () => {
          // No-op; the suite needs service-role to seed runs (no
          // authenticated INSERT policy exists by design).
        },
      );
      return;
    }

    t(
      { table: 'automation_runs', policy: 'automation_runs_seed', category: 'own', kind: 'positive', scenario: 'seed runs for the suite' },
      async () => {
        const voltAutomation = ctx.fixture.voltline.automation;
        const freshAutomation = ctx.fixture.freshhome.automation;
        await svc.from('automation_runs').insert({
          id: voltRunId,
          automation_id: voltAutomation,
          client_id: ctx.tenants.voltline,
          trigger_event: { leadId: ctx.fixture.voltline.lead },
        });
        await svc.from('automation_runs').insert({
          id: freshRunId,
          automation_id: freshAutomation,
          client_id: ctx.tenants.freshhome,
          trigger_event: { leadId: ctx.fixture.freshhome.lead },
        });
        ctx.track('automation_runs', voltRunId);
        ctx.track('automation_runs', freshRunId);
      },
    );

    // ===== SELECT — clientScoped =================================================
    t(
      { table: 'automation_runs', policy: 'automation_runs_select', category: 'own', kind: 'positive', scenario: 'client reads a run in its own tenant' },
      async () => expectVisible('own read', await mark.from('automation_runs').select('*').eq('id', voltRunId)),
    );
    t(
      { table: 'automation_runs', policy: 'automation_runs_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant run' },
      async () => expectHidden('cross read', await mark.from('automation_runs').select('*').eq('id', freshRunId)),
    );

    // ===== INSERT / UPDATE / DELETE — service-role only ==========================
    t(
      { table: 'automation_runs', policy: 'automation_runs_insert', category: 'capability', kind: 'negative', scenario: 'client cannot insert a run (service-role only)' },
      async () => {
        const id = randomUUID();
        await mark.from('automation_runs').insert({
          id,
          automation_id: ctx.fixture.voltline.automation,
          client_id: ctx.tenants.voltline,
          trigger_event: {},
        });
        await expectAbsent('client run insert blocked', svc, 'automation_runs', 'id', id);
      },
    );
    t(
      { table: 'automation_runs', policy: 'automation_runs_insert', category: 'capability', kind: 'negative', scenario: 'operator cannot insert a run as authenticated user' },
      async () => {
        const id = randomUUID();
        await op.from('automation_runs').insert({
          id,
          automation_id: ctx.fixture.voltline.automation,
          client_id: ctx.tenants.voltline,
          trigger_event: {},
        });
        await expectAbsent('operator authenticated insert blocked', svc, 'automation_runs', 'id', id);
      },
    );
    t(
      { table: 'automation_runs', policy: 'automation_runs_update', category: 'capability', kind: 'negative', scenario: 'client cannot update an own-tenant run' },
      async () => {
        const before = await svc.from('automation_runs').select('status').eq('id', voltRunId).single();
        await mark.from('automation_runs').update({ status: 'cancelled' }).eq('id', voltRunId);
        const after = await svc.from('automation_runs').select('status').eq('id', voltRunId).single();
        if (before.data?.status !== after.data?.status) {
          throw new Error('client update of automation_run leaked through');
        }
      },
    );
    t(
      { table: 'automation_runs', policy: 'automation_runs_delete', category: 'capability', kind: 'negative', scenario: 'client cannot delete an own-tenant run' },
      async () => {
        await mark.from('automation_runs').delete().eq('id', voltRunId);
        const after = await svc.from('automation_runs').select('id').eq('id', voltRunId).maybeSingle();
        if (!after.data) throw new Error('client delete of automation_run leaked through');
      },
    );

    // ===== Lead handoff columns — read-back via leads ============================
    t(
      { table: 'leads', policy: 'leads_select', category: 'own', kind: 'positive', scenario: 'client reads automation_state on own lead' },
      async () => {
        const res = await mark
          .from('leads')
          .select('automation_state, needs_followup_at')
          .eq('id', ctx.fixture.voltline.lead)
          .single();
        expectVisible('automation_state read', res);
        const state = res.data?.automation_state;
        if (
          state !== 'automated' &&
          state !== 'taken_over' &&
          state !== 'completed' &&
          state !== 'archived'
        ) {
          throw new Error(`unexpected automation_state value "${String(state)}"`);
        }
      },
    );
  },
};
