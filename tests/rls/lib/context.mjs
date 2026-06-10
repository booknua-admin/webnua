// =============================================================================
// RLS test harness — context: clients, fixtures, teardown.
//
// Builds everything the suites need:
//   • One Supabase client per identity (anon + the four seeded test users +,
//     optionally, a service-role client and an ephemeral junior operator).
//   • A disposable row in EVERY tenant-scoped table for two tenants (Voltline
//     and FreshHome). Seeded by the operator, identified by sentinel values,
//     torn down at the end. Tests target only these rows, never seed data — a
//     cross-tenant write that slips through can therefore only ever touch a
//     throwaway row.
//
// Every disposable row's id is generated here (crypto.randomUUID) so the
// harness never depends on INSERT...RETURNING (which is itself subject to the
// SELECT policy — see migration 0028).
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const TEST_USERS = {
  craig: 'craig@webnua.com', // operator (admin / owner)
  mark: 'mark@voltline.com.au', // Voltline client
  liam: 'liam@voltline.com.au', // Voltline client (second seat)
  anna: 'anna@freshhome.com.au', // FreshHome client
};

const AUTH_OPTS = { auth: { persistSession: false, autoRefreshToken: false } };

// Tables emptied at teardown, in FK-safe order (children before parents).
// Phase-7 tables come first — most cascade-delete with `clients`, so order
// against the rest is forgiving, but explicit beats implicit.
const TEARDOWN_ORDER = [
  // Approval spine + social calendar (service-role-seeded, migrations 0119-0122)
  'suggested_actions',
  'social_posts',
  'meta_campaign_flags',
  // Phase 7 (service-role-seeded; only present when SUPABASE_SERVICE_ROLE_KEY is set)
  'meta_ads_insights',
  'meta_campaigns',
  'meta_lead_forms',
  'client_meta_ad_accounts',
  'gbp_review_requests',
  'gbp_reviews',
  'client_gbp_locations',
  'notification_preferences',
  'email_messages',
  'email_templates',
  'sms_messages',
  'sms_templates',
  'integration_connections',
  'notifications_outbound',
  'client_stripe_customers',
  'client_email_senders',
  'client_sms_senders',
  'integration_call_log',
  // Original (operator-seeded)
  'job_completions',
  'bookings',
  'recurring_booking_schedules',
  'lead_events',
  'lead_reads',
  'leads',
  'customers',
  'campaign_activity_events',
  'campaigns',
  'automation_runs',
  'automation_actions',
  'automations',
  'ticket_messages',
  'tickets',
  'content_drafts',
  'website_approval_submissions',
  'force_publish_audit_log',
  'website_versions',
  'websites',
  'funnel_approval_submissions',
  'funnel_versions',
  'funnels',
  'reviews',
  'generation_log',
  'notification_reads',
  'notifications',
  'client_user_invites',
  'team_invite_clients',
  'team_invites',
  'seat_limit_changes',
];

function newClient(cfg, key) {
  return createClient(cfg.url, key, AUTH_OPTS);
}

async function signIn(cfg, email) {
  const client = newClient(cfg, cfg.anonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: cfg.password,
  });
  if (error) {
    throw new Error(
      `RLS harness: could not sign in "${email}" — ${error.message}.\n` +
        'Confirm the seeded test users exist and RLS_TEST_PASSWORD is correct.',
    );
  }
  return { client, userId: data.user.id };
}

async function mustInsert(operator, table, row, tracker) {
  const { error } = await operator.from(table).insert(row);
  if (error) {
    throw new Error(`RLS harness: failed to seed "${table}" — [${error.code}] ${error.message}`);
  }
  if (row.id) (tracker[table] ??= []).push(row.id);
}

