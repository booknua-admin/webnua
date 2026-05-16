// =============================================================================
// Client dashboard — stub data (client Screen 1).
//
// One canonical Voltline dashboard — Mark's home screen. Every field is a
// column value or a computed / templated value (see `client-dashboard-types.ts`
// for the schema discipline). Reshape into Supabase reads when the backend
// lands; the consumer (`app/dashboard/_client-content.tsx`) keeps its shape.
// =============================================================================

import type { ClientDashboard } from './client-dashboard-types';

export const voltlineDashboard: ClientDashboard = {
  greeting: {
    tag: '// Wednesday · 10:35 AM',
    ownerName: 'Mark',
  },

  urgentHero: {
    count: 5,
    threshold: 'overdue',
    label: 'new leads to call back',
    callouts: [
      {
        name: 'Sarah Davies',
        age: '32 min ago',
        note: 'Mt Hawthorn, 3-bed — replied "yes please" to your auto-confirm',
      },
      {
        name: 'Mark Kohli',
        age: '2h ago',
        note: 'wants someone today for a tripping switchboard',
      },
    ],
    cta: { label: 'Open inbox →', href: '/leads' },
  },

  followUps: {
    heading: 'Follow-ups due',
    count: 3,
    link: { label: 'All leads →', href: '/leads' },
    items: [
      {
        id: 'fu-1',
        initial: 'SD',
        title: 'Sarah Davies · Mt Hawthorn',
        sub: 'awaiting your call back',
        tag: { label: 'Replied yes', tone: 'urgent' },
        time: '32m',
        href: '/leads/sarah-davies',
      },
      {
        id: 'fu-2',
        initial: 'MK',
        title: 'Mark Kohli · Subiaco',
        sub: 'switchboard tripping',
        tag: { label: 'Wants today', tone: 'urgent' },
        time: '2h',
        href: '/leads/mark-kohli',
      },
      {
        id: 'fu-3',
        initial: 'EP',
        title: 'Emma Petrov · Inglewood',
        sub: 'Quote: 4 fans + 2 light fittings · renovating',
        time: '4h',
        href: '/leads/emma-petrov',
      },
    ],
  },

  todaysJobs: {
    heading: "Today's jobs",
    count: 4,
    link: { label: 'Full week →', href: '/calendar' },
    items: [
      {
        id: 'job-1',
        initial: '✓',
        avatarTone: 'good',
        title: 'Switchboard inspection · Cassidy',
        sub: '8:00 — 9:15 · Mt Lawley',
        tag: { label: 'Done', tone: 'done' },
        time: '9:15',
      },
      {
        id: 'job-2',
        initial: '→',
        avatarTone: 'rust',
        title: 'Powerpoints + USB · Patel',
        sub: '10:00 — 11:30 · Maylands',
        tag: { label: 'Next up', tone: 'next' },
        time: '10:00',
        href: '/bookings/job-2',
      },
      {
        id: 'job-3',
        initial: 'LR',
        title: 'Ceiling fan + RCD · Reilly',
        sub: '13:00 — 15:00 · Highgate · $220',
        time: '13:00',
        href: '/bookings/job-3',
      },
      {
        id: 'job-4',
        initial: 'AH',
        title: 'Smoke alarm × 4 · Hassan',
        sub: '16:30 — 17:15 · Mt Hawthorn · $145',
        time: '16:30',
      },
    ],
  },

  weeklyStats: [
    {
      kind: 'new-leads',
      label: '// NEW LEADS',
      value: '14',
      delta: { direction: 'up', label: '5 vs last wk' },
      trend: [4, 7, 9, 14],
    },
    {
      kind: 'bookings',
      label: '// BOOKINGS',
      value: '12',
      delta: { direction: 'up', label: '4 vs last wk' },
      trend: [4, 6, 8, 12],
    },
    {
      kind: 'revenue',
      label: '// REVENUE',
      value: '$3,420',
      delta: { direction: 'up', label: '28% vs last wk' },
      trend: [1900, 2300, 2670, 3420],
    },
    {
      kind: 'reviews',
      label: '// 5★ REVIEWS',
      value: '3',
      delta: { direction: 'up', label: '1 vs last wk' },
      trend: [1, 1, 2, 3],
    },
  ],
  weeklyMeta: 'DAY 14 OF LIVE · MAY 7–13',

  funnel: {
    domain: 'voltline.com.au',
    periodLabel: 'May 7–13',
    steps: [
      { kind: 'landing', label: 'Landing visits', sublabel: 'From ads + direct', count: 412, pct: 100 },
      { kind: 'engaged', label: 'Engaged scroll', sublabel: 'Past offer card', count: 301, pct: 73 },
      { kind: 'form-started', label: 'Form started', sublabel: 'First input focused', count: 74, pct: 18 },
      { kind: 'form-submitted', label: 'Form submitted', sublabel: 'Lead created', count: 14, pct: 3.4 },
      { kind: 'booked', label: 'Booked', sublabel: 'Converted to job', count: 12, pct: 2.9 },
      { kind: 'reviewed', label: 'Reviewed', sublabel: '5★ Google review', count: 3, pct: 0.7 },
    ],
  },

  funnelSummary: {
    weakPoint: { fromLabel: 'Form started', toLabel: 'submitted', dropCount: 60 },
    operatorNote: "Webnua's building a shorter form for v3 — ships Friday.",
    healthNote: 'Booked-to-reviewed is healthy at 25%.',
    cta: { label: 'View full analytics →', href: '/funnels/emergency-call-out' },
  },

  landingSnapshot: {
    domain: 'voltline.com.au',
    meta: 'Live · v3 · last edited 2d ago',
    stats: [
      { label: '// VISITS · 7D', value: '412', trend: '↑ 14% vs prev wk', trendTone: 'good' },
      { label: '// CONV. RATE', value: '3.4%', trend: '↑ from 2.8%', trendTone: 'good' },
      { label: '// AVG TIME', value: '1:24', trend: 'past offer card', trendTone: 'quiet' },
      { label: '// PAGE SPEED', value: '96', trend: 'LCP all green', trendTone: 'good' },
    ],
  },

  recentActivity: [
    {
      id: 'act-1',
      kind: 'review',
      actor: 'Marcus H.',
      body: 'left a 5-star Google review',
      detail: '"Mark was punctual, professional…"',
      time: '14 min ago',
    },
    {
      id: 'act-2',
      kind: 'lead',
      actor: 'Sarah Davies',
      body: 'submitted a new lead · 3-bed Mt Hawthorn · powerpoint install',
      time: '32 min ago',
    },
    {
      id: 'act-3',
      kind: 'auto-reply',
      body: 'Auto-replied to Sarah Davies',
      detail: '"Will call you back within 90 mins…"',
      time: '32 min ago',
    },
    {
      id: 'act-4',
      kind: 'lead',
      actor: 'Mark Kohli',
      body: 'submitted a new lead · bond-clean urgency in Subiaco',
      time: '2h ago',
    },
    {
      id: 'act-5',
      kind: 'review-request',
      body: 'Review request sent to Tom Banner · 5-day follow-up scheduled',
      time: 'Yesterday',
    },
  ],
};
