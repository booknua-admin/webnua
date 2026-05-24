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

import type { SupabaseClient } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CopyableId } from '@/components/shared/CopyableId';
import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

/** Untyped browser-client view — `gbp_review_requests` is not yet in the
 *  generated Database type. Same pattern as `lib/reviews/queries.tsx` etc. */
function untypedDb(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
import type { SubmittedFormField } from '@/lib/website/form-config';

import {
  LEAD_STATUS_LABEL,
  LEAD_URGENCY_LABEL,
  type AdminLeadRow,
  type ClientLeadRow,
  type ConversationDay,
  type ConversationMessage,
  type LeadClientTone,
  type LeadCompletion,
  type LeadConversation,
  type LeadDetail,
  type LeadQuickAction,
  type LeadRailCard,
  type LeadRailRow,
  type LeadSourceKind,
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
  /** Has customer activity newer than the operator's last view. Drives the
   *  rust dot on the row and the per-tab count badge. */
  unread: boolean;
  completion: LeadCompletion;
  sourceKind: LeadSourceKind;
  /** Phase 8 Session 2 — cold-lead + handoff state. */
  needsFollowupAt: string | null;
  followupDismissedAt: string | null;
  nudgeCount: number;
  automationState: import('./types').LeadAutomationStateValue;
  lastOutboundAt: string | null;
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
  source_kind: 'website' | 'funnel' | 'meta' | null;
  // Phase 8 Session 2 — cold-lead + handoff columns from migration 0076.
  needs_followup_at: string | null;
  followup_dismissed_at: string | null;
  followup_nudge_count: number | null;
  automation_state: string | null;
  last_outbound_at: string | null;
  customer: { suburb: string | null } | null;
  client: { name: string; industry: string; slug: string } | null;
  lead_events: LeadEventRow[];
};

const LEAD_SELECT =
  'id, status, urgency, customer_name_snapshot, created_at, source_kind, ' +
  'needs_followup_at, followup_dismissed_at, followup_nudge_count, ' +
  'automation_state, last_outbound_at, ' +
  'customer:customers(suburb), ' +
  'client:clients(name, industry, slug), ' +
  'lead_events(kind, occurred_at, automation_id, payload)';

// ---- Derivations (design doc §5 — stub fields the schema does not store) ----

const MESSAGE_KINDS = new Set(['sms_in', 'sms_out', 'email_in', 'email_out']);

/** Hours from a lead's first `form_submitted` event before a step-1-only
 *  lead is considered "dropped" by internal automation logic. V1 choice —
 *  documented in CLAUDE.md "Funnel lead completion state" with the revisit
 *  trigger (operators report leads marked dropped too soon, or sit
 *  in-progress forever). */
export const LEAD_DROP_OFF_HOURS = 24;

/** Count of `form_submitted` events on a lead — the spine of `LeadCompletion`.
 *  A step-1-only visitor lands as one `form_submitted`; the threading from
 *  PR #73 stitches their step-2 submit onto the same lead, so a completed
 *  funnel run reads as 2. */
function countFormSubmits(events: LeadEventRow[]): number {
  let n = 0;
  for (const e of events) if (e.kind === 'form_submitted') n += 1;
  return n;
}

/** Derive the completion state. Two-state for V1: `in_progress` (1 submit)
 *  or `completed` (≥2 submits). The 24-hour drop-off threshold is read by
 *  `isLeadDroppedOff` for automation logic — the inbox filter does NOT need
 *  the third state because the operator is filtering by action, not by
 *  lead quality. */
function deriveCompletion(events: LeadEventRow[]): LeadCompletion {
  return countFormSubmits(events) >= 2 ? 'completed' : 'in_progress';
}

/** True when a lead has only a step-1 submit AND its first submit is
 *  older than `LEAD_DROP_OFF_HOURS`. Used by internal automation logic
 *  (the "send a follow-up nudge" decision); NOT surfaced as a lead label
 *  on the inbox row. Exported so automation read paths can call it. */
export function isLeadDroppedOff(
  events: LeadEventRow[],
  now: Date = new Date(),
): boolean {
  const submits = events.filter((e) => e.kind === 'form_submitted');
  if (submits.length !== 1) return false;
  const firstAt = Date.parse(submits[0].occurred_at);
  if (!Number.isFinite(firstAt)) return false;
  return now.getTime() - firstAt >= LEAD_DROP_OFF_HOURS * 3600 * 1000;
}

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

/** Customer-initiated event kinds — what counts as "something to look at".
 *  Operator-side activity (status changes, our own outbound) does NOT count;
 *  the operator already knows about their own actions. */
const CUSTOMER_ACTIVITY_KINDS = new Set([
  'form_submitted',
  'sms_in',
  'email_in',
]);

/** True when the lead has customer activity newer than the operator's last
 *  view (or has never been opened). Drives the rust dot on the inbox row
 *  and the rust count badge on the tab. Opening the lead detail upserts
 *  `lead_reads.read_at = now()` which clears the flag — same model as a
 *  standard email inbox: see something new, open it, it stops shouting.
 *
 *  `readAt = null` → lead has never been opened → unread if any customer
 *  activity exists at all. */
function deriveUnread(events: LeadEventRow[], readAt: string | null): boolean {
  if (readAt === null) {
    return events.some((e) => CUSTOMER_ACTIVITY_KINDS.has(e.kind));
  }
  return events.some(
    (e) =>
      CUSTOMER_ACTIVITY_KINDS.has(e.kind) && e.occurred_at > readAt,
  );
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
    supabase
      .from('lead_reads')
      .select('lead_id, read_at')
      .eq('user_id', user.id),
  ]);

  if (leadsResult.error) throw normalizeError(leadsResult.error);
  if (readsResult.error) throw normalizeError(readsResult.error);

  const readAtByLead = new Map<string, string>();
  for (const r of (readsResult.data ?? []) as { lead_id: string; read_at: string }[]) {
    readAtByLead.set(r.lead_id, r.read_at);
  }

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
    unread: deriveUnread(row.lead_events, readAtByLead.get(row.id) ?? null),
    completion: deriveCompletion(row.lead_events),
    sourceKind: row.source_kind ?? 'website',
    needsFollowupAt: row.needs_followup_at,
    followupDismissedAt: row.followup_dismissed_at,
    nudgeCount: row.followup_nudge_count ?? 0,
    automationState:
      (row.automation_state as LeadInboxRecord['automationState']) ?? 'automated',
    lastOutboundAt: row.last_outbound_at,
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
    completion: record.completion,
    sourceKind: record.sourceKind,
    needsFollowupAt: record.needsFollowupAt,
    followupDismissedAt: record.followupDismissedAt,
    nudgeCount: record.nudgeCount,
    automationState: record.automationState,
    lastOutboundAt: record.lastOutboundAt,
  };
}

