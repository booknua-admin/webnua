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

## Phase 4 — Builder family backend (largest single chunk)

Replace the localStorage builder stubs with Supabase against tables that
already exist (`website_versions`, `funnel_versions`, `content_drafts`,
`website_approval_submissions`, `funnel_approval_submissions`,
`force_publish_audit_log`, `brands`, `websites`, `funnels`).

- Website + funnel data from `data-stub.tsx` → live reads
- Autosave (`use-autosave`), draft store, publish lanes, approval queue,
  rollback, preflight, force-publish audit → live
- Funnel publish/approval (currently unbuilt even as stub — see
  CLAUDE.md parked entry)

Depends on Phase 5's capability-RLS for write gating — sequence 5 first
or accept stub-auth during build.

## Phase 5 — Real auth + capability/workspace/agency/billing

Replace the 7 stub deletion points. Supabase-backed providers reading
`users`, `capability_grants`, `user_client_access`, `agency_policy`,
`policy_overrides`, `plan_catalog`, `plan_assignments`.

- Login → role + capability + workspace resolution from DB
- Wire team-invite / client-invite flows to `team_invites` /
  `client_user_invites`
- Enforce design §4.3 capability-gated RLS on builder writes
- Delete `DevRoleSwitcher` + `/dev/*`

## Phase 6 — AI generation

Replace `generatePageStub` / `generateFunnelStub` with a real Claude
API edge function; record runs in `generation_log`. Wire
onboarding-wizard Q&A → real `GenerationContext`.

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
