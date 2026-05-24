// =============================================================================
// Reviews cluster — data access (Phase 7 GBP consolidation).
//
// Both the client `/reviews` page and the operator cross-client `/reviews`
// grid read **`gbp_reviews`** — the Phase 7 GBP-sync cache (migration 0067).
// The pre-Phase-7 `public.reviews` table was designed as the canonical
// review store but has no live writer; the GBP sync writes to its own
// richer table (reply_text, reply_created_at, is_new_since_last_view,
// deleted_at_google, reviewer_profile_photo_url), so the UI sources from
// there and the old table is left untouched in the schema.
//
// RLS bounds the rows (a client sees only their own client's reviews; an
// operator sees every accessible client). The rating headline, star
// distribution, per-client stats, and relative age labels are all computed
// here per design §5 — the schema stores the raw review, the front end
// composes the display.
//
// queryFn throws `AppError`; React Query catches it into a typed `error`.
// =============================================================================

import type { ReactNode } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

/** Untyped view of the browser client — `gbp_reviews` (migration 0067) is
 *  not yet in the generated Database type. Same pattern as use-gbp.ts /
 *  use-sms.ts / use-email.ts. */
function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

import type {
  AdminReviewsPage,
  ClientReviewsPage,
  ReviewClientCardData,
  ReviewDistributionRow,
  ReviewItem,
  ReviewSummaryData,
} from './types';

// ---- Row shapes -------------------------------------------------------------

/** A row from `gbp_reviews` — the columns the UI consumes. Anonymous
 *  reviewers come through with `reviewer_name` null; an empty `comment`
 *  is also legal (star-only Google reviews). */
type ReviewRow = {
  id: string;
  client_id: string;
  reviewer_name: string | null;
  comment: string | null;
  rating: number;
  created_at_google: string;
  reply_text: string | null;
  reply_created_at: string | null;
};

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
};

const REVIEW_SELECT =
  'id, client_id, reviewer_name, comment, rating, created_at_google, reply_text, reply_created_at';

// ---- Derivations ------------------------------------------------------------

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  );
}

function averageStars(reviews: ReviewRow[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

/** "★ ★ ★ ★ ☆" — `filled` stars then hollow, to 5. */
function starsLabel(filled: number): string {
  const n = Math.max(0, Math.min(5, Math.round(filled)));
  return Array.from({ length: 5 }, (_, i) => (i < n ? '★' : '☆')).join(' ');
}

function ratingNode(avg: number): ReactNode {
  return (
    <>
      {avg.toFixed(1)} <em>★</em>
    </>
  );
}

function distribution(reviews: ReviewRow[]): ReviewDistributionRow[] {
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length;
    return {
      stars,
      count,
      pct: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });
}

function mapReviewItem(row: ReviewRow): ReviewItem {
  const authorName = row.reviewer_name?.trim() || 'Anonymous';
  const item: ReviewItem = {
    id: row.id,
    authorName,
    authorInitials: initials(authorName),
    // Star-only Google reviews carry no comment — render a placeholder.
    text: row.comment?.trim() || '(Star rating only — no written comment.)',
    stars: row.rating,
    age: relativeTime(row.created_at_google),
    clientId: row.client_id,
  };
  if (row.reply_text && row.reply_created_at) {
    item.reply = { text: row.reply_text, at: row.reply_created_at };
  }
  return item;
}

function summaryFor(reviews: ReviewRow[]): ReviewSummaryData {
  const avg = averageStars(reviews);
  return {
    rating:
      reviews.length === 0 ? <>No reviews</> : ratingNode(avg),
    starsLabel: starsLabel(avg),
    meta: `${reviews.length} ${reviews.length === 1 ? 'REVIEW' : 'REVIEWS'}`,
  };
}

/** Tolerate PGRST205 (table missing from PostgREST's schema cache) — a
 *  deployment where the GBP migrations (0066–0069) have not yet been
 *  applied should show a clean empty state with a Connect CTA, not a
 *  raw error. Treat the missing table as "no reviews yet". */
function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === 'PGRST205';
}