function toAdminLeadRow(record: LeadInboxRecord): AdminLeadRow {
  return {
    id: record.id,
    initial: initials(record.name),
    name: record.name,
    clientName: record.clientName,
    clientService: record.clientIndustry,
    clientSlug: record.clientSlug,
    clientTone: toClientTone(record.clientSlug),
    preview: record.preview,
    status: record.status,
    age: relativeTime(record.createdAt),
    meta: record.activity.meta,
    metaTone: record.activity.metaTone,
    unread: record.unread,
    href: `/leads/${record.id}`,
    completion: record.completion,
    sourceKind: record.sourceKind,
    needsFollowupAt: record.needsFollowupAt,
    followupDismissedAt: record.followupDismissedAt,
    nudgeCount: record.nudgeCount,
    automationState: record.automationState,
    lastOutboundAt: record.lastOutboundAt,
  };
}

/** True when a row should appear on the "Needs follow-up" tab — the cold
 *  lead surface. Exported so admin + client content files share the rule. */
export function isColdLeadRow(row: { needsFollowupAt: string | null; followupDismissedAt: string | null }): boolean {
  return row.needsFollowupAt !== null && row.followupDismissedAt === null;
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
  client_id: string;
  status: LeadStatus;
  urgency: LeadUrgency;
  source: string | null;
  submission_id: string | null;
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
  'id, client_id, status, urgency, source, submission_id, customer_name_snapshot, ' +
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

// ---- Lead-attachment signed URLs --------------------------------------------
//
// Form image uploads land in the PRIVATE `lead-attachments` bucket; the
// lead_events payload stores the storage path. The inbox resolves a
// short-lived signed URL per path at fetch time (a stored URL would expire).

type FormAttachment = { fieldId?: string; label?: string; path?: string };

function eventAttachments(payload: Record<string, unknown>): FormAttachment[] {
  return Array.isArray(payload.attachments)
    ? (payload.attachments as FormAttachment[])
    : [];
}

function collectAttachmentPaths(events: LeadDetailEventRow[]): string[] {
  const paths = new Set<string>();
  for (const e of events) {
    if (e.kind !== 'form_submitted') continue;
    for (const a of eventAttachments(payloadObject(e.payload))) {
      if (a.path) paths.add(a.path);
    }
  }
  return [...paths];
}

async function signAttachmentUrls(
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage
    .from('lead-attachments')
    .createSignedUrls(paths, 3600);
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

function mapTimelineEvent(
  e: LeadDetailEventRow,
  attachmentUrls: Record<string, string>,
): LeadTimelineEvent {
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
    const body = typeof payload.body === 'string' ? payload.body : '';
    const subject = typeof payload.subject === 'string' ? payload.subject : '';
    // Email events carry both subject + body; render subject as a bold lead
    // line above the snippet so the timeline is scannable even when (rare)
    // the body extraction came up empty. SMS events have no subject and
    // fall through to the body-only path.
    const hasSubject = (e.kind === 'email_in' || e.kind === 'email_out') && subject.length > 0;
    if (hasSubject && body.length > 0) {
      event.snippet = (
        <>
          <strong>{subject}</strong>
          <br />
          {body}
        </>
      );
    } else if (hasSubject) {
      event.snippet = <strong>{subject}</strong>;
    } else if (body.length > 0) {
      event.snippet = `"${body}"`;
    }
    return event;
  }

  if (e.kind === 'form_submitted') {
    const fields = Array.isArray(payload.fields)
      ? (payload.fields as { label?: string; value?: string }[])
      : [];
    const images = eventAttachments(payload)
      .map((a) => ({
        label: a.label,
        url: a.path ? attachmentUrls[a.path] : undefined,
      }))
      .filter((a): a is { label: string | undefined; url: string } => !!a.url);
    if (fields.length > 0 || images.length > 0) {
      event.snippet = (
        <>
          {fields.map((f, i) => (
            <span key={i}>
              <strong>{f.label}</strong>
              <br />
              {f.value}
              {i < fields.length - 1 || images.length > 0 ? (
                <>
                  <br />
                  <br />
                </>
              ) : null}
            </span>
          ))}
          {images.length > 0 ? (
            <span className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <a
                  key={i}
                  href={img.url}
                  target="_blank"
                  rel="noreferrer"
                  title={img.label ?? 'Attachment'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.label ?? 'Attachment'}
                    className="h-20 w-20 rounded-md border border-rule object-cover"
                  />
                </a>
              ))}
            </span>
          ) : null}
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

type GbpReviewRequestRow = {
  id: string;
  channel: 'sms' | 'email';
  sent_at: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  recipient_phone: string | null;
  recipient_email: string | null;
  resulted_in_review_id: string | null;
  error_message: string | null;
};

/** Map one `gbp_review_requests` row into a timeline event. Renders the
 *  channel + status in the meta line, the recipient + attribution in the
 *  body. A successful review attribution renders in good-green; a failed
 *  send shows the error in warn. */
function mapReviewRequestEvent(row: GbpReviewRequestRow): LeadTimelineEvent {
  const recipient = row.recipient_phone ?? row.recipient_email ?? 'customer';
  const channelLabel = row.channel === 'sms' ? 'SMS' : 'Email';
  let body: ReactNode;
  if (row.status === 'failed') {
    body = (
      <>
        Send to <strong>{recipient}</strong> failed
        {row.error_message ? <>: {row.error_message}</> : null}.
      </>
    );
  } else if (row.resulted_in_review_id) {
    body = (
      <>
        Sent to <strong>{recipient}</strong> · <span className="text-good">✓ Review left</span>
      </>
    );
  } else {
    body = (
      <>
        Sent to <strong>{recipient}</strong>
      </>
    );
  }
  return {
    id: `gbp-request-${row.id}`,
    dot: 'review-request',
    meta: (
      <>
        <span>Review request · {channelLabel}</span>
        <span>·</span>
        <span>{relativeTime(row.sent_at)}</span>
      </>
    ),
    body,
    auto: true,
  };
}

function buildLeadDetail(
  row: LeadDetailJoinRow,
  attachmentUrls: Record<string, string>,
  reviewRequests: GbpReviewRequestRow[],
): LeadDetail {
  const baseEvents = row.lead_events.map((e) =>
    mapTimelineEvent(e, attachmentUrls),
  );
  // `gbp_review_requests` rows are folded in as `review-request` timeline
  // events so the lead's timeline carries every customer-facing touchpoint
  // (form submission → SMS replies → review request sent → review left)
  // in one chronological view.
  const reviewEvents = reviewRequests.map(mapReviewRequestEvent);
  const allEvents = sortTimelineEvents(
    [...baseEvents, ...reviewEvents],
    row.lead_events,
    reviewRequests,
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

  const leadDetailRows: LeadRailRow[] = [
    { label: 'Source', value: row.source ?? 'Direct' },
    { label: 'Status', value: LEAD_STATUS_LABEL[row.status] },
    { label: 'Urgency', value: LEAD_URGENCY_LABEL[row.urgency] || 'None' },
    { label: 'First seen', value: relativeTime(row.created_at) },
  ];
  // The form `submission_id` lets an operator reconcile the lead back to the
  // exact public-form submission that created it. Only form-captured leads
  // carry one — a manual / imported lead has nothing to reconcile, so the row
  // is omitted rather than shown empty.
  if (row.submission_id) {
    leadDetailRows.push({
      label: 'Submission ID',
      value: <CopyableId value={row.submission_id} />,
    });
  }

  const rail: LeadRailCard[] = [
    { heading: '// LEAD DETAILS', rows: leadDetailRows },
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
        {allEvents.length} {allEvents.length === 1 ? 'event' : 'events'} on the
        timeline.
      </>
    ),
    avatar: initials(row.customer_name_snapshot),
    name: row.customer_name_snapshot,
    metaParts,
    status: row.status,
    timeline: {
      eventCount: allEvents.length,
      events: allEvents,
    },
    quickActions,
    rail,
    conversationHref,
    gbpContext: {
      clientId: row.client_id,
      recipientName: row.customer_name_snapshot || null,
      recipientPhone: row.customer_phone_snapshot ?? null,
      recipientEmail: row.customer?.email ?? null,
    },
  };
  if (row.client?.name) detail.clientPillLabel = row.client.name;
  return detail;
}

/** Combine the lead-event timeline events with the review-request events
 *  in reverse-chronological order. Both source arrays carry the timestamp
 *  on the underlying row; we map back through that to compare. */
function sortTimelineEvents(
  events: LeadTimelineEvent[],
  leadEvents: LeadDetailEventRow[],
  reviewRequests: GbpReviewRequestRow[],
): LeadTimelineEvent[] {
  const timestamps = new Map<string, string>();
  for (const e of leadEvents) {
    timestamps.set(e.id, e.scheduled_for ?? e.occurred_at);
  }
  for (const r of reviewRequests) {
    timestamps.set(`gbp-request-${r.id}`, r.sent_at);
  }
  return [...events].sort((a, b) => {
    const ta = timestamps.get(a.id) ?? '';
    const tb = timestamps.get(b.id) ?? '';
    return tb.localeCompare(ta);
  });
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

  const row = data as unknown as LeadDetailJoinRow;
  const [attachmentUrls, reviewRequests] = await Promise.all([
    signAttachmentUrls(collectAttachmentPaths(row.lead_events)),
    fetchReviewRequestsForLead(id),
  ]);
  return buildLeadDetail(row, attachmentUrls, reviewRequests);
}

async function fetchReviewRequestsForLead(
  leadId: string,
): Promise<GbpReviewRequestRow[]> {
  const { data, error } = await untypedDb()
    .from('gbp_review_requests')
    .select(
      'id, channel, sent_at, status, recipient_phone, recipient_email, resulted_in_review_id, error_message',
    )
    .eq('lead_id', leadId)
    .order('sent_at', { ascending: false });
  // Don't surface a query error as a lead-detail failure — the GBP table
  // is optional. PGRST205 = the table doesn't exist (migrations not yet
  // applied); other errors (RLS denial, network) also degrade silently.
  if (error) {
    if (error.code !== 'PGRST205') {
      console.warn('[lead-detail] gbp_review_requests fetch failed', error.message);
    }
    return [];
  }
  return (data as GbpReviewRequestRow[] | null) ?? [];
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

/** Bubble-meta timestamp. `Today · 3:07 PM` when the message is from
 *  today, `21/05/26 · 3:07 PM` otherwise. The day-prefix surfaces in the
 *  meta row alongside the channel pill so operators can scan threads
 *  spanning multiple days without expanding each bubble. */
function clockTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `Today · ${time}`;
  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  return `${date} · ${time}`;
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
    const subject = typeof payload.subject === 'string' ? payload.subject : '';
    const sender =
      typeof payload.senderName === 'string' ? payload.senderName : '';
    const incoming = e.kind === 'sms_in' || e.kind === 'email_in';
    // Email bubbles surface the subject inline above the body — the
    // conversation view needs to know "what this thread is about" without
    // pulling open the lead detail.
    const bubbleBody: ReactNode = subject ? (
      <>
        <strong>{subject}</strong>
        {body ? (
          <>
            <br />
            {body}
          </>
        ) : null}
      </>
    ) : (
      body
    );

    if (incoming) {
      return { id: e.id, kind: 'incoming', body: bubbleBody, channel, time };
    }

    const message: ConversationMessage = {
      id: e.id,
      kind: e.automation_id != null ? 'auto' : 'outgoing',
      body: bubbleBody,
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
    firstName: first,
    hasEmail: !!(row.customer?.email && row.customer.email.trim()),
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
    // Tab ids match the composer's channel vocab so the conversation
    // page can lift one piece of state to both — picking SMS in the
    // header also picks SMS in the composer (and vice versa).
    channelTabs: [
      { id: 'SMS', label: 'SMS' },
      { id: 'Email', label: 'Email' },
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

// ---- Lead status (write) ----------------------------------------------------

/** Move a lead to a new status and log the transition onto its timeline. */
async function updateLeadStatus(input: {
  leadId: string;
  status: LeadStatus;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // Read the current status so the timeline event records the transition.
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('status')
    .eq('id', input.leadId)
    .single();
  if (leadError) throw normalizeError(leadError);

  const previous = lead.status as LeadStatus;
  if (previous === input.status) return;

  const { error: updateError } = await supabase
    .from('leads')
    .update({ status: input.status })
    .eq('id', input.leadId);
  if (updateError) throw normalizeError(updateError);

  const { error: eventError } = await supabase.from('lead_events').insert({
    lead_id: input.leadId,
    kind: 'status_changed',
    occurred_at: new Date().toISOString(),
    actor_user_id: user.id,
    payload: {
      from: LEAD_STATUS_LABEL[previous],
      to: LEAD_STATUS_LABEL[input.status],
    },
  });
  if (eventError) throw normalizeError(eventError);
}

/** Change a lead's status. On success every leads query AND the dashboard
 *  / hub queries are invalidated so the inbox, the lead detail header +
 *  timeline, and the dashboard / hub stat tiles (urgent hero, leads-by-
 *  status counts, conversion funnel) all reflect the move. Without the
 *  `['dashboard']` invalidation a "→ booked" status change correctly
 *  updated the inbox row but left the dashboard counts stale until a
 *  hard refresh. */
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateLeadStatus,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ---- Mark a lead read ------------------------------------------------------
//
// Upserts a `lead_reads` row at `now()` for the signed-in user, so the next
// inbox fetch sees the lead as read (no rust dot, decremented tab badge).
// Same shape as `useMarkNotificationsRead`. Idempotent via the
// (lead_id, user_id) composite PK.

async function markLeadRead(leadId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const { error } = await supabase.from('lead_reads').upsert(
    {
      lead_id: leadId,
      user_id: user.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: 'lead_id,user_id' },
  );
  if (error) throw normalizeError(error);
}

/** Mark a lead read for the current user — clears the rust dot on the
 *  inbox row + decrements the tab count badge. Mounted on the lead-detail
 *  page so "opening the lead" is what marks it seen (the standard email
 *  inbox model). */
export function useMarkLeadRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markLeadRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LEADS_INBOX_KEY });
    },
  });
}

