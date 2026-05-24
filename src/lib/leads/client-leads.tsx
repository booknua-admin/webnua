import type { LeadTab } from '@/lib/leads/types';

/** Static tab definitions. Phase 8 Session 2 adds the `needs_followup` tab —
 *  the cold-lead surface. Status tabs map 1:1 to `LeadStatus`; the new tab
 *  is orthogonal (a lead in any status can be cold). */
export const clientLeadsTabs: LeadTab[] = [
  { id: 'needs_followup', label: 'Needs follow-up' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'booked', label: 'Booked' },
  { id: 'lost', label: 'Lost' },
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
