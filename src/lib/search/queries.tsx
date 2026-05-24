// =============================================================================
// Global search — data access (Phase 3).
//
// Search runs across the `leads`, `bookings` and `reviews` tables; RLS bounds
// the rows (an operator searches every accessible client, a client searches
// their own account). The same fetch serves both roles — the `scope` argument
// only decides whether result meta lines carry a client-name prefix and how
// the scope label reads.
//
// `conversation` results are derived from leads that carry message events
// (the conversation thread is the lead's `lead_events`). The `customer` and
// `client` result kinds in `types.ts` are NOT emitted: neither has a detail
// route to link to yet — customer names are still searchable because they
// surface through the lead / booking results that snapshot them.
//
// queryFn throws `AppError`; React Query catches it into a typed `error`.
// =============================================================================

import { useQuery } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import type { SearchResult, SearchResultGroup, SearchResults } from './types';

export type SearchScope = 'admin' | 'client';

// ---- Helpers ----------------------------------------------------------------

/** Strip characters that would break a PostgREST `.or()` / `.ilike()` filter
 *  (commas, parentheses, wildcards) — search input is free text. */
function sanitizeQuery(raw: string): string {
  return raw.replace(/[,()*%]/g, ' ').trim();
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  );
}

const LEAD_STATUS_LABEL: Record<string, string> = {
  new: 'new lead',
  contacted: 'contacted',
  booked: 'booked',
  completed: 'completed',
  lost: 'lost',
};

const BOOKING_STATUS_LABEL: Record<string, string> = {
  scheduled: 'scheduled',
  in_progress: 'in progress',
  completed: 'completed',
  cancelled: 'cancelled',
};

function clockLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function joinMeta(parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p)).join(' · ');
}

const PER_KIND_LIMIT = 8;

// ---- Row shapes -------------------------------------------------------------

type LeadHit = {
  id: string;
  customer_name_snapshot: string;
  status: string;
  source: string | null;
  created_at: string;
  customer: { suburb: string | null } | null;
  client: { name: string; slug: string } | null;
  lead_events: { kind: string }[];
};

type BookingHit = {
  id: string;
  title: string;
  customer_name_snapshot: string;
  status: string;
  starts_at: string;
  price: number | null;
  customer: { suburb: string | null } | null;
  client: { name: string; slug: string } | null;
};

type ReviewHit = {
  id: string;
  author_name: string;
  body: string;
  stars: number;
  job: string | null;
  reviewed_at: string;
  client: { name: string; slug: string } | null;
};

const MESSAGE_KINDS = new Set(['sms_in', 'sms_out', 'email_in', 'email_out']);

// ---- Fetch ------------------------------------------------------------------

