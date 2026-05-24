# Webnua build roadmap

Strategic spine for the remaining build work, from Phase 3b onward.
This doc is the source of truth for what's planned and in what order.
When a phase completes, update its entry with a ✅ + summary line and
the merge commit. Parked items move to CLAUDE.md per discipline.

## Standing constraint — mobile-first UI

Any new UI built must work on mobile (320–768px viewport) as well as
desktop. Audit existing mobile patterns in the codebase before building
new UI. Applies to operator surfaces, client surfaces, and
customer-facing site templates. No new desktop-only surfaces ship.

## Critical path to launch (paying customers)

The ordered list of work that must complete before the first paid
customer. Each item is a discrete session (or session set). Update with
✅ + merge commit as each lands.

1. ✅ **Custom domains** — shipped + verified. `client_custom_domains`
   table, 5-min polling job, client + operator UI on `/settings/domains`,
   host-aware middleware with 301 to primary domain. End-to-end verified
   against the live Vercel API.
2. **A3 funnel publish + approval lane** — wire the funnel-side publish
   lane in parity with the website lane. (Note: A3 was marked done under
   Phase 4 — re-verify here, then strike or scope follow-ups.)
3. **Sign-up + onboarding flow audit** — read the current state across
   `app/(auth)/`, the create-client modal, the first-load experience.
   Output: a punch list of gaps before building.
4. **Sign-up + onboarding flow build** — close the gaps from #3. New
   customer can self-serve from signup → first funnel published.
5. **Stripe billing tier-gating** — enforce plan-tier access restrictions
   at the resolver / capability layer. Today the plan layer resolves
   correctly but nothing gates on the resolved bundle.
6. **Cancel / delete account flow** — operator + client paths. Subscription
   cancellation already handled by Stripe Portal; account / data deletion
   (RLS, Storage cleanup, audit log retention policy) is the new work.
7. **Mobile optimization** — audit pass then fix sessions. Applies to
   every existing surface; the standing constraint above kicks in for
   anything new.
8. **Stub data sweep + test account cleanup** — remove demo / seed
   content from production tables; remove dev test users; verify a fresh
   sign-up sees an empty workspace, not seeded fixtures.
9. **Custom domains RLS test follow-up** — add `tests/rls/` coverage
   for `client_custom_domains` per the RLS-coverage standing rule.
10. **Manual UI polish pass** — includes building `LeadAutomationPanel`
    (the Phase 8 Session 3 carve-out — see CLAUDE.md), fixing React
    compiler warnings in `cta.tsx` / `reviews.tsx` / `services.tsx` /
    `offer.tsx`, and any cosmetic gaps surfaced by the mobile pass.
11. **Final launch validation** — end-to-end smoke across sign-up →
    onboarding → publish → custom domain → payment → first lead →
    automation fire → review request. Real Stripe live mode, real
    Resend / Twilio sends, real GBP location.

### V1.0.1 — right after launch

- Analytics verification — confirm the rollup + read paths under real
  visitor traffic.
- Meta Pixel auto-install on Meta ad account connect — the install step
  is operator-manual today; auto-inject when a client connects Meta.
- One builder upgrade — highest-impact section TBD from customer
  feedback in the first week.

### V1.1 — after first 10–20 customers

