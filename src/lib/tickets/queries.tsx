// =============================================================================
// Tickets cluster — data access (Phase 3).
//
// The tickets inbox + detail read the `tickets` and `ticket_messages` tables;
// RLS bounds the rows (a client sees only their own client's tickets, an
// operator sees every accessible client) — so the same query is correct for
// both the client and admin views, and the dispatch picks only which row /
// detail shape to map to.
//
// Presentation-only fields the stubs carried — the inbox `preview`, the
// derived `statusLabel` / `statusHeadline` / `metaLine`, the detail
// `properties` rows — are composed here from structured columns per design
// doc §5 (#3: status + awaiting are the source; no `status_label` column).
//
// `/tickets/new` is a write — `useCreateTicket` inserts a `tickets` row plus
// the opening `ticket_messages` row.
//
// queryFn / mutationFn throw `AppError`; React Query catches it into a typed
// `error`. A by-id `.single()` that finds no row resolves as `not_found` —
// deliberately indistinguishable from RLS-hidden (errors.ts / design §8).
// =============================================================================

import type { ReactNode } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import type { AdminTicketClientTone, AdminTicketRow } from './admin-tickets';
import type { AdminTicketDetail } from './admin-detail';
import type {
  ClientTicketDetail,
  TicketDetailAction,
  TicketDetailMessage,
  TicketDetailProperty,
} from './client-detail';
import type { ClientTicketRow } from './client-tickets';
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  URGENCY_LABEL,
  type TicketAwaiting,
  type TicketCategory,
  type TicketStatus,
  type TicketUrgency,
} from './types';

// ---- The Supabase row shapes the selects return ----------------------------

type MessageRow = {
  id: string;
  body: string;
  is_draft: boolean;
  created_at: string;
  author:
    | { id: string; display_name: string; role: string; avatar_initial: string | null }
    | null;
};

type TicketInboxJoinRow = {
  id: string;
  reference: string;
  client_id: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  urgency: TicketUrgency;
  awaiting: TicketAwaiting;
  created_at: string;
  client: { name: string; slug: string; industry: string } | null;
  creator: { display_name: string } | null;
  messages: MessageRow[];
};

type TicketDetailJoinRow = {
  id: string;
  reference: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  urgency: TicketUrgency;
  awaiting: TicketAwaiting;
  created_at: string;
  client: { name: string; slug: string } | null;
  creator: { display_name: string; avatar_initial: string | null } | null;
  operator: { display_name: string; avatar_initial: string | null } | null;
  messages: MessageRow[];
};

const INBOX_SELECT =
  'id, reference, client_id, title, category, status, urgency, awaiting, ' +
  'created_at, ' +
  'client:clients(name, slug, industry), ' +
  'creator:users!tickets_created_by_fkey(display_name), ' +
  'messages:ticket_messages(id, body, is_draft, created_at, ' +
  'author:users(display_name))';

const DETAIL_SELECT =
  'id, reference, title, category, status, urgency, awaiting, created_at, ' +
  'client:clients(name, slug), ' +
  'creator:users!tickets_created_by_fkey(display_name, avatar_initial), ' +
  'operator:users!tickets_assigned_operator_id_fkey(display_name, avatar_initial), ' +
  'messages:ticket_messages(id, body, is_draft, created_at, ' +
  'author:users(id, display_name, role, avatar_initial))';

// ---- Shared helpers ---------------------------------------------------------

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

const KNOWN_TONES = new Set<AdminTicketClientTone>([
  'voltline',
  'freshhome',
  'keyhero',
  'flowline',
]);

function toClientTone(slug: string): AdminTicketClientTone {
  return KNOWN_TONES.has(slug as AdminTicketClientTone)
    ? (slug as AdminTicketClientTone)
    : 'generic';
}

