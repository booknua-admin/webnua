// =============================================================================
// Job-handler manifest — side-effect imports that populate the job registry.
//
// The /api/internal/job-executor route imports this module so that every
// integration's job handlers are registered (via registerJobHandler) in the
// executor process's module graph before it dispatches a job.
//
// Phase 7 Session 1 builds the jobs spine only — there are NO concrete job
// handlers yet. Each future integration session adds ONE side-effect import
// here, e.g.:
//
//   import '@/lib/integrations/twilio/job-handlers';
//   import '@/lib/integrations/stripe/job-handlers';
//   import '@/lib/integrations/resend/job-handlers';
//
// Each of those modules calls registerJobHandler(...) at module scope.
// =============================================================================

export {};
