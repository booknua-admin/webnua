// =============================================================================
// Stripe billing — access-control helpers.
//
// Phase 7 Stripe billing session. Two questions the rest of the app asks about
// a client's billing posture, answered from client_stripe_customers (kept
// current by the Stripe webhook handler):
//
//   • isClientBillingActive  — is this client paying (or in the past_due grace
//     window)? True for 'active' and 'past_due'.
//   • shouldGateClientAccess — should this client's access be suspended? True
//     for 'cancelled', and for 'past_due' once the 7-day grace window since
//     the first failed payment has elapsed.
//
// A client with NO client_stripe_customers row (billing was never set up) is
// neither active nor gated — "billing not set up" is not a cancellation, and
// gating it would lock out every client until billing is rolled out. The
// access-control layer that consumes shouldGateClientAccess() does not exist
// yet; these helpers are the contract it will build against.
//
// SERVER-ONLY.
// =============================================================================

import { getStripeCustomerByClientId } from './customers';

/** The past_due grace window — access is not gated until a failed payment has
 *  been outstanding this long. */
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** True when the client has a live subscription (active, or past_due inside
 *  the grace window). */
export async function isClientBillingActive(clientId: string): Promise<boolean> {
  const row = await getStripeCustomerByClientId(clientId);
  if (!row) return false;
  return row.status === 'active' || row.status === 'past_due';
}

/** True when the client's access should be suspended — the subscription is
 *  cancelled, or it has been past_due longer than the 7-day grace window. */
export async function shouldGateClientAccess(clientId: string): Promise<boolean> {
  const row = await getStripeCustomerByClientId(clientId);
  if (!row) return false;
  if (row.status === 'cancelled') return true;
  if (row.status === 'past_due') {
    // No first-failure timestamp yet — still inside the grace window.
    if (!row.past_due_since) return false;
    return Date.now() - Date.parse(row.past_due_since) > GRACE_PERIOD_MS;
  }
  return false;
}
