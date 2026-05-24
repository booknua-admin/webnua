// =============================================================================
// Suite — unauthenticated (anon) access.
//
// Every Phase-1 policy targets the `authenticated` role; `anon` matches no
// policy and is denied. A denied SELECT surfaces as zero rows (not an error),
// so each negative test confirms an EMPTY result. The one thing `anon` may
// reach is the intentionally-public `section-media` storage bucket.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { expectHidden, expectAbsent, fail } from '../lib/harness.mjs';

const TENANT_TABLES = [
  'clients',
  'users',
  'customers',
  'leads',
  'bookings',
  'reviews',
  'tickets',
  'websites',
  'funnels',
  'notifications',
  'agency_policy',
  'plan_catalog',
  'capability_grants',
  'generation_log',
  'analytics_events',
  'signup_submissions',
  // Phase 7 — every integration / messaging table denies anon SELECT
  'integration_connections',
  'integration_call_log',
  'integration_jobs',
  'client_sms_senders',
  'client_email_senders',
  'client_stripe_customers',
  'notifications_outbound',
  'sms_messages',
  'sms_templates',
  'email_messages',
  'email_templates',
  'notification_preferences',
  'client_gbp_locations',
  'gbp_reviews',
  'gbp_review_requests',
  'client_meta_ad_accounts',
  'meta_lead_forms',
  'meta_campaigns',
  'meta_ads_insights',
  'platform_email_templates',
];

export default {
  name: 'Anonymous access (unauthenticated baseline)',
  register(ctx, t) {
    for (const table of TENANT_TABLES) {
      t(
        { table, policy: `${table}_select`, category: 'anon', kind: 'negative', scenario: 'anon read returns no rows' }, // prettier-ignore
        async () => expectHidden(`anon ${table}`, await ctx.anon.from(table).select('*').limit(5)),
      );
    }

    t(
      { table: 'leads', policy: 'leads_insert', category: 'anon', kind: 'negative', scenario: 'anon cannot insert a lead' }, // prettier-ignore
      async () => {
        const s = `rls-anon-${randomUUID().slice(0, 8)}`;
        await ctx.anon
          .from('leads')
          .insert({ client_id: ctx.tenants.voltline, customer_name_snapshot: s });
        await expectAbsent('anon insert', ctx.operator, 'leads', 'customer_name_snapshot', s);
      },
    );

    t(
      { table: 'website_versions', policy: 'website_versions_insert', category: 'anon', kind: 'negative', scenario: 'anon cannot insert a website version' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await ctx.anon.from('website_versions').insert({
          id,
          website_id: ctx.fixture.voltline.website,
          status: 'draft',
          snapshot: {},
          created_by: ctx.ids.craig,
        });
        const { data } = await ctx.operator.from('website_versions').select('id').eq('id', id);
        if (data && data.length) {
          await ctx.operator.from('website_versions').delete().eq('id', id);
          fail('HOLE — anon wrote a website_versions row');
        }
      },
    );

    // Phase 7 Vault wrappers — EXECUTE explicitly revoked from anon.
    t(
      { table: 'public.webnua_vault_read_secret', policy: 'vault_wrapper_execute', category: 'anon', kind: 'negative', scenario: 'anon cannot call the vault wrappers' }, // prettier-ignore
      async () => {
        const { error } = await ctx.anon.rpc('webnua_vault_read_secret', { secret_id: randomUUID() });
        if (!error) fail('HOLE — anon executed a Vault wrapper');
      },
    );

    // Positive: the intentionally-public section-media storage bucket IS
    // reachable by anon (migration 0027) — confirms anon auth itself works and
    // that the denials above are RLS, not a broken key.
    t(
      { table: 'storage.section-media', policy: 'section_media_public_read', category: 'anon', kind: 'positive', scenario: 'anon may list the public section-media bucket' }, // prettier-ignore
      async () => {
        const { error } = await ctx.anon.storage.from('section-media').list('', { limit: 1 });
        if (error) fail(`expected anon to reach the public bucket — ${error.message}`);
      },
    );
  },
};
