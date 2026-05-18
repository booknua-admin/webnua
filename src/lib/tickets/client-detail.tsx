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

export type TicketDetailAction =
  | { kind: 'link'; icon: string; label: string; href: string }
  | {
      kind: 'confirm';
      icon: string;
      label: string;
      confirm: {
        title: string;
        description?: ReactNode;
        confirmLabel: string;
        tone?: 'default' | 'destructive';
        thenHref?: string;
      };
    }
  | { kind: 'inert'; icon: string; label: string };

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
