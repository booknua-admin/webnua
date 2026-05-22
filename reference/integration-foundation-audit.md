# Integration foundation audit — Phase 7 prep

> **Status:** read-only audit. No code was changed this session.
> **Scope:** what exists in the codebase today that an integration would
> touch or reuse, and the foundation architecture all six Phase 7
> integrations should share.
> **Phase 7 integrations:** Stripe (billing), Twilio (SMS), Resend (email),
> Google Ads, Google Business Profile. Meta Ads deferred — not designed here.
> **Date:** 2026-05-22.

This session is the audit. A separate session builds the foundation.

---

## Current state

The ten areas from the brief. Verdict tags: **reusable** (build on as-is),
**adapt** (good shape, needs extension), **insufficient** (does not meet
integration needs), **absent** (nothing exists).

### 1. External API clients — *adapt*

Three external services are already called. There is **no shared abstraction**
— each is hand-rolled, and two distinct styles already exist.

| Service | Files | Style |
|---|---|---|
| Anthropic (Claude) | `src/lib/website/generate-live.ts`, `generate-funnel-live.ts`; six routes under `src/app/api/` (`generate-site`, `generate-funnel`, `generate-offer`, `generate-seo`, `enhance-field`, `enhance-offer`) | Official `@anthropic-ai/sdk`. `new Anthropic()` instantiated per call, reads `ANTHROPIC_API_KEY` implicitly from env. |
| Vercel (custom domains) | `src/lib/website/vercel.ts` (server-only) | Raw `fetch()` to `api.vercel.com`. Manual `Authorization: Bearer`. Reads `VERCEL_TOKEN`/`VERCEL_PROJECT_ID`/`VERCEL_TEAM_ID`. |
| Supabase | `src/lib/supabase/client.ts` (browser anon), `server.ts` (server service-role) | Official `@supabase/supabase-js`. Module-singleton clients. |

Patterns observed (consistent, and worth keeping — see *Patterns to preserve*):

- **Key loaded from env, guarded per call-site.** Every AI route opens with
  `if (!process.env.ANTHROPIC_API_KEY) return 503`. `vercel.ts` returns
  `{ configured: false }` when its vars are unset. Graceful degradation is
  the house style.
- **Errors:** `try/catch` → `500` with a `{ name, status, detail }` body
  (AI routes) or a discriminated `{ ok: false, error }` result (`vercel.ts`).
  Nothing is silently swallowed at the route layer.
- **Response validation:** AI routes defensively parse model JSON
  (`parseRawPage` in `generate-live.ts` — tolerates code fences, extracts the
  object) then run a validation pipeline (`assembleResult`). `vercel.ts`
  handles idempotency codes (409 already-attached, 404 already-removed).
- **Logging:** `console.error` only, except the AI routes which write
  `generation_log` rows (see §9).

**Gap:** the *shape* is good but there is zero shared scaffolding. A seventh
integration copy-pastes the env-guard, the try/catch, the error shape. Vercel
is the canary — it is genuinely a 6th external integration, shipped ad-hoc
with raw `fetch`. A 7th built the same way produces the 3rd distinct pattern.

### 2. Environment variables — *insufficient*

