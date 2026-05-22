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

1. ✅ **DONE** — Migrations `0047`–`0053` applied to the live `webnua` Supabase
   project (`ynfnjskylwlbmgyeeiot`) and schema-verified (see Verification).
2. Set the `INTERNAL_JOB_SECRET` env var (a long random value) in the
   deployment environment (and `.env.local` for local dev).
3. Run the one-time `UPDATE private.integration_runtime_config` from migration
   `0049`'s table comment — set `app_base_url` and `job_executor_secret` (the
   latter equal to `INTERNAL_JOB_SECRET`). Until then the poller can reclaim
   stale jobs but cannot dispatch new ones.

### Verification

Applied and verified against the live project:

- ✅ All six tables created with RLS enabled and the right policy counts —
  the five readable tables have one operator-scoped `SELECT` policy;
  `integration_jobs` intentionally has zero policies (service-role-only).
- ✅ `webnua-integration-jobs-poll` cron job scheduled (`* * * * *`) and active;
  `pg_cron` + `pg_net` installed; `private.dispatch_integration_jobs()` runs
  without error.
- ✅ `private.integration_runtime_config` single row present (empty — awaits
  operator step 3).
- ✅ Privilege lockdown: `integration_jobs` is fully invisible to
  `authenticated`; the five readable tables expose `SELECT` only (RLS-gated) —
  `INSERT/UPDATE/DELETE` revoked.

Still needs a deployed app + the operator steps above:

- [ ] Boot with a missing required env var → clear error naming it.
- [ ] `callExternal()` against a failing endpoint → retries fire, one
      `integration_call_log` row per attempt with the right `error_class`.
- [ ] Enqueue a job → `pg_cron` dispatches → executor runs → job `completed`
      (also needs a registered handler — Session 1 ships none).
- [ ] `enqueueJobImmediate` → job processes within ~2 seconds.
- [ ] Existing Vercel subdomain provisioning still works through the wrapper.

### Advisor notes (post-apply security lint)

- **`integration_jobs` — "RLS enabled, no policy" (INFO).** Intentional: the
  table is service-role-only internal infrastructure. RLS on + zero policies +
  `authenticated` revoked = invisible to every signed-in session.
- **`pg_net` installed in the `public` schema (WARN).** Introduced by migration
  `0049`'s `create extension`. Hygiene-level — `net.http_post` lives in the
  `net` schema and is unaffected. Recommend relocating `pg_net` (and `pg_cron`)
  to the `extensions` schema in a project-wide extension-hygiene pass.
