import type { ActionItem } from '@/components/admin/integrations/IntegrationMatrixActionCard';
import type {
  MatrixClientRow,
  MatrixFilter,
  MatrixIntegrationColumn,
} from '@/components/admin/integrations/IntegrationMatrix';
import type { MatrixHeroStat } from '@/components/admin/integrations/IntegrationMatrixHero';

export const adminMatrixHero = {
  tag: '14 of 20 connected · 1 needs reauth',
  title: (
    <>
      Client <em>integrations</em>
    </>
  ),
  subtitle: (
    <>
      See which clients have connected their accounts and where you can help them finish setup.{' '}
      <strong>Click any cell to jump into that client&apos;s admin view.</strong>
    </>
  ),
  stats: [
    { num: <em>14</em>, label: 'Connected', tone: 'good' },
    { num: <em>1</em>, label: 'Needs reauth', tone: 'bad' },
    { num: <em>5</em>, label: 'Missing', tone: 'warn' },
    {
      num: (
        <>
          <em>70</em>%
        </>
      ),
      label: 'Setup rate',
      tone: 'neutral',
    },
  ] as MatrixHeroStat[],
};

export const adminMatrixFilters: MatrixFilter[] = [
  { id: 'all', label: 'All clients' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'missing', label: 'Missing' },
  { id: 'recent', label: 'Recently added' },
];

export const adminMatrixColumns: MatrixIntegrationColumn[] = [
  { id: 'gbp', label: 'GBP', logo: { initial: 'G', tone: 'gbp' } },
  { id: 'meta', label: 'Meta', logo: { initial: 'f', tone: 'meta' } },
  { id: 'ga', label: 'GA4', logo: { initial: 'A', tone: 'ga' } },
  { id: 'gads', label: 'G.Ads', logo: { initial: '▲', tone: 'gads' } },
  { id: 'stripe', label: 'Stripe', logo: { initial: 'S', tone: 'stripe' } },
];

export const adminMatrixRows: MatrixClientRow[] = [
  {
    id: 'voltline',
    name: 'Voltline',
    meta: 'PERTH · DAY 14',
    initial: 'V',
    tone: 'voltline',
    cells: {
      gbp: 'connected',
      meta: 'connected',
      ga: 'warning',
      gads: 'missing',
      stripe: 'missing',
    },
    progress: { connected: 3, total: 5 },
  },
  {
    id: 'freshhome',
    name: 'FreshHome',
    meta: 'DUBLIN · DAY 47',
    initial: 'F',
    tone: 'freshhome',
    cells: {
      gbp: 'connected',
      meta: 'connected',
      ga: 'connected',
      gads: 'connected',
      stripe: 'connected',
    },
    progress: { connected: 5, total: 5 },
  },
  {
    id: 'keyhero',
    name: 'KeyHero',
    meta: 'DAN · DAY 28',
    initial: 'K',
    tone: 'keyhero',
    cells: {
      gbp: 'connected',
      meta: 'missing',
      ga: 'connected',
      gads: 'missing',
      stripe: 'missing',
    },
    progress: { connected: 2, total: 5 },
  },
  {
    id: 'flowline',
    name: 'Flowline',
    meta: 'DAVE · DAY 11',
    initial: 'L',
    tone: 'flowline',
    cells: {
      gbp: 'connected',
      meta: 'connected',
      ga: 'connected',
      gads: 'missing',
      stripe: 'connected',
    },
    progress: { connected: 4, total: 5 },
  },
];

export const adminMatrixAttention: ActionItem[] = [
  {
    id: 'voltline-ga4',
    clientInitial: 'V',
    clientTone: 'bg-rust',
    text: (
      <>
        Voltline · GA4 token expired <em>2D AGO</em>
      </>
    ),
    cta: 'Send reauth',
  },
];

export const adminMatrixGaps: ActionItem[] = [
  {
    id: 'voltline-stripe',
    clientInitial: 'V',
    clientTone: 'bg-rust',
    text: (
      <>
        Voltline · Stripe missing <em>BLOCKS FUNNEL</em>
      </>
    ),
    cta: 'Send nudge',
  },
  {
    id: 'keyhero-meta',
    clientInitial: 'K',
    clientTone: 'bg-[#6a5230]',
    text: (
      <>
        KeyHero · Meta missing <em>BLOCKS ADS</em>
      </>
    ),
    cta: 'Send nudge',
  },
  {
    id: 'keyhero-stripe',
    clientInitial: 'K',
    clientTone: 'bg-[#6a5230]',
    text: (
      <>
        KeyHero · Stripe missing <em>BLOCKS FUNNEL</em>
      </>
    ),
    cta: 'Send nudge',
  },
];