// Seed one disposable row in every tenant-scoped table for one client.
async function seedTenant(operator, clientId, operatorId, recipientUserId, tag, tracker) {
  const id = () => randomUUID();
  const now = new Date().toISOString();
  const f = {
    customer: id(),
    lead: id(),
    leadEvent: id(),
    booking: id(),
    recurring: id(),
    jobCompletion: id(),
    review: id(),
    campaign: id(),
    campaignEvent: id(),
    automation: id(),
    automationStep: id(),
    ticket: id(),
    ticketMessage: id(),
    website: id(),
    websiteVersion: id(),
    funnel: id(),
    funnelVersion: id(),
    contentDraft: id(),
    websiteApproval: id(),
    funnelApproval: id(),
    forcePublishLog: id(),
    generationLog: id(),
    notification: id(),
    clientInvite: id(),
    seatLimitChange: id(),
  };
  // The sentinel marks every seeded row so the verifier can find leaks.
  f.sentinel = `rls-test-${tag}-${randomUUID().slice(0, 8)}`;

  await mustInsert(operator, 'customers', { id: f.customer, client_id: clientId, name: f.sentinel }, tracker); // prettier-ignore
  await mustInsert(operator, 'leads', { id: f.lead, client_id: clientId, customer_name_snapshot: f.sentinel, source: 'rls-test' }, tracker); // prettier-ignore
  await mustInsert(operator, 'lead_events', { id: f.leadEvent, lead_id: f.lead, kind: 'sms_in', occurred_at: now }, tracker); // prettier-ignore
  await mustInsert(operator, 'bookings', { id: f.booking, client_id: clientId, title: f.sentinel, service_type: 'rls-test', starts_at: now, ends_at: now, customer_id: f.customer, customer_name_snapshot: f.sentinel, created_by: operatorId }, tracker); // prettier-ignore
  await mustInsert(operator, 'recurring_booking_schedules', { id: f.recurring, client_id: clientId, frequency: 'weekly', start_time: '09:00', duration_minutes: 60, service_type: 'rls-test', customer_id: f.customer, customer_name_snapshot: f.sentinel, created_by: operatorId }, tracker); // prettier-ignore
  await mustInsert(operator, 'job_completions', { id: f.jobCompletion, booking_id: f.booking, completed_by: operatorId, payment_method: 'card', amount_charged: 100 }, tracker); // prettier-ignore
  await mustInsert(operator, 'reviews', { id: f.review, client_id: clientId, author_name: f.sentinel, body: f.sentinel, stars: 5, reviewed_at: now }, tracker); // prettier-ignore
  await mustInsert(operator, 'campaigns', { id: f.campaign, client_id: clientId, name: f.sentinel }, tracker); // prettier-ignore
  await mustInsert(operator, 'campaign_activity_events', { id: f.campaignEvent, campaign_id: f.campaign, category: 'creative', occurred_at: now }, tracker); // prettier-ignore
  await mustInsert(operator, 'automations', { id: f.automation, client_id: clientId, automation_key: `rls-${f.sentinel}`, name: f.sentinel, trigger_type: 'lead_created' }, tracker); // prettier-ignore
  await mustInsert(operator, 'automation_actions', { id: f.automationStep, automation_id: f.automation, position: 1, action_type: 'send_sms_to_lead', action_config: { template_key: 'lead_acknowledgment' }, pauses_on_human_activity: true }, tracker); // prettier-ignore
  await mustInsert(operator, 'tickets', { id: f.ticket, reference: `RLS-${f.sentinel}`, client_id: clientId, title: f.sentinel, category: 'website', created_by: operatorId }, tracker); // prettier-ignore
  await mustInsert(operator, 'ticket_messages', { id: f.ticketMessage, ticket_id: f.ticket, author_user_id: operatorId, body: 'rls-test' }, tracker); // prettier-ignore
  await mustInsert(operator, 'websites', { id: f.website, client_id: clientId, name: f.sentinel, domain_primary: `${f.sentinel}.example` }, tracker); // prettier-ignore
  await mustInsert(operator, 'website_versions', { id: f.websiteVersion, website_id: f.website, status: 'draft', snapshot: {}, created_by: operatorId }, tracker); // prettier-ignore
  await mustInsert(operator, 'funnels', { id: f.funnel, client_id: clientId, name: f.sentinel, domain_primary: `${f.sentinel}-funnel.example` }, tracker); // prettier-ignore
  await mustInsert(operator, 'funnel_versions', { id: f.funnelVersion, funnel_id: f.funnel, status: 'draft', snapshot: {}, created_by: operatorId }, tracker); // prettier-ignore
  await mustInsert(operator, 'content_drafts', { id: f.contentDraft, scope_kind: 'page', website_id: f.website, page_key: f.sentinel, sections: [], saved_at: now, updated_by: operatorId }, tracker); // prettier-ignore
  await mustInsert(operator, 'website_approval_submissions', { id: f.websiteApproval, website_id: f.website, pending_version_id: f.websiteVersion, submitter_id: operatorId, diff: {} }, tracker); // prettier-ignore
  await mustInsert(operator, 'funnel_approval_submissions', { id: f.funnelApproval, funnel_id: f.funnel, pending_funnel_version_id: f.funnelVersion, submitter_id: operatorId, diff: {} }, tracker); // prettier-ignore
  await mustInsert(operator, 'force_publish_audit_log', { id: f.forcePublishLog, actor_user_id: operatorId, website_id: f.website, new_version_id: f.websiteVersion, reason: 'rls-test' }, tracker); // prettier-ignore
  await mustInsert(operator, 'generation_log', { id: f.generationLog, generation_id: randomUUID(), client_id: clientId, section_type: 'hero', field_name: f.sentinel, reason: 'missing' }, tracker); // prettier-ignore
  await mustInsert(operator, 'notifications', { id: f.notification, recipient_user_id: recipientUserId, kind: 'lead', title: f.sentinel }, tracker); // prettier-ignore
  const expires = new Date(Date.now() + 7 * 864e5).toISOString();
  await mustInsert(operator, 'client_user_invites', { id: f.clientInvite, email: `${f.sentinel}@example.com`, client_id: clientId, invited_by: operatorId, expires_at: expires, magic_link: f.sentinel }, tracker); // prettier-ignore
  await mustInsert(operator, 'seat_limit_changes', { id: f.seatLimitChange, client_id: clientId, changed_by: operatorId, previous_limit: 3, new_limit: 4 }, tracker); // prettier-ignore

  return f;
}