// =============================================================================
// Client `/reviews` — the signed-in client's own reviews.
// =============================================================================

/** Build a `ClientReviewsPage` from a client row + the matched gbp_reviews
 *  for that client. Shared by `useClientReviews` (signed-in client, RLS-
 *  scoped) and `useSubAccountReviews` (operator drilled into a client). The
 *  two hooks differ only in WHICH client to read; the deep-dive shape is
 *  identical. */
function buildClientReviewsPage(
  clientName: string,
  reviews: ReviewRow[],
  variant: 'client' | 'sub-account',
): ClientReviewsPage {
  if (variant === 'sub-account') {
    return {
      hero: {
        eyebrow: `// ${clientName.toUpperCase()} · GOOGLE REVIEWS`,
        title: (
          <>
            {clientName}&apos;s <em>reviews</em>.
          </>
        ),
        subtitle: (
          <>
            Every Google review collected for <strong>{clientName}</strong>.{' '}
            The review request automation fires on job completion — manage the
            GBP connection from <strong>/settings/integrations</strong>.
          </>
        ),
      },
      summary: summaryFor(reviews),
      distribution: distribution(reviews),
      callout: {
        headline: (
          <>
            Asked, not <em>begged</em>.
          </>
        ),
        sub: `${clientName}'s review request automation runs on every "Completed" job — no manual outreach needed.`,
        link: { label: 'View on Google ↗', href: '#' },
      },
      listHeader: (
        <>
          {'// '}
          <strong>
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </strong>{' '}
          · newest first
        </>
      ),
      listAside: 'Auto-collected via Webnua',
      reviews: reviews.map(mapReviewItem),
    };
  }
  return {
    hero: {
      eyebrow: `// ${clientName} · Google reviews`,
      title: (
        <>
          Your <em>reviews</em>.
        </>
      ),
      subtitle: (
        <>
          Every Google review collected for {clientName}.{' '}
          <strong>The review request automation does the heavy lifting</strong>{' '}
          — keep marking jobs as &ldquo;Completed&rdquo; and the requests fire
          automatically.
        </>
      ),
    },
    summary: summaryFor(reviews),
    distribution: distribution(reviews),
    callout: {
      headline: (
        <>
          Asked, not <em>begged</em>.
        </>
      ),
      sub: 'The automation handles every review request automatically — just keep marking jobs "Completed."',
      link: { label: 'View on Google ↗', href: '#' },
    },
    listHeader: (
      <>
        {'// '}
        <strong>
          {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
        </strong>{' '}
        · newest first
      </>
    ),
    listAside: 'Auto-collected via Webnua',
    reviews: reviews.map(mapReviewItem),
  };
}

async function fetchClientReviews(): Promise<ClientReviewsPage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // RLS scopes `clients` to the caller's own client; `gbp_reviews` likewise.
  const [clientResult, reviewsResult] = await Promise.all([
    supabase.from('clients').select('id, name, slug, industry'),
    db()
      .from('gbp_reviews')
      .select(REVIEW_SELECT)
      .is('deleted_at_google', null)
      .order('created_at_google', { ascending: false }),
  ]);

  if (clientResult.error) throw normalizeError(clientResult.error);
  if (reviewsResult.error && !isMissingTableError(reviewsResult.error)) {
    throw normalizeError(reviewsResult.error);
  }

  const client = (clientResult.data as ClientRow[])[0];
  const reviews = (reviewsResult.data as ReviewRow[] | null) ?? [];
  const clientName = client?.name ?? 'Your business';

  return buildClientReviewsPage(clientName, reviews, 'client');
}

/** The client reviews page — RLS bounds rows to the signed-in client. */
export function useClientReviews() {
  return useQuery({
    queryKey: ['reviews', 'client'],
    queryFn: fetchClientReviews,
  });
}

// =============================================================================
// Sub-account `/reviews` — operator drilled into one client.
//
// Renders the client deep-dive shape (summary + distribution + reviews list)
// for the picked client only — see reference/client-context-pattern.md §4
// (Strategy A: mirror the client shape; use operator's query hook + a client
// filter; bolt operator chrome where appropriate). `clientId` (UUID) drives
// the GBP location + connect CTA; `clientSlug` resolves the row.
// =============================================================================

