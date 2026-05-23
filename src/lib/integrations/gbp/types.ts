// =============================================================================
// Google Business Profile — API slice types + DB row types.
//
// Hand-written until the generated Database type (src/lib/types/database.ts)
// is regenerated to include the GBP tables (0066–0068). Mirrors the pattern
// used by lib/integrations/twilio/types.ts + lib/integrations/resend/types.ts.
//
// Each Google API slice carries the SUBSET of fields the GBP wrapper actually
// consumes — defensive optional shapes that survive Google adding new fields
// or moving things around within a major API version.
//
// SERVER + CLIENT safe — pure types.
// =============================================================================

// --- Google Business Profile API slices --------------------------------------

/** One account from the Account Management API. `name` is the full resource
 *  name, e.g. "accounts/123456789". */
export type GbpAccount = {
  name?: string;
  accountName?: string;
  type?: string;
  role?: string;
  verificationState?: string;
};

/** Wrapper for the accounts list response. */
export type GbpAccountsResponse = {
  accounts?: GbpAccount[];
  nextPageToken?: string;
};

/** A Business Profile location. `name` is the full resource name relative to
 *  the account, e.g. "locations/987654321". */
export type GbpLocation = {
  name?: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  phoneNumbers?: {
    primaryPhone?: string;
  };
  websiteUri?: string;
  metadata?: {
    placeId?: string;
    newReviewUri?: string;
    mapsUri?: string;
  };
};

export type GbpLocationsResponse = {
  locations?: GbpLocation[];
  nextPageToken?: string;
};

/** Google's review enum maps to "ONE" .. "FIVE"; the client wrapper converts
 *  to a 1-5 integer. Documented values + a fallback for unknown strings. */
export type GbpStarRating = 'STAR_RATING_UNSPECIFIED' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';

/** One review from the v4 list endpoint. `name` is the full review resource
 *  name: "accounts/{a}/locations/{l}/reviews/{r}". */
export type GbpReview = {
  name?: string;
  reviewId?: string;
  reviewer?: {
    profilePhotoUrl?: string;
    displayName?: string;
    isAnonymous?: boolean;
  };
  starRating?: GbpStarRating;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
    updateTime?: string;
  };
};

export type GbpReviewsResponse = {
  reviews?: GbpReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
};

// --- DB row shapes -----------------------------------------------------------

/** A client_gbp_locations row (migration 0066). */
export type ClientGbpLocationRow = {
  id: string;
  client_id: string;
  created_at: string;
  updated_at: string;
  gbp_account_id: string;
  gbp_location_id: string;
  location_title: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  review_link: string | null;
  current_rating: number | null;
  review_count: number;
  last_synced_at: string | null;
};

export type ClientGbpLocationInsert = {
  client_id: string;
  gbp_account_id: string;
  gbp_location_id: string;
  location_title?: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  review_link?: string | null;
  current_rating?: number | null;
  review_count?: number;
  last_synced_at?: string | null;
};

/** A gbp_reviews row (migration 0067). */
export type GbpReviewRow = {
  id: string;
  client_id: string;
  gbp_review_id: string;
  reviewer_name: string | null;
  reviewer_profile_photo_url: string | null;
  rating: number;
  comment: string | null;
  created_at_google: string;
  updated_at_google: string | null;
  reply_text: string | null;
  reply_created_at: string | null;
  synced_at: string;
  is_new_since_last_view: boolean;
  deleted_at_google: string | null;
};

export type GbpReviewInsert = {
  client_id: string;
  gbp_review_id: string;
  reviewer_name: string | null;
  reviewer_profile_photo_url: string | null;
  rating: number;
  comment: string | null;
  created_at_google: string;
  updated_at_google: string | null;
  reply_text: string | null;
  reply_created_at: string | null;
  synced_at: string;
  is_new_since_last_view?: boolean;
  deleted_at_google?: string | null;
};

/** A gbp_review_requests row (migration 0068). */
export type GbpReviewRequestRow = {
  id: string;
  client_id: string;
  lead_id: string | null;
  booking_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  channel: 'sms' | 'email';
  sent_at: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  error_message: string | null;
  review_link: string;
  clicked_at: string | null;
  resulted_in_review_id: string | null;
};

export type GbpReviewRequestInsert = {
  client_id: string;
  lead_id?: string | null;
  booking_id?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  channel: 'sms' | 'email';
  status?: 'queued' | 'sent' | 'delivered' | 'failed';
  error_message?: string | null;
  review_link: string;
};

// --- conversion helpers ------------------------------------------------------

const STAR_RATING_TO_INT: Record<GbpStarRating, number> = {
  STAR_RATING_UNSPECIFIED: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

/** Convert Google's enum-string rating to a 1-5 integer. Returns 0 for
 *  STAR_RATING_UNSPECIFIED or an unknown value — the caller should skip
 *  the row, since 0 isn't a valid persisted rating. */
export function starRatingToInt(rating: GbpStarRating | undefined): number {
  if (!rating) return 0;
  return STAR_RATING_TO_INT[rating] ?? 0;
}