// Phase-7 seeding — every writable Phase-7 table revokes
// INSERT/UPDATE/DELETE from `authenticated`, so an operator-authenticated
// client can't seed them. The service-role bypass is the only way to insert
// a disposable probe row. Without SUPABASE_SERVICE_ROLE_KEY this returns
// null and the integrations suite SKIPs everything.
//
// Unique-per-client constraints (`client_sms_senders.client_id` unique,
// `client_email_senders.slug` globally unique, `client_stripe_customers.
// client_id` unique, `client_gbp_locations.client_id` unique,
// `client_meta_ad_accounts.client_id` unique) mean a previous run that
// crashed before teardown can collide on re-seed. Pre-delete by client_id
// for the tables with a `unique(client_id)` constraint so the harness is
// idempotent.
async function seedPhase7Tenant(svc, clientId, parents, tag, tracker) {
  const id = () => randomUUID();
  const now = new Date().toISOString();
  const sentinel = `rls7-${tag}-${randomUUID().slice(0, 8)}`;
  const f = {
    smsSender: id(),
    emailSender: id(),
    stripeCustomer: id(),
    notifOutbound: id(),
    integrationConnection: id(),
    callLog: id(),
    smsTemplate: id(),
    emailTemplate: id(),
    smsMessage: id(),
    emailMessage: id(),
    notifPref: id(),
    gbpLocation: id(),
    gbpReview: id(),
    gbpReviewRequest: id(),
    metaAdAccount: id(),
    metaLeadForm: id(),
    metaCampaign: id(),
    metaInsight: id(),
    sentinel,
  };

  // Pre-delete the unique-per-client tables so a re-run is idempotent.
  for (const table of [
    'client_sms_senders',
    'client_email_senders',
    'client_stripe_customers',
    'client_gbp_locations',
    'client_meta_ad_accounts',
  ]) {
    await svc.from(table).delete().eq('client_id', clientId);
  }

  // ===== operator-only-readable tables =====================================
  await mustInsert(svc, 'client_sms_senders', {
    id: f.smsSender, client_id: clientId, sender_id: `RLS${tag.toUpperCase()}`, status: 'pending_approval',
  }, tracker);
  // Email-sender slug is globally unique — sentinel-suffixed.
  await mustInsert(svc, 'client_email_senders', {
    id: f.emailSender, client_id: clientId, slug: `rls-${tag}-${randomUUID().slice(0, 6)}`, display_name: 'RLS Test',
  }, tracker);
  await mustInsert(svc, 'client_stripe_customers', {
    id: f.stripeCustomer, client_id: clientId, stripe_customer_id: `cus_rls_${randomUUID().slice(0, 12)}`,
  }, tracker);
  await mustInsert(svc, 'notifications_outbound', {
    id: f.notifOutbound, client_id: clientId, recipient_email: `${sentinel}@example.com`,
    template_name: 'lead_notification', sent_at: now,
  }, tracker);
  await mustInsert(svc, 'integration_connections', {
    id: f.integrationConnection, client_id: clientId, provider: 'google_business_profile',
    provider_account_id: `acct_rls_${randomUUID().slice(0, 8)}`, token_model: 'refresh_access',
  }, tracker);
  await mustInsert(svc, 'integration_call_log', {
    id: f.callLog, client_id: clientId, provider: 'stripe', operation: 'rls_test', direction: 'outbound',
    occurred_at: now,
  }, tracker);

  // ===== tenant-readable (acl) tables ======================================
  await mustInsert(svc, 'sms_templates', {
    id: f.smsTemplate, client_id: clientId, template_key: 'lead_acknowledgment',
    body: `rls ${sentinel}`,
  }, tracker);
  await mustInsert(svc, 'email_templates', {
    id: f.emailTemplate, client_id: clientId, template_key: 'lead_followup',
    subject: 'rls', body_html: '<p>rls</p>', body_text: 'rls',
  }, tracker);
  await mustInsert(svc, 'sms_messages', {
    id: f.smsMessage, client_id: clientId, sender_id: 'RLSTEST', recipient_phone: '+15555550100',
    message_body: sentinel, segments_count: 1, encoding: 'gsm', status: 'queued', sent_at: now,
  }, tracker);
  await mustInsert(svc, 'email_messages', {
    id: f.emailMessage, client_id: clientId, direction: 'outbound',
    sender_address: 'rls@mail.webnua.com', recipient_address: `${sentinel}@example.com`,
    subject: 'rls', body_text: sentinel, status: 'queued', occurred_at: now,
  }, tracker);
  await mustInsert(svc, 'notification_preferences', {
    id: f.notifPref, client_id: clientId, operator_email: `${sentinel}-ops@webnua.com`,
  }, tracker);
  await mustInsert(svc, 'client_gbp_locations', {
    id: f.gbpLocation, client_id: clientId,
    gbp_account_id: `accounts/rls-${randomUUID().slice(0, 8)}`,
    gbp_location_id: `locations/rls-${randomUUID().slice(0, 8)}`,
    location_title: sentinel,
  }, tracker);
  await mustInsert(svc, 'gbp_reviews', {
    id: f.gbpReview, client_id: clientId, gbp_review_id: `rls-${randomUUID()}`,
    rating: 5, comment: sentinel, created_at_google: now,
  }, tracker);
  await mustInsert(svc, 'gbp_review_requests', {
    id: f.gbpReviewRequest, client_id: clientId, channel: 'sms', sent_at: now,
    review_link: `https://example.com/rls/${sentinel}`,
  }, tracker);
  await mustInsert(svc, 'client_meta_ad_accounts', {
    id: f.metaAdAccount, client_id: clientId,
    meta_ad_account_id: `act_rls_${randomUUID().slice(0, 10)}`,
  }, tracker);
  await mustInsert(svc, 'meta_lead_forms', {
    id: f.metaLeadForm, client_id: clientId,
    meta_form_id: `rls-form-${randomUUID().slice(0, 8)}`, form_name: sentinel,
  }, tracker);
  // meta_campaigns needs a real public.campaigns row — re-use the parent's.
  await mustInsert(svc, 'meta_campaigns', {
    id: f.metaCampaign, client_id: clientId, campaign_id: parents.campaign,
    meta_campaign_id: `rls-camp-${randomUUID().slice(0, 8)}`, campaign_name: sentinel,
  }, tracker);
  await mustInsert(svc, 'meta_ads_insights', {
    id: f.metaInsight, client_id: clientId, meta_campaign_id: f.metaCampaign,
    date_recorded: now.slice(0, 10),
  }, tracker);

  // ===== approval spine + ads flags + social (migrations 0119, 0120, 0122) ==
  f.suggestedAction = id();
  await mustInsert(svc, 'suggested_actions', {
    id: f.suggestedAction, client_id: clientId, kind: 'generic',
    title: sentinel, body: 'rls probe',
  }, tracker);
  f.campaignFlag = id();
  await mustInsert(svc, 'meta_campaign_flags', {
    id: f.campaignFlag, client_id: clientId, meta_campaign_db_id: f.metaCampaign,
    flag_type: 'spend_not_pacing',
  }, tracker);
  f.socialPost = id();
  await mustInsert(svc, 'social_posts', {
    id: f.socialPost, client_id: clientId, caption: sentinel,
    scheduled_for: now,
  }, tracker);

  return f;
}