/** Operator headline stats rendered above the deep-dive summary card (the
 *  "stats-cards-per-flow" pattern applied at the page level — see
 *  reference/client-context-pattern.md §6). 4-up `StatCard` row: avg rating,
 *  total reviews, new in last 30 days, operator response rate. */
export type SubAccountReviewsStats = {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  trendTone?: 'good' | 'quiet';
}[];

export type SubAccountReviewsPage = ClientReviewsPage & {
  clientId: string;
  stats: SubAccountReviewsStats;
};

function statsFor(reviews: ReviewRow[]): SubAccountReviewsStats {
  const total = reviews.length;
  const avg = averageStars(reviews);
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newCount = reviews.filter(
    (r) => new Date(r.created_at_google).getTime() >= monthAgo,
  ).length;
  const withReply = reviews.filter((r) => r.reply_text && r.reply_text.length > 0).length;
  const responseRate =
    total === 0 ? 0 : Math.round((withReply / total) * 100);

  return [
    {
      label: '// AVG RATING',
      value: total === 0 ? <>—</> : ratingNode(avg),
      trend: total === 0 ? 'no reviews yet' : 'across all reviews',
      trendTone: 'quiet',
    },
    {
      label: '// TOTAL REVIEWS',
      value: String(total),
      trend: total === 1 ? 'review' : 'reviews',
      trendTone: 'quiet',
    },
    {
      label: '// NEW · 30D',
      value: String(newCount),
      trend: 'last 30 days',
      trendTone: newCount > 0 ? 'good' : 'quiet',
    },
    {
      label: '// RESPONSE RATE',
      value: total === 0 ? '—' : `${responseRate}%`,
      trend: `${withReply} of ${total} replied`,
      trendTone: responseRate >= 80 ? 'good' : 'quiet',
    },
  ];
}

async function fetchSubAccountReviews(
  clientSlug: string,
): Promise<SubAccountReviewsPage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // Operator may have multiple accessible clients — narrow by slug. RLS still
  // refuses if this slug isn't in the operator's accessible set, in which
  // case `single()` raises a row-not-found error.
  const { data: clientRow, error: clientError } = await supabase
    .from('clients')
    .select('id, name, slug, industry')
    .eq('slug', clientSlug)
    .single();
  if (clientError) throw normalizeError(clientError);
  const client = clientRow as ClientRow;

  const { data: reviewsData, error: reviewsError } = await db()
    .from('gbp_reviews')
    .select(REVIEW_SELECT)
    .eq('client_id', client.id)
    .is('deleted_at_google', null)
    .order('created_at_google', { ascending: false });
  if (reviewsError && !isMissingTableError(reviewsError)) {
    throw normalizeError(reviewsError);
  }
  const reviews = (reviewsData as ReviewRow[] | null) ?? [];

  return {
    ...buildClientReviewsPage(client.name, reviews, 'sub-account'),
    clientId: client.id,
    stats: statsFor(reviews),
  };
}

/** The operator-in-sub-account reviews page — picks the active client by
 *  slug. Returns the same client deep-dive shape PLUS a `clientId` UUID for
 *  the GBP location + reply hooks, AND a 4-up operator stats row. */
export function useSubAccountReviews(clientSlug: string | null) {
  return useQuery({
    queryKey: ['reviews', 'sub-account', clientSlug],
    queryFn: () => fetchSubAccountReviews(clientSlug as string),
    enabled: clientSlug != null && clientSlug.length > 0,
  });
}

// =============================================================================
// Admin `/reviews` — one card per accessible client (`empty` for clients with
// no reviews yet) + a 4-up workspace stat row.
// =============================================================================

