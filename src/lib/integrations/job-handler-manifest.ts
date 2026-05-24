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
//
// Phase 7 Twilio SMS adds send_sms — the outbound transactional SMS handler.
//
// Phase 7 Resend adds:
//   • send_email                — the workhorse template-rendered email send.
//   • send_lead_notification    — fan out a new-lead notification to operators
//                                  configured on notification_preferences, with
//                                  throttling against the digest worker.
//   • batch_notification_digest — hourly digest of throttled notifications.
//   • send_test_notification    — operator test-send from the settings UI.
//
// Phase 7 Google Business Profile adds:
//   • gbp_sync_reviews          — daily review-pull from Google + upsert into
//                                  gbp_reviews (also called on demand).
//   • gbp_send_review_request   — picks an SMS or email channel and enqueues
//                                  the underlying send job, with a row on
//                                  gbp_review_requests for the audit log.
//
// Phase 7 Meta Ads adds:
//   • meta_sync_insights        — daily insights-pull from Meta + upsert
//                                  into meta_ads_insights (cron 04:00 UTC).
//   • meta_sync_leads           — every-15-min lead-pull from Meta lead
//                                  forms; new leads land in public.leads
//                                  with source_kind='meta'.
// =============================================================================

import '@/lib/integrations/_shared/job-handlers';
import '@/lib/integrations/gbp/job-handlers';
import '@/lib/integrations/meta-ads/job-handlers';
import '@/lib/integrations/resend/job-handlers';
import '@/lib/integrations/stripe/job-handlers';
import '@/lib/integrations/twilio/job-handlers';

// Phase 8 Session 1 — automation engine. Registers automation_trigger,
// automation_action, and cold_lead_scan handlers so the integration_jobs
// executor can dispatch the engine.
import '@/lib/automations/job-handlers';

export {};
