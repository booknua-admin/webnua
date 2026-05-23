// =============================================================================
// Typed, boot-validated environment module — SERVER-ONLY.
//
// Phase 7 Session 1. The single source of truth for environment variables.
// New server code should read `env.X` here instead of `process.env.X` directly:
// the value is zod-validated, typed, and a missing *required* key fails loud at
// boot (see src/instrumentation.ts) rather than as an undefined deep in a
// handler. Existing direct `process.env` accesses were intentionally NOT
// refactored this session — this just establishes the pattern.
//
// Validation is LAZY (a Proxy that parses on first property access), not at
// module load. Reason: Next imports route modules during `next build` for
// metadata collection; eager top-level validation would fail a build on a
// machine without env. Boot validation is forced explicitly by
// instrumentation.ts's register() hook, which runs once at server start.
//
// `zod` is the one dependency this session adds. It is a utility-tier schema
// validator, not a stack expansion — the stack (Next / React / Tailwind /
// shadcn / Supabase / TanStack Query) is unchanged.
//
// SERVER-ONLY: this module reads server secrets. It must never be imported by
// client code. NEXT_PUBLIC_* values are inlined by Next and available
// everywhere; everything else is `undefined` in the browser.
// =============================================================================

import { z } from 'zod';

// --- helpers -----------------------------------------------------------------

// An optional string env var. A present-but-empty value (`KEY=` in a .env file
// surfaces as '') is coerced to `undefined` so it reads as "not set" rather
// than failing a min-length check.
const optionalStr = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().min(1).optional(),
);

// A required string — a missing or empty value is a validation failure.
const requiredStr = z.string().trim().min(1);

// An optional string with a fallback default when unset/empty.
const withDefault = (fallback: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined),
    z.string().default(fallback),
  );

// --- schema ------------------------------------------------------------------
// Schema slots are defined for every Phase 7 provider even though only some
// env vars are populated today (Supabase / Anthropic / Vercel). The unpopulated
// integration keys are `.optional()` — a feature degrades gracefully when its
// key is unset; it does not block boot.

