// =============================================================================
// Suite — agency / policy / billing layer:
// agency_policy, plan_catalog, plan_assignments, policy_overrides,
// seat_limit_changes, team_invites, team_invite_clients, client_user_invites.
//
// agency_policy and the team-invite tables are operator-only — a client must
// not see HQ policy or the org-invite pipeline at all. The billing tables are
// tenant-scoped: a client sees its own plan/assignment/overrides, never
// another tenant's.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { expectVisible, expectHidden, expectAbsent, fail } from '../lib/harness.mjs';

const sentinel = (p) => `rls-${p}-${randomUUID().slice(0, 8)}`;

// Operator query that should simply succeed (rows optional).
async function okQuery(label, query) {
  const { error } = await query;
  if (error) fail(`${label}: operator query errored — ${error.message}`);
}

export default {
  name: 'Agency / policy / billing layer',
  register(ctx, t) {
    const { mark, craig } = ctx.clients;
    const op = ctx.operator;

    // ===== agency_policy (operator-only) =====================================
    t(
      { table: 'agency_policy', policy: 'agency_policy_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read HQ agency policy' }, // prettier-ignore
      async () => expectHidden('agency policy', await mark.from('agency_policy').select('*')),
    );
    t(
      { table: 'agency_policy', policy: 'agency_policy_select', category: 'own', kind: 'positive', scenario: 'operator reads agency policy' }, // prettier-ignore
      async () => okQuery('agency policy', craig.from('agency_policy').select('*').limit(5)),
    );
    if (ctx.discovered.agencyPolicyKey) {
      t(
        { table: 'agency_policy', policy: 'agency_policy_update', category: 'capability', kind: 'negative', scenario: 'client cannot rewrite agency policy' }, // prettier-ignore
        async () => {
          const key = ctx.discovered.agencyPolicyKey;
          const { data: before } = await op.from('agency_policy').select('value').eq('policy_key', key).maybeSingle(); // prettier-ignore
          await mark.from('agency_policy').update({ value: { rls: 'attacker' } }).eq('policy_key', key); // prettier-ignore
          const { data: after } = await op.from('agency_policy').select('value').eq('policy_key', key).maybeSingle(); // prettier-ignore
          if (JSON.stringify(after?.value) !== JSON.stringify(before?.value))
            fail('HOLE — a client rewrote agency policy');
        },
      );
    }

    // ===== plan_catalog ======================================================
    t(
      { table: 'plan_catalog', policy: 'plan_catalog_select', category: 'own', kind: 'positive', scenario: 'operator reads the plan catalog' }, // prettier-ignore
      async () => okQuery('plan catalog', craig.from('plan_catalog').select('*').limit(5)),
    );
    t(
      { table: 'plan_catalog', policy: 'plan_catalog_insert', category: 'capability', kind: 'negative', scenario: 'client cannot add a billing plan' }, // prettier-ignore
      async () => {
        const name = sentinel('plan');
        await mark.from('plan_catalog').insert({ name, price: 1, currency: 'USD', billing_cycle: 'monthly' }); // prettier-ignore
        await expectAbsent('plan insert', op, 'plan_catalog', 'name', name);
      },
    );

    // ===== plan_assignments ==================================================
    t(
      { table: 'plan_assignments', policy: 'plan_assignments_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant plan assignment' }, // prettier-ignore
      async () =>
        expectHidden('cross assignment', await mark.from('plan_assignments').select('*').eq('client_id', ctx.tenants.freshhome)), // prettier-ignore
    );
    t(
      { table: 'plan_assignments', policy: 'plan_assignments_select', category: 'own', kind: 'positive', scenario: 'operator reads plan assignments' }, // prettier-ignore
      async () => okQuery('plan assignments', craig.from('plan_assignments').select('*').limit(5)),
    );
    t(
      { table: 'plan_assignments', policy: 'plan_assignments_update', category: 'capability', kind: 'negative', scenario: 'client cannot re-point its own plan assignment' }, // prettier-ignore
      async () => {
        // Re-attribute the assignment to the client itself. Blocked → unchanged;
        // if no assignment exists the update is a vacuous no-op (still safe).
        const { data: before } = await op.from('plan_assignments').select('assigned_by').eq('client_id', ctx.tenants.voltline).maybeSingle(); // prettier-ignore
        await mark.from('plan_assignments').update({ assigned_by: ctx.ids.mark }).eq('client_id', ctx.tenants.voltline); // prettier-ignore
        const { data: after } = await op.from('plan_assignments').select('assigned_by').eq('client_id', ctx.tenants.voltline).maybeSingle(); // prettier-ignore
        if (after && after.assigned_by === ctx.ids.mark && before?.assigned_by !== ctx.ids.mark)
          fail('HOLE — a client rewrote its own plan assignment');
      },
    );

    // ===== policy_overrides ==================================================
    t(
      { table: 'policy_overrides', policy: 'policy_overrides_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant policy overrides' }, // prettier-ignore
      async () =>
        expectHidden('cross overrides', await mark.from('policy_overrides').select('*').eq('client_id', ctx.tenants.freshhome)), // prettier-ignore
    );
    t(
      { table: 'policy_overrides', policy: 'policy_overrides_select', category: 'own', kind: 'positive', scenario: 'operator reads policy overrides' }, // prettier-ignore
      async () => okQuery('policy overrides', craig.from('policy_overrides').select('*').limit(5)),
    );

    // ===== seat_limit_changes (seeded per tenant) ============================
    t(
      { table: 'seat_limit_changes', policy: 'seat_limit_changes_select', category: 'own', kind: 'positive', scenario: 'client reads its own seat-limit history' }, // prettier-ignore
      async () =>
        expectVisible('own seat history', await mark.from('seat_limit_changes').select('*').eq('id', ctx.fixture.voltline.seatLimitChange)), // prettier-ignore
    );
    t(
      { table: 'seat_limit_changes', policy: 'seat_limit_changes_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant seat history' }, // prettier-ignore
      async () =>
        expectHidden('cross seat history', await mark.from('seat_limit_changes').select('*').eq('id', ctx.fixture.freshhome.seatLimitChange)), // prettier-ignore
    );
    t(
      { table: 'seat_limit_changes', policy: 'seat_limit_changes_insert', category: 'capability', kind: 'negative', scenario: 'client cannot fake a seat-limit change' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from('seat_limit_changes').insert({ id, client_id: ctx.tenants.voltline, changed_by: ctx.ids.mark, new_limit: 999 }); // prettier-ignore
        const { data } = await op.from('seat_limit_changes').select('id').eq('id', id);
        if (data && data.length) {
          await op.from('seat_limit_changes').delete().eq('id', id);
          fail('HOLE — a client forged a seat-limit-change record');
        }
      },
    );

    // ===== team_invites / team_invite_clients (operator-only) ================
    t(
      { table: 'team_invites', policy: 'team_invites_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read the org invite pipeline' }, // prettier-ignore
      async () => expectHidden('team invites', await mark.from('team_invites').select('*')),
    );
    t(
      { table: 'team_invites', policy: 'team_invites_select', category: 'own', kind: 'positive', scenario: 'operator reads team invites' }, // prettier-ignore
      async () => okQuery('team invites', craig.from('team_invites').select('*').limit(5)),
    );
    t(
      { table: 'team_invites', policy: 'team_invites_insert', category: 'capability', kind: 'negative', scenario: 'client cannot create an operator invite' }, // prettier-ignore
      async () => {
        const link = sentinel('link');
        await mark.from('team_invites').insert({
          email: `${link}@example.com`,
          full_name: 'x',
          role: 'operator',
          invited_by: ctx.ids.mark,
          expires_at: new Date(Date.now() + 864e5).toISOString(),
          magic_link: link,
        });
        await expectAbsent('team invite insert', op, 'team_invites', 'magic_link', link);
      },
    );
    t(
      { table: 'team_invite_clients', policy: 'team_invite_clients_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read invite client-scoping rows' }, // prettier-ignore
      async () => expectHidden('team invite clients', await mark.from('team_invite_clients').select('*')), // prettier-ignore
    );

    // ===== client_user_invites (tenant-scoped, seeded) =======================
    t(
      { table: 'client_user_invites', policy: 'client_user_invites_select', category: 'own', kind: 'positive', scenario: 'client reads its own pending invites' }, // prettier-ignore
      async () =>
        expectVisible('own invites', await mark.from('client_user_invites').select('*').eq('id', ctx.fixture.voltline.clientInvite)), // prettier-ignore
    );
    t(
      { table: 'client_user_invites', policy: 'client_user_invites_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant invites' }, // prettier-ignore
      async () =>
        expectHidden('cross invites', await mark.from('client_user_invites').select('*').eq('id', ctx.fixture.freshhome.clientInvite)), // prettier-ignore
    );
    t(
      { table: 'client_user_invites', policy: 'client_user_invites_insert', category: 'own', kind: 'positive', scenario: 'client can invite a teammate into its own tenant' }, // prettier-ignore
      async () => {
        const email = `${sentinel('invite')}@example.com`;
        const res = await mark.from('client_user_invites').insert({
          email,
          client_id: ctx.tenants.voltline,
          invited_by: ctx.ids.mark,
          expires_at: new Date(Date.now() + 864e5).toISOString(),
          magic_link: sentinel('ml'),
        });
        if (res.error) fail(`own-tenant invite blocked — ${res.error.message}`);
        await op.from('client_user_invites').delete().eq('email', email);
      },
    );
    t(
      { table: 'client_user_invites', policy: 'client_user_invites_insert', category: 'tenant', kind: 'negative', scenario: 'client cannot inject an invite into another tenant' }, // prettier-ignore
      async () => {
        const email = `${sentinel('xinvite')}@example.com`;
        await mark.from('client_user_invites').insert({
          email,
          client_id: ctx.tenants.freshhome,
          invited_by: ctx.ids.mark,
          expires_at: new Date(Date.now() + 864e5).toISOString(),
          magic_link: sentinel('ml'),
        });
        await expectAbsent('cross invite insert', op, 'client_user_invites', 'email', email);
      },
    );
  },
};
