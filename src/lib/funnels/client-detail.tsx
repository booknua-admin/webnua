import type { FunnelDetail } from './types';

export const voltlineFunnel: FunnelDetail = {
  id: 'emergency-call-out',
  back: { label: 'Back to funnels', href: '/funnels' },
  hero: {
    tag: 'Webnua-managed funnel',
    title: (
      <>
        $99 <em>emergency call-out</em> funnel
      </>
    ),
    subtitle: (
      <>
        Your 3-step booking funnel running on{' '}
        <strong>book.voltline.com.au</strong>. Ads → landing → schedule →
        booked. Webnua built this and manages updates — text Craig to change
        anything.
      </>
    ),
    meta: [
      { label: 'Built', value: <>14d ago</> },
      { label: 'By', value: <>Webnua</> },
    ],
    versionLabel: 'v3 · current',
    actions: {
      viewLiveLabel: '⌕ View live',
      viewLiveHref: 'https://book.voltline.com.au',
      requestChangeLabel: '+ Request a change',
      requestChangeHref: '/tickets/new',
    },
  },
  agg: {
    label: '// Funnel performance · 14 days',
    live: true,
    metrics: [
      {
        num: <em>412</em>,
        label: '// Visits in',
        trend: '↑ from Meta ads',
      },
      {
        num: <>14</>,
        label: '// Booked',
        trend: '3.4% end-to-end',
      },
    ],
    bottom: {
      left: <>Revenue from funnel</>,
      right: (
        <>
          <strong>$1,386</strong> at $99 each
        </>
      ),
    },
  },
  flow: {
    title: (
      <>
        Step-by-step <em>flow</em>
      </>
    ),
    defaultPeriod: '14d',
    periods: ['7d', '14d', '30d', '90d'],
  },
  steps: [
    {
      id: 'landing',
      position: 1,
      positionLabel: 'Landing',
      tone: 'first',
      thumb: 'landing',
      name: '$99 offer landing',
      url: 'book.voltline.com.au',
      metricNum: <em>412</em>,
      metricLabel: '// Visitors',
      foot: [
        { label: 'Avg time', value: '0:42' },
        { label: 'Bounce', value: '52%' },
        { label: 'Scroll depth', value: '74%' },
      ],
    },
    {
      id: 'schedule',
      position: 2,
      positionLabel: 'Schedule',
      tone: 'middle',
      thumb: 'schedule',
      name: 'Pick a time + details',
      url: 'book.voltline.com.au/schedule',
      metricNum: <em>74</em>,
      metricLabel: '// Reached',
      foot: [
        { label: 'Avg time', value: '1:18' },
        { label: 'Form starts', value: '74 / 74' },
        { label: 'Form abandons', value: '60 (81%)' },
      ],
    },
    {
      id: 'booked',
      position: 3,
      positionLabel: 'Booked',
      tone: 'last',
      thumb: 'thanks',
      name: 'Thank-you + SMS confirm',
      url: 'book.voltline.com.au/thanks',
      metricNum: <em>14</em>,
      metricLabel: '// Completed · $99 each',
      foot: [
        { label: 'SMS sent', value: '14 / 14' },
        { label: 'Showed up', value: '13 (93%)' },
        { label: 'No-show', value: '1' },
      ],
    },
  ],
  arrows: [
    {
      id: 'landing-to-schedule',
      pct: '18% →',
      dropLabel: (
        <>
          338 dropped <strong>→ ad spend</strong>
        </>
      ),
    },
    {
      id: 'schedule-to-booked',
      pct: '19% →',
      dropLabel: (
        <>
          <strong>60 dropped</strong> on form
        </>
      ),
    },
  ],
  insights: {
    title: (
      <>
        <em>Insights</em> · what we see
      </>
    ),
    subtitle: (
      <>
        Webnua reviews funnel performance weekly and flags what&apos;s working
        or breaking.
      </>
    ),
    items: [
      {
        id: 'schedule-dropoff',
        tone: 'warn',
        glyph: '!',
        body: (
          <>
            <strong>81% drop-off on the schedule form.</strong> Most visitors
            get to the form but don&apos;t submit — likely because the form
            asks for too much info upfront. Recommend testing a 2-field version
            (phone + suburb only).
          </>
        ),
        meta: 'Flagged 3d ago · Webnua',
      },
      {
        id: 'headline-test',
        tone: 'good',
        glyph: '✓',
        body: (
          <>
            <strong>v3 headline is outperforming v2 by 24%.</strong>{' '}
            &ldquo;Get a sparky in 60 min&rdquo; beats &ldquo;Same-day
            emergency electrician&rdquo; significantly. Locking in for now.
          </>
        ),
        meta: 'Confirmed 7d ago · Webnua',
      },
      {
        id: 'saturday-window',
        tone: 'info',
        glyph: 'i',
        body: (
          <>
            <strong>Saturday evening converts highest.</strong> 38% of bookings
            come Sat 6–10pm. Worth boosting ad budget for that window.{' '}
            <em>Want me to set that up?</em>
          </>
        ),
        meta: 'Suggested 1d ago · Webnua',
      },
    ],
  },
  history: {
    title: (
      <>
        Build <em>history</em>
      </>
    ),
    subtitle: (
      <>
        Every published version of your funnel. Webnua keeps the last 5
        versions for instant rollback.
      </>
    ),
    items: [
      {
        id: 'v3',
        label: 'v3',
        current: true,
        body: <>Headline test: &ldquo;Get a sparky in 60 min&rdquo;</>,
        meta: 'Published · 412 visits · 3.4% CR',
        when: '14d ago',
      },
      {
        id: 'v2',
        label: 'v2',
        body: <>Added trust badges + Trustpilot widget</>,
        meta: 'Prior · 286 visits · 2.7% CR',
        when: '28d ago',
      },
      {
        id: 'v1',
        label: 'v1',
        body: (
          <>Initial launch — &ldquo;Same-day emergency electrician&rdquo;</>
        ),
        meta: 'Initial · 124 visits · 1.6% CR',
        when: '42d ago',
      },
    ],
    ctaLabel: '+ Request a change',
    ctaHref: '/tickets/new',
  },
};
