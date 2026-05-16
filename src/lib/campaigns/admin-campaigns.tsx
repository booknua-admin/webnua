import type { AdminCampaignsPage } from './types';

const adminCampaigns: AdminCampaignsPage = {
  hero: {
    eyebrow: '// Workspace · Meta campaigns',
    title: (
      <>
        All <em>campaigns</em>.
      </>
    ),
    subtitle: (
      <>
        Read-only view of Meta ad campaigns across your clients.{' '}
        <strong>Webnua manages, you watch.</strong> The campaign builder lives
        in Meta Ads Manager — we don&apos;t try to replicate it.
      </>
    ),
  },
  filters: [
    { id: 'all', label: 'All clients', count: 3 },
    { id: 'freshhome', label: 'FreshHome' },
    { id: 'keyhero', label: 'KeyHero' },
    { id: 'neatworks', label: 'NeatWorks' },
    { id: 'voltline', label: 'Voltline (pre-launch)' },
  ],
  defaultFilterId: 'all',
  stats: [
    {
      label: '// SPEND 7D',
      value: '$840',
      trend: '~$120 / day',
      trendTone: 'quiet',
    },
    {
      label: '// LEADS 7D',
      value: <em>74</em>,
      trend: '↑ 11 vs last wk',
      trendTone: 'good',
    },
    {
      label: '// AVG CPL',
      value: '$11.35',
      trend: '▼ vs $13.20',
      trendTone: 'good',
    },
    {
      label: '// AVG ROAS',
      value: '8.9×',
      trend: 'across 3 campaigns',
      trendTone: 'quiet',
    },
  ],
  rows: [
    {
      id: 'freshhome-first-clean',
      clientId: 'freshhome',
      logoInitial: 'F',
      name: 'FreshHome · $99 first clean',
      meta: (
        <>
          <strong>FreshHome</strong> · Cleaning · Perth metro · Started 31 days
          ago
        </>
      ),
      status: 'active',
      cells: [
        { value: '$30', sub: '/ DAY SPEND' },
        { value: <span className="text-rust">$9.40</span>, sub: 'CPL · 7D' },
        { value: '14.0×', sub: 'ROAS' },
      ],
      sparkPoints: '0,30 14,28 28,24 42,22 56,18 70,14 84,12 100,8',
    },
    {
      id: 'keyhero-response',
      clientId: 'keyhero',
      logoInitial: 'K',
      name: 'KeyHero · 30-min response',
      meta: (
        <>
          <strong>KeyHero</strong> · Locksmith · Perth metro · Started 12 days
          ago
        </>
      ),
      status: 'active',
      cells: [
        { value: '$45', sub: '/ DAY SPEND' },
        { value: <span className="text-rust">$11.20</span>, sub: 'CPL · 7D' },
        { value: '6.6×', sub: 'ROAS' },
      ],
      sparkPoints: '0,32 14,26 28,28 42,22 56,24 70,18 84,16 100,14',
    },
    {
      id: 'neatworks-dublin',
      clientId: 'neatworks',
      logoInitial: 'N',
      name: 'NeatWorks · Dublin residential',
      meta: (
        <>
          <strong>NeatWorks</strong> · Cleaning · Dublin · Started 6 weeks ago
        </>
      ),
      status: 'active',
      cells: [
        { value: '$40', sub: '/ DAY SPEND' },
        { value: <span className="text-rust">$13.45</span>, sub: 'CPL · 7D' },
        { value: '6.2×', sub: 'ROAS' },
      ],
      sparkPoints: '0,18 14,22 28,16 42,20 56,18 70,22 84,20 100,18',
    },
    {
      id: 'voltline-response',
      clientId: 'voltline',
      logoInitial: 'V',
      name: 'Voltline · 90-min response',
      meta: (
        <>
          <strong>Voltline</strong> · Electrical · Pre-launch · Launches when
          page goes live
        </>
      ),
      status: 'pending',
      statusLabel: 'Pending',
      cells: [
        { value: '$40', sub: '/ DAY (draft)' },
        { value: '—', sub: '—' },
        { value: '—', sub: '—' },
      ],
      dimmed: true,
    },
  ],
  footer: {
    tag: '// CAMPAIGN MANAGEMENT',
    body: "Edit creatives, audiences, and budgets in Meta Ads Manager. We surface performance here — we don't try to replace Meta's tools.",
    ctaLabel: 'Open Meta Ads ↗',
    ctaHref: '#',
  },
};

export { adminCampaigns };
