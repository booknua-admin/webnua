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

export const clientTickets: ClientTicketRow[] = [
  {
    id: 'TKT-0247',
    title: '"Areas We Serve" page with suburb list',
    preview: (
      <>
        <strong>Craig:</strong> Single page with all suburbs, or 8 dedicated
        pages per suburb?
      </>
    ),
    category: 'website',
    status: 'open',
    awaiting: 'client',
    age: '12m ago',
    href: '/tickets/TKT-0247',
  },
  {
    id: 'TKT-0246',
    title: 'Refresh services page hero image',
    preview: (
      <>
        <strong>Craig:</strong> New hero image is on staging — have a look and
        tell me if you want any changes.
      </>
    ),
    category: 'website',
    status: 'in_progress',
    awaiting: 'client',
    age: '3h ago',
    href: '/tickets/TKT-0246',
  },
  {
    id: 'TKT-0245',
    title: 'Pause $99 funnel ads next weekend — going on holiday',
    preview: (
      <>
        <strong>Craig:</strong> Got it. Pausing Sat 18 May through Tues 21 May,
        resuming Wed morning.
      </>
    ),
    category: 'campaigns',
    status: 'in_progress',
    awaiting: 'operator',
    age: '4h ago',
    href: '/tickets/TKT-0245',
  },
  {
    id: 'TKT-0241',
    title: 'Got charged twice in April — can you check?',
    preview: (
      <>
        <strong>Craig:</strong> Confirmed the duplicate, refund processed today,
        will hit your card in 2-3 days.
      </>
    ),
    category: 'billing',
    status: 'in_progress',
    awaiting: 'operator',
    age: '2d ago',
    href: '/tickets/TKT-0241',
  },
  {
    id: 'TKT-0239',
    title: 'Idea — run a "winter maintenance" ad for landlords',
    preview: (
      <>
        <strong>You:</strong> Mate, what about a winter-maintenance angle for
        landlords getting properties ready before tenants...
      </>
    ),
    category: 'marketing',
    status: 'open',
    awaiting: 'operator',
    age: '3d ago',
    href: '/tickets/TKT-0239',
  },
  {
    id: 'TKT-0232',
    title: "Respond to David Cheung's 5-star review",
    preview: (
      <>
        <strong>Craig:</strong> Posted a reply this morning — thanks for the
        heads-up.
      </>
    ),
    category: 'reviews',
    status: 'done',
    awaiting: null,
    age: '5d ago',
    href: '/tickets/TKT-0232',
  },
  {
    id: 'TKT-0230',
    title: 'Add smoke alarm service to services page',
    preview: (
      <>
        <strong>System:</strong> You added this service yourself via the editor
        — auto-closed.
      </>
    ),
    category: 'website',
    status: 'done',
    awaiting: null,
    age: '5d ago',
    href: '/tickets/TKT-0230',
  },
];