// ---- Create a lead from a form submission (write) ---------------------------
//
// A website / funnel form submission becomes a real lead: a `customers` row,
// a `leads` row, and the opening `form_submitted` `lead_events` entry that
// carries the answers. The dashboard conversion funnel counts `leads` rows,
// so a created lead feeds the platform analytics with no extra wiring.

export type CreateLeadInput = {
  /** The client (UUID) the website / funnel belongs to. */
  clientId: string;
  /** Categorical surface attribution — written to `leads.source_kind` and
   *  surfaced on the inbox row's Source column. */
  surfaceKind: 'website' | 'funnel';
  /** Human label of the form's origin, e.g. "Form · Hero". */
  source: string;
  fields: SubmittedFormField[];
  /**
   * Design-only (cross-step linking): when set, the submission appends a
   * `form_submitted` event to an existing lead instead of creating a new
   * one. Unused until the public funnel renderer threads a visitor-session
   * leadId across steps — every editor test-submit omits it.
   */
  existingLeadId?: string;
};

/** Builds the `form_submitted` lead_events payload from the submitted fields.
 *  `fields` matches the shape existing readers expect (`{label,value}`);
 *  `attachments` is additive — image fields whose upload produced a path. */
function formSubmittedPayload(source: string, fields: SubmittedFormField[]) {
  return {
    source,
    fields: fields.map((f) => ({ label: f.label, value: f.value, type: f.type })),
    attachments: fields
      .filter((f) => !!f.imagePath)
      .map((f) => ({ fieldId: f.fieldId, label: f.label, path: f.imagePath })),
  };
}

