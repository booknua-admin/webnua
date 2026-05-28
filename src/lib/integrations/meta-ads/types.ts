// =============================================================================
// Meta Ads — typed slices of the Graph API + row shapes for the four new
// public.* tables. Hand-written until src/lib/types/database.ts is
// regenerated (the migrations land after the last type-gen pass).
//
// SERVER + CLIENT safe — pure types only, no I/O.
// =============================================================================

// --- Meta API slices ---------------------------------------------------------
//
// Each interface is the SUBSET of Meta's response shape Webnua reads.
// Every field is `?` because Meta's API is generous with omissions —
// defensive parsing wins.

export interface MetaAdAccount {
  id?: string;                  // 'act_NNNNNNN'
  account_id?: string;          // bare numeric id
  name?: string;
  currency?: string;            // ISO 4217
  account_status?: number;      // 1=active, 2=disabled, 3=unsettled, 7=pending_risk_review, etc.
  amount_spent?: string;        // string-formatted integer minor units (e.g. "12345" = €123.45)
  balance?: string;             // prepaid funding balance (minor units, string)
  business?: { id?: string; name?: string };
  timezone_name?: string;
  funding_source?: string;
}

export interface MetaAdAccountsResponse {
  data?: MetaAdAccount[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

export interface MetaPage {
  id?: string;
  name?: string;
  /** Page access token — used when creating ads under this Page. Some
   *  endpoints (createCampaign) accept the user access token; others
   *  (lead-form CRUD) require the Page token. */
  access_token?: string;
  tasks?: string[];
}

export interface MetaPagesResponse {
  data?: MetaPage[];
}

export interface MetaCampaignCreateResponse {
  id?: string;
}

export interface MetaAdSetCreateResponse {
  id?: string;
}

export interface MetaCreativeCreateResponse {
  id?: string;
}

export interface MetaAdCreateResponse {
  id?: string;
}

export interface MetaLeadFormCreateResponse {
  id?: string;
}

export interface MetaCampaign {
  id?: string;
  name?: string;
  objective?: string;
  status?: string;                // 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED'
  effective_status?: string;      // includes review states ('IN_PROCESS', 'WITH_ISSUES', etc.)
  daily_budget?: string;          // minor units, string-formatted
  lifetime_budget?: string;
  start_time?: string;            // ISO-8601
  stop_time?: string;
  created_time?: string;
}

export interface MetaInsightsRow {
  date_start?: string;            // 'YYYY-MM-DD'
  date_stop?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;                 // minor-unit string
  actions?: Array<{ action_type?: string; value?: string }>;
  cost_per_action_type?: Array<{ action_type?: string; value?: string }>;
  ctr?: string;
  cpc?: string;
  cpm?: string;
}

export interface MetaInsightsResponse {
  data?: MetaInsightsRow[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

export interface MetaLeadRow {
  id?: string;                    // 'NNNNNNNNNN'
  created_time?: string;          // ISO-8601
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  campaign_id?: string;
  form_id?: string;
  field_data?: Array<{ name?: string; values?: string[] }>;
}

export interface MetaLeadsResponse {
  data?: MetaLeadRow[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

export interface MetaLeadFormField {
  type?: string;                  // 'EMAIL' | 'FULL_NAME' | 'PHONE' | 'CUSTOM' | ...
  key?: string;
  label?: string;
  inputType?: string;
}

export interface MetaError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  fbtrace_id?: string;
}

// --- Row types ---------------------------------------------------------------
//
// Mirror the columns the 4 new migrations (0070–0073) declare. Optional
// fields = nullable column.

export type MetaCampaignDbStatus =
  | 'active'
  | 'paused'
  | 'archived'
  | 'in_review'
  | 'with_issues';

export type MetaCampaignCreatedVia =
  | 'webnua_month_1'
  | 'webnua_ongoing'
  | 'external';

/** Webnua's Business Manager partnership state on a customer asset
 *  (ad account or Page). `'active'` means operators see the customer's
 *  asset natively in their own Ads Manager / Business Manager — no extra
 *  steps. `'failed'` means the share API call did not succeed; the row's
 *  `*_error` column carries the reason and the operator can retry. */
export type MetaPartnerStatus = 'pending' | 'active' | 'failed' | 'revoked';

export type ClientMetaAdAccountRow = {
  id: string;
  client_id: string;
  meta_ad_account_id: string;
  meta_business_id: string | null;
  meta_user_id: string | null;
  ad_account_name: string | null;
  currency: string | null;
  account_status: number | null;
  amount_spent_cents: number | null;
  balance_cents: number | null;
  timezone_name: string | null;
  customer_agreed_at: string | null;
  customer_agreed_by_email: string | null;
  last_synced_at: string | null;
  // Page selected at OAuth time. Required for lead-gen ads (every ad
  // attaches to a Page) and for Page partnership sharing. Nullable for
  // back-compat with pre-0113 rows.
  meta_page_id: string | null;
  meta_page_name: string | null;
  // Operator-selected Meta Pixel id (migration 0116). NULL until the
  // launch wizard's landing-page objective path resolves a pixel.
  meta_pixel_id: string | null;
  // Ad-account partnership state (migration 0113).
  webnua_partner_status: MetaPartnerStatus | null;
  webnua_partner_granted_at: string | null;
  webnua_partner_error: string | null;
  // Page partnership state (independent — can succeed/fail separately).
  webnua_page_partner_status: MetaPartnerStatus | null;
  webnua_page_partner_granted_at: string | null;
  webnua_page_partner_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientMetaAdAccountInsert = Omit<
  ClientMetaAdAccountRow,
  'id' | 'created_at' | 'updated_at'
>;

export type MetaCampaignRow = {
  id: string;
  client_id: string;
  campaign_id: string;
  meta_campaign_id: string;
  meta_ad_set_id: string | null;
  meta_ad_id: string | null;
  meta_creative_id: string | null;
  meta_lead_form_id: string | null;
  campaign_name: string;
  objective: string;
  status: MetaCampaignDbStatus;
  daily_budget_cents: number | null;
  lifetime_budget_cents: number | null;
  start_date: string | null;
  end_date: string | null;
  created_via: MetaCampaignCreatedVia;
  template_slug: string | null;
  last_synced_at: string | null;
  last_insights_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaCampaignInsert = Omit<
  MetaCampaignRow,
  'id' | 'created_at' | 'updated_at'
>;

export type MetaAdsInsightsRow = {
  id: string;
  client_id: string;
  meta_campaign_id: string;
  date_recorded: string;          // 'YYYY-MM-DD'
  impressions: number;
  clicks: number;
  leads: number;
  spend_cents: number;
  cpl_cents: number | null;
  ctr_bps: number | null;
  raw_payload: unknown;
  synced_at: string;
};

export type MetaAdsInsightsInsert = Omit<MetaAdsInsightsRow, 'id' | 'synced_at'>;

export type MetaLeadFormRow = {
  id: string;
  client_id: string;
  meta_form_id: string;
  meta_page_id: string | null;
  form_name: string;
  fields: unknown;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaLeadFormInsert = Omit<
  MetaLeadFormRow,
  'id' | 'created_at' | 'updated_at'
>;

// --- Campaign launch + creative versioning (migration 0115) ------------------
//
// Two tables capture (a) the launch-time snapshot and (b) every creative
// version that ran on a campaign. Both are operator + own-client SELECT,
// service-role write. Powers Session 4's refresh comparison + the
// deferred cross-tenant training pipeline.

/** Closed set of objective flavours the in-app launch wizard supports.
 *  V1.2 lands two; future objectives (traffic / engagement / conversions)
 *  extend this union + the orchestrator's branching, NOT the prompt or
 *  the template catalogue. */
export type CampaignObjective = 'lead_form_meta' | 'lead_form_landing';

export type MetaCampaignLaunchRow = {
  id: string;
  meta_campaign_id: string;
  client_id: string;
  template_slug: string;
  template_variant: string | null;
  campaign_objective: CampaignObjective;
  targeting_geo_center: { lat: number; lng: number } | null;
  targeting_radius_km: number | null;
  targeting_age_min: number;
  targeting_age_max: number;
  targeting_interest_tokens: string[];
  targeting_countries: string[];
  targeting_full_spec: Record<string, unknown>;
  /** Brand row + key clients fields frozen at launch — no PII. */
  brief_snapshot: {
    brand: {
      industry_category: string;
      services: string[];
      top_jobs_to_be_booked: string[];
      voice_formality: number;
      voice_urgency: number;
      voice_technicality: number;
      audience_line: string;
      accent_color: string;
      offer: unknown;
      tagline: string | null;
    } | null;
    client: {
      industry: string;
      service_area: string | null;
      name: string;
    };
  };
  launched_by_user_id: string | null;
  launched_at: string;
  is_first_launch: boolean;
  created_at: string;
};

export type MetaCampaignLaunchInsert = Omit<
  MetaCampaignLaunchRow,
  'id' | 'created_at'
>;

export type MetaAdCreativeRow = {
  id: string;
  meta_campaign_id: string;
  client_id: string;
  started_at: string;
  ended_at: string | null;
  meta_ad_id: string | null;
  /** Session 1.4 matrix testing: the ad set this creative is attached
   *  to. Each ad set carries one copy variant; multiple creatives (one
   *  per image) share the same ad set. Nullable for pre-1.4 rows. */
  meta_ad_set_id: string | null;
  meta_creative_id: string | null;
  meta_image_hash: string | null;
  image_url: string;
  image_width: number | null;
  image_height: number | null;
  headline: string;
  primary_text: string;
  description: string | null;
  cta_type: string;
  /** 0-based copy variant index — the ad-set axis of the M × N matrix. */
  copy_variant_index: number;
  /** 0-based image variant index — the ad axis (within an ad set). */
  image_variant_index: number;
  created_by_user_id: string | null;
  created_at: string;
};

export type MetaAdCreativeInsert = Omit<
  MetaAdCreativeRow,
  'id' | 'created_at'
>;

// --- Status mapping ----------------------------------------------------------

/** Map Meta's effective_status to our local campaign DB status. */
export function mapMetaStatusToLocal(
  effectiveStatus: string | undefined,
): MetaCampaignDbStatus {
  switch (effectiveStatus) {
    case 'ACTIVE':
      return 'active';
    case 'PAUSED':
      return 'paused';
    case 'ARCHIVED':
    case 'DELETED':
      return 'archived';
    case 'IN_PROCESS':
    case 'PENDING_REVIEW':
    case 'PREAPPROVED':
      return 'in_review';
    case 'WITH_ISSUES':
    case 'DISAPPROVED':
    case 'PENDING_BILLING_INFO':
      return 'with_issues';
    default:
      return 'in_review';
  }
}

/** Map Meta's account_status (numeric) to a human label. */
export function describeMetaAccountStatus(status: number | null | undefined): string {
  switch (status) {
    case 1: return 'Active';
    case 2: return 'Disabled';
    case 3: return 'Unsettled';
    case 7: return 'Pending risk review';
    case 8: return 'Pending settlement';
    case 9: return 'In grace period';
    case 100: return 'Pending closure';
    case 101: return 'Closed';
    case 201: return 'Any active';
    case 202: return 'Any closed';
    default: return status == null ? 'Unknown' : `Status ${status}`;
  }
}
