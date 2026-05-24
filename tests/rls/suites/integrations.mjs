// =============================================================================
// Suite — Phase 7 integration tables (Stripe / Twilio / Resend / GBP / Meta)
// + the Vault wrappers that protect per-tenant OAuth tokens.
//
// Two structural shapes the Phase-7 tables fall into:
//
//   • OPERATOR-ONLY readable — `is_operator() AND client_id in acl`. Clients
//     must not see these AT ALL (including their own tenant's rows).
//       integration_call_log, client_sms_senders, client_email_senders,
//       client_stripe_customers, notifications_outbound, integration_connections
//
//   • TENANT-READABLE (acl) — `client_id in acl`. Clients see their own
//     tenant's rows but never another tenant's; operators see all.
//       sms_messages, sms_templates, email_messages, email_templates,
//       notification_preferences, client_gbp_locations, gbp_reviews,
//       gbp_review_requests, client_meta_ad_accounts, meta_lead_forms,
//       meta_campaigns, meta_ads_insights
//
//   • SERVICE-ROLE-ONLY — `revoke all … from authenticated`. Even SELECT is
//     denied to every authenticated user — only service_role reads/writes.
//       integration_jobs
//
// EVERY Phase-7 table revokes INSERT/UPDATE/DELETE from `authenticated`. The
// suite confirms each rejects a client-write authoritatively (persistence
// verified through the service-role client).
//
// `integration_connections` is the per-tenant OAuth tokens table. The cached
// access token (`access_token_cached`) is plaintext; the persistent token
// (`token_secret_id`) is a Vault secret uuid. The combination of (a) the SELECT
// denial and (b) the Vault wrappers (only service_role may execute) is the
// two-layer defence of cross-client OAuth-token isolation. The Vault tests
// here confirm layer (b) independently.
// =============================================================================

import { randomUUID } from 'node:crypto';
import {
  expectVisible,
  expectHidden,
  expectAbsent,
  expectUnchanged,
  expectStillExists,
  expectWriteOk,
  skip,
  fail,
} from '../lib/harness.mjs';

const now = () => new Date().toISOString();

