import type { ReactNode } from 'react';

import type {
  TicketCategory,
  TicketStatus,
  TicketTab,
  TicketUrgency,
} from './types';

export type AdminTicketClientTone =
  | 'voltline'
  | 'freshhome'
  | 'keyhero'
  | 'flowline'
  | 'generic';

export type AdminTicketRow = {
  id: string;
  title: string;
  preview: string;
  category: TicketCategory;
  status: TicketStatus;
  urgency: TicketUrgency;
  age: string;
  unread?: boolean;
  client: {
    id: string;
    slug: string;
    initial: string;
    name: string;
    meta: string;
    tone?: AdminTicketClientTone;
  };
  href: string;
};

export type AdminTicketHeroStat = {
  num: ReactNode;
  label: string;
  tone?: 'warn' | 'rust' | 'neutral';
};

/** Copy-only hero defaults. The `tag` and `stats` array are computed live
 *  in `_admin-content.tsx` from `useAdminTicketsInbox()` + the workspace
 *  mode — agency mode counts across all accessible clients, sub-account
 *  mode counts only the active client. */
export const adminTicketsHero: {
  title: ReactNode;
  subtitle: ReactNode;
} = {
  title: (
    <>
      Your <em>ticket inbox</em>
    </>
  ),
  subtitle: (
    <>
      Every client request lands here — website changes, ad tweaks, billing
      questions, anything.{' '}
      <strong>Triage in the morning, work through the queue.</strong>
    </>
  ),
};

// Static tab definitions — every consumer (`_admin-content.tsx`,
// `_sub-account-content.tsx`) overrides `count` with the live filtered count
// via `.map((tab) => ({ ...tab, count: pool.filter(...).length }))`, so we
// don't ship a hardcoded number here.
export const adminTicketTabs: TicketTab[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];