/** The thread's chronological order — oldest first, the way it reads. */
function chronological(messages: MessageRow[]): MessageRow[] {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** The most recent message (drafts included — RLS already drops operator
 *  drafts for a client viewer). */
function latestMessage(messages: MessageRow[]): MessageRow | null {
  return chronological(messages).at(-1) ?? null;
}

// =============================================================================
// Inbox — the `tickets` list. Both the client and admin inbox read this; the
// role dispatch picks the row shape.
// =============================================================================

export type TicketInboxRecord = {
  id: string;
  reference: string;
  clientId: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  urgency: TicketUrgency;
  awaiting: TicketAwaiting;
  createdAt: string;
  clientName: string;
  clientSlug: string;
  clientIndustry: string;
  creatorName: string;
  latest: { body: string; authorName: string } | null;
};

async function fetchTicketInbox(): Promise<TicketInboxRecord[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const { data, error } = await supabase
    .from('tickets')
    .select(INBOX_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);

  return (data as unknown as TicketInboxJoinRow[]).map((row) => {
    const latest = latestMessage(row.messages);
    return {
      id: row.id,
      reference: row.reference,
      clientId: row.client_id,
      title: row.title,
      category: row.category,
      status: row.status,
      urgency: row.urgency,
      awaiting: row.awaiting,
      createdAt: row.created_at,
      clientName: row.client?.name ?? 'Unknown client',
      clientSlug: row.client?.slug ?? 'generic',
      clientIndustry: row.client?.industry ?? '',
      creatorName: row.creator?.display_name ?? 'Unknown',
      latest: latest
        ? {
            body: latest.body,
            authorName: latest.author?.display_name ?? 'Unknown',
          }
        : null,
    };
  });
}

function toClientTicketRow(record: TicketInboxRecord): ClientTicketRow {
  const preview: ReactNode = record.latest ? (
    <>
      <strong>{firstName(record.latest.authorName)}:</strong>{' '}
      {record.latest.body}
    </>
  ) : (
    'No messages yet'
  );

  return {
    id: record.reference,
    title: record.title,
    preview,
    category: record.category,
    status: record.status,
    awaiting: record.awaiting,
    age: `${relativeTime(record.createdAt)} ago`,
    href: `/tickets/${record.reference}`,
  };
}

function toAdminTicketRow(record: TicketInboxRecord): AdminTicketRow {
  return {
    id: record.reference,
    title: record.title,
    preview: record.latest?.body ?? 'No messages yet',
    category: record.category,
    status: record.status,
    urgency: record.urgency,
    age: `${relativeTime(record.createdAt)} ago`,
    client: {
      id: record.clientId,
      slug: record.clientSlug,
      initial: initial(record.clientName),
      name: record.clientName,
      meta: record.creatorName.toUpperCase(),
      tone: toClientTone(record.clientSlug),
    },
    href: `/tickets/${record.reference}`,
  };
}

const TICKETS_INBOX_KEY = ['tickets', 'inbox'] as const;

/** The client tickets inbox — RLS bounds rows to the signed-in client. */
export function useClientTicketsInbox() {
  return useQuery({
    queryKey: TICKETS_INBOX_KEY,
    queryFn: fetchTicketInbox,
    select: (records) => records.map(toClientTicketRow),
  });
}

/** The operator cross-client tickets inbox — RLS bounds rows to the
 *  operator's accessible clients. */
export function useAdminTicketsInbox() {
  return useQuery({
    queryKey: TICKETS_INBOX_KEY,
    queryFn: fetchTicketInbox,
    select: (records) => records.map(toAdminTicketRow),
  });
}

// =============================================================================
// Detail — one ticket + its full message thread. Both detail views read this;
// RLS makes the by-reference fetch return nothing (→ not_found) for a ticket
// outside the caller's tenant.
// =============================================================================

export type TicketDetailRecord = {
  id: string;
  reference: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  urgency: TicketUrgency;
  awaiting: TicketAwaiting;
  createdAt: string;
  clientName: string;
  clientSlug: string;
  creatorName: string;
  operatorName: string | null;
  messages: MessageRow[];
  currentUserId: string;
};

async function fetchTicketDetail(reference: string): Promise<TicketDetailRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const { data, error } = await supabase
    .from('tickets')
    .select(DETAIL_SELECT)
    .eq('reference', reference)
    .single();

  if (error) throw normalizeError(error);

  const row = data as unknown as TicketDetailJoinRow;
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    category: row.category,
    status: row.status,
    urgency: row.urgency,
    awaiting: row.awaiting,
    createdAt: row.created_at,
    clientName: row.client?.name ?? 'Unknown client',
    clientSlug: row.client?.slug ?? 'generic',
    creatorName: row.creator?.display_name ?? 'Unknown',
    operatorName: row.operator?.display_name ?? null,
    messages: row.messages,
    currentUserId: user.id,
  };
}

