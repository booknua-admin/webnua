// =============================================================================
// onboarding/types — the wizard state shape, persisted to clients.wizard_state.
//
// One source of truth for what every step reads + writes. Stored as JSON
// (jsonb column, migration 0091), keyed by `current_step` so a customer can
// close the browser mid-flow and resume exactly where they left off.
//
// Optionality discipline: every step except step 1 is skippable. A skipped
// step's slot in `step_data` is `null` (rather than absent) so the wizard
// can distinguish "not visited" from "visited and skipped" — the dashboard
// gate reads `wizard_completed_at` (not step counts) so the wizard is "done"
// the moment the customer hits step 7, regardless of how many steps they
// skipped along the way.
//
// Shape evolution: adding a new step or a new field means amending this
// type AND providing a sensible default in the wizard state. The JSON
// column tolerates extra keys, so a re-deploy with new fields doesn't
// invalidate in-progress wizards — readers default-coalesce on absence.
// =============================================================================

import type { IndustryKey } from '@/lib/website/industry-templates';

/** The wizard's seven steps. Step 1 is required; 2–7 are skippable. */
export type WizardStepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// --- per-step shapes --------------------------------------------------------

export type Step1Data = {
  /** Canonical industry key. Resolved from a dropdown pick (one of the 11
   *  templates) OR from free text via `mapIndustry()` for the "Other" path.
   *  NEVER NULL once step 1 is committed — step 1 is the only required step. */
  industryKey: IndustryKey;
  /** The raw text the customer entered if they picked "Other". NULL when
   *  they picked a known industry from the dropdown. Preserved so the
   *  industry block on the prompt can carry the customer's own phrasing. */
  industryFreeText: string | null;
  /** Services the customer kept (with the industry default as the seed +
   *  any custom additions). Order is preserved — the generator reads
   *  services[0] as the funnel's primary service. */
  services: string[];
  /** Trust signals the customer kept (industry default minus any toggled
   *  off + any custom additions). Order preserved. */
  trustSignals: string[];
};

export type Step2Data = {
  /** Business name. Defaults from signup; the customer can refine it. */
  businessName: string;
  /** Service area — city / region / postcodes the business covers. Free
   *  text; the generator weaves it into hero + contact copy. */
  serviceArea: string;
  /** Primary contact phone. Stored on clients.primary_contact_phone. */
  phone: string;
  /** Business hours line ("Mon–Fri 9–5"). Free text. */
  hours: string;
  /** Optional address (single-line). Most trades don't have a public
   *  storefront, so this stays optional. */
  address: string;
};

export type Step3Data = {
  /** Who the business serves — "Homeowners", "Property managers",
   *  "Small businesses", or anything the customer types. The funnel
   *  generator uses this as the audience cue. */
  targetCustomer: string;
  /** Average job value (free text — operators give us "$200–$600" or
   *  "from €99" or "varies"). Stored verbatim; the generator picks
   *  sensible price-framing copy. */
  averageJobValue: string;
  /** Optional starting price ("from €X"). When present, surfaces in the
   *  offer headline. */
  startingPriceFraming: string;
  /** Optional USP — what makes them different from the next tradie. Free
   *  text. The funnel uses this as the guarantee anchor. */
  usp: string;
};

export type Step4Data = {
  /** Public URL the brand logo lives at (Supabase Storage). NULL when the
   *  customer skipped the upload. */
  logoUrl: string | null;
  /** Primary brand colour as a hex string (always `#rrggbb`, lowercased).
   *  Defaults from `INDUSTRY_PRIMARY_COLORS` for the chosen industry. */
  primaryColor: string;
  /** Secondary brand colour. Auto-derived from primary by the wizard
   *  unless the customer overrides it. */
  secondaryColor: string;
  /** Optional tagline. Generator uses it in the hero sub. */
  tagline: string;
  /** Voice tone preset. Drives the brand row's voice axes (3-tuple). */
  tone: 'friendly' | 'professional' | 'casual';
};

export type Step5Testimonial = {
  /** The customer's quote — the spine of the social-proof section. */
  quote: string;
  /** Who said it (first name + last initial works). */
  author: string;
  /** Optional context — "Bondi, regular customer", "Boiler install Jan
   *  2025". Renders as the author's meta line. */
  context: string;
};

export type Step5Data = {
  /** 0–3 testimonials. Empty array = the funnel renders placeholder
   *  social-proof copy (we never invent quotes — see CLAUDE.md "Open
   *  decisions / parked"). */
  testimonials: Step5Testimonial[];
};

export type Step6IntegrationStatus = 'pending' | 'connected' | 'skipped';

export type Step6Data = {
  /** Status of the Meta Ads connect attempt. Updated reactively by the
   *  same `IntegrationConnectionsSection` used everywhere else. */
  metaAds: Step6IntegrationStatus;
  /** Status of the Google Business Profile connect attempt. */
  gbp: Step6IntegrationStatus;
  /** The customer chose to set up a custom domain (vs the default
   *  {slug}.webnua.dev). Defers to /settings/domains post-publish. */
  customDomainPlanned: boolean;
};

/** No Step7Data — step 7 is the "done" surface; nothing to capture. The
 *  wizard marks completion by stamping clients.wizard_completed_at. */

// --- top-level wizard state -------------------------------------------------

export type WizardStateData = {
  step1: Step1Data | null;
  step2: Step2Data | null;
  step3: Step3Data | null;
  step4: Step4Data | null;
  step5: Step5Data | null;
  step6: Step6Data | null;
};

export type WizardState = {
  /** The step the customer is currently looking at (1–7). When they resume
   *  via /onboarding, this is where they land. */
  current_step: WizardStepId;
  /** Steps the customer has already committed (either by entering data +
   *  Continue, or by skipping). Ordered. Step 7 lands here too on
   *  completion. */
  completed_steps: WizardStepId[];
  /** Per-step data slots. `null` = visited-and-skipped or not-yet-visited
   *  (distinguished by membership in `completed_steps`). */
  step_data: WizardStateData;
};

/** Initial state for a freshly-started wizard. */
export const INITIAL_WIZARD_STATE: WizardState = {
  current_step: 1,
  completed_steps: [],
  step_data: {
    step1: null,
    step2: null,
    step3: null,
    step4: null,
    step5: null,
    step6: null,
  },
};

/** True when the step's slot has data committed (not skipped). */
export function isStepFilled<K extends keyof WizardStateData>(
  state: WizardState,
  step: K,
): state is WizardState & { step_data: { [P in K]: NonNullable<WizardStateData[P]> } } {
  return state.step_data[step] !== null;
}

/** Has the customer reached step 4 + committed data there? Used to gate
 *  background site generation: generation fires the moment step 4 is
 *  committed so the result is ready by step 7. */
export function isReadyForGeneration(state: WizardState): boolean {
  return isStepFilled(state, 'step1') && isStepFilled(state, 'step4');
}
