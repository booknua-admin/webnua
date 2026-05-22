# Integration foundation — audit & build status

> Phase 7 of the Webnua build (see CLAUDE.md "Remaining build phases"). This
> document is the running status of the integration foundation: the shared
> spine every Phase 7 integration is built on. Updated per session.

---

## The two integration architectures

"Integrations" in Webnua covers two structurally different things. Conflating
them is the failure mode this foundation guards against.

### 1. Platform-level integrations — Webnua owns the account

**Stripe, Twilio, Resend, Vercel.** Webnua owns the third-party account. There
is a single API key in env vars. Per-customer state is "which sub-identity is
assigned to this client":

- **Twilio** — each client is assigned one alphanumeric, one-way SMS sender id
  (`client_sms_senders`). No per-customer phone numbers in V1.
- **Resend** — each client is assigned one email sub-address slug
  (`client_email_senders`); the sending address is `[slug]@mail.webnua.com`.
- **Stripe** — each client maps to one Stripe Customer record inside Webnua's
  account (`client_stripe_customers`). Standard scope, no Connect.
- **Vercel** — custom-domain provisioning; no per-customer identity.

### 2. Per-tenant OAuth integrations — the customer owns the account

**Google Ads, Google Business Profile, eventually Meta.** The customer owns
the third-party account; Webnua OAuths in and stores per-tenant tokens. This
is a **separate concern** — Session 2, not built here.

---

## Operator-locked decisions

These were decided by the operator and are not open for re-litigation in
implementation:

| Decision | Value |
|---|---|
| Email sending domain | `mail.webnua.com` (subdomain of the primary) |
| Secret encryption | Supabase Vault — **deferred to the OAuth session**, not used in Session 1 |
| Async jobs | A `integration_jobs` table polled by `pg_cron` — NOT Edge Functions, NOT Vercel Cron, NOT an external queue |
| Call log | A separate `integration_call_log` table — NOT reusing `generation_log` |
| Env validation | `zod` (utility tier — not a stack expansion) |
| Stripe scope | Standard, no Connect |
| SMS | One-way alphanumeric senders only; no per-customer phone numbers in V1 |
| Email | Customer slug sub-addresses (`[slug]@mail.webnua.com`); replies route to the Webnua lead inbox; no forwarding to personal email |

---

## Session 1 — platform integration spine ✅ COMPLETE

Session 1 built the foundation every Phase 7 integration shares. The spine, not
any specific integration.

### Delivered

- ✅ **Typed, boot-validated env module** — `src/lib/env.ts`. A zod schema with
  a slot for every Phase 7 provider (Supabase, Anthropic, Vercel, internal job
  executor, Stripe, Twilio, Resend, Google Ads, GBP). Required keys fail loud
  at boot; integration keys are optional (a feature degrades gracefully when
  its key is unset). Validation is lazy (a Proxy) so `next build` does not
  trip; `src/instrumentation.ts`'s `register()` hook forces it at server boot.
  New server code should read `env.X` instead of `process.env.X`; existing
  accesses were intentionally not refactored.

- ✅ **`integration_call_log` table** — migration `0047`. Logs every external
  API call (and inbound webhook): provider, operation, direction, redacted
  request/response shapes, status, latency, error class/message, client_id,
  correlation_id. Operator-only RLS, tenant-scoped; service-role writes.
  Single table for V1; the migration comment documents the monthly-partition
  path if writes exceed ~100k/day.

- ✅ **`callExternal()` wrapper** — `src/lib/integrations/_shared/call.ts`. The
  single function every integration uses for outbound calls: timeout (default
  30s), retry on 5xx + network errors with exponential backoff (default 3
  attempts), structured logging to `integration_call_log`, error classification
  (`retryable` / `non_retryable` / `auth_failed` / `rate_limited`), and a typed
  `IntegrationResult<T>` discriminated union. JSON-in/JSON-out by default with
  `rawBody` / `parseResponse` escape hatches.

- ✅ **Retry helper** — `src/lib/integrations/_shared/retry.ts`. Exponential
  backoff with full jitter; configurable max attempts / base / cap. Exposes
  `computeBackoffDelay` + `sleep` (used by `callExternal`) and `withRetry` (the
  ad-hoc throwing-function wrapper).

- ✅ **`integration_jobs` table** — migration `0048`. The async-work queue:
  status, attempts/max_attempts, run_after, provider, job_type, payload,
  result, error, client_id, correlation_id. Internal infrastructure — RLS on
  with zero policies, all `authenticated` privileges revoked; service-role
  only.

- ✅ **`pg_cron` poller** — migration `0049`. Polls `integration_jobs` every
  minute, dispatches due jobs to the Node executor over HTTP (`pg_net`), and
  reclaims stale `running` jobs after a 10-minute lease. Runtime config
  (executor URL + shared secret) lives in `private.integration_runtime_config`
  — **the operator must populate it once post-deploy** (see the table comment).

- ✅ **Jobs API** — `src/lib/integrations/_shared/jobs.ts`. `enqueueJob`,
  `enqueueJobImmediate` (enqueue + fire-and-forget self-POST for near-instant
  runs), `registerJobHandler`, and `runJob` (the executor body — atomic claim →
  handler → terminal status). Plus the executor route at
  `POST /api/internal/job-executor` (shared-secret verified, constant-time
  compare) and the side-effect manifest `job-handler-manifest.ts`.