// ---- Thread mapping ---------------------------------------------------------

function mapThreadMessage(
  message: MessageRow,
  view: 'client' | 'admin',
  currentUserId: string,
): TicketDetailMessage {
  const authorRole = message.author?.role === 'admin' ? 'operator' : 'client';
  const authorName = message.author?.display_name ?? 'Unknown';
  const isSelf = message.author?.id === currentUserId;

  const name =
    view === 'client' && isSelf ? 'You' : authorName;
  const roleLabel =
    authorRole === 'operator' ? 'Webnua' : 'Client';
  const time = message.is_draft
    ? `${relativeTime(message.created_at)} ago · draft`
    : `${relativeTime(message.created_at)} ago`;

  const mapped: TicketDetailMessage = {
    id: message.id,
    author: authorRole,
    name,
    role: roleLabel,
    time,
    avatar: (message.author?.avatar_initial ?? initial(authorName)) || '?',
    // `whitespace-pre-wrap` keeps newlines — request-change tickets carry a
    // structured "what & where" preamble above the client's free text.
    body: <p className="whitespace-pre-wrap">{message.body}</p>,
  };
  if (message.is_draft) mapped.draft = true;
  return mapped;
}

// ---- Derived status display (§5 #3) -----------------------------------------

function clientStatusSuffix(awaiting: TicketAwaiting): string {
  if (awaiting === 'client') return ' · awaiting your reply';
  if (awaiting === 'operator') return ' · with Webnua';
  return '';
}

function clientStatusDescription(
  status: TicketStatus,
  awaiting: TicketAwaiting,
): ReactNode {
  if (status === 'done') {
    return <>This ticket is closed — nothing more is needed from you.</>;
  }
  if (awaiting === 'client') {
    return (
      <>
        Webnua is <strong>waiting on your reply</strong> before continuing.
      </>
    );
  }
  if (awaiting === 'operator') {
    return <>Webnua has this and will update you here as it progresses.</>;
  }
  return <>Webnua is working through this ticket.</>;
}

// ---- Properties (derived projections) ---------------------------------------

function detailProperties(
  record: TicketDetailRecord,
  editable: boolean,
): TicketDetailProperty[] {
  const rows: TicketDetailProperty[] = [
    { label: 'Category', value: CATEGORY_LABEL[record.category] },
    { label: 'Urgency', value: URGENCY_LABEL[record.urgency] },
    { label: 'Status', value: STATUS_LABEL[record.status] },
    { label: 'Managed by', value: record.operatorName ?? 'Unassigned' },
    { label: 'Submitted', value: `${relativeTime(record.createdAt)} ago` },
  ];
  if (!editable) return rows;
  return rows.map((row) =>
    row.label === 'Submitted' ? row : { ...row, editable: true },
  );
}

// ---- Static action affordances ----------------------------------------------

function clientActions(): TicketDetailAction[] {
  return [
    { kind: 'inert', icon: '✎', label: 'Edit original request' },
    { kind: 'inert', icon: '⤴', label: 'Add a reference file' },
    {
      kind: 'confirm',
      icon: '⊘',
      label: 'Cancel this ticket',
      confirm: {
        title: 'Cancel this ticket?',
        description: (
          <>
            Webnua will be notified and any work in progress stops.{' '}
            <strong>This can&rsquo;t be undone.</strong>
          </>
        ),
        confirmLabel: 'Cancel ticket',
        tone: 'destructive',
        thenHref: '/tickets',
      },
    },
  ];
}

function adminActions(clientName: string): TicketDetailAction[] {
  return [
    {
      kind: 'link',
      icon: '▦',
      label: `Open ${clientName} website`,
      href: '/website',
    },
    {
      kind: 'link',
      icon: '+',
      label: 'Create new page draft',
      href: '/website/new',
    },
    { kind: 'inert', icon: '↗', label: 'Add internal note' },
    { kind: 'inert', icon: '⤿', label: 'Convert to subtasks' },
  ];
}