/**
 * The single submit seam. Today it writes directly (the editor test-submit
 * runs as an authenticated operator/client, which RLS permits). The future
 * public visitor renderer replaces this body with a service-role edge
 * function call — `useCreateLead` and every caller stay unchanged.
 */
async function submitLead(input: CreateLeadInput): Promise<{ leadId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const occurredAt = new Date().toISOString();
  const payload = formSubmittedPayload(input.source, input.fields);

  // Cross-step linking branch — append to an existing lead.
  if (input.existingLeadId) {
    const { error } = await supabase.from('lead_events').insert({
      lead_id: input.existingLeadId,
      kind: 'form_submitted',
      occurred_at: occurredAt,
      actor_user_id: user.id,
      payload,
    });
    if (error) throw normalizeError(error);
    return { leadId: input.existingLeadId };
  }

  // Resolve the lead's identity from the leadRole-tagged fields.
  const roleValue = (role: 'name' | 'email' | 'phone') =>
    input.fields.find((f) => f.leadRole === role)?.value.trim() || '';
  const name = roleValue('name') || 'Website enquiry';
  const email = roleValue('email') || null;
  const phone = roleValue('phone') || null;

  // The customer — V1 always inserts a fresh row; dedup by phone/email is a
  // later concern (kept a separate step so it can slot in).
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({ client_id: input.clientId, name, email, phone })
    .select('id')
    .single();
  if (customerError) throw normalizeError(customerError);

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    // `source_kind` was added by migration 0043 and won't appear in the
    // generated DB types until type-gen is re-run; cast through unknown so
    // the insert accepts the column. Same pattern as the analytics queries.
    .insert({
      client_id: input.clientId,
      customer_id: customer.id,
      customer_name_snapshot: name,
      customer_phone_snapshot: phone,
      status: 'new',
      urgency: 'none',
      source: input.source,
      source_kind: input.surfaceKind,
    } as unknown as never)
    .select('id')
    .single();
  if (leadError) throw normalizeError(leadError);

  const { error: eventError } = await supabase.from('lead_events').insert({
    lead_id: lead.id,
    kind: 'form_submitted',
    occurred_at: occurredAt,
    actor_user_id: user.id,
    payload,
  });
  if (eventError) throw normalizeError(eventError);

  return { leadId: lead.id };
}

