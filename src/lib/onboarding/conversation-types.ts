// =============================================================================
// onboarding/conversation-types — typed view of clients.conversation_state.
//
// The DB column is jsonb (migration 0095). Both writers go through this
// module so the shape stays consistent. The /api/clients/[id]/conversation-
// state route validates the loose Body shape AT THE BOUNDARY and stores
// whatever passed — readers use these types to deserialise.
//
// Adding a captured-fact key: amend `ConversationCapturedFacts` here AND
// confirm the route's validator still accepts the body (it validates the
// envelope, not the per-field shape, so additive keys are safe).
// =============================================================================

import type { IndustryKey } from '@/lib/website/industry-templates';

/** A single chat message in the persisted thread. Append-only; the shell
 *  rebuilds the rendered conversation by reading messages in order. UI-only
 *  state (which bubble has a picker mounted, which is "thinking") is derived
 *  from the current turn + capturedFacts, NOT stored here — that keeps
 *  messages cheap to write and replay. */
export type ConversationMessage = {
  /** Stable id; the route uses the tail message id for the optimistic-
   *  concurrency check on POST. Generated client-side at append time. */
  id: string;
  role: 'bot' | 'user' | 'system';
  content: string;
  /** ISO-8601 wall-clock string. */
  timestamp: string;
};

/** The four-field offer as it lands in brands.offer (snake_case to match
 *  the DB). Mirrors the shape in `lib/website/offer-generate.ts`
 *  `FunnelOfferRow` — re-declared here so this module is self-contained
 *  for the conversation shell + the route validator. */
export type ConversationOfferRow = {
  headline: string;
  promise: string;
  risk_reversal: string;
  cta_text: string;
};

/** Brand inputs captured in turn 3. Optional shape — every field is
 *  optional because the customer can skip the entire turn. */
export type ConversationBrandFacts = {
  /** Hex `#rrggbb`. */
  primaryColor: string;
  /** Hex `#rrggbb`, auto-derived when blank. */
  secondaryColor?: string;
  /** Public URL of the uploaded logo, or null when skipped. */
  logoUrl?: string | null;
};

/** AI extraction output. The /api/onboarding/extract-business route writes
 *  this onto capturedFacts.extraction as soon as turn 1 + verification
 *  complete and we can call Sonnet with the first message. */
export type ConversationExtraction = {
  /** The business name the customer mentioned OR a sensibly-derived one
   *  ("painter in Cork" → "Cork Painters"). Empty string when the message
   *  carries no name signal AND deriving one would be too speculative
   *  (rare — most messages support a derivation). When non-empty AND
   *  confidence ≥ EXTRACTION_CONFIDENCE_THRESHOLD, the shell POSTs the
   *  business-identity route which overwrites the email-derived
   *  placeholder on clients.name AND re-slugifies the workspace URL. */
  businessName: string;
  /** Normalised industry key (one of the 11 templates). */
  industry: IndustryKey;
  /** The free-text industry phrase the customer used (e.g. "sparkie"),
   *  preserved so prompts can carry their phrasing. NULL when the model
   *  resolved a known industry without ambiguity. */
  industryFreeText: string | null;
  /** Location / service area string the customer mentioned. Empty when
   *  not present in the first message. */
  location: string;
  /** Specialty / sub-niche the customer mentioned (e.g. "residential
   *  rewires", "commercial fit-outs"). Empty when not present. */
  specialty: string;
  /** Team size hint when mentioned ("solo", "small team", "10+ crew"),
   *  else empty. */
  teamSize: string;
  /** Years-in-business hint when mentioned, else empty. */
  yearsInBusiness: string;
  /** Services the model identified in the first message, matched against
   *  the industry's defaultServices list. Used to pre-tick turn 2's
   *  picker. May be empty when the customer's first message was thin. */
  mentionedServices: string[];
  /** 0.0–1.0 confidence the model has in its read of the message. The
   *  shell uses < 0.6 as the threshold to ask a clarifying question
   *  before proceeding to turn 2. */
  confidence: number;
  /** When confidence is low, the model lists what it couldn't resolve
   *  (e.g. "industry — could be plumbing OR HVAC; mentioned 'heating'
   *  but not which side"). Empty array when confidence is high. */
  ambiguities: string[];
};

