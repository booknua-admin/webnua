import type { AdminReviewsPage } from './types';

const adminReviews: AdminReviewsPage = {
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
        <strong>21 new reviews collected this month</strong> across the
        workspace via the review request loop. Average rating is climbing
        across all active clients.
      </>
    ),
  },
  filters: [
    { id: 'all', label: 'All clients', count: 3 },
    { id: 'freshhome', label: 'FreshHome' },
    { id: 'keyhero', label: 'KeyHero' },
    { id: 'neatworks', label: 'NeatWorks' },
  ],
  defaultFilterId: 'all',
  stats: [
    {
      label: '// AVG RATING',
      value: (
        <>
          4.91 <em>★</em>
        </>
      ),
      trend: '↑ from 4.86',
      trendTone: 'good',
    },
    {
      label: '// NEW · MONTH',
      value: '21',
      trend: '↑ 7 vs last month',
      trendTone: 'good',
    },
    {
      label: '// REQUEST → REVIEW',
      value: '29%',
      trend: 'across 3 clients',
      trendTone: 'quiet',
    },
    {
      label: '// 5-STAR RATE',
      value: '94%',
      trend: 'of all new reviews',
      trendTone: 'quiet',
    },
  ],
  clientCards: [
    {
      kind: 'connected',
      id: 'freshhome',
      logoInitial: 'F',
      clientName: 'FreshHome Cleaning',
      meta: 'PERTH · 268 TOTAL REVIEWS',
      summary: {
        rating: (
          <>
            4.9 <em>★</em>
          </>
        ),
        starsLabel: '★ ★ ★ ★ ★',
        meta: 'AVG · LAST 30D',
      },
      stats: [
        { label: '// NEW · 7D', value: '11' },
        { label: '// 5-STAR', value: '100%' },
        { label: '// REQUEST → REVIEW', value: '32%' },
      ],
      recentLabel: '// RECENT 5-STAR',
      recent: [
        {
          id: 'sd',
          authorName: 'Sarah D.',
          text: 'Lisa is amazing, photo proof every visit is such a nice touch.',
          stars: 5,
          age: '2h',
        },
        {
          id: 'tb',
          authorName: 'Tom B.',
          text: 'Same cleaner every fortnight, exactly as promised. Worth every dollar.',
          stars: 5,
          age: '6h',
        },
        {
          id: 'ep',
          authorName: 'Emma P.',
          text: "Pet-friendly products, our cat hasn't reacted at all. Great work.",
          stars: 5,
          age: '1d',
        },
      ],
    },
    {
      kind: 'connected',
      id: 'keyhero',
      logoInitial: 'K',
      clientName: 'KeyHero Locksmith',
      meta: 'PERTH · 84 TOTAL REVIEWS',
      summary: {
        rating: (
          <>
            4.95 <em>★</em>
          </>
        ),
        starsLabel: '★ ★ ★ ★ ★',
        meta: 'AVG · LAST 30D',
      },
      stats: [
        { label: '// NEW · 7D', value: '7' },
        { label: '// 5-STAR', value: '100%' },
        { label: '// REQUEST → REVIEW', value: '35%' },
      ],
      recentLabel: '// RECENT 5-STAR',
      recent: [
        {
          id: 'mh',
          authorName: 'Marcus H.',
          text: 'Locked out at 11pm, on site in 24 minutes. Took a photo of the price card before starting. No surprises.',
          stars: 5,
          age: '4h',
        },
        {
          id: 'jt',
          authorName: 'Jenny T.',
          text: 'Replaced our front door deadlock and a back patio cylinder. Quick, clean, well-priced.',
          stars: 5,
          age: '2d',
        },
      ],
    },
    {
      kind: 'connected',
      id: 'neatworks',
      logoInitial: 'N',
      clientName: 'NeatWorks',
      meta: 'DUBLIN · 312 TOTAL REVIEWS',
      summary: {
        rating: (
          <>
            4.88 <em>★</em>
          </>
        ),
        starsLabel: '★ ★ ★ ★ ★',
        meta: 'AVG · LAST 30D',
      },
      stats: [
        { label: '// NEW · 7D', value: '3' },
        { label: '// 5-STAR', value: '67%' },
        { label: '// REQUEST → REVIEW', value: '22%' },
      ],
      recentLabel: '// RECENT',
      recent: [
        {
          id: 'am',
          authorName: 'Aoife M.',
          text: 'Cleaner was 20 mins late but otherwise great work. Bond returned in full.',
          stars: 4,
          age: '1d',
        },
        {
          id: 'cb',
          authorName: 'Conor B.',
          text: "Top notch. Best end-of-tenancy clean I've ever had.",
          stars: 5,
          age: '3d',
        },
      ],
    },
    {
      kind: 'empty',
      id: 'voltline',
      logoInitial: 'V',
      clientName: 'Voltline',
      meta: 'PERTH · NOT YET CONNECTED',
      emptyDescription:
        'Google Business Profile not yet connected. Connect after launch to start tracking reviews.',
      cta: { label: 'Connect Google Business', href: '#' },
    },
  ],
};

export { adminReviews };
