// =============================================================================
// Job-handler manifest — side-effect imports that populate the job registry.
//
// The /api/internal/job-executor route imports this module so that every
// integration's job handlers are registered (via registerJobHandler) in the
// executor process's module graph before it dispatches a job.
//
// Each future integration session adds ONE side-effect import here, e.g.:
//
//   import '@/lib/integrations/twilio/job-handlers';
//   import '@/lib/integrations/stripe/job-handlers';
//   import '@/lib/integrations/resend/job-handlers';
//
// Each of those modules calls registerJobHandler(...) at module scope.
//
// Phase 7 Session 2 (per-tenant OAuth foundation) registers the first handler
// — token_refresh_check, the daily long-lived-token refresh sweep.
//
// Phase 7 Stripe billing adds stripe_payment_failed_notify — the operator
// payment-failure email.
// =============================================================================

import '@/lib/integrations/_shared/job-handlers';
import '@/lib/integrations/stripe/job-handlers';

export {};