async function fetchAdminReviews(): Promise<AdminReviewsPage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const [clientsResult, reviewsResult] = await Promise.all([
    supabase.from('clients').select('id, name, slug, industry').order('name'),
    db()
      .from('gbp_reviews')
      .select(REVIEW_SELECT)
      .is('deleted_at_google', null)
      .order('created_at_google', { ascending: false }),
  ]);

  if (clientsResult.error) throw normalizeError(clientsResult.error);
  if (reviewsResult.error && !isMissingTableError(reviewsResult.error)) {
    throw normalizeError(reviewsResult.error);
  }

  const clients = clientsResult.data as ClientRow[];
  const reviews = (reviewsResult.data as ReviewRow[] | null) ?? [];

  const byClient = new Map<string, ReviewRow[]>();
  for (const r of reviews) {
    const list = byClient.get(r.client_id) ?? [];
    list.push(r);
    byClient.set(r.client_id, list);
  }

  const clientCards: ReviewClientCardData[] = clients.map((client) => {
    const list = byClient.get(client.id) ?? [];
    const industry = (client.industry ?? '').toUpperCase();
    if (list.length === 0) {
      return {
        kind: 'empty',
        id: client.slug,
        logoInitial: (client.name[0] ?? '?').toUpperCase(),
        clientName: client.name,
        meta: industry ? `${industry} · NOT YET CONNECTED` : 'NOT YET CONNECTED',
        emptyDescription:
          'No Google reviews collected yet. Connect this client’s Google Business profile so the review request loop can start.',
        cta: { label: 'Connect Google Business', href: '/settings/integrations' },
      };
    }
    const fiveStar = list.filter((r) => r.rating === 5).length;
    return {
      kind: 'connected',
      id: client.slug,
      logoInitial: (client.name[0] ?? '?').toUpperCase(),
      clientName: client.name,
      meta: `${industry ? `${industry} · ` : ''}${list.length} ${
        list.length === 1 ? 'REVIEW' : 'REVIEWS'
      }`,
      summary: summaryFor(list),
      stats: [
        { label: 'REVIEWS', value: String(list.length) },
        { label: 'AVG', value: averageStars(list).toFixed(1) },
        { label: '5-STAR', value: String(fiveStar) },
      ],
      recentLabel: '// RECENT',
      recent: list.slice(0, 3).map(mapReviewItem),
    };
  });

  // Workspace-wide stat row.
  const total = reviews.length;
  const avg = averageStars(reviews);
  const fiveStar = reviews.filter((r) => r.rating === 5).length;
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newThisMonth = reviews.filter(
    (r) => new Date(r.created_at_google).getTime() >= monthAgo,
  ).length;

  const filters = [
    { id: 'all', label: 'All clients' },
    ...clients.map((c) => ({ id: c.slug, label: c.name })),
  ];

  return {
    hero: {
      eyebrow: '// Workspace · reputation',
      title: (
        <>
          All <em>reviews</em>.
        </>
      ),
      subtitle: (
        <>
          Google review tracking per client.{' '}
          <strong>
            {newThisMonth} new {newThisMonth === 1 ? 'review' : 'reviews'} in the
            last 30 days
          </strong>{' '}
          across the workspace via the review request loop.
        </>
      ),
    },
    filters,
    defaultFilterId: 'all',
    stats: [
      {
        label: '// AVG RATING',
        value: total === 0 ? <>—</> : ratingNode(avg),
        trend: `across ${clientCards.length} clients`,
        trendTone: 'quiet',
      },
      {
        label: '// TOTAL REVIEWS',
        value: String(total),
        trend: 'all clients',
        trendTone: 'quiet',
      },
      {
        label: '// NEW · 30D',
        value: String(newThisMonth),
        trend: 'last 30 days',
        trendTone: 'good',
      },
      {
        label: '// 5-STAR RATE',
        value: total === 0 ? '—' : `${Math.round((fiveStar / total) * 100)}%`,
        trend: 'of all reviews',
        trendTone: 'quiet',
      },
    ],
    clientCards,
  };
}

/** The operator cross-client reviews grid — RLS bounds rows to the operator's
 *  accessible clients. */
export function useAdminReviews() {
  return useQuery({
    queryKey: ['reviews', 'admin'],
    queryFn: fetchAdminReviews,
  });
}
