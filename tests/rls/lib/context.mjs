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
const TEARDOWN_ORDER = [
  'job_completions',
  'bookings',
  'recurring_booking_schedules',
  'lead_events',
  'lead_reads',
  'leads',
  'customers',
  'campaign_activity_events',
  'campaigns',
  'automation_steps',
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
  await mustInsert(operator, 'automations', { id: f.automation, client_id: clientId, name: f.sentinel, trigger_type: 'lead_created' }, tracker); // prettier-ignore
  await mustInsert(operator, 'automation_steps', { id: f.automationStep, automation_id: f.automation, position: 1, channel: 'sms', name: f.sentinel, body: 'rls-test' }, tracker); // prettier-ignore
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
  if (cfg.serviceKey) {
    svc = newClient(cfg, cfg.serviceKey);
    process.stdout.write('  Service-role key present — building junior-operator fixture...\n');
    try {
      junior = await buildJunior(cfg, svc, tenants.voltline, ids.craig);
    } catch (err) {
      process.stdout.write(`  WARNING: junior fixture skipped — ${err.message}\n`);
    }
  } else {
    process.stdout.write(
      '  No SUPABASE_SERVICE_ROLE_KEY — service-role + junior-operator tests will SKIP.\n',
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
    track: (table, id) => (tracker[table] ??= []).push(id),
    teardown,
  };
}
