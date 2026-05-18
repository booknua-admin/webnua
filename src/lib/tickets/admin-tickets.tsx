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
