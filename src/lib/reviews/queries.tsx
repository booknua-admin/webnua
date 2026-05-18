// =============================================================================
// Reviews cluster — data access (Phase 3).
//
// The client `/reviews` page and the admin cross-client `/reviews` grid read
// the `reviews` table; RLS bounds the rows (a client sees only their own
// client's reviews, an operator sees every accessible client). The client
// view also reads `clients` so a client with zero reviews still resolves
// (the by-RLS single client row), and the admin view reads `clients` so an
// operator gets a card per accessible client — `empty` for the ones with no
// reviews yet.
//
// The rating headline, the star distribution, the per-client stats and the
// relative age labels are all computed here from `reviews.stars` /
// `reviews.reviewed_at` per design §5 — the schema stores the raw review,
// the front end composes the display.
//
// queryFn throws `AppError`; React Query catches it into a typed `error`.
// =============================================================================

import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import type {
  AdminReviewsPage,
  ClientReviewsPage,
  ReviewClientCardData,
  ReviewDistributionRow,
  ReviewItem,
  ReviewSummaryData,
} from './types';

// ---- Row shapes -------------------------------------------------------------

type ReviewRow = {
  id: string;
  client_id: string;
  author_name: string;
  body: string;
  stars: number;
  job: string | null;
  source: string;
  reviewed_at: string;
};

type ClientRow = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
};

const REVIEW_SELECT =
  'id, client_id, author_name, body, stars, job, source, reviewed_at';

// ---- Derivations ------------------------------------------------------------

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  );
}

function averageStars(reviews: ReviewRow[]): number {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
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
    const count = reviews.filter((r) => r.stars === stars).length;
    return {
      stars,
      count,
      pct: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });
}

function mapReviewItem(row: ReviewRow): ReviewItem {
  const item: ReviewItem = {
    id: row.id,
    authorName: row.author_name,
    authorInitials: initials(row.author_name),
    text: row.body,
    stars: row.stars,
    age: relativeTime(row.reviewed_at),
  };
  if (row.job) item.job = row.job;
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

// =============================================================================
// Client `/reviews` — the signed-in client's own reviews.
// =============================================================================

async function fetchClientReviews(): Promise<ClientReviewsPage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // RLS scopes `clients` to the caller's own client; `reviews` likewise.
  const [clientResult, reviewsResult] = await Promise.all([
    supabase.from('clients').select('id, name, slug, industry'),
    supabase
      .from('reviews')
      .select(REVIEW_SELECT)
      .order('reviewed_at', { ascending: false }),
  ]);

  if (clientResult.error) throw normalizeError(clientResult.error);
  if (reviewsResult.error) throw normalizeError(reviewsResult.error);

  const client = (clientResult.data as ClientRow[])[0];
  const reviews = reviewsResult.data as ReviewRow[];
  const clientName = client?.name ?? 'Your business';

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

/** The client reviews page — RLS bounds rows to the signed-in client. */
export function useClientReviews() {
  return useQuery({
    queryKey: ['reviews', 'client'],
    queryFn: fetchClientReviews,
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
    supabase
      .from('reviews')
      .select(REVIEW_SELECT)
      .order('reviewed_at', { ascending: false }),
  ]);

  if (clientsResult.error) throw normalizeError(clientsResult.error);
  if (reviewsResult.error) throw normalizeError(reviewsResult.error);

  const clients = clientsResult.data as ClientRow[];
  const reviews = reviewsResult.data as ReviewRow[];

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
    const fiveStar = list.filter((r) => r.stars === 5).length;
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
  const fiveStar = reviews.filter((r) => r.stars === 5).length;
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newThisMonth = reviews.filter(
    (r) => new Date(r.reviewed_at).getTime() >= monthAgo,
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