- **Pre-existing, project-wide:** `authenticated` holds `TRUNCATE` / `REFERENCES`
  / `TRIGGER` on every `public` table (Supabase's default `GRANT ALL`) — and
  `TRUNCATE` is not gated by RLS. The integration tables inherit this baseline
  (and are stricter than most — `integration_jobs` revokes it entirely). The
  honest fix is one project-wide `REVOKE` + `ALTER DEFAULT PRIVILEGES`, out of
  scope for this session — flagged for the RLS-hardening workstream.

---

## Session 2 — per-tenant OAuth foundation ✅ COMPLETE

Session 2 built the foundation for the **per-tenant OAuth** architecture — the
customer owns the third-party account, Webnua OAuths in and stores per-tenant
tokens. Two registered providers: **Google Business Profile** (Google's
short-lived-access-token + refresh-token model) and **Meta Ads** (Meta's
long-lived-token model). Google Ads is NOT built (operator decision).

This is the foundation BOTH GBP and Meta business sessions build on — it has
no GBP or Meta business logic, only the OAuth scaffolding they share.

### Delivered

- ✅ **Supabase Vault** — migration `0054`. The `supabase_vault` extension
  (verified present, 0.3.1) plus four `public` wrapper functions
  (`webnua_vault_create_secret` / `_read_secret` / `_update_secret` /
  `_delete_secret`). The `vault` schema is not PostgREST-reachable; the
  wrappers are SECURITY DEFINER with EXECUTE revoked from every role except
  `service_role`, so only server code holding the service-role key can mint,
  read, rotate or delete a secret. Verified: round-trip works, the raw
  `vault.secrets.secret` column is ciphertext (not the plaintext token), and
  `anon` / `authenticated` cannot execute the wrappers.

- ✅ **`integration_connections` table** — migration `0055`. One row per
  customer account on one OAuth provider. Generic across providers; supports
  both token models via `token_model` (`refresh_access` / `long_lived`). The
  persistent secret lives in Vault (`token_secret_id`); `access_token_cached`
  is the ONLY token in a plain column — a bounded exception (a ~1h Google
  access token). Operator-only tenant-scoped RLS; service-role writes;
  clients get no access.

- ✅ **Token-refresh cron** — migration `0056`. Enqueues a daily
  `token_refresh_check` job onto the Session 1 jobs spine; the handler
  proactively refreshes `long_lived` (Meta) connections within 14 days of
  expiry. `refresh_access` (Google) connections need no proactive refresh —
  their access token is re-minted on demand. Verified: the handler's scan
  query selects exactly the long-lived, near-expiry, active rows.

- ✅ **OAuth provider registry** — `_shared/oauth-providers.ts`. Per-provider
  endpoints + the code/token-exchange, refresh, revoke and account-lookup
  functions, all routed through `callExternal()`. Google is fully implemented;
  Meta is written against the documented Graph API but **not verified against
  a live app** (`TODO(meta)` flags) — sufficient as a contract for the Meta
  session.

- ✅ **Generic OAuth helpers** — `_shared/oauth.ts`. `generateAuthorizationUrl`,
  `exchangeCodeForTokens`, `buildRedirectUri`, and the HMAC-signed `state`
  token (`signOAuthState` / `verifyOAuthState`) — the CSRF defence + the
  authenticated context carried into the callback.

- ✅ **Token management** — `_shared/tokens.ts`. `storeConnection`
  (Vault-encrypt then write the row — Vault failure is fatal, no plaintext
  fallback), `getAccessToken` (on-demand refresh, forked on `token_model`),
  `revokeConnection`, and the throttled refresh-failure operator alert. Typed
  errors: `VaultUnavailableError`, `ConnectionNotFoundError`,
  `TokenExpiredError`, `TokenRefreshFailedError`, `TokenRevokedError`.

- ✅ **`callWithToken()`** — `_shared/api-call-with-token.ts`. The per-tenant
  API-call wrapper every GBP/Meta call uses: fresh access token in, 401 →
  refresh-and-retry-once, `refresh_failed` + throw on a failed refresh.

- ✅ **OAuth routes** — `POST /api/integrations/[provider]/connect` (operator
  auth → signed state → authorization URL), `GET …/callback` (verify state →
  exchange → store → redirect), `POST …/disconnect` (revoke).

- ✅ **Operator connections UI** — `IntegrationConnectionsSection`, mounted on
  sub-account `/settings/integrations`. Per-provider status (connected /
  reconnection-needed / not-connected), Connect / Disconnect / Reconnect, and
  the days-until-expiry + scopes for a connected provider.

### Deliberate refinements of the brief

- **No `integrations:manage` capability.** Integration management is operator
  governance, outside the 13-cap builder model (CLAUDE.md). The connect /
  disconnect routes gate on operator role + client access (junior operators
  stay inside their assignment) — no invented capability.
- **Connect route returns JSON, not a 302.** The app has no cookie-based
  server auth, so the route is reached by `fetch()` with the operator's bearer
  token; a `fetch` cannot follow a 302 to a provider domain (CORS). It returns
  `{ authorizationUrl }` and the browser navigates.
- **One canonical provider slug.** The DB value, the route `[provider]` param
  and the registry key are all the underscore form (`google_business_profile`
  / `meta_ads`) — no hyphen/underscore mapping layer.
- **Refresh-failure notification — V1 delivery is a server-log + the UI
  status.** There is no operator in-app feed and the operator email path
  (Resend) is a later session. The throttle (`last_failure_notified_at`, once
  per connection per 24h) and the composed message are built; delivery is a
  structured `console.warn` for now, and the connections UI's `refresh_failed`
  status + Reconnect affordance is the real operator-facing surface. Wiring
  the email is a one-line swap when Resend lands.

### Operator action required post-deploy

1. ✅ **DONE** — migrations `0054`–`0056` applied to the live `webnua`
   project (`ynfnjskylwlbmgyeeiot`) and verified (Vault round-trip, RLS,
   privileges, cron, the refresh-job scan).
2. **Google Cloud OAuth app** — create the project, enable the Google My
   Business API, create an OAuth 2.0 client, register the redirect URI, and
   apply for verification (the GBP scope is sensitive). Full steps are in
   CLAUDE.md → "Per-tenant OAuth — Google Business Profile setup".
3. Set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` (and
   optionally `GOOGLE_OAUTH_REDIRECT_URI_BASE`, `OAUTH_STATE_SECRET`) in the
   deployment env.
4. Meta setup is deferred to the Meta business session — no Meta app exists
   yet; the `META_*` env slots stay blank until then.

### Regenerate the Database type

`integration_connections` (and the `0047`–`0053` tables) are still not in the
generated `src/lib/types/database.ts`. Session 2 reaches `integration_*`
tables through `getIntegrationDb()` + hand-written row types in
`_shared/db-types.ts`, and the browser connections read casts the client
untyped. Regenerate `database.ts` post-deploy and a later session can drop the
casts.

### What the GBP and Meta business sessions need to know

- **`callWithToken()` is the call path.** Every GBP / Meta API call goes
  through `callWithToken(clientId, provider, fetchFn)` — it supplies a fresh
  access token, refreshes-and-retries on a 401, and marks the connection
  `refresh_failed` on a dead token. `fetchFn` itself uses `callExternal()`.
- **The connection is already there.** After an operator connects a provider,
  `integration_connections` has the row and Vault has the secret. A business
  session never touches token storage — it calls `callWithToken` and gets a
  token.
- **Meta needs finishing.** `oauth-providers.ts`'s `metaAds` entry is written
  against the documented Graph API but unverified — every uncertain spot is a
  `TODO(meta)`. The Meta session creates the Meta app, fills `META_APP_ID` /
  `META_APP_SECRET`, confirms the Graph API version + scope set + the
  revoke / account-id shapes, and verifies the connect flow end to end.
- **GBP business logic is the next Google step.** `fetchAccountId` returns the
  GBP account name (`accounts/NNN`); listing locations / reviews is business
  logic for the GBP session, built on `callWithToken`.
- **A new refresh-related job type** registers in
  `_shared/job-handlers.ts` (or a provider module) + the manifest — the
  `token_refresh_check` handler is the worked example.

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
- **Runtime config → Vault — still open.** `private.integration_runtime_config`
  holds the job-executor secret in plaintext. Session 2 added Vault but did NOT
  migrate this — it is an internal-infra secret read by the pg_cron poller from
  inside Postgres (a different access pattern from the service-role-RPC Vault
  wrappers), and migrating it is not part of the per-tenant OAuth foundation.
  Acceptable for V1 (non-exposed `private` schema, no role grants); revisit in
  an extension-hygiene / secrets pass.
- **Meta provider is unverified.** `oauth-providers.ts`'s `metaAds` entry is
  built against the documented Graph API but has never run against a live Meta
  app. The Meta business session must verify the token exchange, refresh,
  revoke and account-lookup shapes (`TODO(meta)` flags) before relying on it.
- **`notifications_outbound` is unused by Session 2.** The refresh-failure
  alert logs to the server console + the connection's `refresh_failed` status
  (the connections UI is the operator surface). When the Resend operator-email
  path is wired, route the alert through `notifications_outbound`.
