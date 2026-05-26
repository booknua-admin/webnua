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

/** Copy-only hero defaults. The `eyebrow` is computed live in
 *  `_client-content.tsx` from `useClientLeadsInbox()` — previously
 *  hardcoded "// Voltline · 23 leads total" which (a) leaked another
 *  customer's name into every client's dashboard and (b) showed a fake
 *  count. The status-summary prose in the subtitle was likewise fake;
 *  removed in favour of the live tab counts the user can see directly. */
export const clientLeadsHero = {
  title: (
    <>
      Lead <em>inbox</em>.
    </>
  ),
  subtitle: (
    <>
      Every lead from your funnel. Click a row to see the full conversation
      thread.
    </>
  ),
};