const ADMIN_STATUS_OPTIONS: { status: TicketStatus; label: string }[] = [
  { status: 'open', label: '● Open' },
  { status: 'in_progress', label: '● In progress' },
  { status: 'blocked', label: '⚠ Blocked / needs info' },
  { status: 'done', label: '✓ Done' },
];

const CLIENT_REPLY_CHIPS = [
  'Sounds good — go ahead',
  'Let me think on it',
  'Can you call me?',
  'A few changes first',
];

// ---- Detail builders --------------------------------------------------------

function buildClientDetail(record: TicketDetailRecord): ClientTicketDetail {
  const suffix = clientStatusSuffix(record.awaiting);
  const operatorFirst = record.operatorName
    ? firstName(record.operatorName)
    : 'Webnua';

  return {
    id: record.reference,
    category: record.category,
    status: record.status,
    statusLabel: `${STATUS_LABEL[record.status]}${suffix}`,
    statusHeadline: (
      <>
        <em>{STATUS_LABEL[record.status]}</em>
        {suffix}
      </>
    ),
    urgency: record.urgency,
    urgencyLabel: URGENCY_LABEL[record.urgency],
    title: record.title,
    metaLine: (
      <>
        Submitted <strong>{relativeTime(record.createdAt)} ago</strong> ·
        managed by{' '}
        <strong>{record.operatorName ?? 'the Webnua team'}</strong>
      </>
    ),
    thread: chronological(record.messages).map((m) =>
      mapThreadMessage(m, 'client', record.currentUserId),
    ),
    reply: {
      label: `// Reply to ${operatorFirst}`,
      placeholder: `Type your reply to ${operatorFirst}…`,
      chips: CLIENT_REPLY_CHIPS,
      sendLabel: 'Send reply →',
    },
    statusDescription: clientStatusDescription(record.status, record.awaiting),
    properties: detailProperties(record, false),
    actions: clientActions(),
  };
}

function buildAdminDetail(record: TicketDetailRecord): AdminTicketDetail {
  // The operator's staged draft reply pre-fills the composer (if any).
  const draft = chronological(record.messages)
    .filter((m) => m.is_draft)
    .at(-1);

  return {
    id: record.reference,
    category: record.category,
    status: record.status,
    urgency: record.urgency,
    title: record.title,
    client: {
      initial: initial(record.clientName),
      name: record.clientName,
      tone: toClientTone(record.clientSlug),
    },
    metaLine: (
      <>
        From <strong>{record.creatorName} · {record.clientName}</strong> ·{' '}
        {relativeTime(record.createdAt)} ago
      </>
    ),
    thread: chronological(record.messages).map((m) =>
      mapThreadMessage(m, 'admin', record.currentUserId),
    ),
    reply: {
      placeholder: `Type a reply to ${firstName(record.creatorName)}…`,
      defaultValue: draft?.body ?? '',
      sendLabel: 'Send reply →',
    },
    statusOptions: ADMIN_STATUS_OPTIONS,
    properties: detailProperties(record, true),
    actions: adminActions(record.clientName),
  };
}

/** One ticket as the client sees it. RLS scopes the by-reference fetch to the
 *  caller's tenant; a ticket outside it resolves as not_found. */
export function useClientTicketDetail(reference: string) {
  return useQuery({
    queryKey: ['tickets', 'detail', reference],
    queryFn: () => fetchTicketDetail(reference),
    enabled: reference.length > 0,
    select: buildClientDetail,
  });
}

/** One ticket as the operator sees it (drafts included). */
export function useAdminTicketDetail(reference: string) {
  return useQuery({
    queryKey: ['tickets', 'detail', reference],
    queryFn: () => fetchTicketDetail(reference),
    enabled: reference.length > 0,
    select: buildAdminDetail,
  });
}

// =============================================================================
// Create — /tickets/new. Inserts a `tickets` row plus the opening
// `ticket_messages` row. A fresh request awaits the operator (`awaiting`).
// =============================================================================

