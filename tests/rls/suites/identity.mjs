// =============================================================================
// Suite — identity layer: clients, users, brands, capability_grants,
// user_client_access.
//
// The privilege-escalation tests live here. The most serious cross-tenant risk
// is not a leaked SELECT — it is a client who can REWRITE their own identity
// (role / client_id / team_role) or GRANT themselves capabilities. Those tests
// are the harness's primary purpose.
// =============================================================================

import { randomUUID } from 'node:crypto';
import {
  expectVisible,
  expectHidden,
  expectAbsent,
  expectUnchanged,
  expectStillExists,
  expectWriteOk,
  fail,
} from '../lib/harness.mjs';

const sId = () => randomUUID();
const sentinel = (p) => `rls-${p}-${randomUUID().slice(0, 8)}`;

export default {
  name: 'Identity layer (clients, users, brands, grants, client access)',
  register(ctx, t) {
    const { mark, anna, liam, craig } = ctx.clients;
    const op = ctx.operator;
    const svc = ctx.svc;

    // ===== clients ===========================================================
    t(
      { table: 'clients', policy: 'clients_select', category: 'own', kind: 'positive', scenario: 'client reads its own client row' }, // prettier-ignore
      async () => expectVisible('own client', await mark.from('clients').select('*').eq('id', ctx.tenants.voltline)), // prettier-ignore
    );
    t(
      { table: 'clients', policy: 'clients_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another client row' }, // prettier-ignore
      async () => expectHidden('cross client', await mark.from('clients').select('*').eq('id', ctx.tenants.freshhome)), // prettier-ignore
    );
    t(
      { table: 'clients', policy: 'clients_insert', category: 'capability', kind: 'negative', scenario: 'client cannot create a client (operator-only)' }, // prettier-ignore
      async () => {
        const slug = sentinel('client');
        await mark.from('clients').insert({ name: slug, slug, industry: 'rls-test' });
        await expectAbsent('client insert', op, 'clients', 'slug', slug);
      },
    );
    t(
      { table: 'clients', policy: 'clients_update', category: 'tenant', kind: 'negative', scenario: 'client cannot rename another tenant' }, // prettier-ignore
      async () => {
        const attack = sentinel('attacker');
        await mark.from('clients').update({ name: attack }).eq('id', ctx.tenants.freshhome);
        await expectUnchanged('cross client update', op, 'clients', ctx.tenants.freshhome, 'name', attack); // prettier-ignore
      },
    );
    t(
      { table: 'clients', policy: 'clients_select', category: 'own', kind: 'positive', scenario: 'operator reads every client' }, // prettier-ignore
      async () => expectVisible('operator client read', await craig.from('clients').select('id').eq('id', ctx.tenants.freshhome)), // prettier-ignore
    );

    // ===== users =============================================================
    t(
      { table: 'users', policy: 'users_select', category: 'own', kind: 'positive', scenario: 'client reads its own profile row' }, // prettier-ignore
      async () => expectVisible('own profile', await mark.from('users').select('*').eq('id', ctx.ids.mark)), // prettier-ignore
    );
    t(
      { table: 'users', policy: 'users_select', category: 'own', kind: 'positive', scenario: 'client reads a teammate in the same tenant' }, // prettier-ignore
      async () => expectVisible('same-tenant user', await mark.from('users').select('*').eq('id', ctx.ids.liam)), // prettier-ignore
    );
    t(
      { table: 'users', policy: 'users_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read a user in another tenant' }, // prettier-ignore
      async () => expectHidden('cross user', await mark.from('users').select('*').eq('id', ctx.ids.anna)), // prettier-ignore
    );
    // PRIVILEGE ESCALATION — a client must NOT be able to rewrite their own
    // role / client_id / team_role. If this leaks, the client becomes an
    // operator (or jumps tenant). Self-healing: any escalation is reverted.
    t(
      { table: 'users', policy: 'users_update', category: 'capability', kind: 'negative', scenario: 'client cannot promote itself to operator' }, // prettier-ignore
      async () => {
        await mark
          .from('users')
          .update({ role: 'admin', client_id: null, team_role: 'owner' })
          .eq('id', ctx.ids.mark);
        const { data } = await op.from('users').select('role, client_id, team_role').eq('id', ctx.ids.mark).maybeSingle(); // prettier-ignore
        if (!data) fail('could not re-read mark to verify');
        if (data.role !== 'client' || data.client_id !== ctx.tenants.voltline) {
          await (svc ?? op)
            .from('users')
            .update({ role: 'client', client_id: ctx.tenants.voltline, team_role: null })
            .eq('id', ctx.ids.mark);
          fail('HOLE — a client escalated its own role/tenant via a self-UPDATE (reverted)');
        }
      },
    );
    t(
      { table: 'users', policy: 'users_update', category: 'capability', kind: 'negative', scenario: 'client cannot switch its own tenant' }, // prettier-ignore
      async () => {
        await mark.from('users').update({ client_id: ctx.tenants.freshhome }).eq('id', ctx.ids.mark); // prettier-ignore
        const { data } = await op.from('users').select('client_id').eq('id', ctx.ids.mark).maybeSingle(); // prettier-ignore
        if (data?.client_id !== ctx.tenants.voltline) {
          await (svc ?? op).from('users').update({ client_id: ctx.tenants.voltline }).eq('id', ctx.ids.mark); // prettier-ignore
          fail('HOLE — a client moved its own row to another tenant (reverted)');
        }
      },
    );
    t(
      { table: 'users', policy: 'users_update', category: 'own', kind: 'positive', scenario: 'client may edit its own display name' }, // prettier-ignore
      async () => {
        const { data: before } = await mark.from('users').select('display_name').eq('id', ctx.ids.mark).maybeSingle(); // prettier-ignore
        const next = sentinel('name');
        const res = await mark.from('users').update({ display_name: next }).eq('id', ctx.ids.mark); // prettier-ignore
        expectWriteOk('own name update', res);
        await op.from('users').update({ display_name: before?.display_name ?? 'Mark' }).eq('id', ctx.ids.mark); // prettier-ignore
      },
    );
    t(
      { table: 'users', policy: 'users_update', category: 'capability', kind: 'negative', scenario: 'client cannot edit a teammate profile' }, // prettier-ignore
      async () => {
        const attack = sentinel('attacker');
        await mark.from('users').update({ display_name: attack }).eq('id', ctx.ids.liam);
        await expectUnchanged('teammate edit', op, 'users', ctx.ids.liam, 'display_name', attack);
      },
    );
    t(
      { table: 'users', policy: 'users_insert', category: 'capability', kind: 'negative', scenario: 'client cannot create a user' }, // prettier-ignore
      async () => {
        const email = `${sentinel('user')}@example.com`;
        await mark.from('users').insert({ id: sId(), display_name: 'x', email, role: 'client', client_id: ctx.tenants.voltline }); // prettier-ignore
        await expectAbsent('user insert', op, 'users', 'email', email);
      },
    );

    // ===== brands ============================================================
    t(
      { table: 'brands', policy: 'brands_select', category: 'own', kind: 'positive', scenario: 'client reads its own brand' }, // prettier-ignore
      async () => expectVisible('own brand', await mark.from('brands').select('*').eq('client_id', ctx.tenants.voltline)), // prettier-ignore
    );
    t(
      { table: 'brands', policy: 'brands_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant brand' }, // prettier-ignore
      async () => expectHidden('cross brand', await mark.from('brands').select('*').eq('client_id', ctx.tenants.freshhome)), // prettier-ignore
    );
    t(
      { table: 'brands', policy: 'brands_update', category: 'tenant', kind: 'negative', scenario: 'client cannot update another tenant brand' }, // prettier-ignore
      async () => {
        const attack = sentinel('attacker');
        await mark.from('brands').update({ audience_line: attack }).eq('client_id', ctx.tenants.freshhome); // prettier-ignore
        const { data } = await op.from('brands').select('audience_line').eq('client_id', ctx.tenants.freshhome).maybeSingle(); // prettier-ignore
        if (data?.audience_line === attack) fail('HOLE — cross-tenant brand update succeeded');
      },
    );
    t(
      { table: 'brands', policy: 'brands_update', category: 'capability', kind: 'negative', scenario: 'client without editTheme cannot update own brand' }, // prettier-ignore
      async () => {
        const attack = sentinel('attacker');
        // anna holds no capability grants — brands_update needs editTheme.
        await anna.from('brands').update({ audience_line: attack }).eq('client_id', ctx.tenants.freshhome); // prettier-ignore
        const { data } = await op.from('brands').select('audience_line').eq('client_id', ctx.tenants.freshhome).maybeSingle(); // prettier-ignore
        if (data?.audience_line === attack) fail('HOLE — uncapped client edited its own brand');
      },
    );

    // ===== capability_grants =================================================
    t(
      { table: 'capability_grants', policy: 'capability_grants_select', category: 'own', kind: 'positive', scenario: 'client reads its own grants' }, // prettier-ignore
      async () => {
        const res = await mark.from('capability_grants').select('*').eq('user_id', ctx.ids.mark);
        if (res.error) fail(`own grants read errored — ${res.error.message}`);
      },
    );
    t(
      { table: 'capability_grants', policy: 'capability_grants_select', category: 'capability', kind: 'negative', scenario: 'client cannot read another user grants' }, // prettier-ignore
      async () => expectHidden('others grants', await mark.from('capability_grants').select('*').eq('user_id', ctx.ids.craig)), // prettier-ignore
    );
    // ESCALATION — a client must NOT be able to grant itself capabilities.
    t(
      { table: 'capability_grants', policy: 'capability_grants_insert', category: 'capability', kind: 'negative', scenario: 'client cannot grant itself capabilities' }, // prettier-ignore
      async () => {
        const id = sId();
        await mark.from('capability_grants').insert({
          id,
          user_id: ctx.ids.mark,
          website_id: ctx.fixture.voltline.website,
          capabilities: ['publish', 'approve', 'manageDomain'],
        });
        const { data } = await op.from('capability_grants').select('id').eq('id', id);
        if (data && data.length) {
          await op.from('capability_grants').delete().eq('id', id);
          fail('HOLE — a client granted itself capabilities');
        }
      },
    );
    t(
      { table: 'capability_grants', policy: 'capability_grants_update', category: 'capability', kind: 'negative', scenario: 'client cannot widen its own grant' }, // prettier-ignore
      async () => {
        await mark
          .from('capability_grants')
          .update({ capabilities: ['publish', 'approve'] })
          .eq('user_id', ctx.ids.mark)
          .is('website_id', null);
        const { data } = await op.from('capability_grants').select('capabilities').eq('user_id', ctx.ids.mark).is('website_id', null).maybeSingle(); // prettier-ignore
        if (data && data.capabilities.includes('publish'))
          fail('HOLE — a client widened its own capability grant');
      },
    );

    // ===== user_client_access ================================================
    t(
      { table: 'user_client_access', policy: 'user_client_access_select', category: 'own', kind: 'positive', scenario: 'operator reads client-access rows' }, // prettier-ignore
      async () => {
        const res = await craig.from('user_client_access').select('*').limit(5);
        if (res.error) fail(`operator access read errored — ${res.error.message}`);
      },
    );
    // ESCALATION — a client must NOT be able to grant itself access to a client.
    t(
      { table: 'user_client_access', policy: 'user_client_access_insert', category: 'capability', kind: 'negative', scenario: 'client cannot grant itself access to another client' }, // prettier-ignore
      async () => {
        await mark.from('user_client_access').insert({
          user_id: ctx.ids.mark,
          client_id: ctx.tenants.freshhome,
          granted_by: ctx.ids.mark,
        });
        const { data } = await op
          .from('user_client_access')
          .select('user_id')
          .eq('user_id', ctx.ids.mark)
          .eq('client_id', ctx.tenants.freshhome);
        if (data && data.length) {
          await op.from('user_client_access').delete().eq('user_id', ctx.ids.mark).eq('client_id', ctx.tenants.freshhome); // prettier-ignore
          fail('HOLE — a client granted itself cross-client access');
        }
      },
    );
  },
};
