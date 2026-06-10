// =============================================================================
// Social calendar — shared types.
//
// The social_posts table (migration 0122). AI drafts a rolling calendar;
// the owner approves / edits / dismisses; approved posts auto-publish to
// the client's connected Facebook Page at their scheduled time.
// =============================================================================

export type SocialPostStatus = 'draft' | 'approved' | 'published' | 'failed' | 'dismissed';

export const SOCIAL_POST_KINDS = [
  'tip',
  'offer',
  'seasonal',
  'review_highlight',
  'behind_scenes',
  'before_after',
] as const;

export type SocialPostKind = (typeof SOCIAL_POST_KINDS)[number];

export const POST_KIND_LABEL: Record<SocialPostKind, string> = {
  tip: 'Tip',
  offer: 'Offer',
  seasonal: 'Seasonal',
  review_highlight: 'Review highlight',
  behind_scenes: 'Behind the scenes',
  before_after: 'Before / after',
};

export type SocialPostRow = {
  id: string;
  client_id: string;
  status: SocialPostStatus;
  scheduled_for: string;
  caption: string;
  hashtags: string;
  image_url: string | null;
  channels: string[];
  post_kind: string;
  created_via: 'ai' | 'manual';
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  publish_error: string | null;
  meta_post_id: string | null;
  created_at: string;
  updated_at: string;
};
