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

import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import {
  LEAD_STATUS_LABEL,
  LEAD_URGENCY_LABEL,
  type AdminLeadRow,
  type ClientLeadRow,
  type ConversationDay,
  type ConversationMessage,
  type LeadClientTone,
  type LeadConversation,
  type LeadDetail,
  type LeadQuickAction,
  type LeadRailCard,
  type LeadStatus,
  type LeadTimelineDot,
  type LeadTimelineEvent,
  type LeadUrgency,
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

// =============================================================================
// Lead detail — one lead + its full lead_events timeline. Both the client and
// admin detail views read this; RLS makes the by-id fetch return nothing (→
// not_found) for a lead outside the caller's tenant.
// =============================================================================

type LeadDetailEventRow = {
  id: string;
  kind: string;
  occurred_at: string;
  scheduled_for: string | null;
  automation_id: string | null;
  payload: unknown;
};

type LeadDetailJoinRow = {
  id: string;
  status: LeadStatus;
  urgency: LeadUrgency;
  source: string | null;
  customer_name_snapshot: string;
  customer_phone_snapshot: string | null;
  created_at: string;
  customer: {
    suburb: string | null;
    email: string | null;
    address: string | null;
  } | null;
  client: { name: string; slug: string } | null;
  lead_events: LeadDetailEventRow[];
};

const LEAD_DETAIL_SELECT =
  'id, status, urgency, source, customer_name_snapshot, ' +
  'customer_phone_snapshot, created_at, ' +
  'customer:customers(suburb, email, address), ' +
  'client:clients(name, slug), ' +
  'lead_events(id, kind, occurred_at, scheduled_for, automation_id, payload)';

const EVENT_DOT: Record<string, LeadTimelineDot> = {
  sms_in: 'sms-in',
  sms_out: 'sms-out',
  email_in: 'email',
  email_out: 'email',
  form_submitted: 'form',
  status_changed: 'status',
  booking_created: 'status',
  automation_fired: 'status',
};

function isFuture(iso: string | null): boolean {
  return iso != null && new Date(iso).getTime() > Date.now();
}

function eventDot(e: LeadDetailEventRow): LeadTimelineDot {
  if (isFuture(e.scheduled_for)) {
    return e.kind.startsWith('email') ? 'scheduled-email' : 'scheduled-sms';
  }
  return EVENT_DOT[e.kind] ?? 'status';
}

function eventMetaLabel(e: LeadDetailEventRow): string {
  const auto = e.automation_id != null ? ' · automated' : '';
  switch (e.kind) {
    case 'sms_in':
      return 'SMS · INCOMING';
    case 'sms_out':
      return `SMS · OUTGOING${auto}`;
    case 'email_in':
      return 'EMAIL · INCOMING';
    case 'email_out':
      return `EMAIL · OUTGOING${auto}`;
    case 'form_submitted':
      return 'FORM SUBMIT';
    case 'status_changed':
      return 'STATUS';
    case 'booking_created':
      return 'BOOKING';
    case 'automation_fired':
      return 'AUTOMATION';
    default:
      return 'EVENT';
  }
}

function mapTimelineEvent(e: LeadDetailEventRow): LeadTimelineEvent {
  const payload = payloadObject(e.payload);
  const when = isFuture(e.scheduled_for) ? e.scheduled_for! : e.occurred_at;

  const event: LeadTimelineEvent = {
    id: e.id,
    dot: eventDot(e),
    meta: (
      <>
        <span>{eventMetaLabel(e)}</span>
        <span>·</span>
        <span>{relativeTime(when)}</span>
      </>
    ),
    auto: e.automation_id != null,
    pending: isFuture(e.scheduled_for),
  };

  if (MESSAGE_KINDS.has(e.kind)) {
    const body = payload.body;
    if (typeof body === 'string' && body.length > 0) event.snippet = `"${body}"`;
    return event;
  }

  if (e.kind === 'form_submitted') {
    const fields = Array.isArray(payload.fields)
      ? (payload.fields as { label?: string; value?: string }[])
      : [];
    if (fields.length > 0) {
      event.snippet = (
        <>
          {fields.map((f, i) => (
            <span key={i}>
              <strong>{f.label}</strong>
              <br />
              {f.value}
              {i < fields.length - 1 ? (
                <>
                  <br />
                  <br />
                </>
              ) : null}
            </span>
          ))}
        </>
      );
    }
    return event;
  }

  if (e.kind === 'status_changed') {
    const from = typeof payload.from === 'string' ? payload.from : '';
    const to = typeof payload.to === 'string' ? payload.to : '';
    event.body = `Status changed${from ? ` from "${from}"` : ''}${
      to ? ` to "${to}"` : ''
    }.`;
  }

  return event;
}

function buildLeadDetail(row: LeadDetailJoinRow): LeadDetail {
  const events = [...row.lead_events].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
  const conversationHref = `/leads/${row.id}/conversation`;
  const first = row.customer_name_snapshot.trim().split(/\s+/)[0] ?? '';
  const rest = row.customer_name_snapshot.slice(first.length).trim();
  const suburb = row.customer?.suburb ?? null;

  const metaParts: ReactNode[] = [];
  if (row.customer_phone_snapshot) {
    metaParts.push(<strong key="phone">{row.customer_phone_snapshot}</strong>);
  }
  if (row.customer?.email) metaParts.push(row.customer.email);
  if (suburb) metaParts.push(suburb);

  const rail: LeadRailCard[] = [
    {
      heading: '// LEAD DETAILS',
      rows: [
        { label: 'Source', value: row.source ?? 'Direct' },
        { label: 'Status', value: LEAD_STATUS_LABEL[row.status] },
        { label: 'Urgency', value: LEAD_URGENCY_LABEL[row.urgency] || 'None' },
        { label: 'First seen', value: relativeTime(row.created_at) },
      ],
    },
  ];

  const customerRows = [
    row.customer_phone_snapshot
      ? { label: 'Phone', value: row.customer_phone_snapshot }
      : null,
    row.customer?.email ? { label: 'Email', value: row.customer.email } : null,
    suburb ? { label: 'Suburb', value: suburb } : null,
    row.customer?.address
      ? { label: 'Address', value: row.customer.address }
      : null,
  ].filter((r): r is { label: string; value: string } => r != null);
  if (customerRows.length > 0) {
    rail.push({ heading: '// CUSTOMER', rows: customerRows });
  }

  const quickActions: LeadQuickAction[] = [
    { icon: '☏', label: `Call ${first} back`, primary: true },
    { icon: '✉', label: 'Open conversation', href: conversationHref },
    { icon: '▤', label: 'Book a job from this lead' },
    { icon: '⤿', label: 'Push to follow-up' },
  ];

  const detail: LeadDetail = {
    id: row.id,
    backHref: '/leads',
    backLabel: 'Back to lead inbox',
    tag: `// Lead · ${row.customer_name_snapshot}${
      suburb ? ` · ${suburb}` : ''
    }`,
    title: rest ? (
      <>
        {first} <em>{rest}</em>.
      </>
    ) : (
      <>{first}.</>
    ),
    subtitle: (
      <>
        Lead via <strong>{row.source ?? 'a direct enquiry'}</strong>.{' '}
        {events.length} {events.length === 1 ? 'event' : 'events'} on the
        timeline.
      </>
    ),
    avatar: initials(row.customer_name_snapshot),
    name: row.customer_name_snapshot,
    metaParts,
    status: row.status,
    timeline: { eventCount: events.length, events: events.map(mapTimelineEvent) },
    quickActions,
    rail,
    conversationHref,
  };
  if (row.client?.name) detail.clientPillLabel = row.client.name;
  return detail;
}

async function fetchLeadDetail(id: string): Promise<LeadDetail> {
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_DETAIL_SELECT)
    .eq('id', id)
    .single();

  // PGRST116 (no row) → not_found — RLS-hidden and genuinely-absent are
  // deliberately indistinguishable (errors.ts / design §8).
  if (error) throw normalizeError(error);

  return buildLeadDetail(data as unknown as LeadDetailJoinRow);
}

