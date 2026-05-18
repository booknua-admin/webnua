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
