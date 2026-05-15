export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'done';

export type TicketUrgency = 'rush' | 'soon' | 'none';

export type TicketCategory =
  | 'website'
  | 'website-approval'
  | 'marketing'
  | 'campaigns'
  | 'reviews'
  | 'billing'
  | 'other';

export type TicketAwaiting = 'operator' | 'client' | null;

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  website: 'Website',
  'website-approval': 'Website approval',
  marketing: 'Marketing',
  campaigns: 'Campaigns',
  reviews: 'Reviews',
  billing: 'Billing',
  other: 'Other',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const URGENCY_LABEL: Record<TicketUrgency, string> = {
  rush: 'ASAP',
  soon: 'Few days',
  none: 'No rush',
};

export type TicketTab = {
  id: string;
  label: string;
  count?: number;
};
