// =============================================================================
// Suggested actions — shared types.
//
// The approval-first spine (migration 0119). Every AI module that drafts
// work writes a `suggested_actions` row; the owner dashboard renders the
// queue as approvable cards. These types are shared by the browser data
// layer (queries.tsx), the server write helper (server.ts), and the
// approve-dispatch route.
// =============================================================================

export const SUGGESTED_ACTION_KINDS = [
  'reply_draft',
  'ads_budget',
  'ads_pause',
  'ads_creative_refresh',
  'review_reply_draft',
  'followup_nudge',
  'generic',
] as const;

export type SuggestedActionKind = (typeof SUGGESTED_ACTION_KINDS)[number];

export type SuggestedActionStatus = 'pending' | 'approved' | 'dismissed' | 'expired';

export type SuggestedActionUrgency = 'normal' | 'high';

/** The table row, as read by both the browser and the server. */
export type SuggestedActionRow = {
  id: string;
  client_id: string;
  kind: SuggestedActionKind;
  status: SuggestedActionStatus;
  title: string;
  body: string;
  explanation: string;
  payload: Record<string, unknown>;
  source_entity_type: string | null;
  source_entity_id: string | null;
  dedupe_key: string | null;
  urgency: SuggestedActionUrgency;
  created_at: string;
  expires_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution: Record<string, unknown>;
};

// --- per-kind payload shapes ---------------------------------------------

/** kind = 'reply_draft' — an AI-drafted reply to an inbound customer email. */
export type ReplyDraftPayload = {
  leadId: string;
  draftText: string;
  subject?: string;
  intent: string;
};

/** kind = 'ads_pause' | 'ads_budget' — a drafted Meta campaign action. */
export type AdsActionPayload = {
  metaCampaignDbId: string;
  campaignName: string;
  /** ads_budget only — the recommended new daily budget. */
  newDailyBudgetCents?: number;
  currentDailyBudgetCents?: number | null;
};

/** The label the approve button carries per kind. */
export const APPROVE_LABEL: Record<SuggestedActionKind, string> = {
  reply_draft: 'Approve & send',
  ads_budget: 'Approve budget change',
  ads_pause: 'Pause campaign',
  ads_creative_refresh: 'Open refresh',
  review_reply_draft: 'Approve & post',
  followup_nudge: 'Open lead',
  generic: 'Approve',
};
