// =============================================================================
// Single-client overview hub — stub data (admin Screen 20).
//
// One canonical FreshHome hub. The `[id]`-equivalent (the active sub-account
// client) is decorative for the stub layer — this renders regardless of which
// client is active, the same pattern as every other `[id]` stub. Real backend
// keys the read to `activeClientId`.
//
// Every field is a column value or a computed/templated value — see
// `hub-types.ts` for the schema discipline.
// =============================================================================

import type { ClientHub } from './hub-types';

export const freshhomeHub: ClientHub = {
  clientId: 'freshhome',

  operatorActions: [
    { kind: 'edit-page', icon: '▤', label: 'Edit page', href: '/website' },
    {
      kind: 'manage-automations',
      icon: '⤿',
      label: 'Manage automations',
      href: '/automations',
    },
    {
      kind: 'edit-campaign',
      icon: '↗',
      label: 'Edit ad campaign',
      href: '/campaigns',
    },
    { kind: 'billing', icon: '$', label: 'Billing', href: '/settings/billing' },
    // Impersonate is a mode switch wired with real auth — no route yet.
    { kind: 'impersonate', icon: '⌥', label: 'Impersonate as client' },
  ],

  hero: {
    clientName: 'FreshHome Cleaning',
    lifecycle: 'live',
    liveDayCount: 31,
    identityFacts: ["Lisa's account", 'Perth metro', '$240/wk ad spend', 'margin tracking healthy'],
    managementState: {
      primary: 'operator',
      clientLastActiveDays: 10,
      operatorName: 'Craig',
    },
    leadFocal: {
      count: 12,
      label: 'leads this week',
      breakdown: { booked: 9, pendingCallback: 2, ghosted: 1 },
      cta: { label: 'Open lead inbox →', href: '/leads' },
    },
    stats: [
      {
        kind: 'booked-7d',
        label: 'BOOKED 7D',
        value: '9',
        caption: '↑ 3 vs last wk',
        captionTone: 'good',
      },
      {
        kind: 'revenue-7d',
        label: 'REVENUE 7D',
        value: '$2,840',
        caption: '↑ 22% vs prev',
        captionTone: 'good',
      },
      {
        kind: 'ad-spend',
        label: 'AD SPEND',
        value: '$240',
        caption: '$34/day · stable',
        captionTone: 'quiet',
      },
      {
        kind: 'roas',
        label: 'ROAS',
        value: '11.8×',
        caption: 'above benchmark',
        captionTone: 'good',
      },
    ],
  },

  contextCards: [
    {
      kind: 'landing-page',
      label: '// LANDING PAGE',
      headline: 'freshhome.com.au · v12',
      facts: [
        'Last edited 2 days ago by Craig',
        '12.8% conversion rate this week',
        'LCP 98 (green)',
      ],
      link: { label: 'Open editor →', href: '/website' },
    },
    {
      kind: 'automations',
      label: '// AUTOMATIONS',
      headline: '3 of 4 active · 142 sends this week',
      facts: [
        'Instant confirm — 48% reply',
        '24h follow-up — 36% reply',
        'Review loop — 11 reviews collected',
      ],
      link: { label: 'Manage flows →', href: '/automations' },
    },
    {
      kind: 'campaign',
      label: '// META AD CAMPAIGN',
      headline: '$99 first-clean · day 31',
      facts: ['$240/wk · CPL $9.40 · 14× ROAS', 'audience refresh recommended in 2 weeks'],
      link: { label: 'View in Meta Ads →', href: '/campaigns' },
    },
  ],

  schedule: {
    heading: "Today's schedule",
    meta: '4 jobs · 1 done · 3 to go',
    jobs: [
      {
        id: 'fh-job-1',
        time: '9:00 — 11:00',
        logoInitial: 'F',
        title: 'Fortnightly · 3-bed',
        customer: 'Larsen · Subiaco',
        status: 'completed',
        tone: 'freshhome',
        href: '/bookings/fh-job-1',
      },
      {
        id: 'fh-job-2',
        time: '11:30 — 13:00',
        logoInitial: 'F',
        title: 'Deep clean · move-in',
        customer: 'Davies · Mt Hawthorn',
        status: 'in_progress',
        tone: 'freshhome',
        href: '/bookings/fh-job-2',
      },
      {
        id: 'fh-job-3',
        time: '13:30 — 15:30',
        logoInitial: 'F',
        title: 'Fortnightly · 4-bed',
        customer: 'Petrov · Subiaco',
        status: 'scheduled',
        tone: 'freshhome',
        href: '/bookings/fh-job-3',
      },
      {
        id: 'fh-job-4',
        time: '16:00 — 17:15',
        logoInitial: 'F',
        title: 'One-off · move-out',
        customer: 'Torres · Inglewood',
        status: 'scheduled',
        tone: 'freshhome',
        href: '/bookings/fh-job-4',
      },
    ],
  },

  recentActivity: [
    {
      id: 'act-1',
      kind: 'review',
      actor: 'Marcus H.',
      body: 'left a 5-star review',
      time: '14 min ago',
    },
    {
      id: 'act-2',
      kind: 'lead',
      actor: 'Sarah Davies',
      body: 'submitted a new lead · 3-bed Mt Hawthorn',
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
      body: 'submitted a new lead · bond clean',
      time: '2h ago',
    },
    {
      id: 'act-5',
      kind: 'review-request',
      body: 'Review request sent to Tom Banner',
      time: 'Yesterday',
    },
  ],

  weeklyStats: [
    {
      kind: 'new-leads',
      label: '// NEW LEADS',
      value: '12',
      delta: { direction: 'up', label: '4 vs last wk' },
      trend: [6, 8, 8, 12],
    },
    {
      kind: 'bookings',
      label: '// BOOKINGS',
      value: '9',
      delta: { direction: 'up', label: '3 vs last wk' },
      trend: [4, 6, 6, 9],
    },
    {
      kind: 'revenue',
      label: '// REVENUE',
      value: '$2,840',
      delta: { direction: 'up', label: '22% vs last wk' },
      trend: [1800, 2100, 2330, 2840],
    },
    {
      kind: 'reviews',
      label: '// 5★ REVIEWS',
      value: '7',
      delta: { direction: 'up', label: '2 vs last wk' },
      trend: [3, 4, 5, 7],
    },
  ],

  funnel: {
    domain: 'freshhome.com.au',
    periodLabel: 'May 7–13',
    steps: [
      {
        kind: 'landing',
        label: 'Landing visits',
        sublabel: 'From ads + direct',
        count: 2142,
        pct: 100,
      },
      {
        kind: 'engaged',
        label: 'Engaged scroll',
        sublabel: 'Past offer card',
        count: 1671,
        pct: 78,
      },
      {
        kind: 'form-started',
        label: 'Form started',
        sublabel: 'First input focused',
        count: 450,
        pct: 21,
      },
      {
        kind: 'form-submitted',
        label: 'Form submitted',
        sublabel: 'Lead created',
        count: 274,
        pct: 12.8,
      },
      {
        kind: 'booked',
        label: 'Booked',
        sublabel: 'Converted to job',
        count: 203,
        pct: 9.5,
      },
      {
        kind: 'reviewed',
        label: 'Reviewed',
        sublabel: '5★ Google review',
        count: 73,
        pct: 3.4,
      },
    ],
  },

  insight: {
    severity: 'opportunity',
    target: 'booked-to-reviewed',
    suggestedAction: 'fire the review-request loop one day earlier',
    reasoning:
      'Form conversion at 12.8% is above the 8–10% residential-cleaning benchmark. Booked-to-reviewed sits at 36% — strong, but an earlier review request would lift it further.',
  },
};
