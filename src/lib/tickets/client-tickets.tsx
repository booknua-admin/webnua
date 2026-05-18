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

export const clientTicketsHero = {
  tag: 'Live · 2 need your reply',
  title: (
    <>
      Your <em>tickets</em>
    </>
  ),
  subtitle: (
    <>
      Anything you&apos;ve asked Webnua to handle — website changes, ad tweaks,
      billing questions.{' '}
      <strong>Tap a ticket to see status and reply to Craig.</strong>
    </>
  ),
};

export const clientTicketTabs: TicketTab[] = [
  { id: 'active', label: 'Active', count: 5 },
  { id: 'needs-reply', label: 'Needs your reply', count: 2 },
  { id: 'done', label: 'Done', count: 8 },
  { id: 'all', label: 'All', count: 13 },
];
