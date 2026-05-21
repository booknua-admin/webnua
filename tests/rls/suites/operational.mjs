// =============================================================================
// Suite — operational layer: customers, leads, lead_events, lead_reads,
// bookings, recurring_booking_schedules, job_completions, reviews, campaigns,
// campaign_activity_events, automations, automation_steps, tickets,
// ticket_messages.
//
// These are the day-to-day client-data tables — the highest-volume cross-tenant
// surface. Every directly client-scoped table runs the full clientScoped
// matrix; every child table runs the childCrossTenant matrix.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { clientScoped, childCrossTenant } from '../lib/scenarios.mjs';
import { expectVisible, expectHidden, expectWriteOk, fail } from '../lib/harness.mjs';

const now = () => new Date().toISOString();

export default {
  name: 'Operational layer (leads, bookings, tickets, reviews, campaigns, automations)',
  register(ctx, t) {
    const { mark, liam } = ctx.clients;
    const op = ctx.operator;
    const voltCustomer = ctx.fixture.voltline.customer;

    // ===== directly client-scoped tables =====================================
    clientScoped(t, ctx, {
      table: 'customers',
      policy: 'customers',
      key: 'customer',
      updateColumn: 'notes',
      buildRow: (clientId, id) => ({ id, client_id: clientId, name: `rls-${id.slice(0, 8)}` }),
    });
    clientScoped(t, ctx, {
      table: 'leads',
      policy: 'leads',
      key: 'lead',
      updateColumn: 'source',
      buildRow: (clientId, id) => ({ id, client_id: clientId, customer_name_snapshot: 'rls' }),
    });
    clientScoped(t, ctx, {
      table: 'bookings',
      policy: 'bookings',
      key: 'booking',
      updateColumn: 'notes',
      buildRow: (clientId, id) => ({
        id,
        client_id: clientId,
        title: 'rls',
        service_type: 'rls',
        starts_at: now(),
        ends_at: now(),
        customer_id: voltCustomer,
        customer_name_snapshot: 'rls',
        created_by: ctx.ids.mark,
      }),
    });
    clientScoped(t, ctx, {
      table: 'recurring_booking_schedules',
      policy: 'recurring_schedules',
      key: 'recurring',
      updateColumn: 'service_type',
      buildRow: (clientId, id) => ({
        id,
        client_id: clientId,
        frequency: 'weekly',
        start_time: '09:00',
        duration_minutes: 60,
        service_type: 'rls',
        customer_id: voltCustomer,
        customer_name_snapshot: 'rls',
        created_by: ctx.ids.mark,
      }),
    });
    clientScoped(t, ctx, {
      table: 'reviews',
      policy: 'reviews',
      key: 'review',
      updateColumn: 'body',
      buildRow: (clientId, id) => ({
        id,
        client_id: clientId,
        author_name: 'rls',
        body: 'rls',
        stars: 5,
        reviewed_at: now(),
      }),
    });
    clientScoped(t, ctx, {
      table: 'campaigns',
      policy: 'campaigns',
      key: 'campaign',
      updateColumn: 'name',
      buildRow: (clientId, id) => ({ id, client_id: clientId, name: `rls-${id.slice(0, 8)}` }),
    });
    clientScoped(t, ctx, {
      table: 'automations',
      policy: 'automations',
      key: 'automation',
      updateColumn: 'name',
      buildRow: (clientId, id) => ({
        id,
        client_id: clientId,
        name: `rls-${id.slice(0, 8)}`,
        trigger_type: 'lead_created',
      }),
    });
    clientScoped(t, ctx, {
      table: 'tickets',
      policy: 'tickets',
      key: 'ticket',
      updateColumn: 'title',
      buildRow: (clientId, id) => ({
        id,
        client_id: clientId,
        reference: `RLS-${id.slice(0, 12)}`,
        title: 'rls',
        category: 'website',
        created_by: ctx.ids.mark,
      }),
    });

    // ===== child tables (tenant resolved through a parent FK) ================
    childCrossTenant(t, ctx, {
      table: 'lead_events',
      policy: 'lead_events',
      key: 'leadEvent',
      parentKey: 'lead',
      buildRow: (leadId, id) => ({ id, lead_id: leadId, kind: 'sms_in', occurred_at: now() }),
    });
    childCrossTenant(t, ctx, {
      table: 'job_completions',
      policy: 'job_completions',
      key: 'jobCompletion',
      parentKey: 'booking',
      buildRow: (bookingId, id) => ({
        id,
        booking_id: bookingId,
        completed_by: ctx.ids.mark,
        payment_method: 'card',
        amount_charged: 1,
      }),
    });
    childCrossTenant(t, ctx, {
      table: 'campaign_activity_events',
      policy: 'campaign_activity_events',
      key: 'campaignEvent',
      parentKey: 'campaign',
      buildRow: (campaignId, id) => ({
        id,
        campaign_id: campaignId,
        category: 'creative',
        occurred_at: now(),
      }),
    });
    childCrossTenant(t, ctx, {
      table: 'automation_steps',
      policy: 'automation_steps',
      key: 'automationStep',
      parentKey: 'automation',
      buildRow: (automationId, id) => ({
        id,
        automation_id: automationId,
        position: 99,
        channel: 'sms',
        name: 'rls',
        body: 'rls',
      }),
    });
    childCrossTenant(t, ctx, {
      table: 'ticket_messages',
      policy: 'ticket_messages',
      key: 'ticketMessage',
      parentKey: 'ticket',
      buildRow: (ticketId, id) => ({
        id,
        ticket_id: ticketId,
        author_user_id: ctx.ids.mark,
        body: 'rls',
      }),
    });

    // ===== lead_reads — strictly per-viewer (no `id` column) =================
    // A read-state row is private to one user; another user — even in the same
    // tenant — must neither see it nor be able to forge one in their name.
    t(
      { table: 'lead_reads', policy: 'lead_reads_insert', category: 'own', kind: 'positive', scenario: 'user records its own lead read-state' }, // prettier-ignore
      async () => {
        await mark.from('lead_reads').delete().eq('lead_id', ctx.fixture.voltline.lead).eq('user_id', ctx.ids.mark); // prettier-ignore
        const res = await mark
          .from('lead_reads')
          .insert({ lead_id: ctx.fixture.voltline.lead, user_id: ctx.ids.mark });
        expectWriteOk('own lead_read', res);
        expectVisible(
          'own lead_read visible',
          await mark.from('lead_reads').select('*').eq('lead_id', ctx.fixture.voltline.lead),
        );
      },
    );
    t(
      { table: 'lead_reads', policy: 'lead_reads_select', category: 'capability', kind: 'negative', scenario: 'user cannot see a teammate read-state' }, // prettier-ignore
      async () =>
        expectHidden(
          'teammate lead_read',
          await liam.from('lead_reads').select('*').eq('lead_id', ctx.fixture.voltline.lead).eq('user_id', ctx.ids.mark), // prettier-ignore
        ),
    );
    t(
      { table: 'lead_reads', policy: 'lead_reads_insert', category: 'capability', kind: 'negative', scenario: 'user cannot forge a read-state for another user' }, // prettier-ignore
      async () => {
        await mark
          .from('lead_reads')
          .insert({ lead_id: ctx.fixture.voltline.lead, user_id: ctx.ids.liam });
        // Liam is the only one who could see his own row — verify through him.
        const { data } = await liam
          .from('lead_reads')
          .select('user_id')
          .eq('lead_id', ctx.fixture.voltline.lead)
          .eq('user_id', ctx.ids.liam);
        if (data && data.length) {
          await liam.from('lead_reads').delete().eq('lead_id', ctx.fixture.voltline.lead).eq('user_id', ctx.ids.liam); // prettier-ignore
          fail('HOLE — a user forged another user read-state');
        }
        await mark.from('lead_reads').delete().eq('lead_id', ctx.fixture.voltline.lead).eq('user_id', ctx.ids.mark); // prettier-ignore
      },
    );
  },
};