- Messaging events table — closes the campaign + automation
  performance-metrics gap (CLAUDE.md "Automation overlap / anti-spam
  suppression rules" parked decision).
- More builder upgrades — driven by customer feedback patterns.
- `LeadAutomationPanel` per-lead historical runs UI — the deferred
  Phase 8 Session 3 carve-out, surfaced on the lead detail page.

### Admin work in parallel (operator, not engineering)

- Terms of Service drafted.
- Meta App Review submission with demo videos — the sensitive scopes
  (`ads_management`, `business_management`, `pages_manage_ads`,
  `leads_retrieval`) need verified-app review.
- Google Business API verification status — the `business.manage`
  scope is sensitive/restricted; track verification through approval.

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
- ✅ Funnel publish + approval lane shipped (A3) in parity with the
  website lane — `lib/funnel/mutations.ts` Lane A + Lane B,
  `lib/funnel/queries.tsx` publish-state hooks, `lib/funnel/preflight.ts`,
  the `/funnels/[id]/review` surface, the shared `/tickets` approvals
  queue, and approval-lane Realtime (migration `0046`). Three deliberate
  divergences from the website lane (no force-publish, one shared
  Approvals tab, no commit-message field) — see the CLAUDE.md parked
  decision "Funnel publish + approval lane — DONE".

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
- ✅ Funnel generator wired to real Claude via `/api/generate-funnel`
  + `generate-funnel-live.ts`. ONE Opus 4.7 call produces the
  seven-section landing step (hero → offer → reviews → features →
  trust → reviews → form) in the Sultanic / Suby shape, driven by
  the chosen offer (Session 2) + brief + testimonials. Schedule +
  thanks steps stay deterministic. Same fallback contract as the
  website route — 503 silently falls back to `generateFunnelSync`,
  500 unmasks via `AppError`. Writes `generation_log` rows for
  missing-field fallbacks. See CLAUDE.md parked decision "Funnel
  vs offer generator model choice".
- Wizard Q&A → real `GenerationContext` — still owed (see CLAUDE.md
  parked decision).

### Phase 6 polish — prompt quality (in progress)

Iterative quality work on the four generation prompts surfaced by
`reference/prompt-audit.md`. Each item is a discrete session — small,
testable, no scope drift.

- ✅ Variant enums + item-array shapes + heading-accent semantics +
  icon library — in the website + funnel prompts via
  `SECTION_SHAPE_CATALOG` + `SHARED_FIELD_NOTES` in
  `lib/website/generation-prompt.ts`. Addresses the three reported
  symptoms (blank funnel arrays, duplicated accents, layout drift).
  See CLAUDE.md parked decision "Prompt-content fixes for reported
  symptoms".
- Banned-word list consolidation across the four prompts (offer +
  funnel × 2 + enhance carry the same 16 corporate-speak terms;
  the website prompt has none). Deferred.
- Copy-vs-layout distinction via `SectionMeta.capabilityHints` — the
  website prompt currently asks the model to "populate every field
  key", which includes structural knobs the model shouldn't be
  copy-drafting. Deferred.
- Voice tone on offer + enhance prompts — currently voice-blind.
  Deferred.
- Shared base persona (cached system block reused across all four
  routes). Deferred.
- Worked-example shots — a fully-populated section JSON inline in
  each system prompt. Deferred — the catalog approach above was
  picked first as lighter-weight.

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

## Phase 9 — Realtime + notification writes — DONE

Supabase Realtime on tickets / approvals / notifications. Notification
write path (feed is currently read-only). Closed by migration `0032`.

## Phase 9b — Client context routing fix — DONE

Every shared route follows the canonical
`_admin-content/_sub-account-content/_client-content` pattern
documented at `reference/client-context-pattern.md`. Sessions 1–3
brought `/tickets`, `/leads`, `/calendar`, `/search`, `/automations`,
`/reviews`, `/campaigns`, and `/(admin)/websites` into line.

## Phase 9 · Custom domains — IN PROGRESS

Self-serve + operator-concierge custom domain attachment via Vercel's
Domains API. New `client_custom_domains` table (migration `0081`),
lifecycle status (`pending_dns` → `verifying` → `ssl_pending` → `live`
/ `failed` / `removed`), 5-minute polling job (cron in `0082`),
client + operator UI on `/settings/domains`, host-aware middleware
with 301 redirect from `{slug}.webnua.dev` to a client's primary
domain. End-to-end verification against the live Vercel API is the
follow-up step (real domain test under operator credentials).

## Phase 10 — Production hardening

Domain management (V2), deploy config, env/secrets, error monitoring,
security review + Supabase advisors, and the live browser E2E pass the
sandbox can't do (network-blocked from Supabase).

## Phase 11 — Proof Page prospecting tool

The deliberately-deferred admin feature (audit → proof-page → outreach).
Build last, per CLAUDE.md.

## Deployment env

Server env vars on the deployment (added to `.env.example`):

- `VERCEL_TOKEN` — a Vercel access token
- `VERCEL_PROJECT_ID` — this deployment's project id
- `VERCEL_TEAM_ID` — only if the project is team-scoped
- `NEXT_PUBLIC_WEBNUA_CONCIERGE_CALENDAR_URL` — surfaced to clients
  in the domain-setup-in-progress UI as a "book a setup call" link.
  Also mirrored to server-only `WEBNUA_CONCIERGE_CALENDAR_URL`.
- `DOMAIN_CHECK_BATCH_SIZE` — optional, default 50. Per-tick batch
  size for the every-5-min domain-verification poller.

## Discipline restoration

This roadmap was committed mid-build to restore the doc-update
discipline that drifted across roughly 25-30 sessions starting in
Phase 4. From this commit forward, **every PR updates either
`CLAUDE.md`, this roadmap, or both** — no merges without doc-state
matching code-state. Parked decisions live in CLAUDE.md; phase
progress lives here.