/** One lead + its timeline. RLS scopes the by-id fetch to the caller's
 *  tenant; a lead outside it resolves as not_found. */
export function useLeadDetail(id: string) {
  return useQuery({
    queryKey: ['leads', 'detail', id],
    queryFn: () => fetchLeadDetail(id),
    enabled: id.length > 0,
  });
}

// =============================================================================
// Lead conversation — the two-way message thread. The thread is the
// message-kind `lead_events` (sms/email in/out) grouped into days; status +
// form events fold in as `system` bubbles for context.
// =============================================================================

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function conversationDayLabel(iso: string): string {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (d.toDateString() === now.toDateString()) return `Today · ${dateStr}`;
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${dateStr}`;
  }
  return dateStr;
}

/** Map one lead_event to a conversation bubble — or null for kinds that are
 *  not part of the thread (e.g. automation_fired). */
function mapConversationMessage(
  e: LeadDetailEventRow,
): ConversationMessage | null {
  const payload = payloadObject(e.payload);
  const time = clockTime(e.occurred_at);
  const channel: 'SMS' | 'Email' = e.kind.startsWith('email')
    ? 'Email'
    : 'SMS';

  if (MESSAGE_KINDS.has(e.kind)) {
    const body = typeof payload.body === 'string' ? payload.body : '';
    const sender =
      typeof payload.senderName === 'string' ? payload.senderName : '';
    const incoming = e.kind === 'sms_in' || e.kind === 'email_in';

    if (incoming) {
      return { id: e.id, kind: 'incoming', body, channel, time };
    }

    const message: ConversationMessage = {
      id: e.id,
      kind: e.automation_id != null ? 'auto' : 'outgoing',
      body,
      time,
      delivered: payload.delivered === true,
    };
    if (e.automation_id != null) {
      message.autoLabel = `AUTO · ${channel}`;
    } else {
      message.metaPrefix = sender
        ? `${channel} · ${sender.toUpperCase()}`
        : channel;
    }
    return message;
  }

  if (e.kind === 'form_submitted') {
    return {
      id: e.id,
      kind: 'system',
      body: 'Submitted the enquiry form.',
      time,
    };
  }

  if (e.kind === 'status_changed') {
    const to = typeof payload.to === 'string' ? payload.to : '';
    return {
      id: e.id,
      kind: 'system',
      body: `Status changed${to ? ` to "${to}"` : ''}.`,
      time,
    };
  }

  if (e.kind === 'booking_created') {
    return { id: e.id, kind: 'system', body: 'Booking created.', time };
  }

  return null;
}

function buildLeadConversation(row: LeadDetailJoinRow): LeadConversation {
  const first = row.customer_name_snapshot.trim().split(/\s+/)[0] ?? '';
  const suburb = row.customer?.suburb ?? null;

  // Chronological — the thread reads top-to-bottom.
  const ordered = [...row.lead_events].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  );

  const days: ConversationDay[] = [];
  for (const event of ordered) {
    const message = mapConversationMessage(event);
    if (!message) continue;
    const dayId = event.occurred_at.slice(0, 10);
    let day = days.find((d) => d.id === dayId);
    if (!day) {
      day = {
        id: dayId,
        label: conversationDayLabel(event.occurred_at),
        messages: [],
      };
      days.push(day);
    }
    day.messages.push(message);
  }

  const messageCount = days.reduce((n, d) => n + d.messages.length, 0);
  const firstEvent = ordered[0];

  const detailRows = [
    row.customer_phone_snapshot
      ? { label: 'Phone', value: row.customer_phone_snapshot }
      : null,
    suburb ? { label: 'Suburb', value: suburb } : null,
    { label: 'Source', value: row.source ?? 'Direct' },
    { label: 'Status', value: LEAD_STATUS_LABEL[row.status] },
  ].filter((r): r is { label: string; value: string } => r != null);

  const rail: LeadRailCard[] = [
    { heading: '// LEAD DETAILS', rows: detailRows },
    {
      heading: '// CONVERSATION META',
      rows: [
        {
          label: 'Started',
          value: firstEvent ? conversationDayLabel(firstEvent.occurred_at) : '—',
        },
        { label: 'Messages', value: `${messageCount} total` },
      ],
    },
  ];

  return {
    id: row.id,
    backHref: `/leads/${row.id}`,
    backLabel: `Back to ${row.customer_name_snapshot}`,
    tag: `// CONVERSATION · ${row.customer_name_snapshot} · lead`,
    title: (
      <>
        Reply to <em>{first}</em>.
      </>
    ),
    subtitle: (
      <>
        Two-way message thread with this lead.{' '}
        <strong>Automated messages carry the “AUTO” tag</strong> so you always
        know what was you versus the system.
      </>
    ),
    avatar: initials(row.customer_name_snapshot),
    name: row.customer_name_snapshot,
    headerMeta: (
      <>
        {row.customer_phone_snapshot ? (
          <strong>{row.customer_phone_snapshot}</strong>
        ) : null}
        {suburb ? ` · ${suburb}` : ''} · lead
      </>
    ),
    channelTabs: [
      { id: 'sms', label: 'SMS' },
      { id: 'email', label: 'Email' },
    ],
    headerActions: ['☏', '⌄', '⋯'],
    days,
    composer: {
      channels: ['SMS', 'Email'],
      channelToggle: 'SMS ↕',
      placeholder: `Reply to ${first}…`,
      helpers: ['+ Insert variable', '+ Booking link', '+ Quote template'],
    },
    quickReplies: [
      { icon: '☏', label: 'Confirm a call-back time' },
      { icon: '▤', label: 'Send a booking link' },
      { icon: '✦', label: 'Share the quote range' },
    ],
    rail,
  };
}

async function fetchLeadConversation(id: string): Promise<LeadConversation> {
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_DETAIL_SELECT)
    .eq('id', id)
    .single();

  if (error) throw normalizeError(error);

  return buildLeadConversation(data as unknown as LeadDetailJoinRow);
}

/** One lead's message thread. RLS scopes the by-id fetch to the caller's
 *  tenant; a lead outside it resolves as not_found. */
export function useLeadConversation(id: string) {
  return useQuery({
    queryKey: ['leads', 'conversation', id],
    queryFn: () => fetchLeadConversation(id),
    enabled: id.length > 0,
  });
}
