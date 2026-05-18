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

export const adminLeadsTabs: LeadTab[] = [
  { id: 'new', label: 'New', count: 23 },
  { id: 'contacted', label: 'Contacted', count: 41 },
  { id: 'booked', label: 'Booked', count: 28 },
  { id: 'completed', label: 'Completed', count: 156 },
  { id: 'lost', label: 'Lost', count: 12 },
  { id: 'spam', label: 'Spam', count: 3 },
];