/** Strongly-typed view of clients.conversation_state.capturedFacts.
 *  Every field is optional — captured progressively across turns. The
 *  /api/clients/[id]/conversation-state route accepts any object on jsonb
 *  write; this type is the canonical shape readers can rely on. */
export type ConversationCapturedFacts = {
  /** Verbatim turn-1 user message. Mirrors the seed verify-code writes;
   *  may be re-read for the extraction call OR a clarifying-question
   *  re-extract that concatenates messages. */
  firstMessage?: string;
  /** Email the customer verified. */
  email?: string;
  /** Business name as extracted/derived by the AI in turn 1 OR as edited
   *  by a later flow. The shell POSTs the business-identity route which
   *  writes this onto `clients.name` AND re-slugifies the workspace URL
   *  when the extraction surfaces a name with sufficient confidence. */
  businessName?: string;
  /** ISO timestamp set the moment turn-5 generation FIRST kicks off. Used
   *  by the resume logic: a refresh that finds current_turn=5 + this set +
   *  no live website+funnel re-enters the blueprint screen (the generation
   *  routes are idempotent via wizard-assets' probe, so re-firing is safe;
   *  this flag is just the UI's "we're already building" memory). Cleared
   *  on turn-5 success (since current_turn advances to 6 by then anyway). */
  buildingStartedAt?: string;
  /** The client's slug — written by the shell on first persist after
   *  verification. Persisted into capturedFacts (rather than a top-level
   *  state column) because the route's `conversation_state` shape is
   *  closed; capturedFacts is the extensible bag. Used to resume the
   *  flow after refresh (the shell needs both clientId — from
   *  user_metadata.client_id — and slug for the generation handoff). */
  clientSlug?: string;
  /** AI extraction result, or null when low-confidence path is still
   *  resolving (set after the clarifying question completes). */
  extraction?: ConversationExtraction;
  /** Services the customer kept in turn 2 (intersection of the
   *  industry's defaultServices + any custom typed-in additions; AI
   *  pre-tick + customer edit). Empty when turn 2 was skipped. */
  services?: string[];
  /** Brand inputs from turn 3, or null when skipped. */
  brand?: ConversationBrandFacts;
  /** The accepted offer from turn 4. Snake-case to match brands.offer
   *  storage. null when the customer chose Skip. */
  offer?: ConversationOfferRow | null;
  /** Number of times the customer hit "Refine" on turn 4. Capped at 2
   *  per the locked decision; after that the Refine button disappears
   *  and only Accept / Use my own / Skip remain. */
  offerRefinementsUsed?: number;
  /** A clarifying question the bot asked after a low-confidence
   *  extraction. Persisted so a refresh re-mounts the same question. */
  clarifyingQuestion?: string;
};

/** The full persisted state. Mirrors the inline type in the conversation-
 *  state route — kept in lockstep with that route's `ConversationState`. */
export type ConversationState = {
  messages: ConversationMessage[];
  capturedFacts: ConversationCapturedFacts;
  /** Turn ids match the shell's phase ordering:
   *    1 — turn-1-input + verification (verify-code seeds 2 when done)
   *    2 — services picker
   *    3 — brand picker
   *    4 — offer iteration
   *    5 — generation handoff
   *    6 — done (shell routes to /dashboard) */
  current_turn: number;
  verified: boolean;
};

/** Confidence threshold for the extraction's clarifying-question path. The
 *  prompt locks this at 0.6 — below that, the shell asks a follow-up
 *  question; at-or-above, it proceeds directly to turn 2. Centralised here
 *  so the shell + the route can both reference one constant. */
export const EXTRACTION_CONFIDENCE_THRESHOLD = 0.6;

/** Cap on offer-refinement iterations per locked decision. After two
 *  refinements the Refine action disappears. */
export const OFFER_REFINEMENT_LIMIT = 2;

/** Service-picker breakpoint: ≤ this many services renders inline as
 *  checkboxes; more than this opens a Dialog on mobile. */
export const SERVICE_PICKER_INLINE_LIMIT = 5;

/** Generate a stable client-side id for a new chat message. */
export function newMessageId(role: ConversationMessage['role']): string {
  return `msg_${Date.now()}_${role}_${Math.random().toString(36).slice(2, 7)}`;
}
