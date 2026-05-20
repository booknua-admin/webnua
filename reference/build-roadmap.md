# Webnua build roadmap

Strategic spine for the remaining build work, from Phase 3b onward.
This doc is the source of truth for what's planned and in what order.
When a phase completes, update its entry with a ✅ + summary line and
the merge commit. Parked items move to CLAUDE.md per discipline.

## Phase 3b — Finish surface wiring (this branch + one more session)

Booking-write flows. No migration needed — `recurring_booking_schedules` exists.

- `useRescheduleBooking`, `useCreateBooking`, `useCreateRecurringSchedule` + conflict check
- `CustomerPicker` + `useCustomerSearch` (search + quick-add)
- Controlled-form refactors of `NewBookingModal`, `RescheduleModal`, `/recurring/new`; `ConflictModal` data-driven
- Sub-account-mode gate on `AddBookingButton`

~4 commits. Independent. Lowest risk.

## Phase 4 — Builder family backend (largest single chunk) ✅ DONE (PR #41 / merge `534de96`)

Replaced the localStorage builder stubs with Supabase against tables that
already exist (`website_versions`, `funnel_versions`, `content_drafts`,
`website_approval_submissions`, `funnel_approval_submissions`,
`force_publish_audit_log`, `brands`, `websites`, `funnels`).

- ✅ Website + funnel data from `data-stub.tsx` → live reads via
  `lib/website/queries.tsx` + `lib/funnel/queries.tsx`.
- ✅ Autosave (`use-autosave`), draft store, publish lanes, approval
  queue, rollback, preflight, force-publish audit → live via
  `mutations.ts` + `content-drafts.ts` + `snapshot.ts` +
  `builder-events.ts`. `publish-stub.ts` + `draft-stub.ts` deleted;
  `audit-stub.ts` + `website-approval-stub.ts` collapsed to type-only.
- Funnel publish/approval still deferred — see CLAUDE.md parked entry.

## Phase 5 — Real auth + capability/workspace/agency/billing ✅ DONE (PR #43 / merge `1a4705e`)

Replaced the stub deletion points with Supabase-backed providers.

- ✅ Login → role + capability + workspace resolution from DB.
  `app/(auth)/login` is a real `signInWithPassword`; `user-stub.tsx`
  (misnamed, kept for import stability) resolves from `auth.getSession`
  → `public.users` → `capability_grants`.
- ✅ Nine in-memory stores hydrated from Supabase via
  `DataHydrationProvider` on every `onAuthStateChange`: agency-policy,
  policy-overrides, plan-catalog, plan-assignments, client-invites,
  seat-limit history, team-invites, roster, clients.
- ✅ `DevRoleSwitcher` deleted + four `/dev/*` pages removed
  (`/dev/sections` survives).
- **Owed:** systematic cross-tenant RLS validation pass — policies
  written but not negative-tested with real `auth.uid()`s.

## Phase 6 — AI generation ✅

Replace `generatePageStub` / `generateFunnelStub` with a real Claude
API edge function; record runs in `generation_log`. Wire
onboarding-wizard Q&A → real `GenerationContext`.

- ✅ Website generator wired to real Claude via `/api/generate-site`
  + `generate-live.ts` (PR #47 / commit `efc4374`).
- ✅ Silent-fallback mask removed — real 500s now surface in
  `CreateClientModal`'s error pane via `AppError` (PR #58 / merge
  `f66865f`).
- ✅ Record runs in `generation_log` — one row per §4.4 fallback
  field, all sharing the run's `generation_id` uuid. Service-role
  insert from the route handler.
- ✅ Server/client metadata boundary — section files are
  `'use client'`, so server consumers (`generation-prompt.ts`,
  `generation-stub.ts`) read `SECTION_REGISTRY_META` from
  `sections/registry-meta.ts` instead of importing section objects
  directly. Resolves the `TypeError: Cannot read properties of
  undefined (reading 'includes')` that PR #58's unmasking surfaced.
  See CLAUDE.md parked decisions ("Phase 6 generation TypeError —
  RESOLVED" and "Section metadata server/client boundary").
- Funnel generator (`generateFunnelSync`) is still deterministic
  — the next AI-generation increment.
- Wizard Q&A → real `GenerationContext` — still owed (see CLAUDE.md
  parked decision).

## Phase 7 — Integrations

OAuth + API: GBP, Meta Ads, GA4, Google Ads (business) · Stripe, Resend,
Twilio (platform). Makes `/settings/integrations` connect flows real.
Unlocks reviews auto-pull, campaign metrics, email/SMS sending, real
billing.

## Phase 8 — Automation / messaging execution engine

Automations are definitions only — nothing sends. Build a scheduler
(edge function + cron), a new `messaging_events` send-log table, and
the suppression/anti-spam rules (CLAUDE.md parked decision). Closes the
campaign + automation metrics gap (sent/delivered/replied become real).
Depends on Phase 7.

## Phase 9 — Realtime + notification writes

Supabase Realtime on tickets / approvals / notifications. Notification
write path (feed is currently read-only).

## Phase 10 — Production hardening

Domain management (V2), deploy config, env/secrets, error monitoring,
security review + Supabase advisors, and the live browser E2E pass the
sandbox can't do (network-blocked from Supabase).

## Phase 11 — Proof Page prospecting tool

The deliberately-deferred admin feature (audit → proof-page → outreach).
Build last, per CLAUDE.md.

## Deployment env

Two server env vars on the deployment (added to `.env.example`):

- `VERCEL_TOKEN` — a Vercel access token
- `VERCEL_PROJECT_ID` — this deployment's project id
- `VERCEL_TEAM_ID` — only if the project is team-scoped

## Discipline restoration

This roadmap was committed mid-build to restore the doc-update
discipline that drifted across roughly 25-30 sessions starting in
Phase 4. From this commit forward, **every PR updates either
`CLAUDE.md`, this roadmap, or both** — no merges without doc-state
matching code-state. Parked decisions live in CLAUDE.md; phase
progress lives here.