/** Create a lead from a form submission. On success the leads inbox + the
 *  dashboard funnel queries are invalidated so the new lead surfaces. */
export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitLead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// =============================================================================
// Reply to a lead by email — the "Reply" button on the conversation view
// POSTs to /api/leads/[id]/reply, which sends via Resend, writes the
// email_messages row, and adds the email_out lead_event. We invalidate the
// conversation + detail queries so the new message appears immediately.
// =============================================================================

export type ReplyToLeadInput = {
  leadId: string;
  /** The email subject. Optional — the server derives "Re: …" from the
   *  most-recent inbound if omitted. */
  subject?: string;
  /** Plain-text body. */
  body: string;
};

async function postReplyToLead(input: ReplyToLeadInput): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw AppError.auth();

  const response = await fetch(`/api/leads/${input.leadId}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subject: input.subject ?? '',
      body: input.body,
    }),
  });
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };
    const message = errorBody.detail || errorBody.error || `HTTP ${response.status}`;
    throw new Error(messageFor(errorBody.error ?? '', message));
  }
}

function messageFor(code: string, fallback: string): string {
  switch (code) {
    case 'no-recipient-email':
      return 'No email address on file for this lead — cannot reply by email.';
    case 'no-active-sender':
      return 'No active email sender for this client — provision one in Settings → Email first.';
    case 'resend-not-configured':
      return 'Email sending is not configured for this deployment.';
    case 'empty-body':
      return 'The reply body is empty.';
    case 'forbidden-lead':
      return 'You do not have access to this lead.';
    case 'unauthenticated':
      return 'You are signed out — sign in again.';
    case 'lead-not-found':
      return 'Lead not found.';
    default:
      return fallback;
  }
}

/** Reply to a lead by email. Invalidates conversation + detail queries on
 *  success so the new outbound row appears. */
export function useReplyToLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postReplyToLead,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['leads', 'conversation', variables.leadId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['leads', 'detail', variables.leadId],
      });
      // Inbox 'meta' line is derived from latest event — refresh the inbox too.
      void queryClient.invalidateQueries({ queryKey: ['leads', 'inbox'] });
    },
  });
}

// =============================================================================
// Phase 8 Session 2 — handoff mutations + automation-state read.
//
// Each mutation POSTs an existing /api/leads/[id]/* route (which gates on
// requireLeadAccess and calls into lib/automations/handoff). On success we
// invalidate the inbox + detail queries so the UI re-renders without a
// manual refresh.
// =============================================================================

/** A small fetch wrapper for the lead-action routes. Bearer-token auth
 *  matches what `requireLeadAccess` (lib/automations/lead-access.ts) expects.
 *  Throws an AppError on a non-OK response so callers' error handling can be
 *  uniform with the rest of the queries module. */
async function postLeadAction(
  leadId: string,
  action: 'take-over' | 'dismiss-followup' | 'resume-automations',
  body?: Record<string, unknown>,
): Promise<unknown> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw AppError.auth();
  const res = await fetch(`/api/leads/${leadId}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ error: 'request-failed' }));
    throw AppError.unexpected(
      typeof detail.error === 'string' ? detail.error : 'lead-action-failed',
      String(res.status),
    );
  }
  return res.json();
}