// One operator-only-readable table: confirm clients cannot see their OWN row
// (the bright line vs tenant-readable tables) AND cannot see another tenant's;
// operator can see both; every authenticated write is denied.
function operatorOnly(t, ctx, { table, policy, key, sample }) {
  const { mark, craig } = ctx.clients;
  const svc = ctx.svc;
  const F = ctx.fixture;

  t(
    { table, policy: `${policy}_select`, category: 'capability', kind: 'negative', scenario: 'client cannot read its OWN tenant row (operator-only)' },
    async () => expectHidden(`client own ${table}`, await mark.from(table).select('*').eq('id', F.voltline[key])),
  );
  t(
    { table, policy: `${policy}_select`, category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant row' },
    async () => expectHidden(`cross ${table}`, await mark.from(table).select('*').eq('id', F.freshhome[key])),
  );
  t(
    { table, policy: `${policy}_select`, category: 'own', kind: 'positive', scenario: 'operator reads tenant rows' },
    async () => expectVisible(`operator ${table}`, await craig.from(table).select('*').eq('id', F.voltline[key])),
  );
  t(
    { table, policy: `${policy}_insert`, category: 'capability', kind: 'negative', scenario: 'authenticated INSERT is revoked (service-role only)' },
    async () => {
      const id = randomUUID();
      await mark.from(table).insert(sample(ctx.tenants.voltline, id, F.voltline));
      await expectAbsent(`client ${table} insert`, svc, table, 'id', id);
    },
  );
  t(
    { table, policy: `${policy}_insert`, category: 'capability', kind: 'negative', scenario: 'operator-authenticated INSERT is revoked too' },
    async () => {
      const id = randomUUID();
      await craig.from(table).insert(sample(ctx.tenants.voltline, id, F.voltline));
      await expectAbsent(`operator ${table} insert`, svc, table, 'id', id);
    },
  );
  // UPDATE / DELETE are revoked too — verify the seed row is untouched after
  // a client tries to mutate / drop it.
  t(
    { table, policy: `${policy}_delete`, category: 'capability', kind: 'negative', scenario: 'client cannot delete an own-tenant row (writes revoked)' },
    async () => {
      await mark.from(table).delete().eq('id', F.voltline[key]);
      await expectStillExists(`client ${table} delete`, svc, table, F.voltline[key]);
    },
  );
}

// A tenant-readable table: standard cross-tenant SELECT matrix; every
// authenticated INSERT/UPDATE/DELETE rejected (writes are service-role only).
function tenantReadable(t, ctx, { table, policy, key, sample, updateColumn }) {
  const { mark, craig } = ctx.clients;
  const svc = ctx.svc;
  const F = ctx.fixture;

  t(
    { table, policy: `${policy}_select`, category: 'own', kind: 'positive', scenario: 'client reads an own-tenant row' },
    async () => expectVisible(`own ${table}`, await mark.from(table).select('*').eq('id', F.voltline[key])),
  );
  t(
    { table, policy: `${policy}_select`, category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant row' },
    async () => expectHidden(`cross ${table}`, await mark.from(table).select('*').eq('id', F.freshhome[key])),
  );
  t(
    { table, policy: `${policy}_select`, category: 'own', kind: 'positive', scenario: 'operator reads any tenant row' },
    async () => expectVisible(`operator ${table}`, await craig.from(table).select('*').eq('id', F.freshhome[key])),
  );
  t(
    { table, policy: `${policy}_insert`, category: 'capability', kind: 'negative', scenario: 'authenticated INSERT is revoked (service-role only)' },
    async () => {
      const id = randomUUID();
      await mark.from(table).insert(sample(ctx.tenants.voltline, id, F.voltline));
      await expectAbsent(`client ${table} insert`, svc, table, 'id', id);
    },
  );
  if (updateColumn) {
    t(
      { table, policy: `${policy}_update`, category: 'capability', kind: 'negative', scenario: 'client cannot update an own-tenant row (writes revoked)' },
      async () => {
        const attack = `rls-attack-${randomUUID().slice(0, 8)}`;
        await mark.from(table).update({ [updateColumn]: attack }).eq('id', F.voltline[key]);
        await expectUnchanged(`${table} update`, svc, table, F.voltline[key], updateColumn, attack);
      },
    );
  }
  t(
    { table, policy: `${policy}_delete`, category: 'capability', kind: 'negative', scenario: 'client cannot delete an own-tenant row (writes revoked)' },
    async () => {
      await mark.from(table).delete().eq('id', F.voltline[key]);
      await expectStillExists(`${table} delete`, svc, table, F.voltline[key]);
    },
  );
}

export default {
  name: 'Phase-7 integrations (Stripe / Twilio / Resend / GBP / Meta) + Vault',
  register(ctx, t) {
    const { mark, craig } = ctx.clients;
    const svc = ctx.svc;

    if (!ctx.phase7Seeded) {
      t(
        { table: 'integrations.*', policy: 'phase7_suite', category: 'capability', kind: 'negative', scenario: 'suite skipped — SUPABASE_SERVICE_ROLE_KEY required to seed' },
        async () => skip('Phase-7 tables revoke authenticated writes; needs service-role to seed disposable rows'),
      );
      return;
    }

    // ===== OPERATOR-ONLY READABLE =============================================

    operatorOnly(t, ctx, {
      table: 'integration_call_log',
      policy: 'integration_call_log',
      key: 'callLog',
      sample: (clientId, id) => ({
        id, client_id: clientId, provider: 'rls', operation: 'rls', direction: 'outbound', occurred_at: now(),
      }),
    });

    operatorOnly(t, ctx, {
      table: 'client_sms_senders',
      policy: 'client_sms_senders',
      key: 'smsSender',
      sample: (clientId, id) => ({ id, client_id: clientId, sender_id: 'RLSA', status: 'pending_approval' }),
    });

    operatorOnly(t, ctx, {
      table: 'client_email_senders',
      policy: 'client_email_senders',
      key: 'emailSender',
      sample: (clientId, id) => ({
        id, client_id: clientId, slug: `rls-attack-${randomUUID().slice(0, 6)}`, display_name: 'attack',
      }),
    });

    operatorOnly(t, ctx, {
      table: 'client_stripe_customers',
      policy: 'client_stripe_customers',
      key: 'stripeCustomer',
      sample: (clientId, id) => ({
        id, client_id: clientId, stripe_customer_id: `cus_attack_${randomUUID().slice(0, 12)}`,
      }),
    });

    operatorOnly(t, ctx, {
      table: 'notifications_outbound',
      policy: 'notifications_outbound',
      key: 'notifOutbound',
      sample: (clientId, id) => ({
        id, client_id: clientId, recipient_email: 'attacker@example.com',
        template_name: 'rls', sent_at: now(),
      }),
    });

    operatorOnly(t, ctx, {
      table: 'integration_connections',
      policy: 'integration_connections',
      key: 'integrationConnection',
      sample: (clientId, id) => ({
        id, client_id: clientId, provider: 'google_business_profile',
        provider_account_id: `attack-${randomUUID().slice(0, 8)}`, token_model: 'refresh_access',
      }),
    });

    // ===== TENANT-READABLE (acl) ==============================================

    tenantReadable(t, ctx, {
      table: 'sms_templates',
      policy: 'sms_templates',
      key: 'smsTemplate',
      updateColumn: 'body',
      sample: (clientId, id) => ({
        id, client_id: clientId, template_key: 'job_confirmation', body: 'rls',
      }),
    });

    tenantReadable(t, ctx, {
      table: 'email_templates',
      policy: 'email_templates',
      key: 'emailTemplate',
      updateColumn: 'subject',
      sample: (clientId, id) => ({
        id, client_id: clientId, template_key: 'review_request',
        subject: 'rls', body_html: '<p>rls</p>', body_text: 'rls',
      }),
    });

    tenantReadable(t, ctx, {
      table: 'sms_messages',
      policy: 'sms_messages',
      key: 'smsMessage',
      updateColumn: 'message_body',
      sample: (clientId, id) => ({
        id, client_id: clientId, sender_id: 'RLS', recipient_phone: '+15555550100',
        message_body: 'rls', status: 'queued', sent_at: now(),
      }),
    });

    tenantReadable(t, ctx, {
      table: 'email_messages',
      policy: 'email_messages',
      key: 'emailMessage',
      updateColumn: 'subject',
      sample: (clientId, id) => ({
        id, client_id: clientId, direction: 'outbound',
        sender_address: 'rls@mail.webnua.com', recipient_address: 'attacker@example.com',
        subject: 'rls', status: 'queued', occurred_at: now(),
      }),
    });

    tenantReadable(t, ctx, {
      table: 'notification_preferences',
      policy: 'notification_preferences',
      key: 'notifPref',
      updateColumn: 'operator_email',
      sample: (clientId, id) => ({
        id, client_id: clientId, operator_email: `attack-${randomUUID().slice(0, 8)}@example.com`,
      }),
    });

    tenantReadable(t, ctx, {
      table: 'client_gbp_locations',
      policy: 'client_gbp_locations',
      key: 'gbpLocation',
      updateColumn: 'location_title',
      sample: (clientId, id) => ({
        id, client_id: clientId,
        gbp_account_id: `accounts/attack-${randomUUID().slice(0, 8)}`,
        gbp_location_id: `locations/attack-${randomUUID().slice(0, 8)}`,
        location_title: 'attack',
      }),
    });

    tenantReadable(t, ctx, {
      table: 'gbp_reviews',
      policy: 'gbp_reviews',
      key: 'gbpReview',
      updateColumn: 'comment',
      sample: (clientId, id) => ({
        id, client_id: clientId, gbp_review_id: `attack-${randomUUID()}`,
        rating: 1, comment: 'attack', created_at_google: now(),
      }),
    });

    tenantReadable(t, ctx, {
      table: 'gbp_review_requests',
      policy: 'gbp_review_requests',
      key: 'gbpReviewRequest',
      sample: (clientId, id) => ({
        id, client_id: clientId, channel: 'sms', sent_at: now(),
        review_link: `https://example.com/attack/${randomUUID().slice(0, 8)}`,
      }),
    });

    tenantReadable(t, ctx, {
      table: 'client_meta_ad_accounts',
      policy: 'client_meta_ad_accounts',
      key: 'metaAdAccount',
      updateColumn: 'ad_account_name',
      sample: (clientId, id) => ({
        id, client_id: clientId, meta_ad_account_id: `act_attack_${randomUUID().slice(0, 10)}`,
      }),
    });

    tenantReadable(t, ctx, {
      table: 'meta_lead_forms',
      policy: 'meta_lead_forms',
      key: 'metaLeadForm',
      updateColumn: 'form_name',
      sample: (clientId, id) => ({
        id, client_id: clientId, meta_form_id: `attack-${randomUUID()}`, form_name: 'attack',
      }),
    });

    // meta_campaigns INSERT needs a real campaigns row — use the parent's.
    tenantReadable(t, ctx, {
      table: 'meta_campaigns',
      policy: 'meta_campaigns',
      key: 'metaCampaign',
      updateColumn: 'campaign_name',
      sample: (clientId, id, F) => ({
        id, client_id: clientId, campaign_id: F.campaign,
        meta_campaign_id: `attack-${randomUUID().slice(0, 10)}`, campaign_name: 'attack',
      }),
    });

    tenantReadable(t, ctx, {
      table: 'meta_ads_insights',
      policy: 'meta_ads_insights',
      key: 'metaInsight',
      sample: (clientId, id, F) => ({
        id, client_id: clientId, meta_campaign_id: F.metaCampaign,
        date_recorded: now().slice(0, 10), impressions: 1,
      }),
    });

    // ===== SERVICE-ROLE-ONLY (integration_jobs) =================================
    // The whole table grants `service_role` only; `authenticated` SELECT
    // returns a hard permission error (42501). expectHidden() treats an
    // error as a valid denial.
    t(
      { table: 'integration_jobs', policy: 'integration_jobs_no_authenticated', category: 'capability', kind: 'negative', scenario: 'client cannot SELECT integration_jobs (all privileges revoked)' },
      async () => expectHidden('client integration_jobs', await mark.from('integration_jobs').select('*').limit(1)),
    );
    t(
      { table: 'integration_jobs', policy: 'integration_jobs_no_authenticated', category: 'capability', kind: 'negative', scenario: 'operator cannot SELECT integration_jobs (no authenticated policy)' },
      async () => expectHidden('operator integration_jobs', await craig.from('integration_jobs').select('*').limit(1)),
    );
    t(
      { table: 'integration_jobs', policy: 'integration_jobs_no_authenticated', category: 'capability', kind: 'negative', scenario: 'client cannot INSERT integration_jobs' },
      async () => {
        const id = randomUUID();
        await mark.from('integration_jobs').insert({
          id, job_type: 'rls_attack', status: 'pending',
        });
        await expectAbsent('client jobs insert', svc, 'integration_jobs', 'id', id);
      },
    );
    t(
      { table: 'integration_jobs', policy: 'integration_jobs_service_role', category: 'service', kind: 'positive', scenario: 'service-role can SELECT integration_jobs' },
      async () => {
        const { error } = await svc.from('integration_jobs').select('id').limit(1);
        if (error) fail(`service-role jobs read errored — ${error.message}`);
      },
    );

    // ===== VAULT wrappers (per-tenant OAuth token isolation, layer 2) =========
    // `public.webnua_vault_*` are SECURITY DEFINER bridges to vault.secrets;
    // EXECUTE is revoked from public/anon/authenticated, granted only to
    // service_role. The combination of (a) integration_connections SELECT
    // denial (above) and (b) these wrappers' service-role-only EXECUTE is
    // what isolates per-tenant OAuth tokens cross-client.
    t(
      { table: 'public.webnua_vault_create_secret', policy: 'vault_wrapper_execute', category: 'capability', kind: 'negative', scenario: 'authenticated client cannot mint a vault secret' },
      async () => {
        const { error } = await mark.rpc('webnua_vault_create_secret', { secret: 'rls', name: 'rls' });
        if (!error) fail('HOLE — a client minted a Vault secret');
      },
    );
    t(
      { table: 'public.webnua_vault_read_secret', policy: 'vault_wrapper_execute', category: 'capability', kind: 'negative', scenario: 'authenticated client cannot read a vault secret' },
      async () => {
        const { error } = await mark.rpc('webnua_vault_read_secret', { secret_id: randomUUID() });
        if (!error) fail('HOLE — a client read a Vault secret');
      },
    );
    t(
      { table: 'public.webnua_vault_read_secret', policy: 'vault_wrapper_execute', category: 'capability', kind: 'negative', scenario: 'operator-authenticated cannot read a vault secret either' },
      async () => {
        const { error } = await craig.rpc('webnua_vault_read_secret', { secret_id: randomUUID() });
        if (!error) fail('HOLE — an operator-authenticated session read a Vault secret');
      },
    );
    t(
      { table: 'public.webnua_vault_delete_secret', policy: 'vault_wrapper_execute', category: 'capability', kind: 'negative', scenario: 'authenticated client cannot delete a vault secret' },
      async () => {
        const { error } = await mark.rpc('webnua_vault_delete_secret', { secret_id: randomUUID() });
        if (!error) fail('HOLE — a client deleted a Vault secret');
      },
    );
    t(
      { table: 'public.webnua_vault_create_secret', policy: 'vault_wrapper_execute', category: 'service', kind: 'positive', scenario: 'service-role may use the vault wrappers' },
      async () => {
        // Mint + immediately drop a real secret so we don't leak fixtures.
        const { data: id, error: createErr } = await svc.rpc('webnua_vault_create_secret', {
          secret: 'rls-vault-roundtrip', name: `rls-${randomUUID().slice(0, 8)}`,
        });
        if (createErr) fail(`service-role vault create errored — ${createErr.message}`);
        if (!id) fail('service-role vault create returned no id');
        const { error: deleteErr } = await svc.rpc('webnua_vault_delete_secret', { secret_id: id });
        if (deleteErr) fail(`service-role vault delete errored — ${deleteErr.message}`);
      },
    );
  },
};