async function fetchSearch(
  rawQuery: string,
  scope: SearchScope,
  clientSlugFilter: string | null,
): Promise<SearchResults> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const query = sanitizeQuery(rawQuery);
  const scopeLabel =
    clientSlugFilter
      ? `leads, bookings, reviews and conversations in ${clientSlugFilter}`
      : scope === 'admin'
        ? 'leads, bookings, reviews and conversations across all clients'
        : 'your leads, bookings, reviews and conversations';

  // An empty query (or one sanitized to nothing) returns no groups.
  if (query.length === 0) {
    return { query: rawQuery, scopeLabel, groups: [] };
  }

  const like = `%${query}%`;

  const [leadsResult, bookingsResult, reviewsResult] = await Promise.all([
    supabase
      .from('leads')
      .select(
        'id, customer_name_snapshot, status, source, created_at, ' +
          'customer:customers(suburb), client:clients!inner(name, slug), ' +
          'lead_events(kind)',
      )
      .ilike('customer_name_snapshot', like)
      .order('created_at', { ascending: false })
      .limit(PER_KIND_LIMIT),
    supabase
      .from('bookings')
      .select(
        'id, title, customer_name_snapshot, status, starts_at, price, ' +
          'customer:customers(suburb), client:clients!inner(name, slug)',
      )
      .or(`title.ilike.${like},customer_name_snapshot.ilike.${like}`)
      .order('starts_at', { ascending: false })
      .limit(PER_KIND_LIMIT),
    supabase
      .from('reviews')
      .select(
        'id, author_name, body, stars, job, reviewed_at, ' +
          'client:clients!inner(name, slug)',
      )
      .or(`author_name.ilike.${like},body.ilike.${like}`)
      .order('reviewed_at', { ascending: false })
      .limit(PER_KIND_LIMIT),
  ]);

  if (leadsResult.error) throw normalizeError(leadsResult.error);
  if (bookingsResult.error) throw normalizeError(bookingsResult.error);
  if (reviewsResult.error) throw normalizeError(reviewsResult.error);

  let leads = (leadsResult.data ?? []) as unknown as LeadHit[];
  let bookings = (bookingsResult.data ?? []) as unknown as BookingHit[];
  let reviews = (reviewsResult.data ?? []) as unknown as ReviewHit[];

  // Sub-account narrowing — operator drilled into one client. The join
  // already returned client.slug; filter client-side so the join shape
  // (and the join itself) stays uniform with the agency path.
  if (clientSlugFilter) {
    leads = leads.filter((row) => row.client?.slug === clientSlugFilter);
    bookings = bookings.filter((row) => row.client?.slug === clientSlugFilter);
    reviews = reviews.filter((row) => row.client?.slug === clientSlugFilter);
  }

  const prefix = (clientName: string | undefined): string | null =>
    scope === 'admin' && clientName ? clientName : null;

  // --- Leads --------------------------------------------------------------
  const leadResults: SearchResult[] = leads.map((l) => ({
    id: `lead-${l.id}`,
    kind: 'lead',
    avatar: initials(l.customer_name_snapshot),
    title: l.customer_name_snapshot,
    meta: joinMeta([
      prefix(l.client?.name),
      l.customer?.suburb,
      LEAD_STATUS_LABEL[l.status] ?? l.status,
      relativeTime(l.created_at),
    ]),
    href: `/leads/${l.id}`,
  }));

  // --- Bookings -----------------------------------------------------------
  const bookingResults: SearchResult[] = bookings.map((b) => ({
    id: `booking-${b.id}`,
    kind: 'booking',
    avatar: '▦',
    title: `${b.customer_name_snapshot} · ${clockLabel(b.starts_at)}`,
    meta: joinMeta([
      prefix(b.client?.name),
      b.title,
      b.price != null ? `$${Math.round(b.price).toLocaleString('en-AU')}` : null,
      BOOKING_STATUS_LABEL[b.status] ?? b.status,
    ]),
    href: `/bookings/${b.id}`,
  }));

  // --- Reviews ------------------------------------------------------------
  const reviewResults: SearchResult[] = reviews.map((r) => ({
    id: `review-${r.id}`,
    kind: 'review',
    avatar: '★',
    title: `${r.stars}★ from ${r.author_name}`,
    meta: joinMeta([
      prefix(r.client?.name),
      r.job,
      `"${r.body.slice(0, 60)}${r.body.length > 60 ? '…' : ''}"`,
      relativeTime(r.reviewed_at),
    ]),
    href: '/reviews',
  }));

  // --- Conversations (leads that carry a message thread) ------------------
  const conversationResults: SearchResult[] = leads
    .filter((l) => l.lead_events.some((e) => MESSAGE_KINDS.has(e.kind)))
    .map((l) => {
      const messageCount = l.lead_events.filter((e) =>
        MESSAGE_KINDS.has(e.kind),
      ).length;
      return {
        id: `conversation-${l.id}`,
        kind: 'conversation' as const,
        avatar: '✉',
        title: `Conversation with ${l.customer_name_snapshot}`,
        meta: joinMeta([
          prefix(l.client?.name),
          `${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`,
        ]),
        href: `/leads/${l.id}/conversation`,
      };
    });

  const groups: SearchResultGroup[] = [];
  if (leadResults.length > 0) {
    groups.push({ kind: 'lead', label: 'Leads', results: leadResults });
  }
  if (bookingResults.length > 0) {
    groups.push({
      kind: 'booking',
      label: 'Bookings',
      results: bookingResults,
    });
  }
  if (reviewResults.length > 0) {
    groups.push({ kind: 'review', label: 'Reviews', results: reviewResults });
  }
  if (conversationResults.length > 0) {
    groups.push({
      kind: 'conversation',
      label: 'Conversations',
      results: conversationResults,
    });
  }

  return { query: rawQuery, scopeLabel, groups };
}

/** Global search results for the given query. RLS bounds the searchable rows
 *  to the caller's tenant; `scope` only shapes the meta lines + scope label.
 *  Pass `clientSlugFilter` to narrow results to a single client (operator
 *  in sub-account mode). */
export function useSearch(
  query: string,
  scope: SearchScope,
  clientSlugFilter: string | null = null,
) {
  return useQuery({
    queryKey: ['search', scope, query, clientSlugFilter],
    queryFn: () => fetchSearch(query, scope, clientSlugFilter),
  });
}
