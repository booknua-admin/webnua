import type { ReactNode } from 'react';

import type {
  TicketAwaiting,
  TicketCategory,
  TicketStatus,
  TicketTab,
} from './types';

export type ClientTicketRow = {
  id: string;
  title: string;
  preview: ReactNode;
  category: TicketCategory;
  status: TicketStatus;
  awaiting: TicketAwaiting;
  age: string;
  href: string;
};

/** Copy-only hero defaults. The `tag` is computed live in
 *  `_client-content.tsx` from `useClientTicketsInbox()` — "N need your reply"
 *  maps to `awaiting === 'client'`. "Craig" was removed: the support contact
 *  is the operator the client is matched with (see clientSupportContact in
 *  `lib/nav/client-nav.ts`), not a hardcoded name. */
export const clientTicketsHero = {
  title: (
    <>
      Your <em>tickets</em>
    </>
  ),
  subtitle: (
    <>
      Anything you&apos;ve asked Webnua to handle — website changes, ad tweaks,
      billing questions.{' '}
      <strong>Tap a ticket to see status and reply.</strong>
    </>
  ),
};

export const clientTicketTabs: TicketTab[] = [
  { id: 'active', label: 'Active', count: 5 },
  { id: 'needs-reply', label: 'Needs your reply', count: 2 },
  { id: 'done', label: 'Done', count: 8 },
  { id: 'all', label: 'All', count: 13 },
];
