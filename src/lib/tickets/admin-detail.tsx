import type { ReactNode } from 'react';

import type { AdminTicketClientTone } from './admin-tickets';
import type {
  TicketCategory,
  TicketStatus,
  TicketUrgency,
} from './types';
import type {
  TicketDetailAction,
  TicketDetailMessage,
  TicketDetailProperty,
} from './client-detail';

export type AdminTicketDetail = {
  id: string;
  category: TicketCategory;
  status: TicketStatus;
  urgency: TicketUrgency;
  title: ReactNode;
  client: { initial: string; name: string; tone?: AdminTicketClientTone };
  metaLine: ReactNode;
  thread: TicketDetailMessage[];
  reply: {
    placeholder: string;
    defaultValue: string;
    sendLabel: string;
  };
  statusOptions: { status: TicketStatus; label: string }[];
  properties: TicketDetailProperty[];
  actions: TicketDetailAction[];
};

export const adminTicketDetail: AdminTicketDetail = {
  id: 'TKT-0247',
  category: 'website',
  status: 'open',
  urgency: 'soon',
  title: (
    <>
      New &ldquo;Areas We Serve&rdquo; page with <em>suburb list</em>
    </>
  ),
  client: { initial: 'V', name: 'Voltline', tone: 'voltline' },
  metaLine: (
    <>
      From <strong>Mark Cassidy · Voltline</strong> · 12 minutes ago · open
      for 12m
    </>
  ),
  thread: [
    {
      id: 'm1',
      author: 'client',
      name: 'Mark Cassidy',
      role: 'Client',
      time: '12 min ago',
      avatar: 'M',
      body: (
        <p>
          I want a new <strong>&ldquo;Areas We Serve&rdquo;</strong> page that
          lists all the suburbs I cover — Subiaco, Mt Hawthorn, Mt Lawley,
          Highgate, Inglewood, West Perth, North Perth, Maylands. Each suburb
          could have a short paragraph and maybe a Google Maps embed showing
          my service area. Goal: rank for{' '}
          <em>&ldquo;[suburb] electrician&rdquo;</em> searches.
        </p>
      ),
    },
    {
      id: 'm2',
      author: 'operator',
      name: 'Craig',
      role: 'Operator',
      time: 'just now · draft',
      avatar: 'C',
      draft: true,
      body: (
        <p>
          Hi Mark — great idea, &ldquo;Areas We Serve&rdquo; pages work well
          for local SEO. I&apos;ll build this out with 8 suburb sections +
          maps. Roughly <strong>2 days work, ready by Thursday</strong>. One
          quick question before I start: do you want a single page with all
          suburbs (faster to build, less SEO) or 8 dedicated pages, one per
          suburb (more SEO juice, takes 4 days)?
        </p>
      ),
    },
  ],
  reply: {
    placeholder: 'Type a reply to Mark...',
    defaultValue:
      'Hi Mark — great idea, "Areas We Serve" pages work well for local SEO. I\'ll build this out with 8 suburb sections + maps. Roughly 2 days work, ready by Thursday. One quick question before I start: do you want a single page with all suburbs (faster to build, less SEO) or 8 dedicated pages, one per suburb (more SEO juice, takes 4 days)?',
    sendLabel: 'Send reply →',
  },
  statusOptions: [
    { status: 'open', label: '● Open' },
    { status: 'in_progress', label: '● In progress' },
    { status: 'blocked', label: '⚠ Blocked / needs info' },
    { status: 'done', label: '✓ Done' },
  ],
  properties: [
    { label: 'Category', value: 'Website', editable: true },
    { label: 'Subtype', value: 'New page', editable: true },
    { label: 'Urgency', value: 'Few days', editable: true },
    { label: 'Assigned', value: 'Craig', editable: true },
    { label: 'ETA', value: 'Thu (2d)', editable: true },
    { label: 'Submitted', value: '12 min ago' },
  ],
  actions: [
    { icon: '▦', label: 'Open Voltline website' },
    { icon: '+', label: 'Create new page draft' },
    { icon: '↗', label: 'Add internal note' },
    { icon: '⤿', label: 'Convert to subtasks' },
  ],
};
