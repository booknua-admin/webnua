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

// Static tab definitions — `_client-content.tsx` overrides `count` with the
// live filtered count via `.map((tab) => ({ ...tab, count: pool.filter(...).length }))`,
// so we don't ship a hardcoded number here.
export const clientTicketTabs: TicketTab[] = [
  { id: 'active', label: 'Active' },
  { id: 'needs-reply', label: 'Needs your reply' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];