const envSchema = z.object({
  // --- Supabase: required to boot --------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: requiredStr,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredStr,
  // Service role bypasses RLS — required for any server-side data path, but
  // optional here so a client-only build/boot does not hard-fail.
  SUPABASE_SERVICE_ROLE_KEY: optionalStr,

  // --- AI generation ---------------------------------------------------------
  ANTHROPIC_API_KEY: optionalStr,

  // --- public-site routing + self-addressing --------------------------------
  APP_HOST: optionalStr,
  PUBLIC_SITE_DOMAIN: optionalStr,
  // Absolute origin of the Webnua app, used to self-POST the job executor.
  // Falls back to VERCEL_URL then APP_HOST — see getAppBaseUrl().
  APP_BASE_URL: optionalStr,

  // --- internal job executor -------------------------------------------------
  // Shared secret guarding /api/internal/job-executor. The pg_cron poller
  // holds the same value in private.integration_runtime_config (Postgres
  // cannot read these env vars). Both sides must match.
  INTERNAL_JOB_SECRET: optionalStr,

  // --- Vercel: custom-domain provisioning -----------------------------------
  VERCEL_TOKEN: optionalStr,
  VERCEL_PROJECT_ID: optionalStr,
  VERCEL_TEAM_ID: optionalStr,

  // --- platform integrations (Webnua owns the account) ----------------------
  // Stripe: standard scope, no Connect (operator decision).
  STRIPE_SECRET_KEY: optionalStr,
  STRIPE_WEBHOOK_SECRET: optionalStr,
  STRIPE_PUBLISHABLE_KEY: optionalStr,
  // The Stripe Price id for the standard plan (€299/month recurring), created
  // once in the Stripe dashboard. Optional like the other integration keys —
  // "Set up billing" returns a not-configured error when it (or
  // STRIPE_SECRET_KEY) is unset, rather than blocking boot.
  STRIPE_PRICE_ID_STANDARD: optionalStr,
  // Twilio: one-way alphanumeric senders, no per-customer numbers in V1.
  TWILIO_ACCOUNT_SID: optionalStr,
  TWILIO_AUTH_TOKEN: optionalStr,
  TWILIO_MESSAGING_SERVICE_SID: optionalStr,
  // ISO-3166 alpha-2 country used to expand national-form phone numbers to
  // E.164 before sending (src/lib/sms/phone.ts). Defaults to Ireland.
  TWILIO_DEFAULT_COUNTRY: withDefault('IE'),
  // Resend: transactional email. Customer slug sub-addresses are composed
  // against EMAIL_SENDING_DOMAIN (locked: mail.webnua.com).
  RESEND_API_KEY: optionalStr,
  RESEND_WEBHOOK_SECRET: optionalStr,
  // Inbound (email.received) webhooks have their own signing secret in the
  // Resend dashboard when configured as a separate endpoint from the
  // delivery-status webhook. Optional — falls back to RESEND_WEBHOOK_SECRET
  // when a single Resend webhook covers both URLs (rare, since one Resend
  // webhook points at one URL).
  RESEND_INBOUND_WEBHOOK_SECRET: optionalStr,
  EMAIL_SENDING_DOMAIN: withDefault('mail.webnua.com'),

  // --- per-tenant OAuth integrations (customer owns the account) ------------
  // Phase 7 Session 2. The customer grants OAuth access to their own account;
  // Webnua stores per-tenant tokens (encrypted in Vault). Google Ads is NOT
  // here — operator decision: not building it.
  //
  // Google (Business Profile). One Google Cloud OAuth 2.0 client. The
  // redirect-URI base is optional — it falls back to {app origin}/api/
  // integrations; set it to pin the exact URI registered with Google.
  GOOGLE_OAUTH_CLIENT_ID: optionalStr,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalStr,
  GOOGLE_OAUTH_REDIRECT_URI_BASE: optionalStr,
  // Meta (Ads). Placeholders until the Meta app exists — the OAuth flow is
  // scaffolded but Meta connect is deferred to the Meta business session.
  META_APP_ID: optionalStr,
  META_APP_SECRET: optionalStr,
  META_OAUTH_REDIRECT_URI_BASE: optionalStr,
  // HMAC key for signing the OAuth `state` token. Optional — falls back to
  // SUPABASE_SERVICE_ROLE_KEY (always present server-side, high entropy).
  OAUTH_STATE_SECRET: optionalStr,
});

/** The validated, typed environment. Optional keys are `string | undefined`. */
export type Env = z.infer<typeof envSchema>;

// --- lazy validated singleton ------------------------------------------------

let cached: Env | null = null;

function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(
      'Invalid environment configuration — the app cannot start.\n' +
        lines.join('\n') +
        '\n\nSet the missing values in .env.local (local dev) or the deployment ' +
        'environment (Vercel project settings). See .env.example for the full list.',
    );
  }
  cached = parsed.data;
  return cached;
}

/**
 * The typed environment object. Reading any property triggers lazy validation
 * on first access; a missing *required* key throws with a clear message naming
 * exactly what is missing.
 *
 * Prefer this over `process.env.*` in new server code.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return loadEnv()[prop as keyof Env];
  },
  has(_target, prop) {
    return prop in loadEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(loadEnv());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(loadEnv(), prop);
  },
});

/**
 * Force environment validation now. Called by instrumentation.ts's register()
 * hook so a misconfigured deployment fails at boot, not on the first request.
 * Throws the same actionable error `env` would on first access.
 */
export function validateEnv(): void {
  loadEnv();
}

/**
 * The absolute origin of the Webnua app — used to self-POST the internal job
 * executor. Resolves APP_BASE_URL, then Vercel's runtime VERCEL_URL, then
 * https://{APP_HOST}. Returns null when none can be determined (the pg_cron
 * poller then remains the only dispatch path).
 */
export function getAppBaseUrl(): string | null {
  const stripSlash = (s: string) => s.replace(/\/+$/, '');
  if (env.APP_BASE_URL) return stripSlash(env.APP_BASE_URL);
  // VERCEL_URL is a Vercel-injected runtime var (host only, no scheme); it is
  // not part of the validated schema because it only exists on Vercel.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (env.APP_HOST) return `https://${env.APP_HOST}`;
  return null;
}
