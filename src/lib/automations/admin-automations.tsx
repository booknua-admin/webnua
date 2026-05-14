import type { AdminAutomations, AutomationStat } from './types';

const placeholderStats: AutomationStat[] = [
  { label: '// NOT RUNNING', value: '—' },
  { label: '// —', value: '—' },
  { label: '// —', value: '—' },
];

const adminAutomations: AdminAutomations = {
  hero: {
    eyebrow: '// Workspace · 11 active flows',
    title: (
      <>
        All <em>automations</em>.
      </>
    ),
    subtitle: (
      <>
        Every flow running across your clients, grouped by automation type.{' '}
        <strong>11 of 16 flows are active</strong> — 5 disabled per client
        preference (mostly no-show recovery, which most clients leave off in
        the first 30 days).
      </>
    ),
  },
  filters: [
    { id: 'all', label: 'All clients', count: 4 },
    { id: 'freshhome', label: 'FreshHome' },
    { id: 'keyhero', label: 'KeyHero' },
    { id: 'neatworks', label: 'NeatWorks' },
    { id: 'voltline', label: 'Voltline' },
  ],
  defaultFilterId: 'all',
  stats: [
    {
      label: '// ACTIVE FLOWS',
      value: <em>11</em>,
      trend: 'of 16 configured',
      trendTone: 'quiet',
    },
    {
      label: '// SENT 7D',
      value: '428',
      trend: '↑ 12% vs prev',
      trendTone: 'good',
    },
    {
      label: '// DELIVERY',
      value: '96%',
      trend: 'across SMS + email',
      trendTone: 'quiet',
    },
    {
      label: '// REPLY RATE',
      value: '38%',
      trend: 'leads → reply',
      trendTone: 'quiet',
    },
  ],
  groups: [
    {
      id: 'instant-confirm',
      title: 'Instant confirm SMS',
      countBadge: '4 / 4',
      meta: (
        <>
          All clients · <strong>97% delivery</strong>
        </>
      ),
      flows: [
        {
          id: 'instant-confirm-freshhome',
          clientInitial: 'F',
          clientName: 'FreshHome',
          flowName: '1 step · instant on form submit',
          clientTone: 'freshhome',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '142' },
            { label: '// DELIVERED', value: '98%' },
            { label: '// REPLIED', value: '42%' },
          ],
          href: '/automations/instant-confirm-freshhome',
        },
        {
          id: 'instant-confirm-keyhero',
          clientInitial: 'K',
          clientName: 'KeyHero',
          flowName: '1 step · instant on call form',
          clientTone: 'keyhero',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '98' },
            { label: '// DELIVERED', value: '99%' },
            { label: '// REPLIED', value: '55%' },
          ],
          href: '/automations/instant-confirm-keyhero',
        },
        {
          id: 'instant-confirm-neatworks',
          clientInitial: 'N',
          clientName: 'NeatWorks',
          flowName: '1 step · instant on form submit',
          clientTone: 'neatworks',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '128' },
            { label: '// DELIVERED', value: '96%' },
            { label: '// REPLIED', value: '39%' },
          ],
          href: '/automations/instant-confirm-neatworks',
        },
      ],
    },
    {
      id: 'follow-up-24h',
      title: '24-hour follow-up sequence',
      countBadge: '3 / 4',
      meta: (
        <>
          3 active · <strong>34% reply rate</strong>
        </>
      ),
      flows: [
        {
          id: 'follow-up-freshhome',
          clientInitial: 'F',
          clientName: 'FreshHome',
          flowName: '3 steps · SMS / email / SMS · click to edit',
          clientTone: 'freshhome',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '86' },
            { label: '// DELIVERED', value: '94%' },
            { label: '// REPLIED', value: '28%' },
          ],
          href: '/automations/follow-up-freshhome',
        },
        {
          id: 'follow-up-keyhero',
          clientInitial: 'K',
          clientName: 'KeyHero',
          flowName: '3 steps · SMS / email / SMS',
          clientTone: 'keyhero',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '54' },
            { label: '// DELIVERED', value: '95%' },
            { label: '// REPLIED', value: '41%' },
          ],
          href: '/automations/follow-up-keyhero',
        },
        {
          id: 'follow-up-neatworks',
          clientInitial: 'N',
          clientName: 'NeatWorks',
          flowName: '3 steps · disabled by client',
          clientTone: 'neatworks',
          enabled: false,
          stats: placeholderStats,
          href: '/automations/follow-up-neatworks',
        },
      ],
    },
    {
      id: 'review-loop',
      title: 'Review request loop',
      countBadge: '3 / 4',
      meta: (
        <>
          3 active · <strong>18 reviews collected 7d</strong>
        </>
      ),
      flows: [
        {
          id: 'review-freshhome',
          clientInitial: 'F',
          clientName: 'FreshHome',
          flowName: '2 steps · 2h after complete + 5d retry',
          clientTone: 'freshhome',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '38' },
            { label: '// DELIVERED', value: '97%' },
            { label: '// REVIEWS', value: '11' },
          ],
          href: '/automations/review-freshhome',
        },
        {
          id: 'review-keyhero',
          clientInitial: 'K',
          clientName: 'KeyHero',
          flowName: '2 steps · 2h after complete + 5d retry',
          clientTone: 'keyhero',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '22' },
            { label: '// DELIVERED', value: '98%' },
            { label: '// REVIEWS', value: '7' },
          ],
          href: '/automations/review-keyhero',
        },
      ],
    },
    {
      id: 'no-show-recovery',
      title: 'No-show recovery',
      countBadge: '1 / 4',
      meta: <>3 off · client default</>,
      flows: [
        {
          id: 'no-show-keyhero',
          clientInitial: 'K',
          clientName: 'KeyHero',
          flowName: '1 step · rebook link on no-show',
          clientTone: 'keyhero',
          enabled: true,
          stats: [
            { label: '// SENT 7D', value: '3' },
            { label: '// DELIVERED', value: '100%' },
            { label: '// REBOOKED', value: '2' },
          ],
          href: '/automations/no-show-keyhero',
        },
      ],
    },
  ],
};

export { adminAutomations };
