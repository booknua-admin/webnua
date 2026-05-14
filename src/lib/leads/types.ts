import type { ReactNode } from 'react';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'booked'
  | 'completed'
  | 'lost';

export type LeadUrgency = 'asap' | 'today' | 'soon' | 'none';

export type LeadClientTone =
  | 'voltline'
  | 'freshhome'
  | 'keyhero'
  | 'neatworks'
  | 'flowline'
  | 'generic';

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  completed: 'Completed',
  lost: 'Lost',
};

export const LEAD_URGENCY_LABEL: Record<LeadUrgency, string> = {
  asap: 'ASAP',
  today: 'Today',
  soon: 'Soon',
  none: '',
};

export type LeadTab = {
  id: string;
  label: string;
  count?: number;
};

export type LeadFilterChip = {
  id: string;
  label: string;
  count?: number;
};

// Inbox rows
export type ClientLeadRow = {
  id: string;
  initial: string;
  name: string;
  suburb: string;
  preview: string;
  status: LeadStatus;
  statusLabel?: string;
  urgency?: LeadUrgency;
  age: string;
  unread: boolean;
  href: string;
};

export type AdminLeadRow = {
  id: string;
  initial: string;
  name: string;
  clientName: string;
  clientService: string;
  clientTone: LeadClientTone;
  preview: string;
  status: LeadStatus;
  statusLabel?: string;
  age: string;
  meta: string;
  metaTone: 'good' | 'rust' | 'quiet';
  unread: boolean;
  href: string;
};

// Timeline event
export type LeadTimelineDot =
  | 'sms-in'
  | 'sms-out'
  | 'form'
  | 'status'
  | 'email'
  | 'scheduled-sms'
  | 'scheduled-email';

export type LeadTimelineEvent = {
  id: string;
  dot: LeadTimelineDot;
  meta: ReactNode;
  body?: ReactNode;
  snippet?: ReactNode;
  rightTime?: ReactNode;
  pending?: boolean;
  auto?: boolean;
};

// Side rail
export type LeadRailRow = {
  label: string;
  value: ReactNode;
  accent?: boolean;
  tone?: 'good' | 'quiet' | 'default';
};

export type LeadRailCard = {
  heading: string;
  rows: LeadRailRow[];
};

export type LeadQuickAction = {
  icon: string;
  label: string;
  primary?: boolean;
  href?: string;
};

// Detail
export type LeadDetail = {
  id: string;
  backHref: string;
  backLabel: string;
  // Header block
  tag: string;
  title: ReactNode;
  subtitle: ReactNode;
  avatar: string;
  name: string;
  metaParts: ReactNode[];
  clientPillLabel?: string;
  status: LeadStatus;
  // Timeline
  timeline: {
    eventCount: number;
    events: LeadTimelineEvent[];
  };
  // Right rail
  quickActions: LeadQuickAction[];
  rail: LeadRailCard[];
  conversationHref: string;
};

// Conversation
export type ConversationBubbleKind =
  | 'incoming'
  | 'outgoing'
  | 'auto'
  | 'system';

export type ConversationMessage = {
  id: string;
  kind: ConversationBubbleKind;
  body: ReactNode;
  metaPrefix?: ReactNode;
  channel?: 'SMS' | 'Email' | 'Form';
  time?: string;
  delivered?: boolean;
  autoLabel?: string;
};

export type ConversationDay = {
  id: string;
  label: string;
  messages: ConversationMessage[];
};

export type ConversationChannelTab = {
  id: string;
  label: string;
};

export type ConversationQuickReply = {
  icon: string;
  label: string;
};

export type LeadConversation = {
  id: string;
  backHref: string;
  backLabel: string;
  tag: string;
  title: ReactNode;
  subtitle: ReactNode;
  // Header block
  avatar: string;
  name: string;
  headerMeta: ReactNode;
  channelTabs: ConversationChannelTab[];
  headerActions?: string[];
  // Thread
  days: ConversationDay[];
  // Composer
  composer: {
    channelToggle?: string;
    channels?: string[];
    placeholder: string;
    defaultValue?: string;
    helpers?: string[];
  };
  // Side rail
  quickActions?: LeadQuickAction[];
  quickReplies?: ConversationQuickReply[];
  rail: LeadRailCard[];
};
