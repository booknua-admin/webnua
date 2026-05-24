// =============================================================================
// Client lifecycle — central constants + state-machine helpers (Pattern B).
//
// The `client_lifecycle` Postgres enum (migrations 0001 + 0084) carries seven
// values; this module is the SINGLE source of truth for how the app interprets
// each state. Every dispatcher (dashboard, sidebar, public-site renderer,
// operator admin) reads through these helpers — never via raw string compares
// — so a new state lands in ONE place.
//
//   pending_verification — Pattern B entry. Self-serve signup created the
//                          clients row + auth user; user has not yet clicked
//                          the email-verification magic link. Treated as
//                          "no public site" + "not eligible for dashboard"
//                          until verified. Swept after 7 days by cron 0086.
//
//   preview              — Email verified, wizard runs, site/funnel built.
//                          Public site at {slug}.webnua.dev renders with the
//                          preview watermark + noindex + DISABLED forms. The
//                          dashboard mounts the wizard + the "publish to go
//                          live" CTA.
//
//   active               — Pattern B's published-and-paying state. The
//                          subscription is live; public site is fully public.
//
//   live                 — Session 1's synonym of 'active'. Kept valid so
//                          Session 1's production clients are not invalidated
//                          (they keep working). Treated as 'active' wherever
//                          it matters; new code emits 'active'.
//
//   onboarding           — Session 1's signup state (default before 0085).
//                          Treated as 'preview' for dashboard dispatch (the
//                          IntegrationOnboarding screen). New code never
//                          emits this; existing rows stay valid.
//
//   paused               — Subscription paused (operator action or Stripe
//                          dunning timeout). Public site continues to render
//                          (the data is theirs); dashboard reads as paused.
//
//   churned              — Old subscription, no longer paying. Public site
//                          stops rendering. Kept for historical reporting.
//
//   banned               — Operator-imposed terminal state for abuse. Public
//                          site stops rendering, dashboard locked out.
//
//   cancelled            — Stage 1 of Pattern B's two-stage cancellation.
//                          Set by the Stripe webhook on subscription.deleted.
//                          Customer can still log in; sees a read-only banner
//                          with a "Reactivate" CTA. After 30 days the daily
//                          cron (migration 0091) promotes to 'deleted'.
//                          Public site stops rendering immediately.
//
//   deleted              — Stage 2 (soft-deleted). Customer locked out;
//                          operator-only recovery for an additional 60 days.
//                          The cron sends a 7-day-warning email on day 83
//                          and HARD-deletes the row on day 90 (the only
//                          irreversible step).
// =============================================================================

export const CLIENT_LIFECYCLE_VALUES = [
  'pending_verification',
  'preview',
  'active',
  'live',
  'onboarding',
  'paused',
  'churned',
  'banned',
  'cancelled',
  'deleted',
] as const;

export type ClientLifecycle = (typeof CLIENT_LIFECYCLE_VALUES)[number];

/** Type guard — narrows a freeform string read from Supabase to the union. */
export function isClientLifecycle(value: unknown): value is ClientLifecycle {
  return typeof value === 'string' && (CLIENT_LIFECYCLE_VALUES as readonly string[]).includes(value);
}

// --- presentation -----------------------------------------------------------

/** Operator-facing short label for the lifecycle state. Used by the admin
 *  /signups roster, the client roster, and the AdminClientPicker meta. */
export const LIFECYCLE_LABEL: Record<ClientLifecycle, string> = {
  pending_verification: 'Pending verification',
  preview: 'Preview',
  active: 'Active',
  live: 'Active', // legacy synonym
  onboarding: 'In setup', // legacy synonym for preview/onboarding
  paused: 'Paused',
  churned: 'Churned',
  banned: 'Banned',
  cancelled: 'Cancelled',
  deleted: 'Deleted (soft)',
};

/** A short verb-phrase suitable for the AdminClient meta line, e.g.
 *  "Electrical · in setup". Sentence-case, no period. */
export function lifecyclePhrase(value: string): string {
  if (!isClientLifecycle(value)) return value;
  switch (value) {
    case 'pending_verification': return 'pending verification';
    case 'preview': return 'in preview';
    case 'active': return 'active';
    case 'live': return 'active'; // legacy synonym
    case 'onboarding': return 'in setup';
    case 'paused': return 'paused';
    case 'churned': return 'churned';
    case 'banned': return 'banned';
    case 'cancelled': return 'cancelled';
    case 'deleted': return 'deleted';
  }
}

// --- behavioural buckets ----------------------------------------------------

/** A client whose dashboard should render the wizard / publish CTA (NOT the
 *  live workspace hub). True for the pre-published states. The dashboard
 *  uses this to dispatch to `<IntegrationOnboarding>` vs the hub/dashboard. */
export function dashboardIsInPreOnboarding(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  return value === 'pending_verification' || value === 'preview' || value === 'onboarding';
}

/** A client whose public site at {slug}.webnua.dev should render with the
 *  preview watermark + noindex + disabled forms. True for 'preview' (and
 *  legacy 'onboarding' — Session 1's clients sit there until they upgrade). */
export function publicSiteIsPreview(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  return value === 'preview' || value === 'onboarding';
}

/** A client whose public site should render at ALL. False for the pre-verify
 *  state (nothing to show), the terminal states (banned/churned/cancelled/
 *  deleted), and for values we don't recognise. True for 'preview' (with
 *  watermark) and the published states ('active'/'live'/'paused'). */
export function publicSiteIsServable(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  switch (value) {
    case 'pending_verification':
    case 'banned':
    case 'churned':
    case 'cancelled':
    case 'deleted':
      return false;
    case 'preview':
    case 'onboarding':
    case 'active':
    case 'live':
    case 'paused':
      return true;
  }
}

/** A client who can sign into the dashboard. False for the locked-out
 *  terminal states (banned / deleted) and unrecognised; cancelled clients
 *  CAN sign in (the grace period is the entire point — they need access to
 *  reactivate via Stripe). */
export function dashboardIsAccessible(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  return value !== 'banned' && value !== 'deleted';
}

/** A client that the publish-to-go-live CTA should fire for. The CTA mounts
 *  on the dashboard when this is true AND the wizard has produced a site. */
export function isEligibleForPublish(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  return value === 'preview' || value === 'pending_verification' || value === 'onboarding';
}

/** True when the lifecycle reflects an active paid subscription. */
export function isActivelyPaying(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  return value === 'active' || value === 'live';
}

/** True when the client is in the two-stage cancellation lifecycle and the
 *  dashboard should mount the read-only cancellation banner + reactivate
 *  CTA. False for 'deleted' — that state locks the dashboard out entirely
 *  (`dashboardIsAccessible` returns false), so there is no UI to mount the
 *  banner on. */
export function isCancelled(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  return value === 'cancelled';
}

/** True when the client is soft-deleted (post grace, pre hard delete).
 *  Recoverable only via operator out-of-band action. */
export function isSoftDeleted(value: string): boolean {
  if (!isClientLifecycle(value)) return false;
  return value === 'deleted';
}
