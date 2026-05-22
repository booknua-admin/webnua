// =============================================================================
// Stripe billing — job type constants.
//
// Kept in a tiny standalone module so the webhook route can enqueue a job by
// its type WITHOUT importing job-handlers.ts (which would pull the email-send
// graph and run registerJobHandler in the webhook process). job-handlers.ts
// and the job-executor import this same constant.
// =============================================================================

/** Enqueued by the Stripe webhook on invoice.payment_failed. The handler
 *  emails the operator(s) that a client's payment failed. */
export const STRIPE_PAYMENT_FAILED_JOB = 'stripe_payment_failed_notify';

/** Payload shape for STRIPE_PAYMENT_FAILED_JOB. */
export type StripePaymentFailedPayload = {
  clientId: string;
  invoiceId?: string | null;
};
