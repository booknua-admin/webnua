// =============================================================================
// Meta Ads — lead-sync helpers.
//
// Phase 7 Meta Ads. The bridge from Meta's /leads endpoint response to
// public.leads + public.lead_events. Mirrors the shape /api/forms/submit
// uses so a Meta-sourced lead is indistinguishable from a website / funnel /
// test-submit lead at every downstream surface (inbox, dashboard, lead
// detail, automation triggers).
//
// Key design call — we DEDUPE on meta_lead_id by reading lead_events.payload
// (the canonical Meta lead id from the lead-create event). Adding a column
// to public.leads to make this lookup fast is a follow-up; at lead volumes
// the operator sees today, the event scan is comfortable.
//
// SERVER-ONLY — uses the service-role client through getIntegrationDb().
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { MetaLeadRow } from './types';

// --- helpers -----------------------------------------------------------------

/** Find the email/full-name/phone in Meta's flat field_data array. Meta
 *  emits well-known field types for `EMAIL`, `FULL_NAME`, `PHONE_NUMBER` —
 *  custom questions arrive as `CUSTOM` with the question label as `name`. */
function extractKnownField(
  fields: MetaLeadRow['field_data'],
  candidates: string[],
): string | null {
  if (!Array.isArray(fields)) return null;
  for (const candidate of candidates) {
    const match = fields.find(
      (f) => typeof f.name === 'string' && f.name.toLowerCase() === candidate.toLowerCase(),
    );
    const val = match?.values?.[0];
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  }
  return null;
}

function nameFromLead(lead: MetaLeadRow): string {
  const full = extractKnownField(lead.field_data, ['full_name', 'name']);
  if (full) return full;
  const first = extractKnownField(lead.field_data, ['first_name']) ?? '';
  const last = extractKnownField(lead.field_data, ['last_name']) ?? '';
  const combined = `${first} ${last}`.trim();
  return combined.length > 0 ? combined : 'Meta lead';
}

function emailFromLead(lead: MetaLeadRow): string | null {
  return extractKnownField(lead.field_data, ['email']);
}

function phoneFromLead(lead: MetaLeadRow): string | null {
  return extractKnownField(lead.field_data, ['phone_number', 'phone']);
}

// --- core --------------------------------------------------------------------

export type IngestResult = {
  inserted: number;
  skipped: number;
  errors: number;
};

/**
 * Ingest a batch of Meta leads — for each:
 *   1. Look it up by `meta_lead_id` in lead_events.payload (dedupe).
 *   2. New leads: create customer + lead + lead_event (form_submitted),
 *      then enqueue the lead-acknowledgment SMS and the operator
 *      new-lead notification.
 *   3. Skip already-ingested leads silently.
 *
 * `clientId` is the Webnua client this Meta form is wired to. Resolved
 * by the caller from meta_lead_forms.client_id, not from anything the
 * Meta payload says (trust boundary — never let Meta's response decide
 * tenant).
 */
