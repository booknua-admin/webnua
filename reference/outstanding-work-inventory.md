# Outstanding-work inventory

> Read-only diagnostic produced 2026-05-20 on branch
> `claude/outstanding-work-inventory-BifMN`. Cross-references
> `CLAUDE.md`, `reference/build-roadmap.md`,
> `reference/analytics-audit.md`, `reference/prompt-audit.md`, and
> `reference/drift-recovery/*` to surface every outstanding or
> deferred item in one place.
>
> Effort sizing: **small** < 300 lines · **medium** 300–800 lines ·
> **large** 800+ lines (or multi-session).

---

## Section A — Critical gaps before external user readiness

Items that would actively break the platform for real users or
operators if a paying client landed today.

### A1. Cross-tenant RLS validation pass (security)
- **Current state.** Per `build-roadmap.md` Phase 5 and CLAUDE.md
  ("Auth — DONE … **Still owed:** a deliberate cross-tenant RLS
  validation pass — the policies have not been systematically
  negative-tested with real `auth.uid()`s"). Policies are written
  across all live tables (clients, websites, funnels, leads, bookings,
  tickets, notifications, automations, content_drafts, capability_grants,
  agency_policy, plan_assignments, lead_attachments bucket, etc.) but
  no systematic negative test confirms tenant A cannot read or write
  tenant B's rows.
- **What would need to ship.** A test harness (Vitest + the anon /
  service-role / per-tenant JWT pattern) that asserts: SELECT / INSERT /
  UPDATE / DELETE on every table by a tenant-B user against tenant-A
  rows returns zero rows or a permission error. Also assert the
  `anon` role is refused everywhere (it must stay refused — the docs
  call out this is what produces the wall of `401` warnings on a
  logged-out load). Fix any failures found.
- **Effort.** Medium for the harness; gap-dependent for any fixes
  surfaced (likely small — the policies are written, they need
  validation more than rewriting).

### A2. Wizard Q&A inputs are not fed to the website generation prompt
- **Current state.** Per build-roadmap.md Phase 6 ("Wizard Q&A → real
  `GenerationContext` — still owed") and CLAUDE.md
  `lib/website/sections/header.tsx` note plus the
  `composePrompt`/`buildPromptBlocks` design — the `/website/new` flow
  collects five questions (pageType / intent / audience / specifics /
  avoid) and routes them into `generatePageStub`. The deterministic
  stub ignores `specifics` + `avoid`; the live Claude path
  (`generate-live.ts`) does consume them via `composePrompt`. The
  `CreateClientModal` create-client flow uses brand + funnel-offer
  context but does NOT yet thread the wizard's Q&A answers into the
  per-page generation context. Result: a new client's site is
  generated from the brief alone, ignoring any Q&A signals the wizard
  could capture.
- **What would need to ship.** Decide whether the create-client flow
  is the right home for per-page Q&A at all (the wizard sunset
  parked decision suggests the brief is the only intake; per-page
  Q&A may belong only to `/website/new`). If yes, thread the answers
  into the `ClientBrief → GenerationContext` mapping in
  `lib/clients/create-client.ts`. If no, mark explicitly resolved
  and remove the build-roadmap line.
- **Effort.** Small if the answer is "leave create-client as-is and
  remove the line"; medium if Q&A surfaces in create-client.

### A3. Funnel publish + approval lane — ✅ DONE
- **Shipped.** The funnel publish lane is wired in parity with the
  website lane: `lib/funnel/mutations.ts` extended with Lane A
  (`publishFunnelDraft`, already present — now also resolves any
  in-flight pending submission) + Lane B (`submitFunnelForApproval`,
  `approveFunnelSubmission`, `rejectFunnelSubmission`,
  `recallFunnelSubmission`); `lib/funnel/queries.tsx` gained
  `useUserPendingFunnelSubmission` + `useAllPendingFunnelApprovals`;
  `lib/funnel/approval.ts` carries the `FunnelApprovalSubmission` type
  + the pure `diffFunnelSnapshots` summary; `lib/funnel/preflight.ts`
  is the funnel-shaped rule engine; `/funnels/[id]/review` is the
  funnel review surface; the funnel editor's toolbar routes
  `reviewHref` through it; the `/tickets` approvals queue renders
  funnel submissions (`FunnelApprovalRow`) alongside website ones;
  Realtime is wired via migration `0046`. The `funnel_approval_
  submissions` table already existed (pre-aligned in migration 0015).
- **Three deliberate divergences from the website lane** (each a
  structural difference, not an omission — see the CLAUDE.md parked
  decision "Funnel publish + approval lane — DONE"): (1) no
  force-publish — `force_publish_audit_log` is website-keyed; (2) one
  shared "Approvals" tab, not a separate funnel queue page; (3) no
  commit-message / scheduled-publish fields (the website lane has
  none either — it's a review *surface*, not a modal).

### A4. Real public-site hosting (the "are clients actually live?" gap)
- **Current state.** Per the analytics-audit §1.9 #1 and CLAUDE.md
  build-phases footer ("Public site rendering"): the render pipeline
  exists (PR #50 — middleware host-routing, `/published/[host]/[[...slug]]`
  renderer, tracking-script injection, form rendering) and the
  per-website domain-attach control exists (`ConnectDomainButton` →
  `/api/domains` + `setCustomDomain`). What the audit calls
  "the *production* path that points a client's domain at the Vercel
  project + persists `websites.domain_primary` for a real customer"
  is **not** confirmed to have been done for any real client. Phase 10
  is the umbrella ("Domain management V2"). Until at least one real
  client site is live on a custom host, analytics produces zero data
  and the "live website" promise is unmet.
- **What would need to ship.** Operational, not code: at minimum
  confirm one real customer can complete the domain-connect flow
  end-to-end (point a real registrar's records, SSL provisions, the
  middleware routes to `/published`, the tracking script fires, the
  rollup populates). Add an "is this domain live" healthcheck if it
  isn't there.
- **Effort.** Small if the existing code works end-to-end on a real
  domain (mostly operational verification); medium if `vercel.ts`,
  the middleware, or the `setCustomDomain` flow surfaces gaps under
  a real registrar.

### A5. Integration connect flows are stubs (Phase 7 dependency)
- **Current state.** Per CLAUDE.md `ConnectIntegrationModal` + the
  "Phase 7 — Integrations" build-phase line. The modal opens, shows
  four OAuth-style steps, the footer button just closes. No
  `integration_connections` table, no OAuth-token storage, no
  per-provider API surface. So:
  - GBP — no reviews auto-pull. `useClientReviews` / `useAdminReviews`
    surface real `reviews` table rows, but nothing writes to it.
  - Meta Ads / Google Ads — no campaign metrics. `useClientCampaigns`
    + `useAdminCampaigns` render the campaign *record* + activity log
    live, but every performance metric (leads / spend / CPL / ROAS /
    trend / sparkline) renders "Awaiting Meta Ads".
  - Stripe — no billing. Plans set policy bundles; nothing charges.
    Invoices in `InvoiceList` are display stubs.
  - Resend / Twilio — no email / SMS. Automations cannot send (see A6).
- **What would need to ship.** Phase 7 in full. The build-roadmap
  explicitly notes this is "Owned by the human developer — done on
  a local machine with real credentials, not in a sandbox session."
- **Effort.** Large — per-provider OAuth + API + write-path + UI
  swap-out of the stub. Realistically multiple sessions per provider.

### A6. Automation execution engine — automations never fire
- **Current state.** Per CLAUDE.md ("Phase 8 — Automation / messaging
  execution engine. Automations are definitions only — nothing sends")
  and the resolved/deferred ledger ("Automation overlap / anti-spam
  suppression rules — DEFERRED"). The library has 21 seeded automations
  across four clients (six trigger types: lead_created /
  lead_stale_24h / booking_upcoming / job_completed / booking_no_show /
  customer_dormant). The toggle is real and persisted; the step copy
  is editable and persisted. Nothing schedules, evaluates triggers, or
  sends. A client switching on an automation receives no behaviour
  change.
- **What would need to ship.** Phase 8: a scheduler (edge function +
  cron), a `messaging_events` send-log table, the suppression /
  priority-tier / quiet-hours / per-recipient frequency-cap policy
  (also surfaces `automationDefaults` in the agency-policy resolver,
  which is typed-deferred today). Closes the campaign + automation
  performance metrics gap as a side effect.
- **Effort.** Large — depends on Phase 7 (Resend / Twilio).

### A7. Production observability is missing
- **Current state.** Per build-roadmap.md Phase 10 and analytics-audit
  §1.9 #3 ("`/api/track` write-failures are silent — `await … insert(rows)`
  has no error handling; a Postgres write error becomes an unhandled
  rejection in a serverless function that's already returned 204").
  There is no error-monitoring sink (Sentry/Logflare/etc.), no DB-side
  alert on insertion-rate drops, no Vercel-log surfacing for failed
  generation runs (the `generate-offer` / `enhance-field` routes
  intentionally don't write `generation_log` — they `console.warn`
  only because `client_id` is NOT NULL before the client row exists).
  A production outage on the tracking endpoint, the generation routes,
  or the public-form submit route is invisible until someone notices
  a number wrong in the UI.
- **What would need to ship.** Phase 10 production hardening:
  pick a monitoring sink, wire it to every API route, alert on rate
  drops + 5xx rates. Optionally relax `generation_log.client_id` to
  nullable so pre-client-row generation can log too, or add a sister
  `generation_diagnostics` table without the FK.
- **Effort.** Medium — provider choice + per-route wiring + one
  alert-rule pass.

### A8. Funnel form submit + step-2 lead threading edge cases — status unclear; verify before scheduling
- **Current state.** The §2 + §3 analytics-audit update blocks claim
  the duplicate-lead gap is closed (`existingLeadId` threading via
  `?lead=<id>`), funnel rollup step-granularity is closed (migration
  0042 + `page_ref` PK extension), source_funnel_id attribution is
  wired (migration 0044). However the §3 update also says: "a step-2
  submit that fails at `/api/forms/submit` (e.g. the cross-tenant
  guard … rejects a tampered `?lead=`) still fires `form_submit` at
  the tracker and leaves the step-1 lead orphaned with no second
  event. Worth tracking." This is the form-submit-error false-positive
  gap (analytics-audit §5.2 #1, claimed RESOLVED via migrations 0038
  + 0039 + a `formSubmitError` tracker API the React `FormBlock`
  calls in its catch block). **Verify the catch-block wiring actually
  exists in `FormBlock.tsx` and the new event type appears in
  `analytics_event_type`** — the audit claims it shipped but the
  §3 re-run note flags the same concern as still applicable.
- **What would need to ship.** First, verify what shipped. If the
  catch-block call to `window.webnuaTrack.formSubmitError` exists
  and `formFailed` rolls up, this item is closed. If it doesn't, ship
  the `FormBlock` catch-block invocation and confirm the rollup
  branch in the aggregation function handles `form_submit_error`.
- **Effort.** Small to verify + small to fix if needed.

### A9. Wizard `funnel_testimonials` placeholder vs published funnel
- **Current state.** Per CLAUDE.md parked decision
  ("`funnel_testimonials` renders placeholders, never AI-generated
  testimonials"). An operator who skips the testimonials step gets
  a real placeholder ("Your customer reviews will appear here") in
  the published funnel. **Status check needed.** A funnel built
  with no testimonials renders that placeholder on the public site —
  if a real client published today they would see this on their own
  funnel. Confirm whether the renderer hides the social-proof
  section entirely vs renders the placeholder vs falls back to the
  brand's `reviews` table (where GBP-pulled reviews would land if
  Phase 7 were done). The honest-placeholder posture is correct
  policy; the question is what *renders* today.
- **What would need to ship.** Verify the public renderer's behaviour
  when `funnel_testimonials` is empty AND the client's `reviews`
  table is empty (pre-Phase-7, this is every client). If the
  placeholder ships on the public page, decide whether to (a) keep
  it as-is (honesty default), (b) hide the section, or (c) wire a
  fallback to website-level `reviews` rows.
- **Effort.** Small.

---

## Section B — Important but not blocking

Items that meaningfully affect product quality but won't break the
platform for early users.

### B1. Approvals Realtime is not in the publication — ✅ DONE
- **Current state.** Per CLAUDE.md ("Approvals Realtime is not wired —
  the approval write path is Supabase but the table is not in the
  publication") and build-roadmap.md Phase 9 update. The approvals tab
  still relies on the `BUILDER_EVENT` bus + query invalidation (works
  within a single tab, single user — fine for the V1 single-operator
  team). A second operator approving from a different tab will not see
  state propagate without a manual refresh.
- **What would need to ship.** Add `website_approval_submissions` to
  the `supabase_realtime` publication (one-line migration) + a
  `RealtimeProvider` channel + an invalidate handler for the
  `['approvals']` query keys.
- **Effort.** Small.
- **✅ Resolved.** `website_approval_submissions` is in the
  `supabase_realtime` publication and `RealtimeProvider` subscribes to it
  via `postgres_changes`, so a cross-session approve / reject / submit
  propagates to the `/tickets` approvals queue and every editor
  publish-state surface without a manual refresh.
- **Merge note (B1 ↔ A3).** B1 originally shipped this as
  `0046_realtime_website_approvals.sql` + a `RealtimeProvider` handler
  doing targeted invalidations of the three approval query-key prefixes.
  A3 (funnel publish lane) landed a same-numbered superset migration
  `0046_funnel_publish_realtime.sql` (all four builder tables) and a
  unified `notifyBuilder()` fan. The B1↔A3 merge kept A3's superset
  migration (B1's duplicate-numbered file was deleted) and A3's fan —
  which **subsumes** B1's targeting, because the three reader hooks
  (`useWebsitePublishState` / `useUserPendingSubmission` /
  `useAllPendingApprovals`) are all `useBuilderQuery`-based and so
  already refetch on `BUILDER_EVENT`. B1's outcome is unchanged; only
  the mechanism merged.

### B2. Operator-facing notification surface is not built
- **Current state.** Per CLAUDE.md `client/notifications/`
  architectural note ("Client-only — the admin notification surface
  is not built") and the prototype-disagreement note on the
  negative-review modal ("If a future operator-facing 'FreshHome
  just got a 2★' surfacing lands in Cluster 6, build that as a
  sibling"). Operators rely on the tickets inbox + the dashboard
  hub for cross-client signals; there's no notification bell.
- **What would need to ship.** A sibling `admin/notifications/`
  feed reading the same `notifications` table (RLS bounds the
  cross-client rows for operators) with the operator-relevant
  triggers (sub-4★ reviews, escalated tickets, integration
  reauth-needed). Could reuse the existing `NotificationPanel`
  with an admin-tab vocabulary.
- **Effort.** Medium.

### B3. Automation editor — step timing, add/remove/reorder not wired
- **Current state.** Per CLAUDE.md `lib/automations/queries.tsx` note
  ("**Still not wired:** step *timing* (the delay pill is display-only)
  and step add/remove/reorder — those need a delay picker + a step
  insert/delete/position mutation"). Step copy is editable and
  persists; step timing + structure is read-only.
- **What would need to ship.** A delay picker component + `useUpdateAutomationStep`
  for `delay_minutes`, plus insert/delete/reorder mutations against
  `automation_steps`. Coordinates with the (deferred) execution engine.
- **Effort.** Small to medium.

### B4. Real-screenshot page thumbnails on `/website`
- **Current state.** Per CLAUDE.md `PageThumbnail` ("Pure CSS — no
  SVG, no real screenshots. A real-screenshot pipeline is V2"). Each
  page card on the website hub shows a per-page-type wireframe
  silhouette, not a render of the actual page.
- **What would need to ship.** A render-to-image pipeline
  (Playwright in a serverless function, or `@vercel/og` for a SSR'd
  thumbnail), storage bucket for snapshots, invalidation on publish.
- **Effort.** Medium.

### B5. Streaming UX for generation progress
- **Current state.** Per CLAUDE.md `GenerationSplash` ("Hardcoded
  timings approximate the real generator's latency … Not tied to
  real progress events — real streaming is a separate later session;
  until then this is an honest reassurance pattern"). The splash
  shows six staged checkmarks on a fixed timer; if the generator
  is slow the splash advances on schedule and parks; if it's fast
  it dismisses cleanly anyway.
- **What would need to ship.** SSE or a streaming response from
  `/api/generate-site`, a real progress event channel, a
  `GenerationSplash` that consumes events instead of a timer.
- **Effort.** Medium.

### B6. Page-grid stats currently V1 only (avg time + visits)
- **Current state.** Per CLAUDE.md `PageGridCard` ("V1 ships AVG TIME
  for every page type; BOUNCE / SUBMITS / FUNNEL CTR are Session B
  once `analytics_funnel_daily` gets the `page_ref` PK extension").
  Migration 0042 has now landed (per CLAUDE.md migration log), so
  the schema gap is closed; the read-layer + UI extension to render
  per-page-type variant cells is the remaining piece.
- **What would need to ship.** Extend `fetchPageTotalsByRef` or add
  a sibling reader that pulls per-page funnel rollup rows
  (`stage = 'form_submitted'`, `stage = 'engaged'`, etc.) for the
  per-page-type variant cells. Update `PageGridCard` to render
  them per the existing per-page-type plan.
- **Effort.** Small.

### B7. Prompt-quality polish remains (banned-word consolidation, shared persona, voice on offer/enhance)
- **Current state.** Per build-roadmap.md "Phase 6 polish" and the
  `prompt-audit.md` resolution log. Three sessions have shipped
  (variant enums / item shapes / accent semantics / icon library;
  offer pricing fabrication; theme contrast). Five items remain
  deferred: banned-word list consolidation across the four prompts;
  copy-vs-layout via `capabilityHints` (RESOLVED per the resolution
  log — verify); voice tone on offer + enhance prompts (currently
  voice-blind); shared base persona (cached system block reused);
  worked-example shots (RESOLVED per the resolution log).
- **What would need to ship.** Per remaining item — each is its own
  small session per the build-roadmap. None is load-bearing; they
  improve copy quality without unblocking anything.
- **Effort.** Small each (3-4 sessions total).

### B8. Test-send modals are display stubs
- **Current state.** Per CLAUDE.md `AutomationTestSendModal` ("both
  close the modal — wire to real send when backend lands") and
  `GenerateApiKeyModal` (same pattern — token doesn't persist).
  Operator-facing UI is wired; the action button is inert until
  Phase 7 (test-send) or a real API-key persistence path lands.
- **What would need to ship.** Test-send waits on Phase 7's
  Resend/Twilio; the API-key modal needs an `api_keys` table + the
  `whk_live_*` issuance + revoke flow.
- **Effort.** Small for API keys; depends on Phase 7 for test-send.

### B9. Generation-log gap for pre-client-row routes
- **Current state.** Per CLAUDE.md parked decision ("No
  `generation_log` write — the wizard runs offer generation BEFORE
  the client row exists, and `generation_log.client_id` is NOT NULL").
  Affects `generate-offer`, `enhance-field`, `enhance-offer`,
  `generate-seo`. Failures land in console only. The website + funnel
  generators DO write to `generation_log` (those run after a client
  exists).
- **What would need to ship.** Either relax `client_id` to nullable
  on `generation_log` (closes the observability gap for the wizard
  routes), or add a sister `generation_diagnostics` table without
  the FK constraint.
- **Effort.** Small.

### B10. Unread per-CTA / per-threshold scroll analytics
- **Current state.** Per analytics-audit §4.3 / §5.2 #4-N. Closed
  schema-wise: migration 0041 extended the rollup PK with
  `element_label` and added the missing scroll thresholds
  (25 / 75 / 90). Surfaced in the new `WebsiteEngagementCard`.
  Per-funnel-CTA breakdown + per-threshold scroll heatmap surfaces
  for the operator dashboard (cross-client) are not built.
- **What would need to ship.** Operator-side aggregate views over
  the existing rollup columns.
- **Effort.** Small.

### B11. Session duration + returning-visitor surface
- **Current state.** Per analytics-audit §4.1 / §4.3. Data exists
  (`session_id` persists, `visitor_id` persists in localStorage with
  analytics consent); no query derives session duration across
  pages, no UI surfaces "returning visitor". The operator gets
  per-page dwell only.
- **What would need to ship.** A `fetchSessionTotals(surfaceId)`
  read + a returning-vs-new tile on the dashboard. Within the 90-day
  raw-event retention window, no migration needed.
- **Effort.** Small.

### B12. `leads.submission_id` is written but never read (reconciliation deferred) — ✅ DONE
- **Current state.** Per analytics-audit §1.7 + §2.3. The column is
  populated by `/api/forms/submit`; no query consumes it. The
  intended reconciler ("match tracked `form_submit` count against
  actual `leads` count") does not exist.
- **What would need to ship.** A small reconciliation read or a
  scheduled job comparing `analytics_events` `form_submit` payload
  submission ids against `leads.submission_id` and flagging
  drift. Within the 90-day raw-event window.
- **Effort.** Small.
- **✅ Resolved (UI-read scope).** `useLeadDetail` now selects
  `leads.submission_id` and the lead-detail `// LEAD DETAILS` rail card
  surfaces it as a copyable monospace "Submission ID" row (via the new
  `components/shared/CopyableId.tsx`), shown only for form-captured
  leads. An operator can copy the exact id and reconcile a lead back to
  the public-form submission that created it. A *background* reconciler
  (scheduled drift check across `analytics_events`) was not built — the
  operator-facing read closes the day-to-day need; an automated job
  remains a Phase-10 observability item if drift monitoring is wanted.

### B13. `funnel_testimonials` AI-pull fallback (post-GBP integration)
- **Current state.** Per CLAUDE.md parked decision (deferred until
  Phase 7 GBP integration ships). An empty `funnel_testimonials`
  array currently renders a placeholder; with GBP wired, the
  renderer could fall back to real Google reviews.
- **What would need to ship.** Renderer change + read against
  `reviews` table when `funnel_testimonials` is empty. Trivial
  once Phase 7 lands.
- **Effort.** Small (post-Phase-7).

### B14. Editor test-submit funnel-id attribution (intentional defer)
- **Current state.** Per CLAUDE.md migration 0044 notes
  ("Editor test-submit attribution is intentionally NOT wired").
  Test submits from a funnel preview record `source_kind = 'funnel'`
  but `source_funnel_id = NULL`. Test traffic is rare in production
  analytics; the funnel-detail "booked from this funnel" counter
  correctly excludes test leads, but if test traffic ever spikes
  the count would under-count by one bucket.
- **What would need to ship.** Thread `funnelId` through
  `FormTestSubmitContext` + `submitLead`. Trigger to revisit per
  CLAUDE.md: only if test traffic starts polluting the count.
- **Effort.** Small.

### B16. AI-generated placeholder testimonials have no editor / preflight signal — ✅ DONE
- **Note.** Not in the original 2026-05-20 diagnostic; identified and
  closed in the B1/B12/B16 verify-and-finish cluster. (No B15 — the
  cluster's internal numbering.)
- **Current state (before).** The website generator emits `reviews`
  sections with AI-invented testimonials — plausible-but-fake quotes +
  author names. Nothing in the editor flagged them as AI-drafted
  placeholders, and the pre-publish preflight did not warn. Operators
  could (and did) ship sites with invented testimonials live — a
  credibility / consumer-trust risk.
- **What shipped.** (1) `lib/website/placeholder-testimonials.ts` —
  detection layer: `toSection` (`generation-stub.ts`) snapshots the
  AI-drafted review items onto `section.ai.placeholderSnapshot`
  (`SectionAIMeta` extended in `types.ts`); a live review item is an
  "unedited placeholder" when its `quote` + `authorName` +
  `authorRole` still EXACTLY match a snapshot entry. (2)
  `PlaceholderTestimonialBanner` — an amber editor nudge in
  `SectionFieldsPanel`, dismissable per-section. (3) A
  `reviews-ai-placeholder` preflight `warn` rule. (4) `/website/review`
  publish-confirm shows testimonial-specific copy + "Continue anyway" /
  "Review testimonials first" when unedited placeholders remain.
- **Scope note.** Website generation only — the funnel generator is a
  separate path and per the CLAUDE.md parked decision never AI-generates
  testimonials, so funnel reviews carry no snapshot and the detection
  safely no-ops on them.
- **Effort.** Small (~closed in cluster).

---

## Section C — Deferred by design

Items explicitly deferred to later phases or marked "later" in
CLAUDE.md parked decisions.

### C1. Phase 7 — Integrations (full)
- GBP, Meta Ads, GA4, Google Ads, Stripe, Resend, Twilio OAuth +
  API wiring. **Why deferred.** Build-roadmap.md flags this as
  owned by the human developer with real credentials, not sandbox
  work. **Trigger to revisit.** The current phase plan slots it
  next after the Phase 6 prompt-quality polish.

### C2. Phase 8 — Messaging / automation execution engine
- Scheduler + `messaging_events` send-log + suppression + anti-spam
  rules. **Why deferred.** Depends on Phase 7 (needs a working
  sender). **Trigger to revisit.** After Phase 7.

### C3. Phase 10 — Production hardening
- Domain management V2, deploy config, env/secrets policy, error
  monitoring, security review, live browser E2E pass.
  **Why deferred.** Final phase before Phase 11. **Trigger to
  revisit.** After Phases 7 + 8 + 9 close.

### C4. Phase 11 — Proof Page prospecting tool
- The admin audit → proof-page → outreach pipeline.
  **Why deferred.** CLAUDE.md explicit: "deferred until the full
  platform — front and back end — is working". **Trigger to
  revisit.** All other phases complete.

### C5. Workspace-governance capabilities (manageBilling, manageTeam, etc.)
- The 13-cap builder model doesn't include `manageBilling`,
  `manageTeam`, `deleteClient`, `viewFinancials`. **Why deferred.**
  Per CLAUDE.md parked decision, deferred to the backend pass or
  first real billing surface. **Trigger to revisit.** When real
  billing (Phase 7 Stripe) lands or when a second org tier needs
  to express divergence between owner and operator.

### C6. Client-internal role hierarchy (flat for V1)
- Every client-invited user gets `CLIENT_DEFAULTS`; no co-owner /
  member tier. **Why deferred.** Per CLAUDE.md parked decision —
  needs the workspace-governance caps (C5) first. **Trigger to
  revisit.** With C5.

### C7. Multi-operator `{operatorLabel}` token
- `src/lib/auth/explainers.ts` hardcodes "your operator" / "your
  account". **Why deferred.** Single-operator deploys only for V1.
  **Trigger to revisit.** First white-label / multi-operator
  customer.

### C8. Real-screenshot page thumbnails on `/website`
- Per CLAUDE.md `PageThumbnail`. **Why deferred.** V2; the CSS
  wireframe is good enough for the V1 hub. **Trigger to revisit.**
  Operator feedback that the silhouette is misleading vs the real
  page, or a marketing surface that needs a real thumbnail.

### C9. Streaming UX for generation progress
- Per CLAUDE.md `GenerationSplash`. **Why deferred.** Honest
  reassurance via timer is sufficient for V1; SSE is its own
  session. **Trigger to revisit.** If generation latency varies
  enough that the timer feels obviously wrong.

### C10. Section thumbnail consolidation
- Per CLAUDE.md TicketsHero/LeadsHero twin observation. **Why
  deferred.** Wait for the next touch on either. **Trigger to
  revisit.** Next session that touches one of them.

### C11. Multi-page funnel + qualification engine
- Per the funnel-step editor mode-discriminator section. The
  funnel data model supports 3 steps (landing / schedule /
  thanks) deterministic in step 3. **Why deferred.** Multi-step
  funnels with branching qualification are V2 — the V1 shape is
  a fixed two-form sequence. **Trigger to revisit.** When a
  client needs a 4+ step or branching funnel.

### C12. Audit log + dashboard tile for funnel rollup drift / completion
- Per CLAUDE.md "Funnel lead completion state — derived at read
  time, not persisted". **Why deferred.** The derivation is
  cheap and `lead_events` is in the inbox select. **Trigger to
  revisit.** If a dashboard surface needs to filter by completion
  at high cardinality (≥10k leads).

### C13. Numbered-option-row shared primitive
- `ConflictOptionRow` + `NegativeReviewActionRow` are visually
  adjacent. **Why deferred.** Two siblings is fine. **Trigger to
  revisit.** Third use → extract.

### C14. Generic `TabsBar` primitive
- `TicketTabsBar` + `LeadTabsBar` are structurally identical.
  **Why deferred.** Two is fine. **Trigger to revisit.** Third
  surface.

### C15. Per-section media-upload pipeline
- The MediaField is URL-text-only today. **Why deferred.** A real
  upload + crop UI ships with asset management. **Trigger to
  revisit.** When operators need to actually manage media (likely
  Phase 7 or 10).

### C16. Service sub-page pipeline (per-service deep landing pages)
- Not in any current phase plan; mentioned in the prompt as
  potentially deferred. **Status.** Not tracked anywhere in
  CLAUDE.md or build-roadmap; not on any roadmap. **Trigger to
  revisit.** A real customer asks for it.

### C17. 8-step wizard major upgrade
- Per CLAUDE.md parked decision: the 8-step `/clients/new/<step>`
  onboarding wizard was sunset; `CreateClientModal` is the
  canonical create flow. **Why deferred.** The quick-create modal
  is sufficient; the long wizard was over-built for V1. **Trigger
  to revisit.** A multi-page brief intake genuinely doesn't fit
  the modal.

---

## Section D — Phase plan status

| Phase | Status | Notes |
|---|---|---|
| **3b — Booking-write flows** | ✅ DONE | All three flows (reschedule / new booking / recurring) wired to live Supabase per CLAUDE.md. SMS preview is still a display stub (no messaging backend — depends on Phase 7/8). |
| **4 — Builder family backend** | ✅ DONE (PR #41 / merge `534de96`) | localStorage `publish-stub` + `draft-stub` deleted; `queries.tsx` + `mutations.ts` + `content-drafts.ts` + `snapshot.ts` + `builder-events.ts` live. **Funnel publish/approval lane shipped in A3** (`lib/funnel/mutations.ts` + `queries.tsx` + `approval.ts` + `preflight.ts`, `/funnels/[id]/review`, migration `0046`). |
| **5 — Real auth + capability + agency + billing** | ✅ DONE (PR #43 / merge `1a4705e`) | Sign-in is real, nine stores hydrate via `DataHydrationProvider`, `DevRoleSwitcher` + most `/dev/*` deleted. **Owed: systematic cross-tenant RLS validation pass — see A1.** |
| **6 — AI generation** | ✅ DONE (PR #47) — polish in progress | Website + funnel generators wired to real Claude. `generation_log` writes. Server/client metadata boundary resolved. **Owed: wizard Q&A → real `GenerationContext` — see A2.** Polish items deferred per B7. |
| **7 — Integrations** | ⏸ NOT STARTED | Largest remaining work. Owned by human dev with real creds. Unblocks reviews / campaigns / billing / messaging — see A5. |
| **8 — Automation execution engine** | ⏸ NOT STARTED | Depends on Phase 7 (needs Resend/Twilio). See A6. |
| **9 — Realtime + notification writes** | ✅ DONE | Triggers fan notifications on leads / bookings / reviews / operator ticket replies (migration 0032). `notifications` / `tickets` / `ticket_messages` in publication. Approvals Realtime now also wired — `website_approval_submissions` in publication (migration 0046, B1). |
| **10 — Production hardening** | ⏸ NOT STARTED | Domain management V2, error monitoring, security review, E2E pass — see A4 + A7. |
| **11 — Proof Page prospecting tool** | ⏸ DEFERRED INDEFINITELY | Per CLAUDE.md: deferred until full platform working. C4. |

### Sequencing constraints
- Phase 8 depends on Phase 7 (needs a sender).
- Phase 6 polish (B7) can run in parallel with anything.
- Phase 10 production hardening should run after Phase 7 + 8 so the
  monitoring sink covers the integration + sender code paths.
- Cross-tenant RLS validation (A1) blocks any production-customer
  onboarding regardless of phase. It is the only Section-A item that
  is genuinely a security-blocker.

### Effort to complete the plan
- Phase 6 polish: small × 4 sessions.
- Phase 7: large per provider × 7 providers (multi-session per).
- Phase 8: large.
- Phase 9 remainder: small (B1).
- Phase 10: medium-large.
- Phase 11: large (its own multi-cluster feature).

---

## Section E — Recommendations

Ship in this order. The judgment call: A1 (RLS validation) is the
only true blocker for *any* real customer; everything else is
ship-quality work that closes specific user-visible gaps.

### 1. Cross-tenant RLS validation pass + any fixes it surfaces (A1)
**Ship first.** This is the only Section-A item that gates onboarding
a paying customer. Per Phase 5's own "Owed" line, the policies are
written but not negative-tested. A medium-sized harness + a small
fix pass is realistic in one session. **User impact:** prevents the
"tenant A reads tenant B's leads" class of incident; nothing else
matters if this isn't solid.

### 2. Cluster the three small "verify-and-finish" items (A8 + B1 + A9 + B12)
**Ship second** as a single session-or-two cluster:
- **A8** — verify the `form_submit_error` catch-block wiring actually
  shipped per the §5.2 RESOLVED claim (small).
- **B1** — add `website_approval_submissions` to the
  `supabase_realtime` publication + `RealtimeProvider` channel
  (small migration + small client change).
- **A9** — verify the public renderer's behaviour for empty
  `funnel_testimonials` and decide the V1 posture explicitly (small).
- **B12** — the `submission_id` reconciliation read (small).

Why cluster: each is small alone; clustered is one "loose-ends close"
session worth ~400 lines total. **User impact:** removes the analytics
gaps still flagged as "verify" and gets approvals propagating live
between operator tabs.

### 3. Wizard Q&A → real `GenerationContext` decision + ship (A2)
**Ship third.** Per build-roadmap.md this is the last explicitly-listed
Phase 6 deliverable. The decision itself is more important than the
code: either thread the Q&A through, or remove the line from the
roadmap. Either way it's small. **User impact:** closes Phase 6 on
the books and removes the implicit "we're going to fix the
create-client flow" tension.

### 4. Funnel publish + approval lane (A3) — ✅ DONE
Shipped — the funnel publish + approval lane is wired in parity with
the website lane. The "your funnel changes can't actually be
published" trap is closed: a client who edits their funnel now gets
the same Publish / Submit-for-review flow as their website.

### 5. Pick A4 OR begin Phase 7 (A5) — operator/business call
**Ship fifth — needs an operator decision before scheduling.**
Two roads:
- **A4** (verify public-site hosting actually works for one real
  customer): operational, small-to-medium. Confirms the rendering /
  domain pipeline is end-to-end usable. Doesn't unblock major
  features but proves the V1 promise.
- **Phase 7 (A5)** start (likely Stripe first — billing is the most
  decoupleable, lowest-dependency provider): large, multi-session,
  but unblocks the largest set of downstream work (Phase 8, real
  campaign metrics, real reviews).

These two are the next-major-thing-to-do question. A4 is faster
ROI; Phase 7 is bigger commitment but unblocks more. Pick based on
"do we have a real customer to onboard?" (A4) or "are we focused on
finishing build before onboarding anyone?" (Phase 7).

### Items NOT in this top-5 (and why)
- **A6 (automation engine)** depends on Phase 7 — bundle with that
  road.
- **A7 (production observability)** is Phase 10 — wait until Phase 7
  has a real sink to monitor.
- **B7 (prompt polish)** is parallel-safe — run as fill-in sessions
  between bigger items.
- Everything in Section B + C — by definition not user-blocking and
  not next-three priorities.
