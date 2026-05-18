// =============================================================================
// Leads inbox — data access (Phase 3 · first wired surface).
//
// The leads inbox reads the `leads` table; RLS bounds the rows (a client sees
// only their own client's leads, an operator sees every accessible client) —
// so the same query is correct for both the client and admin views, and the
// dispatch picks only which row shape to map to.
//
// Presentation-only fields the stub carried (`preview`, the admin activity
// blurb, `unread`) are derived here from `lead_events` / `lead_reads` per
// design doc §5 — the schema stores structure, the front end composes display.
//
// queryFn throws `AppError`; React Query catches it into a typed `error`.
// =============================================================================

import { useQuery } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import type {
  AdminLeadRow,
  ClientLeadRow,
  LeadClientTone,
  LeadStatus,
  LeadUrgency,
} from './types';

// ---- Normalised inbox record (role-neutral; both views map from this) ----

type LeadActivity = {
  meta: string;
  metaTone: 'good' | 'rust' | 'quiet';
};

export type LeadInboxRecord = {
  id: string;
  name: string;
  status: LeadStatus;
  urgency: LeadUrgency;
  createdAt: string;
  suburb: string | null;
  clientName: string;
  clientIndustry: string;
  clientSlug: string;
  preview: string;
  activity: LeadActivity;
  unread: boolean;
};

// ---- The Supabase row shapes the select returns ----

type LeadEventRow = {
  kind: string;
  occurred_at: string;
  automation_id: string | null;
  payload: unknown;
};

type LeadJoinRow = {
  id: string;
  status: LeadStatus;
  urgency: LeadUrgency;
  customer_name_snapshot: string;
  created_at: string;
  customer: { suburb: string | null } | null;
  client: { name: string; industry: string; slug: string } | null;
  lead_events: LeadEventRow[];
};

const LEAD_SELECT =
  'id, status, urgency, customer_name_snapshot, created_at, ' +
  'customer:customers(suburb), ' +
  'client:clients(name, industry, slug), ' +
  'lead_events(kind, occurred_at, automation_id, payload)';

// ---- Derivations (design doc §5 — stub fields the schema does not store) ----

const MESSAGE_KINDS = new Set(['sms_in', 'sms_out', 'email_in', 'email_out']);

function payloadObject(payload: unknown): Record<string, unknown> {
  return payload !== null && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : {};
}

/** The inbox preview line — the funnel form's job answer, else the latest
 *  message body, else a quiet fallback. */
function derivePreview(events: LeadEventRow[]): string {
  const form = events.find((e) => e.kind === 'form_submitted');
  if (form) {
    const fields = payloadObject(form.payload).fields;
    if (Array.isArray(fields)) {
      const typed = fields as { label?: string; value?: string }[];
      const job = typed.find((f) => /job/i.test(f.label ?? '')) ?? typed[0];
      if (job?.value) return job.value;
    }
  }

  const latestMessage = [...events]
    .filter((e) => MESSAGE_KINDS.has(e.kind))
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  const body = payloadObject(latestMessage?.payload).body;
  if (typeof body === 'string' && body.length > 0) return body;

  return 'No message yet';
}

/** The admin row's last-activity blurb (design doc §5 #1 — derived, not a
 *  stored `meta` column). */
function deriveActivity(events: LeadEventRow[]): LeadActivity {
  if (events.length === 0) return { meta: 'New enquiry', metaTone: 'rust' };

  const latest = [...events].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  )[0];

  switch (latest.kind) {
    case 'sms_in':
    case 'email_in':
      return { meta: 'Reply waiting', metaTone: 'rust' };
    case 'sms_out':
    case 'email_out':
      return latest.automation_id
        ? { meta: 'Auto-replied', metaTone: 'good' }
        : { meta: 'You replied', metaTone: 'quiet' };
    case 'booking_created':
      return { meta: 'Booked', metaTone: 'good' };
    case 'status_changed':
      return { meta: 'Status updated', metaTone: 'quiet' };
    default:
      return { meta: 'New enquiry', metaTone: 'rust' };
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const out = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return out.toUpperCase() || '?';
}

const KNOWN_TONES = new Set<LeadClientTone>([
  'voltline',
  'freshhome',
  'keyhero',
  'neatworks',
  'flowline',
]);

function toClientTone(slug: string): LeadClientTone {
  return KNOWN_TONES.has(slug as LeadClientTone)
    ? (slug as LeadClientTone)
    : 'generic';
}

// ---- Fetch ----

async function fetchLeadInbox(): Promise<LeadInboxRecord[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const [leadsResult, readsResult] = await Promise.all([
    supabase
      .from('leads')
      .select(LEAD_SELECT)
      .order('created_at', { ascending: false }),
    supabase.from('lead_reads').select('lead_id').eq('user_id', user.id),
  ]);

  if (leadsResult.error) throw normalizeError(leadsResult.error);
  if (readsResult.error) throw normalizeError(readsResult.error);

  const readLeadIds = new Set(
    (readsResult.data ?? []).map((r) => r.lead_id),
  );

  return (leadsResult.data as unknown as LeadJoinRow[]).map((row) => ({
    id: row.id,
    name: row.customer_name_snapshot,
    status: row.status,
    urgency: row.urgency,
    createdAt: row.created_at,
    suburb: row.customer?.suburb ?? null,
    clientName: row.client?.name ?? 'Unknown client',
    clientIndustry: row.client?.industry ?? '',
    clientSlug: row.client?.slug ?? 'generic',
    preview: derivePreview(row.lead_events),
    activity: deriveActivity(row.lead_events),
    unread: !readLeadIds.has(row.id),
  }));
}

// ---- Row mappers ----

function toClientLeadRow(record: LeadInboxRecord): ClientLeadRow {
  return {
    id: record.id,
    initial: initials(record.name),
    name: record.name,
    suburb: record.suburb ?? '',
    preview: record.preview,
    status: record.status,
    urgency: record.urgency,
    age: relativeTime(record.createdAt),
    unread: record.unread,
    href: `/leads/${record.id}`,
  };
}

function toAdminLeadRow(record: LeadInboxRecord): AdminLeadRow {
  return {
    id: record.id,
    initial: initials(record.name),
    name: record.name,
    clientName: record.clientName,
    clientService: record.clientIndustry,
    clientTone: toClientTone(record.clientSlug),
    preview: record.preview,
    status: record.status,
    age: relativeTime(record.createdAt),
    meta: record.activity.meta,
    metaTone: record.activity.metaTone,
    unread: record.unread,
    href: `/leads/${record.id}`,
  };
}

// ---- Hooks ----

const LEADS_INBOX_KEY = ['leads', 'inbox'] as const;

/** The client leads inbox — RLS bounds rows to the signed-in client. */
export function useClientLeadsInbox() {
  return useQuery({
    queryKey: LEADS_INBOX_KEY,
    queryFn: fetchLeadInbox,
    select: (records) => records.map(toClientLeadRow),
  });
}

/** The operator cross-client leads inbox — RLS bounds rows to the operator's
 *  accessible clients. */
export function useAdminLeadsInbox() {
  return useQuery({
    queryKey: LEADS_INBOX_KEY,
    queryFn: fetchLeadInbox,
    select: (records) => records.map(toAdminLeadRow),
  });
}