export async function ingestMetaLeads(
  db: SupabaseClient,
  clientId: string,
  leads: MetaLeadRow[],
): Promise<IngestResult> {
  const result: IngestResult = { inserted: 0, skipped: 0, errors: 0 };
  if (leads.length === 0) return result;

  // Pre-fetch existing meta_lead_ids for this client in one query — cheaper
  // than N round-trips when nothing new arrived (the common case once
  // steady-state).
  const candidateIds = leads
    .map((l) => l.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const existing = await findExistingMetaLeadIds(db, clientId, candidateIds);

  for (const lead of leads) {
    if (!lead.id) {
      result.errors += 1;
      continue;
    }
    if (existing.has(lead.id)) {
      result.skipped += 1;
      continue;
    }
    try {
      await ingestSingleLead(db, clientId, lead);
      result.inserted += 1;
    } catch (err) {
      // Swallow per-lead errors so one bad payload doesn't fail the whole
      // sync. The job result captures the count; integration_call_log
      // captures the actual API responses.
      console.warn(
        `[meta-ads] ingest failed for lead ${lead.id}:`,
        err instanceof Error ? err.message : err,
      );
      result.errors += 1;
    }
  }
  return result;
}

async function findExistingMetaLeadIds(
  db: SupabaseClient,
  clientId: string,
  metaLeadIds: string[],
): Promise<Set<string>> {
  if (metaLeadIds.length === 0) return new Set();
  // lead_events.payload->>'meta_lead_id' — we'll write this on the
  // form_submitted event below. This dedupes across re-runs of the sync
  // job AND across overlapping cron + manual sync invocations.
  const { data, error } = await db
    .from('lead_events')
    .select('payload, lead_id, leads:leads!inner(client_id)')
    .eq('kind', 'form_submitted')
    .eq('leads.client_id', clientId)
    .filter('payload->>meta_lead_id', 'in', `(${metaLeadIds.map((id) => `"${id}"`).join(',')})`);
  if (error) {
    // On a query failure, fall back to "treat everything as new" rather
    // than re-inserting — the unique-on-meta_lead_id sweep below would
    // double-insert. The caller logs the error and reports it on the
    // job row.
    throw new Error(`findExistingMetaLeadIds failed: ${error.message}`);
  }
  const found = new Set<string>();
  for (const row of (data as Array<{ payload: unknown }> | null) ?? []) {
    const payload = row.payload;
    if (payload && typeof payload === 'object' && 'meta_lead_id' in payload) {
      const id = (payload as { meta_lead_id?: unknown }).meta_lead_id;
      if (typeof id === 'string') found.add(id);
    }
  }
  return found;
}

async function ingestSingleLead(
  db: SupabaseClient,
  clientId: string,
  lead: MetaLeadRow,
): Promise<void> {
  const name = nameFromLead(lead);
  const email = emailFromLead(lead);
  const phone = phoneFromLead(lead);

  // 1. customer row. Lookup-by-phone-or-email-first would be a nicer
  // dedupe — for V1 we just always insert a new customer and let an
  // operator merge if needed. Matches the /api/forms/submit shape.
  const { data: customer, error: customerError } = await db
    .from('customers')
    .insert({ client_id: clientId, name, email, phone } as unknown as never)
    .select('id')
    .single();
  if (customerError || !customer) {
    throw new Error(`customer insert failed: ${customerError?.message ?? 'no row'}`);
  }

  // 2. lead row. source_kind='meta' was reserved by migration 0043.
  const { data: leadRow, error: leadError } = await db
    .from('leads')
    .insert({
      client_id: clientId,
      customer_id: (customer as { id: string }).id,
      customer_name_snapshot: name,
      customer_phone_snapshot: phone,
      status: 'new',
      urgency: 'none',
      source: lead.ad_name ? `Meta Ads · ${lead.ad_name}` : 'Meta Ads',
      source_kind: 'meta',
      source_funnel_id: null,
      submission_id: null,
    } as unknown as never)
    .select('id')
    .single();
  if (leadError || !leadRow) {
    throw new Error(`lead insert failed: ${leadError?.message ?? 'no row'}`);
  }
  const leadId = (leadRow as { id: string }).id;

  // 3. lead_events row with form_submitted + the Meta lead id in payload
  // for dedupe.
  const occurredAt = lead.created_time ?? new Date().toISOString();
  const { error: eventError } = await db.from('lead_events').insert({
    lead_id: leadId,
    kind: 'form_submitted',
    occurred_at: occurredAt,
    actor_user_id: null,
    payload: {
      source: 'meta_ads',
      meta_lead_id: lead.id,
      meta_form_id: lead.form_id,
      meta_ad_id: lead.ad_id,
      meta_ad_name: lead.ad_name,
      meta_campaign_id: lead.campaign_id,
      fields: (lead.field_data ?? []).map((f) => ({
        label: f.name ?? '',
        value: (f.values?.[0] ?? '').toString(),
        type: f.name === 'email' ? 'email' : f.name === 'phone_number' ? 'phone' : 'text',
      })),
      attachments: [],
    } as unknown as never,
  } as unknown as never);
  if (eventError) {
    throw new Error(`lead_event insert failed: ${eventError.message}`);
  }

  // 4. enqueue the lead-acknowledgment SMS if we have a phone. Same
  // pattern /api/forms/submit uses — best-effort, never blocks ingestion.
  if (phone) {
    try {
      await enqueueJobImmediate(
        'send_sms',
        {
          clientId,
          templateKey: 'lead_acknowledgment',
          recipientPhone: phone,
          relatedLeadId: leadId,
          contextOverrides: {
            'lead.firstName': name.split(' ')[0] ?? name,
          },
        },
        { clientId, provider: 'twilio', correlationId: leadId },
      );
    } catch (err) {
      console.warn(
        `[meta-ads] failed to enqueue lead_acknowledgment SMS for lead ${leadId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // The operator new-lead notification is fanned by the AFTER INSERT
  // trigger on public.leads (migration 0063) — no app-side enqueue
  // needed here. Same behaviour as /api/forms/submit.
}

// --- entry helpers (used by the job handler) ---------------------------------

export function defaultLeadsSyncWindow(): { fromUnix: number } {
  // Look back 1 hour — enough to cover a sync skip and Meta's eventual
  // delivery lag, much smaller than the dedup table's reach. The dedupe
  // by meta_lead_id makes a wider window safe; this is the API-call
  // pagination cap.
  return { fromUnix: Math.floor(Date.now() / 1000) - 60 * 60 };
}

export function getIntegrationDbForLeadSync() {
  return getIntegrationDb();
}