export type CreateTicketInput = {
  category: TicketCategory;
  urgency: TicketUrgency;
  title: string;
  description: string;
  context: {
    pageId: string | null;
    sectionId: string | null;
    fieldKey: string | null;
  } | null;
};

/** Next display reference. RLS scopes a client's visible tickets, so the
 *  computed max can collide with a hidden tenant's row — the caller retries
 *  on the unique-constraint violation. */
async function nextReference(): Promise<string> {
  const { data, error } = await supabase
    .from('tickets')
    .select('reference')
    .order('reference', { ascending: false })
    .limit(1);
  if (error) throw normalizeError(error);

  const top = data?.[0]?.reference ?? 'TKT-0000';
  const n = Number.parseInt(top.replace(/\D/g, ''), 10) || 0;
  return `TKT-${String(n + 1).padStart(4, '0')}`;
}

async function createTicket(
  input: CreateTicketInput,
): Promise<{ reference: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // A ticket belongs to a client business — resolve the submitter's own.
  const { data: me, error: meError } = await supabase
    .from('users')
    .select('client_id')
    .eq('id', user.id)
    .single();
  if (meError) throw normalizeError(meError);
  if (!me.client_id) {
    throw AppError.validation(
      { form: 'Submitting a ticket needs a client account.' },
      'Operators submit tickets from a client workspace.',
    );
  }

  // Insert the ticket, retrying the reference on a unique-constraint clash.
  let inserted: { id: string; reference: string } | null = null;
  for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
    const reference = await nextReference();
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        reference,
        client_id: me.client_id,
        title: input.title,
        category: input.category,
        urgency: input.urgency,
        status: 'open',
        awaiting: 'operator',
        created_by: user.id,
        context_page_id: input.context?.pageId ?? null,
        context_section_id: input.context?.sectionId ?? null,
        context_field_key: input.context?.fieldKey ?? null,
      })
      .select('id, reference')
      .single();

    if (!error) {
      inserted = data;
      break;
    }
    // 23505 = unique_violation on `reference` — recompute and retry.
    const code = (error as { code?: string }).code;
    if (code !== '23505') throw normalizeError(error);
  }
  if (!inserted) {
    throw AppError.unexpected(null, 'Could not allocate a ticket reference.');
  }

  // The opening message carries the request body verbatim.
  const { error: messageError } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: inserted.id,
      author_user_id: user.id,
      body: input.description,
      is_draft: false,
    });
  if (messageError) throw normalizeError(messageError);

  return { reference: inserted.reference };
}

/** Submit a new ticket. On success the inbox query is invalidated so the new
 *  ticket appears without a reload. */
export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

// ---- Reply (write) ----------------------------------------------------------

/** Post a reply onto a ticket thread and hand the ticket to the other party. */
async function replyToTicket(input: {
  reference: string;
  body: string;
}): Promise<void> {
  const body = input.body.trim();
  if (!body) {
    throw AppError.validation({ body: 'A reply needs a message.' });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // Resolve the ticket UUID from its display reference (RLS scopes this).
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id')
    .eq('reference', input.reference)
    .single();
  if (ticketError) throw normalizeError(ticketError);

  // A replier with a home client is the client; an operator has none.
  const { data: me, error: meError } = await supabase
    .from('users')
    .select('client_id')
    .eq('id', user.id)
    .single();
  if (meError) throw normalizeError(meError);

  const { error: messageError } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticket.id,
      author_user_id: user.id,
      body,
      is_draft: false,
    });
  if (messageError) throw normalizeError(messageError);

  // The thread now waits on whoever did not just reply.
  const awaiting: TicketAwaiting = me.client_id ? 'operator' : 'client';
  const { error: ticketUpdateError } = await supabase
    .from('tickets')
    .update({ awaiting })
    .eq('id', ticket.id);
  if (ticketUpdateError) throw normalizeError(ticketUpdateError);
}

/** Reply to a ticket. On success every tickets query is invalidated so the
 *  thread + inbox reflect the new message and `awaiting` flip. */
export function useReplyToTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replyToTicket,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