export function useTakeOverLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => postLeadAction(leadId, 'take-over'),
    onSuccess: (_, leadId) => {
      void queryClient.invalidateQueries({ queryKey: ['leads', 'inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'detail', leadId] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'automation-state', leadId] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'cold'] });
    },
  });
}

export function useDismissFollowup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => postLeadAction(leadId, 'dismiss-followup'),
    onSuccess: (_, leadId) => {
      void queryClient.invalidateQueries({ queryKey: ['leads', 'inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'detail', leadId] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'automation-state', leadId] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'cold'] });
    },
  });
}

export function useResumeAutomations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => postLeadAction(leadId, 'resume-automations'),
    onSuccess: (_, leadId) => {
      void queryClient.invalidateQueries({ queryKey: ['leads', 'inbox'] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'detail', leadId] });
      void queryClient.invalidateQueries({ queryKey: ['leads', 'automation-state', leadId] });
    },
  });
}

// --- Automation state read --------------------------------------------------

export type LeadAutomationStateResponse = {
  lead: {
    id: string;
    status: string | null;
    automationState: 'automated' | 'taken_over' | 'completed' | 'archived';
    takenOverAt: string | null;
    takenOverBy: string | null;
    needsFollowupAt: string | null;
    followupDismissedAt: string | null;
    followupNudgeCount: number;
    lastInboundAt: string | null;
    lastOutboundAt: string | null;
  };
  runs: Array<{
    id: string;
    automationId: string;
    automationName: string;
    status: string;
    pausedReason: string | null;
    startedAt: string;
    pausedAt: string | null;
    currentActionPosition: number;
    totalActions: number;
    nextActionType: string | null;
    nextRunAt: string | null;
  }>;
};

