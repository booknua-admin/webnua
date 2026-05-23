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
  /** Unread lead count in this tab — has customer activity newer than the
   *  operator's last view. Renders as a rust pill ONLY when > 0; the tab
   *  is otherwise unbadged (the standard email-inbox model: the badge
   *  represents things needing attention, not total volume). */
  count?: number;
};

export type LeadFilterChip = {
  id: string;
  label: string;
  count?: number;
};

/** Derived funnel-run completion state — see `LeadCompletion` in queries.tsx
 *  for the spec. Lifted onto the row so any consumer (automation engine,
 *  future filters) can read it without re-querying lead_events. */
export type LeadCompletion = 'in_progress' | 'completed';

/** Categorical surface attribution. Mirrors `leads.source_kind`. `meta` is
 *  reserved for the Meta lead-ads integration (later session). */
export type LeadSourceKind = 'website' | 'funnel' | 'meta';

export const LEAD_SOURCE_KIND_LABEL: Record<LeadSourceKind, string> = {
  website: 'Website',
  funnel: 'Funnel',
  meta: 'Meta',
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
  /** Has customer activity newer than the operator's last view — show
   *  the rust dot next to the name. Clears when the operator opens the
   *  lead detail (the detail page upserts `lead_reads.read_at = now()`). */
  unread: boolean;
  href: string;
  completion: LeadCompletion;
  sourceKind: LeadSourceKind;
};

export type AdminLeadRow = {
  id: string;
  initial: string;
  name: string;
  clientName: string;
  clientService: string;
  /** Real client slug — the client-filter identity (clientTone collapses
   *  many clients to one colour, so it can't filter). */
  clientSlug: string;
  clientTone: LeadClientTone;
  preview: string;
  status: LeadStatus;
  statusLabel?: string;
  age: string;
  meta: string;
  metaTone: 'good' | 'rust' | 'quiet';
  /** Has customer activity newer than the operator's last view — show
   *  the rust dot next to the name. Clears when the operator opens the
   *  lead detail (the detail page upserts `lead_reads.read_at = now()`). */
  unread: boolean;
  href: string;
  completion: LeadCompletion;
  sourceKind: LeadSourceKind;
};

// Timeline event
export type LeadTimelineDot =
  | 'sms-in'
  | 'sms-out'
  | 'form'
  | 'status'
  | 'email'
  | 'scheduled-sms'
  | 'scheduled-email'
  | 'review-request';

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
  /** Context for the GBP manual review-request button mounted in the
   *  QUICK ACTIONS rail. Carries the bits the modal pre-fills. The
   *  button hides itself when `clientId` is null (eg. a lead whose
   *  client row was deleted — unreachable in practice). */
  gbpContext: {
    clientId: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    recipientEmail: string | null;
  };
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
  /** The lead's display first name (the textarea placeholder reads it). */
  firstName: string;
  /** True when an email address is on file — drives whether the composer's
   *  Email channel is available. */
  hasEmail: boolean;
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