- **Inventory:** `.env.example` is the committed source of truth — 10 vars:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `APP_HOST`,
  `PUBLIC_SITE_DOMAIN`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`,
  `RLS_TEST_PASSWORD`.
- **Access:** raw `process.env.X` scattered across ~7 files. No central typed
  env module. **`zod` is not a dependency** — there is no schema validation
  layer anywhere in the codebase.
- Each consumer does its own ad-hoc `if (!process.env.X)` guard. There is no
  fail-fast-on-boot, and no single place that answers "which env vars exist".
- **Already-present placeholder:** `.env.example` has a section
  *"Integrations: Phase 4 (not used yet)"* naming Twilio / Meta / GBP /
  Stripe / Resend. (Doc drift — it says "Phase 4"; the roadmap renumbered
  this to Phase 7. Cosmetic; flag for cleanup.)

**Gap:** without a typed env module, each of six integrations adds 2–4 vars
as scattered `process.env` reads + bespoke guards. No validation, no
boot-time failure, no inventory.

### 3. Secret storage and encryption — *absent*

- **Nothing customer-level is stored.** Every secret today is a
  *platform-level* env var (Anthropic key, Vercel token, Supabase service
  role). No per-tenant token, key, or credential is persisted anywhere.
- No Supabase Vault usage. No `pgcrypto` / `pgsodium` extension —
  `pg_cron` is the **only** extension any migration enables (0035).
- No app-layer encryption helper exists.

**Gap (critical for OAuth).** Google Ads and GBP store a per-customer OAuth
refresh token that **must be encrypted at rest**. There is no encryption
primitive, no decision on Vault vs envelope encryption, and no table to put
the ciphertext in. This is a from-scratch build and a security-sensitive one.

### 4. OAuth flows — *absent*

- No OAuth-into-a-third-party flow exists.
- Supabase Auth handles **app login** (`supabase.auth.signInWithPassword` —
  email/password). That is the platform's own auth; it is unrelated to
  per-customer OAuth into Google.
- `ConnectIntegrationModal` (`components/shared/settings/`) renders a
  *"four-step OAuth-style display"* — confirmed a pure visual stub; the
  footer actions just close the modal.

**Gap:** GAds + GBP need a real authorize → callback → token-exchange →
refresh cycle. From scratch.

### 5. Webhook handlers (inbound from external services) — *absent (but a good template exists)*

- **No inbound-from-third-party webhook exists.** Stripe and Twilio will both
  need one.
- `src/app/api/forms/submit/route.ts` and `src/app/api/track/route.ts` are
  public POST endpoints — but they receive from Webnua's *own* published
  sites, not from a third party. They are not webhooks, **but they model the
  exact structural template a webhook route wants:** public route + body
  parse + in-code validation + `getServiceClient()` write + rate-limit +
  (track) bot-filter + fast `204`/`200` return.
- **No HMAC / signature-verification helper** — Stripe and Twilio webhooks
  must verify a signature header; that is security-critical and easy to get
  wrong per-integration.

### 6. Background jobs / queue infrastructure — *partial (scheduled DB work only)*

- **pg_cron is available and in use.** Migration 0035 runs
  `create extension if not exists pg_cron` and schedules
  `webnua-analytics-rollup` hourly (`7 * * * *`) calling the
  `SECURITY DEFINER` function `private.aggregate_analytics()`. This is a real,
  working precedent for scheduled server-side work.
- **No Supabase Edge Functions.** No `supabase/functions/` directory, no
  `supabase/config.toml` — the project is managed entirely through migration
  files + the dashboard/MCP; no local Supabase stack.
- **No Vercel Cron** (`next.config.ts` is empty; no `vercel.json`).
- **No job queue** (no pg-boss, Inngest, QStash, etc.).

**Gap:** *scheduled* DB-side work has a path (pg_cron). *App-level async work*
— send an SMS, retry a failed external call, pull GBP reviews on a schedule,
refresh an expiring OAuth token — has **no infrastructure**. Phase 8
(automation/messaging engine) needs the same thing; the decision should be
made once, here.

### 7. Rate limiting and retry logic — *insufficient*

- **Inbound rate limiting exists:** `src/lib/public-site/rate-limit.ts` — an
  in-memory fixed-window per-IP counter. Explicitly best-effort (per-instance
  Map; a serverless host defeats it across instances). Used by
  `/api/forms/submit`, `/api/forms/upload`, `/api/track`. This protects
  *our* endpoints — it is not about respecting an *external* service's limit.
- **Outbound retry is essentially absent.** `generate-offer/route.ts` has a
  one-shot domain-specific retry (re-prompt once when the model invents a
  price) — not a transient-failure backoff. `create-client.ts` retries on a
  DB unique-constraint clash (TKT reference allocation). `use-autosave.ts` has
  a user-driven retry button. **None** is an exponential-backoff /
  `Retry-After`-honouring helper for "the external service 429'd / 5xx'd me".

**Gap:** Stripe / Twilio / Resend / Google all rate-limit and all return
transient 5xx. Without a shared retry helper each integration hand-rolls it
or skips it.

### 8. Per-tenant integration state — *absent*

- **No `integration_connections` table** — and nothing like it. The full
  table list (40 tables) has no integration / connection / oauth / token
  table.
- `lib/agency/` `integrationDefaults` is a **policy key** — *agency-level
  configuration* (which providers the agency offers, default config),
  resolved through the agency→plan→override stack. It is **not** per-customer
  connection state. Different concern, do not conflate.
- `lib/agency/integration-providers.ts` (`INTEGRATION_PROVIDERS`) is **display
  metadata only** — `{ id, name, description }` for resend / twilio /
  meta-ads / gbp / vercel. No state.

**Gap:** "client X has connected Stripe / their Twilio number is Y / their
Google Ads token expires at Z" has nowhere to live. From-scratch table design.

### 9. Audit / observability for external calls — *adapt (the model is `generation_log`)*

- **`generation_log`** (migration 0011) is the model worth copying. Per-run
  `generation_id` groups N rows; `client_id` FK attributes the run;
  append-only (`created_at` only); RLS = operator-only read + service-role
  write; structured columns (`section_type`, `field_name`, `reason`,
  `model_value`).
- **But** it logs *generation fallbacks* (validation-pipeline drops) — a
  prompt-tuning artefact. It is a **domain log, not an external-call log.** It
  records no request, no response, no latency, no HTTP status.
- Everything else goes to `console.error` — visible only in host function
  logs.

**Gap:** no integration is debuggable in production. There is no
request/response/latency/error trail for an external call. The
`generation_log` *shape* is the right template for a new
`integration_call_log` table — reuse the shape, not the table.

### 10. Customer-facing connection UI — *reusable (UI shell), insufficient (data)*

The UI is **fully built** and **entirely stub-fed**:

- `/settings/integrations` — `_client-content.tsx` (per-account cards from the
  `clientIntegrations` stub), `_admin-content.tsx` (the cross-client matrix
  from `lib/integrations/admin-matrix.tsx` — pure stub display data),
  `_sub-account-content.tsx` (per-account policy overrides).
- `/settings/api` — platform-services list (Stripe/Resend/Twilio/Anthropic/
  Vercel) from `lib/settings/platform-services.tsx` — also stub.
- Components: `IntegrationCard`, `ConnectIntegrationModal` (stub flow),
  `IntegrationProgressHero`, `IntegrationMatrix` + matrix hero/action cards.

**Verdict:** the presentation layer is complete and well-built — reuse it
as-is. What is missing is everything behind it: real connection state, a real
OAuth-redirect handler wired to `ConnectIntegrationModal`, real status.

---

## Patterns to preserve

Things the codebase does well that integrations should build *on top of*,
not around:

1. **Graceful degradation when unconfigured.** Every external call already
   checks for its key and degrades honestly (`503 generation-not-configured`,
   `{ configured: false }`). Integrations keep this: an unconnected provider
   produces a clear "not connected" state, never a crash.
2. **Service-role at the trust boundary.** Public/system writes go through
   `getServiceClient()` with **all validation in code** (`/api/forms/submit`,
   `/api/track`). Webhook ingest follows the same model.
3. **`generation_log` shape** — per-run id, client attribution, append-only,
   structured columns, RLS operator-read + service-role-write. The template
   for `integration_call_log`.
4. **`AppError` / `Result<T>` contract** (`src/lib/errors.ts`) — discriminated
   error kinds, static factories, `normalizeError` mapping infra codes
   (`PGRST116`, `42501`, HTTP 401/403). Integration data-access reuses this
   verbatim — do not invent a parallel error type.
5. **Discriminated result shapes.** `vercel.ts` returns
   `{ configured:false } | { ok:true,… } | { ok:false,error }`. A clean
   pattern for "this might not be set up" — generalise it.
6. **pg_cron for scheduled DB work** — proven by `webnua-analytics-rollup`.
   The default answer for *scheduled* (not per-event) integration jobs.
7. **The `/api/forms/submit` route as a public-endpoint template** —
   validate-in-code, rate-limit, cross-tenant guards, fast return.
8. **`RealtimeProvider`** — integrations that produce live data (incoming
   SMS, a new GBP review) can fan invalidations through the existing channel.
9. **Audit-first discipline** — this very report. Foundation before
   integrations.

---

## Foundation gaps

Each gap, framed as the brief asks — *"without this, integrations reinvent it
ad-hoc per integration, or skip it (tech debt)."*

1. **No per-tenant connection table.** Without it, each integration invents
   its own "is X connected for client Y, with what scopes, expiring when"
   storage — five incompatible shapes.
2. **No secret encryption.** Without it, OAuth refresh tokens are stored
   plaintext, or each OAuth integration picks its own scheme. Security debt
   that is expensive to retrofit.
3. **No OAuth flow handler.** Without it, Google Ads and GBP each hand-roll
   authorize → callback → token-exchange → refresh — the same fiddly,
   security-sensitive code twice.
4. **No external-call observability.** Without it, no integration is
   debuggable; transient failures vanish into `console.error`. The first
   production incident has no trail.
5. **No outbound retry/backoff.** Without it, a transient 429/5xx from
   Stripe/Twilio fails the user's operation outright.
6. **No webhook ingest + signature verification.** Without it, Stripe and
   Twilio webhooks each hand-roll HMAC verification — easy to get subtly
   wrong, and a wrong verification is a security hole.
7. **No async job runner.** Without it, "send SMS / sync GBP reviews / refresh
   expiring tokens" runs synchronously inside a request handler (slow, fragile)
   or is skipped.
8. **No typed env schema.** Without it, ~15 new integration env vars scatter
   as raw `process.env` reads with ad-hoc guards and no boot validation.

---

## Recommended foundation work

Prioritised — most foundational first. Sizes: **S** ≈ part of a session,
**M** ≈ a focused session-chunk, **L** ≈ its own session / decision-heavy.

| # | Primitive | Why | Size | Depends on |
|---|---|---|---|---|
| 1 | **Typed env module** (`src/lib/env.ts`) | Validate every env var at boot; one inventory; fail fast. Everything reads keys through it. | S | — |
| 2 | **`integration_connections` table + RLS + migration** | The spine — per-(client, provider) connection record. Every customer-facing integration surface reads it. | M | 1 |
| 3 | **Secret encryption helper** | OAuth refresh tokens must be encrypted at rest. Needed before any token is written. | S–M | 2 + an operator decision (Vault vs pgcrypto) |
| 4 | **`integration_call_log` table + `callExternal()` wrapper** | Times, logs, and `normalizeError`s every external call. Debuggability. | M | 1 |
| 5 | **Retry/backoff helper** (`withRetry`) | Honour `Retry-After` / exponential backoff on 429/5xx. Folds into `callExternal()`. | S | 4 |
| 6 | **OAuth flow scaffold** | Generic authorize-URL builder + `/api/integrations/[provider]/callback` route + token-exchange + refresh. | M | 2, 3 |
| 7 | **Webhook ingest scaffold** | `/api/integrations/[provider]/webhook` route shape + per-provider signature verification + idempotency. | M | 4 |
| 8 | **Async job mechanism** | A jobs table + a pg_cron-driven runner, or Edge Functions. For outbound send / token refresh / review sync. | L | 1, 4 — decision-gated |

Ordering rationale: 1 is a leaf everything else needs. 2 is the data spine.
3 must land before 6 writes a token. 4+5 make every call (including 6's token
exchange) observable + resilient. 6 and 7 are validated by their first real
consumer. 8 is heaviest and decision-gated — see *Open questions*.

**Build #1–#5 first (the un-skippable spine). #6 and #7 alongside their first
integration. #8 deferred to a decision.**

---

## Proposed file structure

Fits the existing `src/lib/<domain>/` convention (per-domain folder, each with
`types.ts` / `queries.tsx` / `mutations.ts`). The `_shared/` underscore prefix
matches the codebase precedent (`sections/_shared/`, `_`-prefixed route
content siblings). API routes match `src/app/api/<name>/route.ts`.

```
src/lib/
  env.ts                          ← #1 · typed env, platform-wide (not integration-only)
  integrations/
    _shared/
      types.ts                    ← IntegrationProvider, ConnectionStatus, …
      connections.ts              ← #2 · integration_connections data access (queries + mutations)
      crypto.ts                   ← #3 · encrypt/decrypt secret-at-rest helpers
      call.ts                     ← #4 · callExternal() — timing, logging, normalizeError
      retry.ts                    ← #5 · withRetry / backoff
      oauth.ts                    ← #6 · authorize URL, token exchange, refresh
      webhook.ts                  ← #7 · signature verification, idempotency
    stripe/
      client.ts                   ← Stripe SDK wrapper
      queries.ts                  ← billing/invoice reads
      webhook.ts                  ← event-type handlers
    twilio/
      client.ts
      send.ts
    resend/
      client.ts
      send.ts
    google-ads/
      client.ts
      oauth.ts                    ← provider-specific OAuth config
      sync.ts
    google-business-profile/
      client.ts
      oauth.ts
      reviews.ts

