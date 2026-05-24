import type { LeadFilterChip, LeadTab } from '@/lib/leads/types';

export const adminLeadsHero = {
  eyebrow: '// Workspace · all leads',
  title: (
    <>
      Lead <em>inbox</em>.
    </>
  ),
  subtitle: (
    <>
      Every lead across your workspace.{' '}
      <strong>Filter to one client to drill in</strong>, or stay on the inbox to
      manage all together. Click a lead to open the full thread.
    </>
  ),
};

export const adminLeadsClientFilters: LeadFilterChip[] = [
  { id: 'all', label: 'All clients', count: 4 },
  { id: 'freshhome', label: 'FreshHome' },
  { id: 'keyhero', label: 'KeyHero' },
  { id: 'neatworks', label: 'NeatWorks' },
  { id: 'voltline', label: 'Voltline' },
];

/** Static tab definitions. Phase 8 Session 2 adds the `needs_followup` tab —
 *  the cold-lead surface. Status tabs map 1:1 to `LeadStatus`; the new tab
 *  is orthogonal (a lead in any status can be cold). */
export const adminLeadsTabs: LeadTab[] = [
  { id: 'needs_followup', label: 'Needs follow-up' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'booked', label: 'Booked' },
  { id: 'completed', label: 'Completed' },
  { id: 'lost', label: 'Lost' },
  { id: 'spam', label: 'Spam' },
];
