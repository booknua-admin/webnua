import type { LeadTab } from '@/lib/leads/types';

export const clientLeadsTabs: LeadTab[] = [
  { id: 'new', label: 'New', count: 5 },
  { id: 'contacted', label: 'Contacted', count: 4 },
  { id: 'booked', label: 'Booked', count: 12 },
  { id: 'lost', label: 'Lost', count: 2 },
  { id: 'all', label: 'All' },
];

export const clientLeadsHero = {
  eyebrow: '// Voltline · 23 leads total',
  title: (
    <>
      Lead <em>inbox</em>.
    </>
  ),
  subtitle: (
    <>
      Every lead from your funnel.{' '}
      <strong>5 new, 4 you&rsquo;ve contacted, 12 booked</strong>. Click a row
      to see the full conversation thread.
    </>
  ),
};
