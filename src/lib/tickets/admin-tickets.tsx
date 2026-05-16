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

export const adminTicketsHero: {
  tag: string;
  title: ReactNode;
  subtitle: ReactNode;
  stats: AdminTicketHeroStat[];
} = {
  tag: 'Live · 7 open across 4 clients',
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
  stats: [
    { num: <em>2</em>, label: '// RUSH', tone: 'warn' },
    { num: '7', label: '// OPEN' },
    { num: '3', label: '// IN PROGRESS' },
    { num: <em>12</em>, label: '// DONE · 7D', tone: 'rust' },
  ],
};

export const adminTicketTabs: TicketTab[] = [
  { id: 'all', label: 'All', count: 10 },
  { id: 'open', label: 'Open', count: 7 },
  { id: 'in-progress', label: 'In progress', count: 3 },
  { id: 'blocked', label: 'Blocked', count: 1 },
  { id: 'done', label: 'Done', count: 12 },
];

export const adminTickets: AdminTicketRow[] = [
  {
    id: 'TKT-0247',
    title: 'New "Areas We Serve" page with suburb list',
    preview:
      'I want a new page that lists all the suburbs I cover — Subiaco, Mt Hawthorn, Mt Lawley...',
    category: 'website',
    status: 'open',
    urgency: 'soon',
    age: '12m ago',
    unread: true,
    client: {
      id: 'voltline',
      initial: 'V',
      name: 'Voltline',
      meta: 'MARK · DAY 14',
      tone: 'voltline',
    },
    href: '/tickets/TKT-0247',
  },
  {
    id: 'TKT-0246',
    title: 'Bad 1-star review needs response — looks fake',
    preview:
      "Got a really nasty 1-star review yesterday from someone I'm pretty sure isn't a real customer...",
    category: 'reviews',
    status: 'in_progress',
    urgency: 'rush',
    age: '2h ago',
    client: {
      id: 'freshhome',
      initial: 'F',
      name: 'FreshHome',
      meta: 'SARAH · DAY 47',
      tone: 'freshhome',
    },
    href: '/tickets/TKT-0246',
  },
  {
    id: 'TKT-0245',
    title: 'Pause $99 funnel ads next weekend — going on holiday',
    preview:
      "Heading to Bali Sat-Tues, can you pause the Meta ads so I don't get bookings I can't service?",
    category: 'campaigns',
    status: 'open',
    urgency: 'none',
    age: '4h ago',
    client: {
      id: 'voltline',
      initial: 'V',
      name: 'Voltline',
      meta: 'MARK · DAY 14',
      tone: 'voltline',
    },
    href: '/tickets/TKT-0245',
  },
  {
    id: 'TKT-0244',
    title: 'Add Joondalup to service area — getting calls from there',
    preview:
      'Been getting calls from Joondalup, Hillarys, Sorrento. Worth adding to my ad targeting?',
    category: 'marketing',
    status: 'open',
    urgency: 'soon',
    age: '6h ago',
    client: {
      id: 'keyhero',
      initial: 'K',
      name: 'KeyHero',
      meta: 'DAN · DAY 28',
      tone: 'keyhero',
    },
    href: '/tickets/TKT-0244',
  },
  {
    id: 'TKT-0243',
    title: 'Update pricing on services page — going up on May 1',
    preview:
      'All my prices are going up by $20 on the 1st, need to update the services page to match...',
    category: 'website',
    status: 'in_progress',
    urgency: 'soon',
    age: '1d ago',
    client: {
      id: 'flowline',
      initial: 'F',
      name: 'Flowline',
      meta: 'DAVE · DAY 11',
      tone: 'flowline',
    },
    href: '/tickets/TKT-0243',
  },
  {
    id: 'TKT-0241',
    title: 'Got charged twice in April — can you check?',
    preview:
      "Two A$497 charges on my Mastercard 11 days apart, one of them shouldn't be there...",
    category: 'billing',
    status: 'blocked',
    urgency: 'rush',
    age: '2d ago',
    client: {
      id: 'voltline',
      initial: 'V',
      name: 'Voltline',
      meta: 'MARK · DAY 14',
      tone: 'voltline',
    },
    href: '/tickets/TKT-0241',
  },
  {
    id: 'TKT-0238',
    title: 'Autumn deep-clean offer idea — want to test it',
    preview:
      'Was thinking of running an autumn deep-clean offer at $179 (normally $249). Worth a test?',
    category: 'marketing',
    status: 'in_progress',
    urgency: 'none',
    age: '3d ago',
    client: {
      id: 'freshhome',
      initial: 'F',
      name: 'FreshHome',
      meta: 'SARAH · DAY 47',
      tone: 'freshhome',
    },
    href: '/tickets/TKT-0238',
  },
  {
    id: 'TKT-0235',
    title: 'Replace stock photos on home page with real ones',
    preview:
      'I have proper photos from a recent job now, want to swap out the stock images on the homepage',
    category: 'website',
    status: 'open',
    urgency: 'none',
    age: '4d ago',
    client: {
      id: 'keyhero',
      initial: 'K',
      name: 'KeyHero',
      meta: 'DAN · DAY 28',
      tone: 'keyhero',
    },
    href: '/tickets/TKT-0235',
  },
  {
    id: 'TKT-0233',
    title: "Site doesn't show up when I Google my business name",
    preview:
      '"Searched Flowline plumbing Perth" and we\'re on page 2. Is there something we can do about that?',
    category: 'other',
    status: 'open',
    urgency: 'none',
    age: '5d ago',
    client: {
      id: 'flowline',
      initial: 'F',
      name: 'Flowline',
      meta: 'DAVE · DAY 11',
      tone: 'flowline',
    },
    href: '/tickets/TKT-0233',
  },
  {
    id: 'TKT-0230',
    title: 'Add smoke alarm service to services page',
    preview: 'Client handled this themselves through the editor 5 days ago',
    category: 'website',
    status: 'done',
    urgency: 'none',
    age: '5d ago',
    client: {
      id: 'voltline',
      initial: 'V',
      name: 'Voltline',
      meta: 'MARK · DAY 14',
      tone: 'voltline',
    },
    href: '/tickets/TKT-0230',
  },
];