async function discoverTenants(operator) {
  const { data, error } = await operator
    .from('clients')
    .select('id, slug')
    .in('slug', ['voltline', 'freshhome']);
  if (error) throw new Error(`RLS harness: could not read clients — ${error.message}`);
  const bySlug = Object.fromEntries((data || []).map((c) => [c.slug, c.id]));
  if (!bySlug.voltline || !bySlug.freshhome) {
    throw new Error('RLS harness: expected the "voltline" and "freshhome" seed clients to exist.');
  }
  return bySlug;
}

// Optional ephemeral junior-operator fixture (needs the service-role key).
async function buildJunior(cfg, svc, voltlineId, craigId) {
  const email = `rls-junior-${randomUUID().slice(0, 8)}@webnua.test`;
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email,
    password: cfg.password,
    email_confirm: true,
    user_metadata: { display_name: 'RLS Junior', role: 'admin', team_role: 'junior' },
  });
  if (createErr) throw new Error(`junior fixture: createUser failed — ${createErr.message}`);
  const juniorId = created.user.id;
  // Junior operators see only the clients in their user_client_access set.
  const { error: accessErr } = await svc
    .from('user_client_access')
    .insert({ user_id: juniorId, client_id: voltlineId, granted_by: craigId });
  if (accessErr) {
    await svc.auth.admin.deleteUser(juniorId);
    throw new Error(`junior fixture: access grant failed — ${accessErr.message}`);
  }
  const session = await signIn(cfg, email);
  return { client: session.client, id: juniorId, email };
}