async function fetchLeadAutomationState(
  leadId: string,
): Promise<LeadAutomationStateResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw AppError.auth();
  const res = await fetch(`/api/leads/${leadId}/automation-state`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw normalizeError(new Error('automation-state-fetch-failed'));
  return res.json();
}

/** Per-lead automation + handoff snapshot. Drives the side-rail panel on
 *  the lead detail page. */
export function useLeadAutomationState(leadId: string) {
  return useQuery({
    queryKey: ['leads', 'automation-state', leadId],
    queryFn: () => fetchLeadAutomationState(leadId),
    enabled: leadId.length > 0,
  });
}

// ---- Per-lead automation-run history -------------------------------------
// Distinct from useLeadAutomationState (which is ACTIVE runs only). This is
// every run ever started on the lead — drives the LeadAutomationPanel's
// "View all runs" expansion.

export type LeadAutomationRunHistoryRow = {
  id: string;
  automationId: string;
  automationName: string;
  automationKey: string;
  status: string;
  pausedReason: string | null;
  startedAt: string;
  completedAt: string | null;
  pausedAt: string | null;
  errorMessage: string | null;
  currentActionPosition: number;
  totalActions: number;
};

type LeadAutomationRunHistoryResponse = { runs: LeadAutomationRunHistoryRow[] };

async function fetchLeadAutomationRuns(
  leadId: string,
): Promise<LeadAutomationRunHistoryResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw AppError.auth();
  const res = await fetch(`/api/leads/${leadId}/runs`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw normalizeError(new Error('automation-runs-fetch-failed'));
  return res.json();
}

export function useLeadAutomationRuns(leadId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['leads', 'automation-runs', leadId],
    queryFn: () => fetchLeadAutomationRuns(leadId),
    enabled: enabled && leadId.length > 0,
  });
}
