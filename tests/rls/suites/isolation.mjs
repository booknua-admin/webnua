// =============================================================================
// Suite — per-viewer tables, analytics, and the workspace / service-role /
// cross-agency isolation categories.
//
//   notifications / notification_reads — strictly per-recipient: even an
//     operator sees only their own.
//   analytics_*                        — SELECT-only for `authenticated`
//     (writes revoked), tenant-scoped.
//   workspace                          — junior-operator scoping: a junior
//     sees only the clients in user_client_access. Needs the service-role key
//     to mint the ephemeral junior fixture; SKIPs without it.
//   service                            — service-role intentionally bypasses
//     RLS. SKIPs without the key.
//   agency                             — N/A on a single-agency deployment.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { expectVisible, expectHidden, expectAbsent, expectWriteOk, skip, fail } from '../lib/harness.mjs'; // prettier-ignore

export default {
  name: 'Per-viewer tables, analytics, and isolation categories',
  register(ctx, t) {
    const { mark, liam, craig } = ctx.clients;
    const op = ctx.operator;
    const svc = ctx.svc;
    const F = ctx.fixture;

    // ===== notifications — per-recipient =====================================
    t(
      { table: 'notifications', policy: 'notifications_select', category: 'own', kind: 'positive', scenario: 'recipient reads its own notification' }, // prettier-ignore
      async () =>
        expectVisible('own notification', await mark.from('notifications').select('*').eq('id', F.voltline.notification)), // prettier-ignore
    );
    t(
      { table: 'notifications', policy: 'notifications_select', category: 'capability', kind: 'negative', scenario: 'a teammate cannot read another user notification' }, // prettier-ignore
      async () =>
        expectHidden('teammate notification', await liam.from('notifications').select('*').eq('id', F.voltline.notification)), // prettier-ignore
    );
    t(
      { table: 'notifications', policy: 'notifications_select', category: 'capability', kind: 'negative', scenario: 'even an operator cannot read another user notification' }, // prettier-ignore
      async () =>
        expectHidden('operator notification', await craig.from('notifications').select('*').eq('id', F.voltline.notification)), // prettier-ignore
    );
    t(
      { table: 'notifications', policy: 'notifications_insert', category: 'capability', kind: 'negative', scenario: 'client cannot fire a notification' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark
          .from('notifications')
          .insert({ id, recipient_user_id: ctx.ids.liam, kind: 'lead', title: 'rls' });
        // Only liam could see his own row — verify through him.
        const { data } = await liam.from('notifications').select('id').eq('id', id);
        if (data && data.length) {
          await (svc ?? liam).from('notifications').delete().eq('id', id);
          fail('HOLE — a client fired a notification');
        }
      },
    );

    // ===== notification_reads — per-viewer ===================================
    t(
      { table: 'notification_reads', policy: 'notification_reads_insert', category: 'own', kind: 'positive', scenario: 'user records its own notification read-state' }, // prettier-ignore
      async () => {
        await mark.from('notification_reads').delete().eq('notification_id', F.voltline.notification).eq('user_id', ctx.ids.mark); // prettier-ignore
        const res = await mark
          .from('notification_reads')
          .insert({ notification_id: F.voltline.notification, user_id: ctx.ids.mark });
        expectWriteOk('own notification_read', res);
        await mark.from('notification_reads').delete().eq('notification_id', F.voltline.notification).eq('user_id', ctx.ids.mark); // prettier-ignore
      },
    );
    t(
      { table: 'notification_reads', policy: 'notification_reads_insert', category: 'capability', kind: 'negative', scenario: 'user cannot forge a read-state for another user' }, // prettier-ignore
      async () => {
        await mark
          .from('notification_reads')
          .insert({ notification_id: F.voltline.notification, user_id: ctx.ids.liam });
        const { data } = await liam
          .from('notification_reads')
          .select('user_id')
          .eq('notification_id', F.voltline.notification)
          .eq('user_id', ctx.ids.liam);
        if (data && data.length) {
          await liam.from('notification_reads').delete().eq('notification_id', F.voltline.notification).eq('user_id', ctx.ids.liam); // prettier-ignore
          fail('HOLE — a user forged another user notification read-state');
        }
      },
    );

    // ===== analytics_* — SELECT-only, tenant-scoped ==========================
    for (const table of ['analytics_events', 'analytics_funnel_daily', 'analytics_page_daily']) {
      t(
        { table, policy: `${table}_writes`, category: 'capability', kind: 'negative', scenario: 'authenticated client cannot write analytics rows' }, // prettier-ignore
        async () => {
          const id = randomUUID();
          // INSERT privilege is revoked from `authenticated` (migration 0035).
          const row =
            table === 'analytics_events'
              ? { id, client_id: ctx.tenants.voltline, surface_kind: 'website', surface_id: F.voltline.website, page_ref: '/', event_type: 'page_view', visitor_id: 'rls', session_id: 'rls', occurred_at: new Date().toISOString() } // prettier-ignore
              : { client_id: ctx.tenants.voltline, surface_id: F.voltline.website, day: '2026-01-01', stage: 'rls', page_ref: '/', surface_kind: 'website' }; // prettier-ignore
          const res = await mark.from(table).insert(row);
          if (!res.error) fail(`HOLE — a client inserted into "${table}"`);
        },
      );
    }
    t(
      { table: 'analytics_events', policy: 'analytics_events_select', category: 'own', kind: 'positive', scenario: 'operator can query analytics' }, // prettier-ignore
      async () => {
        const { error } = await craig.from('analytics_events').select('id').limit(1);
        if (error) fail(`operator analytics read errored — ${error.message}`);
      },
    );
    t(
      { table: 'analytics_events', policy: 'analytics_events_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant analytics' }, // prettier-ignore
      async () => {
        if (!svc) skip('needs SUPABASE_SERVICE_ROLE_KEY to seed an analytics row');
        const id = randomUUID();
        const { error: seedErr } = await svc.from('analytics_events').insert({
          id,
          client_id: ctx.tenants.freshhome,
          surface_kind: 'website',
          surface_id: F.freshhome.website,
          page_ref: '/',
          event_type: 'page_view',
          visitor_id: 'rls',
          session_id: 'rls',
          occurred_at: new Date().toISOString(),
        });
        if (seedErr) fail(`could not seed analytics row — ${seedErr.message}`);
        try {
          expectHidden('cross analytics', await mark.from('analytics_events').select('*').eq('id', id)); // prettier-ignore
        } finally {
          await svc.from('analytics_events').delete().eq('id', id);
        }
      },
    );

    // ===== workspace isolation — junior-operator scoping =====================
    t(
      { table: 'leads', policy: 'accessible_client_ids', category: 'workspace', kind: 'positive', scenario: 'junior operator sees an assigned client' }, // prettier-ignore
      async () => {
        if (!ctx.junior) skip('needs SUPABASE_SERVICE_ROLE_KEY to mint the junior-operator fixture');
        expectVisible(
          'junior assigned',
          await ctx.junior.client.from('leads').select('*').eq('id', F.voltline.lead),
        );
      },
    );
    t(
      { table: 'leads', policy: 'accessible_client_ids', category: 'workspace', kind: 'negative', scenario: 'junior operator cannot see an unassigned client' }, // prettier-ignore
      async () => {
        if (!ctx.junior) skip('needs SUPABASE_SERVICE_ROLE_KEY to mint the junior-operator fixture');
        expectHidden(
          'junior unassigned',
          await ctx.junior.client.from('leads').select('*').eq('id', F.freshhome.lead),
        );
      },
    );
    t(
      { table: 'clients', policy: 'accessible_client_ids', category: 'workspace', kind: 'negative', scenario: 'junior operator cannot see an unassigned client row' }, // prettier-ignore
      async () => {
        if (!ctx.junior) skip('needs SUPABASE_SERVICE_ROLE_KEY to mint the junior-operator fixture');
        expectHidden(
          'junior client row',
          await ctx.junior.client.from('clients').select('*').eq('id', ctx.tenants.freshhome),
        );
      },
    );

    // ===== service-role bypass (intentional) =================================
    t(
      { table: 'leads', policy: 'service_role', category: 'service', kind: 'positive', scenario: 'service-role bypasses RLS and reads every tenant' }, // prettier-ignore
      async () => {
        if (!svc) skip('needs SUPABASE_SERVICE_ROLE_KEY');
        expectVisible('service voltline', await svc.from('leads').select('*').eq('id', F.voltline.lead)); // prettier-ignore
        expectVisible('service freshhome', await svc.from('leads').select('*').eq('id', F.freshhome.lead)); // prettier-ignore
      },
    );
    t(
      { table: 'leads', policy: 'service_role', category: 'service', kind: 'negative', scenario: 'a non-service-role client does NOT get the bypass' }, // prettier-ignore
      async () => {
        if (!svc) skip('needs SUPABASE_SERVICE_ROLE_KEY');
        expectHidden('no bypass for client', await mark.from('leads').select('*').eq('id', F.freshhome.lead)); // prettier-ignore
      },
    );

    // ===== cross-agency isolation — not applicable ===========================
    t(
      { table: '(all)', policy: 'accessible_client_ids', category: 'agency', kind: 'negative', scenario: 'cross-agency isolation' }, // prettier-ignore
      async () =>
        skip(
          'single-agency deployment — there is no second agency. The operative ' +
            'boundaries are client tenant isolation and junior-operator workspace ' +
            'scoping, both covered above. See reference/rls-test-suite.md.',
        ),
    );
  },
};