export async function buildContext(cfg) {
  process.stdout.write('  Signing in test users...\n');
  const anon = newClient(cfg, cfg.anonKey);
  const sessions = {};
  for (const [name, email] of Object.entries(TEST_USERS)) {
    sessions[name] = await signIn(cfg, email);
  }
  const operator = sessions.craig.client;
  const ids = Object.fromEntries(Object.entries(sessions).map(([k, v]) => [k, v.userId]));

  const tenants = await discoverTenants(operator);

  process.stdout.write('  Seeding disposable fixtures (Voltline + FreshHome)...\n');
  const tracker = {};
  const fixture = {
    voltline: await seedTenant(operator, tenants.voltline, ids.craig, ids.mark, 'volt', tracker),
    freshhome: await seedTenant(operator, tenants.freshhome, ids.craig, ids.anna, 'fresh', tracker),
  };

  // An operator-only resource that is global (not tenant-scoped): pick a real
  // agency_policy key + a real plan so the agency suite can probe live rows.
  const { data: policyRows } = await operator.from('agency_policy').select('policy_key').limit(1);
  const { data: planRows } = await operator.from('plan_catalog').select('id').limit(1);
  const discovered = {
    agencyPolicyKey: policyRows?.[0]?.policy_key ?? null,
    planId: planRows?.[0]?.id ?? null,
  };

  // Optional service-role + junior-operator fixtures.
  let svc = null;
  let junior = null;
  let phase7Seeded = false;
  if (cfg.serviceKey) {
    svc = newClient(cfg, cfg.serviceKey);
    process.stdout.write('  Service-role key present — building junior-operator fixture...\n');
    try {
      junior = await buildJunior(cfg, svc, tenants.voltline, ids.craig);
    } catch (err) {
      process.stdout.write(`  WARNING: junior fixture skipped — ${err.message}\n`);
    }
    // Phase-7 tables revoke INSERT/UPDATE/DELETE from `authenticated`, so we
    // can only seed them via service-role. The integrations suite SKIPs when
    // phase7Seeded is false.
    process.stdout.write('  Seeding Phase-7 disposable fixtures (integrations / channels)...\n');
    try {
      Object.assign(
        fixture.voltline,
        await seedPhase7Tenant(svc, tenants.voltline, fixture.voltline, 'volt', tracker),
      );
      Object.assign(
        fixture.freshhome,
        await seedPhase7Tenant(svc, tenants.freshhome, fixture.freshhome, 'fresh', tracker),
      );
      phase7Seeded = true;
    } catch (err) {
      process.stdout.write(`  WARNING: Phase-7 fixture seeding incomplete — ${err.message}\n`);
    }
  } else {
    process.stdout.write(
      '  No SUPABASE_SERVICE_ROLE_KEY — service-role + junior-operator + integrations tests will SKIP.\n',
    );
  }

  const teardown = async () => {
    if (junior) {
      try {
        await svc.auth.admin.deleteUser(junior.id);
      } catch {
        /* best effort */
      }
    }
    const cleaner = svc ?? operator;
    for (const table of TEARDOWN_ORDER) {
      const idsForTable = tracker[table];
      if (idsForTable?.length) {
        await cleaner.from(table).delete().in('id', idsForTable);
      }
    }
  };

  return {
    cfg,
    anon,
    operator,
    clients: {
      craig: sessions.craig.client,
      mark: sessions.mark.client,
      liam: sessions.liam.client,
      anna: sessions.anna.client,
    },
    ids,
    tenants,
    fixture,
    discovered,
    svc,
    junior,
    phase7Seeded,
    track: (table, id) => (tracker[table] ??= []).push(id),
    teardown,
  };
}
