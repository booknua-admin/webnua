import type { ClientCampaignsPage } from './types';

const voltlineClientCampaigns: ClientCampaignsPage = {
  hero: {
    eyebrow: '// Voltline · Meta ads · managed by Webnua',
    title: (
      <>
        Your <em>campaigns</em>.
      </>
    ),
    subtitle: (
      <>
        What Webnua is running on your behalf, what it&apos;s costing, and what
        it&apos;s bringing in.{' '}
        <strong>You don&apos;t manage anything from here</strong> — this is
        read-only. Want a change? Text Craig.
      </>
    ),
  },
  managedBand: {
    icon: '⚙',
    tag: '// MANAGED BY WEBNUA PERTH',
    title: (
      <>
        Craig handles your <em>ad strategy + creative</em>
      </>
    ),
    sub: (
      <>
        Targeting, creative, budgets, A/B tests, audience refreshes —{' '}
        <strong>all of it sits on the Webnua side</strong>. Your job is the
        work that comes in. This page exists so you always know what&apos;s
        running and what it&apos;s returning.
      </>
    ),
    cta: { label: '☏ Text Craig', href: '#' },
  },
  active: {
    eyebrow: 'ACTIVE · DAY 14 OF DELIVERY',
    name: (
      <>
        $99 emergency <em>call-out</em>
      </>
    ),
    meta: (
      <>
        <strong>Subiaco + 20km radius</strong> · adults 28–65 · home-owners and
        renters · <strong>shown on Instagram + Facebook feed</strong>
      </>
    ),
    statusLabel: 'Running',
    metrics: [
      {
        label: '// LEADS · 14 DAYS',
        value: <em>14</em>,
        trend: '↑ 5 vs prior 14 days',
        trendTone: 'good',
      },
      {
        label: '// COST PER LEAD',
        value: '$9.40',
        trend: '↓ $2.10 from start',
        trendTone: 'good',
      },
      {
        label: '// WEEKLY SPEND',
        value: '$240',
        trend: '$34/day · stable',
        trendTone: 'quiet',
      },
      {
        label: '// RETURN',
        value: <em>$11.80</em>,
        trend: (
          <>
            <strong>back for every $1 spent</strong>
          </>
        ),
        trendTone: 'quiet',
      },
    ],
    plainEnglish: (
      <>
        <strong>In plain English:</strong> over the last 14 days you spent{' '}
        <em>$480</em> on ads, got <em>14 leads</em>, booked <em>12 jobs</em>{' '}
        from them, and brought in around <em>$5,640 in work</em>.{' '}
        <strong>Strong week.</strong> For a tradie business in your category,
        anything above $5 return per dollar spent is solid — you&apos;re at
        $11.80.
      </>
    ),
  },
  trend: {
    title: (
      <>
        Performance <em>over time</em>
      </>
    ),
    sub: 'Leads (filled bars) vs ad spend (outlined bars) by week · last 4 weeks',
    yAxisLabels: ['20 / $300', '15 / $225', '10 / $150', '5 / $75', '0 / $0'],
    leadsMax: 20,
    spendMax: 300,
    weeks: [
      { label: 'WEEK -3', leads: 5, spend: 210 },
      { label: 'WEEK -2', leads: 8, spend: 220 },
      { label: 'WEEK -1', leads: 9, spend: 240 },
      { label: 'THIS WEEK', leads: 14, spend: 240, current: true },
    ],
    legendLeadsLabel: 'Leads',
    legendSpendLabel: 'Spend ($)',
  },
  activity: {
    title: (
      <>
        What Webnua&apos;s <em>done lately</em>
      </>
    ),
    sub: (
      <>
        <strong>Every change we make to your campaign shows up here.</strong>{' '}
        No surprises, no things happening behind the scenes you don&apos;t
        know about.
      </>
    ),
    items: [
      {
        id: 'creative-1',
        icon: '✎',
        tone: 'creative',
        who: 'Craig',
        body: (
          <>
            swapped in a new ad headline —{' '}
            <strong>&ldquo;Same-day sparky · Subiaco&rdquo;</strong> replacing{' '}
            <strong>&ldquo;Need an electrician today?&rdquo;</strong>
          </>
        ),
        desc: 'A/B testing against the previous winner · new version is running on 50% of impressions for 7 days before we pick the winner.',
        time: 'YESTERDAY',
      },
      {
        id: 'audience-1',
        icon: '⌖',
        tone: 'audience',
        who: 'Craig',
        body: (
          <>
            refreshed your audience —{' '}
            <strong>added &ldquo;home renovators 25–55&rdquo;</strong> as a new
            lookalike layer
          </>
        ),
        desc: "Why: we've seen 3 leads in the last 14 days mention renovation work · widening the audience to catch more of these.",
        time: '3 DAYS AGO',
      },
      {
        id: 'budget-1',
        icon: '$',
        tone: 'budget',
        who: 'Craig',
        body: (
          <>
            increased daily budget by <strong>$5/day</strong> ($29 → $34) on
            the back of strong cost-per-lead
          </>
        ),
        desc: 'Cost per lead dropped to $9.40 (down from $11.50). Standard play — when CPL drops, we feed it more spend. Always within the agreed monthly ceiling.',
        time: '7 DAYS AGO',
      },
      {
        id: 'tune-1',
        icon: '⚙',
        tone: 'tune',
        who: 'Craig',
        body: (
          <>
            excluded leads from{' '}
            <strong>Cottesloe + Mosman Park postcodes</strong> based on your
            &ldquo;outside service area&rdquo; feedback
          </>
        ),
        desc: "You mentioned 3 leads from these areas weren't fitting your jobs profile. Targeting tightened to your 20km radius from Mt Lawley.",
        time: '10 DAYS AGO',
      },
      {
        id: 'creative-2',
        icon: '✎',
        tone: 'creative',
        who: 'Craig',
        body: (
          <>
            launched your first campaign —{' '}
            <strong>$99 emergency call-out</strong> with 2 ad variants
          </>
        ),
        desc: 'Campaign live · Subiaco + 20km radius · age 28-65 · home-owners and renters · Instagram + Facebook feed placement.',
        time: '14 DAYS AGO',
      },
    ],
  },
  changeCard: {
    body: (
      <>
        <strong>Want to change something?</strong> Add a new offer, kill a
        campaign, pause spend during a busy week, change your service area —
        text Craig and he&apos;ll handle it.{' '}
        <strong>Typical turnaround: under 2 hours during business days.</strong>
      </>
    ),
    actions: [
      { label: '📞 Call' },
      { label: '☏ Text Craig', primary: true },
    ],
  },
};

export { voltlineClientCampaigns };