- ✅ **Client-assignment tables** — `client_sms_senders` (`0050`),
  `client_email_senders` (`0051`), `client_stripe_customers` (`0052`). One row
  per client; operator-only tenant-scoped RLS; service-role writes.

- ✅ **`notifications_outbound` table** — migration `0053`. An audit row per
  operator-facing notification email sent, for throttling and audit.

- ✅ **Vercel adapter refactor** — `src/lib/website/vercel.ts` now routes every
  call through `callExternal()`. This validates the foundation against a real,
  existing integration; the public behaviour (domain provisioning, the 409 /
  404 idempotency cases, graceful `{ configured: false }` degradation) is
  unchanged.

### Deliberate refinements of the brief

- **The poller does not pre-mark jobs `running`.** The brief said "cron updates
  jobs to running, then POSTs". Instead the cron POSTs the job id and the
  executor performs the atomic claim (`UPDATE ... WHERE status='pending'`).
  This makes the cron and `enqueueJobImmediate` dispatch paths race-safe and
  removes the "POST failed → job stranded in `running`" failure mode. The
  lifecycle still ends in `running` then `completed`/`failed`/`pending`.
- **RLS scoping.** The brief said "operators see all" for several tables;
  every operator SELECT policy is scoped through `accessible_client_ids()` so
  a junior operator stays inside their assignment — consistent with the
  migration `0045` cross-tenant discipline. Senior operators (whose accessible
  set IS every client) see all, satisfying the brief.

### Operator action required post-deploy

1. Apply migrations `0047`–`0053`.
2. Set the `INTERNAL_JOB_SECRET` env var (a long random value).
3. Run the one-time `UPDATE private.integration_runtime_config` from migration
   `0049`'s table comment — set `app_base_url` and `job_executor_secret` (the
   latter equal to `INTERNAL_JOB_SECRET`). Until then the poller can reclaim
   stale jobs but cannot dispatch new ones.

### Verification checklist (post-deploy)

- [ ] Boot the app with a missing required env var → clear error naming it.
- [ ] `callExternal()` against a failing endpoint → retries fire, one
      `integration_call_log` row per attempt with the right `error_class`.
- [ ] Enqueue a job → `pg_cron` picks it up within ~1 minute → handler runs →
      job row → `completed`.
- [ ] `enqueueJobImmediate` → job processes within ~2 seconds.
- [ ] Existing Vercel subdomain provisioning still works through the wrapper.

---

## Session 2 — per-tenant OAuth foundation (NOT YET BUILT)

Session 2 builds the foundation for the **per-tenant OAuth** architecture
(Google Ads, GBP). It is a separate concern from the platform spine and is
expected to cover:

- **Token storage with encryption.** A per-tenant `integration_connections`
  (or similar) table holding OAuth access/refresh tokens, encrypted with
  **Supabase Vault** (the operator deferred Vault to this session — Session 1
  intentionally uses none).
- **The OAuth flow** — authorize redirect, callback handler, state/PKCE,
  per-provider scope sets, the `connect` / `reauthorize` / `disconnect`
  lifecycle.
- **Token refresh** — a job type on the Session 1 jobs spine: a scheduled
  `integration_jobs` row refreshes a connection's access token before expiry.
- **The connect UI** — making `ConnectIntegrationModal` real for the
  per-tenant providers.

### What Session 2 needs to know about Session 1

- **`callExternal()` is the only outbound-call path.** OAuth token exchanges
  and Google Ads / GBP API calls go through it — do not reach for bare `fetch`.
  Pass `clientId` so per-tenant calls are attributed in `integration_call_log`.
- **The jobs spine is ready for token refresh.** Add a `job-handlers` module
  per provider, register it via `registerJobHandler`, and add one side-effect
  import to `src/lib/integrations/job-handler-manifest.ts`. Schedule a refresh
  with `enqueueJob(..., { runAfter })`.
- **Env slots already exist** — `GOOGLE_ADS_*` and `GBP_*` keys are defined in
  the `src/lib/env.ts` schema and `.env.example`. Read them via `env.X`.
- **The integration tables are not yet in the generated `Database` type.**
  Session 1 reaches them through `getIntegrationDb()` (an untyped view of the
  service client) + hand-written row types in `_shared/db-types.ts`. After
  `0047`–`0053` are applied, regenerate `src/lib/types/database.ts` and
  Session 2 can use the generated types.
- **Vault is Session 2's job.** Session 1's only plaintext secret-at-rest is
  `private.integration_runtime_config.job_executor_secret` — an internal infra
  secret in the non-PostgREST `private` schema. Migrating it (and the new OAuth
  tokens) to Vault belongs with Session 2.

---

## Known concerns / follow-ups

- **Jobs table at scale.** A polled table is correct for V1 volumes. The
  poller `SELECT` is a partial-indexed scan of pending rows; if job throughput
  grows large, the per-minute poll granularity and the single executor route
  become the bottleneck before the table does. Revisit with a `SELECT ... FOR
  UPDATE SKIP LOCKED` claim batch and/or a shorter poll interval if/when job
  volume warrants — not before.
- **`integration_call_log` growth.** Single table for V1; monthly partitioning
  is the documented path past ~100k writes/day (migration `0047` comment).
- **Runtime config → Vault.** `private.integration_runtime_config` holds the
  job-executor secret in plaintext. Acceptable for V1 (non-exposed schema, no
  role grants); migrate to Vault in Session 2.
