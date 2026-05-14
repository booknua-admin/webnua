import type { ReactNode } from 'react';

import type {
  TicketCategory,
  TicketStatus,
  TicketUrgency,
} from './types';

export type TicketDetailMessage = {
  id: string;
  author: 'client' | 'operator';
  name: string;
  role: string;
  time: string;
  avatar: string;
  body: ReactNode;
  draft?: boolean;
};

export type TicketDetailProperty = {
  label: string;
  value: ReactNode;
  editable?: boolean;
};

export type TicketDetailAction = {
  icon: string;
  label: string;
};

export type ClientTicketDetail = {
  id: string;
  category: TicketCategory;
  status: TicketStatus;
  statusLabel: string;
  statusHeadline: ReactNode;
  urgency: TicketUrgency;
  urgencyLabel: string;
  title: ReactNode;
  metaLine: ReactNode;
  thread: TicketDetailMessage[];
  reply: {
    label: string;
    placeholder: string;
    chips: string[];
    sendLabel: string;
  };
  statusDescription: ReactNode;
  properties: TicketDetailProperty[];
  actions: TicketDetailAction[];
};

export const clientTicketDetail: ClientTicketDetail = {
  id: 'TKT-0247',
  category: 'website',
  status: 'open',
  statusLabel: 'Open · awaiting your reply',
  statusHeadline: (
    <>
      <em>Open</em> · awaiting your reply
    </>
  ),
  urgency: 'soon',
  urgencyLabel: 'Few days',
  title: (
    <>
      &ldquo;Areas We Serve&rdquo; page with <em>suburb list</em>
    </>
  ),
  metaLine: (
    <>
      Submitted <strong>12 minutes ago</strong> · open for 12m · managed by{' '}
      <strong>Craig Fremantle · Webnua Perth</strong>
    </>
  ),
  thread: [
    {
      id: 'm1',
      author: 'client',
      name: 'You',
      role: 'Client',
      time: '12 min ago',
      avatar: 'M',
      body: (
        <p>
          I want a new &ldquo;Areas We Serve&rdquo; page that lists all the
          suburbs I cover — Subiaco, Mt Hawthorn, Mt Lawley, Highgate,
          Inglewood, West Perth, North Perth, Maylands. Each suburb could have
          a short paragraph and maybe a Google Maps embed showing my service
          area. Goal: rank for &ldquo;[suburb] electrician&rdquo; searches.
        </p>
      ),
    },
    {
      id: 'm2',
      author: 'operator',
      name: 'Craig',
      role: 'Webnua',
      time: 'just now',
      avatar: 'C',
      body: (
        <>
          <p>
            Hi Mark — great idea, &ldquo;Areas We Serve&rdquo; pages work well
            for local SEO. I&apos;ll build this out with 8 suburb sections +
            maps. Roughly <strong>2 days work, ready by Thursday</strong>.
          </p>
          <p>
            One quick question before I start: do you want a{' '}
            <strong>single page with all suburbs</strong> (faster to build,
            less SEO juice) or <strong>8 dedicated pages, one per suburb</strong>{' '}
            (more SEO juice, takes 4 days)?
          </p>
        </>
      ),
    },
  ],
  reply: {
    label: '// Reply to Craig',
    placeholder: 'Type your reply to Craig...',
    chips: [
      'Single page is fine',
      'Go with 8 dedicated pages',
      'Let me think on it',
      'Call me to discuss',
    ],
    sendLabel: 'Send reply →',
  },
  statusDescription: (
    <>
      Craig has asked a question and is waiting for your answer before he
      starts building. <strong>Reply when you can</strong> — no rush.
    </>
  ),
  properties: [
    { label: 'Category', value: 'Website' },
    { label: 'Type', value: 'New page' },
    { label: 'Urgency', value: 'Few days' },
    { label: 'Managed by', value: 'Craig F.' },
    { label: 'ETA', value: 'Thu, 2 days' },
    { label: 'Submitted', value: '12 min ago' },
  ],
  actions: [
    { icon: '☏', label: 'Call Craig directly' },
    { icon: '✎', label: 'Edit original request' },
    { icon: '⤴', label: 'Add a reference file' },
    { icon: '⊘', label: 'Cancel this ticket' },
  ],
};