src/app/api/integrations/
  [provider]/
    callback/route.ts             ← #6 · OAuth redirect handler
    webhook/route.ts              ← #7 · inbound webhook ingest

supabase/migrations/
  00XX_integration_connections.sql
  00XX_integration_call_log.sql
  (+ secret-storage migration once the encryption decision is made)
```

**Note — pre-existing file:** `src/lib/integrations/admin-matrix.tsx` already
exists. It is **stub display data** for the cross-client integrations matrix
UI (not real integration code). It belongs with the other settings stubs
(`lib/settings/`); recommend moving it there when the matrix is wired so
`lib/integrations/` holds only real integration code. Minor — flag, don't
block on it.

---

## Per-integration architecture sketch

Short sketches. Meta Ads deliberately excluded.

### Stripe — billing (platform-level account)

Webnua bills its *clients* for their plan — one Webnua Stripe account; each
client is a Stripe Customer. **Not** per-customer OAuth.

- **Foundation primitives:** typed env, `callExternal()` wrapper, retry,
  webhook scaffold (signature-verified).
- **Customer state:** `stripe_customer_id` + `stripe_subscription_id` on
  `clients` (or on `plan_assignments`); an `invoices` table to replace the
  `InvoiceList` stub. No `integration_connections` row (platform-level).
- **Inbound webhooks:** **yes** — `invoice.paid`, `invoice.payment_failed`,
  `customer.subscription.updated/deleted`. HMAC signature verification +
  idempotency required.
- **Background jobs:** optional nightly reconcile (catch missed webhooks).
- **Open:** if clients ever *collect* payments from their own customers, that
  is Stripe Connect — per-tenant, OAuth-shaped. See *Open questions*.

### Twilio — SMS (platform account, per-client sender)

One Webnua Twilio account; each client has its own sender number / messaging
service.

- **Foundation primitives:** typed env, `callExternal()` wrapper, retry,
  webhook scaffold, **async job runner** (outbound send).
- **Customer state:** per-client Twilio number / messaging-service SID — a
  column on `clients` or an `integration_connections` row.
- **Inbound webhooks:** **yes** — inbound SMS replies + delivery-status
  callbacks. Twilio signature verification required.
- **Background jobs:** **yes** — outbound send queue. This is the Phase 8
  automation/messaging engine's sender; build the job runner with that in
  mind.

### Resend — email (platform account)

One Webnua Resend account; per-client from-address / verified domain.

- **Foundation primitives:** typed env, `callExternal()` wrapper, retry,
  webhook scaffold, **async job runner** (outbound send).
- **Customer state:** per-client from-address + domain-verification status.
- **Inbound webhooks:** **yes** — delivery / bounce / complaint events.
- **Background jobs:** **yes** — outbound send (shares the Phase 8 sender
  with Twilio).

### Google Ads — per-customer OAuth

Each client authorises Webnua against *their own* Google Ads account.

- **Foundation primitives:** typed env, **OAuth scaffold**, **secret
  encryption**, `integration_connections` table, `callExternal()` wrapper,
  retry, **async job runner** (token refresh + metrics sync).
- **Customer state:** an `integration_connections` row per client —
  encrypted refresh token, Ads customer id, scopes, `expires_at`, status.
- **Inbound webhooks:** **no** — Google Ads is polled.
- **Background jobs:** **yes** — token refresh before expiry + periodic
  metrics sync (this closes the campaign-metrics gap CLAUDE.md flags).

### Google Business Profile — per-customer OAuth

Each client authorises Webnua against their GBP listing.

- **Foundation primitives:** typed env, **OAuth scaffold**, **secret
  encryption**, `integration_connections` table, `callExternal()` wrapper,
  retry, **async job runner** (review pull + token refresh).
- **Customer state:** an `integration_connections` row — encrypted refresh
  token, GBP account/location id, scopes, `expires_at`, status.
- **Inbound webhooks:** **no real-time push** — GBP is polled.
- **Background jobs:** **yes** — periodic review pull (unlocks review
  auto-pull; the `0032` notification trigger already anticipates a
  "GBP review pull once Phase 7 lands") + token refresh.

**Cross-cutting:** Google Ads + GBP share an OAuth provider (both Google,
same authorize endpoint) — the OAuth scaffold should treat the provider
config as data, so one scaffold serves both with two config objects.

---

## Open questions for the operator

Decisions needed before the foundation session can run.

1. **Secret encryption mechanism.** Supabase Vault (native, no extra infra,
   but a limited API surface) vs `pgcrypto` envelope encryption (a key in env
   encrypts column data) vs app-layer AES with an external KMS. *Recommendation
   to evaluate first: Supabase Vault* — it is the native option and avoids a
   self-managed key. Blocks foundation primitive #3 and OAuth (#6).
2. **Async job mechanism.** pg_cron is already in use for *scheduled* work.
   Options for *per-event* async work (outbound send, token refresh):
   (a) a `jobs` table polled by a pg_cron-driven `SECURITY DEFINER` function;
   (b) Supabase Edge Functions (needs `supabase/config.toml` + a functions
   dir — none exists today); (c) Vercel Cron; (d) an external queue
   (Inngest / QStash). Blocks foundation primitive #8 and Phase 8.
3. **Integration call log — same table as `generation_log` or separate?**
   *Recommendation: a separate `integration_call_log` table reusing the
   `generation_log` shape.* `generation_log` is a generation-domain artefact;
   overloading it blurs two concerns. Confirm.
4. **`zod` for the typed env module.** The stack is frozen and CLAUDE.md says
   "stop and ask before adding a library." A typed env schema is cleanest
   with `zod`, but can be hand-rolled with no dependency. Operator call: add
   `zod`, or hand-roll?
5. **Stripe scope.** Platform-billing only (Webnua bills clients for their
   plan)? Or also Stripe Connect (clients collect payments from their own
   customers)? Connect makes Stripe per-tenant and OAuth-shaped — a materially
   bigger build. Phase 7 brief says "Stripe (billing)" → reads as
   platform-billing only; confirm.
6. **Twilio / Resend account model.** One Webnua platform account with
   per-client sub-identities (number / from-address), or a separate account
   per client? Affects whether they need `integration_connections` rows or
   just a column on `clients`.

---

## Recommended next session

**Build the foundation spine — primitives #1–#5.** Concretely:

1. `src/lib/env.ts` — typed, boot-validated env module; migrate the existing
   ~10 vars + add the Phase 7 integration vars.
2. `integration_connections` table — migration, RLS (operator-write,
   client-read-own, service-role for system writes), `_shared/connections.ts`
   data access.
3. Secret encryption helper (`_shared/crypto.ts`) — **gated on open question
   #1**; if the decision slips, this drops to a follow-up and #1–#2, #4–#5
   still ship.
4. `integration_call_log` table + `_shared/call.ts` (`callExternal()` —
   timing, logging, `normalizeError`).
5. `_shared/retry.ts` — `withRetry()` honouring `Retry-After`, folded into
   `callExternal()`.

That is the un-skippable spine, validated by no specific integration but
needed by all six. **The OAuth scaffold (#6) and webhook scaffold (#7) should
be built in a *second* foundation session, each alongside its first real
consumer** — OAuth with GBP (it unlocks the review-pull the platform most
wants), webhooks with Stripe. Building a scaffold against a real consumer
stops it from being a guess. The async job runner (#8) is decision-gated
(open question #2) and can pair with Phase 8.

**Estimated total foundation effort: 1.5–2 sessions.**
Session 1 = primitives #1–#5 (the spine). Session 2 = OAuth scaffold + webhook
scaffold (#6, #7), ideally each carried in by the first integration that needs
it. Async jobs (#8) is separate and decision-gated.

---

## Flagged during the audit (not in the brief)

- **Vercel is already a 6th ad-hoc integration.** `lib/website/vercel.ts` is
  raw-`fetch` external-API code shipped with no rails. It is the warning sign:
  the foundation should ideally adopt `vercel.ts` onto the new rails too (or
  consciously leave it as the documented exception), so the pattern count
  stops at one.
- **`.env.example` says "Phase 4"** for the integration vars — stale; the
  roadmap renumbered to Phase 7. Cosmetic; fix when the env module lands.
- **No `supabase/config.toml` and no `supabase/functions/`.** The project has
  never had a local Supabase stack or an Edge Function. If open question #2
  resolves to Edge Functions, that infrastructure is itself a setup task —
  factor it into the estimate.
- **`getServiceClient()` is the universal hammer.** Every public route writes
  with service role (RLS-bypassing). Webhook ingest will do the same. That is
  correct for a trust-boundary endpoint, but it means webhook routes carry the
  full validation burden in code — the foundation's webhook scaffold must make
  signature verification *non-optional* so a new webhook route cannot ship
  without it.
- **`lib/integrations/admin-matrix.tsx` already occupies the proposed
  directory** with stub display data — relocate it to `lib/settings/` when the
  matrix is wired (noted in *Proposed file structure*).
