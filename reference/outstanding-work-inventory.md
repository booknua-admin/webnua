# Outstanding-work inventory

> Read-only diagnostic. Original pass 2026-05-20 (branch
> `claude/outstanding-work-inventory-BifMN`). **Verification pass
> 2026-05-20** (branch `claude/inventory-verification-pass-{auto}`)
> — every Section-A item has been verified against actual code or
> data, ambiguous statuses resolved, new untracked items added.
> See the "Verification pass — what changed" block at the foot for a
> diff summary.
>
> Cross-references `CLAUDE.md`, `reference/build-roadmap.md`,
> `reference/analytics-audit.md`, `reference/prompt-audit.md`, and
> `reference/drift-recovery/*`.
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
  validation pass"). Policies are written across all live tables
  (clients, websites, funnels, leads, bookings, tickets,
  notifications, automations, content_drafts, capability_grants,
  agency_policy, plan_assignments, lead_attachments bucket, etc.)
  but no systematic negative test confirms tenant A cannot read or
  write tenant B's rows.
- **What would need to ship.** A test harness (Vitest + the
  anon / service-role / per-tenant JWT pattern) that asserts: SELECT
  / INSERT / UPDATE / DELETE on every table by a tenant-B user
  against tenant-A rows returns zero rows or a permission error.
  Also assert the `anon` role is refused everywhere. Fix any
  failures found.
- **Effort.** Medium for the harness; gap-dependent for any fixes
  surfaced (likely small — the policies are written, they need
  validation more than rewriting).

### A2. Wizard Q&A → GenerationContext — VERIFIED CLOSED (build-roadmap line is stale)
- **Verification finding (2026-05-20).** Read `CreateClientModal.tsx`
  + `site-generation-stub.ts:briefToGenerationContext` +
  `generation-prompt.ts:buildQuestionsBlock`. The current wizard
  **does** capture `intent` (`PRIMARY_INTENT_CHIPS` chip row) and
  `audience` (`AUDIENCE_CHIPS` chip row) and threads them into
  `ClientBrief.primaryIntent` + `ClientBrief.audience`.
  `briefToGenerationContext` forwards both onto `GenerationContext`,
  and `buildQuestionsBlock` emits them into the user prompt
  (`generation-prompt.ts:138-139`). The wizard's free-text `offer`
  field is mapped to `ctx.specifics` (line 90 of site-generation-stub)
  and the prompt surfaces it under "Specifics from the user". The
  only field of `GenerationContext` not populated is `avoid` (always
  `null`) — which is a reasonable absence for a create-client flow
  (the operator has no "things to avoid" opinion until they see
  drafted copy).
- **Verdict.** A2 is **closed by current design**. The
  build-roadmap.md line "Wizard Q&A → real `GenerationContext` —
  still owed" is **stale** (it referred to the now-sunset 8-step
  wizard, not `CreateClientModal`). **Action:** remove the line from
  build-roadmap.md as part of the next housekeeping pass.
- **Effort.** Trivial (one-line doc edit).

### A3. Funnel publish + approval lane is not built
- **Current state.** Per CLAUDE.md ("Funnel publish / autosave /
  approval — DEFERRED past Session 7") and build-roadmap.md
  Phase 4 ("Funnel publish/approval still deferred"). The
  funnel-step editor saves drafts via `useAutosave`, but
  `EditorToolbar` hides both Publish actions when
  `mode.kind === 'funnelStep'`; `useUserPendingSubmission`
  short-circuits to null for funnel mode. A funnel cannot be
  published inside the app today; if a client edits their funnel,
  the changes cannot reach the published version through the
  normal UI flow.
- **What would need to ship.** A `funnel-publish-stub.ts` parallel
  to website publish lanes, `useUserPendingFunnelSubmission`,
  `FunnelApprovalSubmission` type, funnel-shaped `runPreflight`
  (the rule engine is website-snapshot-shaped today),
  `/funnels/[id]/review` surface, route the funnel editor's
  toolbar `reviewHref` through it.
- **Effort.** Medium — most architecture mirror-ready; preflight
  rule adaptation is the open piece.

### A4. Real public-site hosting — VERIFIED untested with a real customer domain
- **Verification finding (2026-05-20).** Queried `websites` table:
  all 21 rows use `*.webnua.dev` `domain_primary` (e.g.
  `voltline.webnua.dev`, `freshhome.webnua.dev`,
  `dublin-clean-co.webnua.dev`). Zero rows have a custom external
  domain. Two rows show `domain_ssl_status = 'live'`, the rest are
  `'pending'`. `domain_aliases` is empty on every row.
- **Verdict.** The renderer + middleware + `ConnectDomainButton`
  + `/api/domains` Vercel integration all exist (PR #50 + the
  domain-management session) but **the production path from
  "customer enters their domain at their registrar → SSL provisions
  → middleware routes → tracking script fires → rollup populates"
  has never been exercised against a real registrar**. The flow
  could work; it has not been proven to.
- **What would need to ship.** Operational, not code: run one
  customer through the full domain-connect flow end-to-end against
  a real registrar's DNS. Add an "is this domain serving" health
  check on the operator side if surface gaps emerge.
- **Effort.** Small if works first time; medium if `vercel.ts`,
  the middleware, or `setCustomDomain` surfaces a gap under a
  real registrar.

### A5. Integration connect flows are stubs (Phase 7 dependency)
- **Current state.** Per CLAUDE.md `ConnectIntegrationModal` + the
  "Phase 7 — Integrations" build-phase line. Modal closes on
  button-press; no `integration_connections` table, no OAuth
  storage, no per-provider API surface. So GBP (no reviews
  auto-pull), Meta / Google Ads (no campaign metrics), Stripe
  (no real billing — invoices are stubs), Resend / Twilio
  (no email / SMS — automations cannot send).
- **What would need to ship.** Phase 7 in full. Build-roadmap
  notes this is human-developer-owned.
- **Effort.** Large per provider × 7 providers.

### A6. Automation execution engine — automations never fire
- **Current state.** Per CLAUDE.md ("Phase 8 — automations are
  definitions only, nothing sends"). The library has 21 seeded
  automations across four clients. Toggle persists; step copy
  persists. Nothing schedules, evaluates triggers, or sends.
- **What would need to ship.** Phase 8: scheduler, `messaging_events`
  send-log, suppression / priority / quiet-hours / frequency-cap
  policy (also surfaces `automationDefaults` in the agency policy
  resolver, which is typed-deferred today).
- **Effort.** Large — depends on Phase 7.

### A7. Production observability is missing
- **Current state.** Per build-roadmap.md Phase 10 and
  analytics-audit §1.9 #3. No error-monitoring sink (Sentry/Logflare
  /etc), no DB-side alert on insertion-rate drops, no Vercel-log
  surfacing for failed generation runs. Pre-client-row generation
  routes (`generate-offer`, `enhance-field`, etc.) log to
  `console.warn` only because `generation_log.client_id` is NOT
  NULL.
- **What would need to ship.** Pick a monitoring sink, wire to
  every API route, alert on rate drops + 5xx rates. Optionally
  relax `generation_log.client_id` to nullable.
- **Effort.** Medium.

### A8. Funnel form-submit-error wiring — VERIFIED CLOSED
- **Verification finding (2026-05-20).** Read
  `public/webnua-track.js` + `FormBlock.tsx` + the migration log.
  All four pieces exist and wire together: enum value (migration
  `0038_form_submit_error_enum.sql`); rollup branch
  (`form_submit_error → 'form_failed'` in migrations 0039 + 0040 +
  0041 + 0042); tracker API
  (`window.webnuaTrack.formSubmitError` exposed at
  `webnua-track.js:679`, fires `form_submit_error` event at line
  394); FormBlock catch-block invocation
  (`FormBlock.tsx:75 — api.formSubmitError(formEl, { reason })`).
- **Verdict.** A8 is **closed**. The `form_submit_error` event
  is captured, transmitted, aggregated, and the analytics-audit
  §5.2 RESOLVED marker is correct. The §3 re-run "worth tracking"
  flag was conservative-but-stale. Tracked-successful-submits =
  `form_submitted − form_failed` per the §5.2 update.

### A9. Funnel testimonials — VERIFIED CRITICAL — invented testimonials ship on published funnels
- **Verification finding (2026-05-20).** Queried published funnels
  with empty `funnel_testimonials`: Dublin Clean co
  (`21151324-…`, published 2026-05-20) has `funnel_testimonials =
  []` but its published version's step 1 snapshot contains TWO
  `reviews` sections, both with **AI-fabricated testimonials**
  ("Aoife M., Rathmines, Dublin 6" with a six-month paragraph
  quote; "Conor B., Drumcondra, Dublin 9" likewise). The Voltline
  funnel uses the deterministic seed (no `reviews` sections), so
  it does not exhibit this — but every Claude-generated funnel
  with empty testimonials will.
- **Why it shipped.** Read `generate-funnel-live.ts`. The prompt
  **explicitly instructs the model to invent reviews** when the
  brief is empty: `line 77` ("If none were supplied, populate
  generic but specific-feeling reviews — named people, suburb,
  concrete detail"), `line 120` ("If the brief carries zero
  testimonials, then and only then may you populate the reviews
  sections with credible-feeling generated reviews"), `line 355`
  (same instruction for step 2), `line 620` (the brief-context
  block emits "(none supplied — generate credible specific
  reviews; named people, suburb, concrete detail)" to the model
  directly). The prompt does the OPPOSITE of the documented
  CLAUDE.md parked policy: "**When the list is empty, the funnel
  renders an explicit 'Your customer reviews will appear here'
  placeholder** rather than asking Claude to invent quotes —
  fabricated testimonials are a credibility / consumer-protection
  foot-gun nothing else in the platform recovers from."
- **Verdict.** **CRITICAL.** Every operator who publishes a funnel
  without supplying real testimonials currently has fabricated
  customer quotes on their live funnel. This is a credibility
  risk (the customer asked for real reviews when there were none)
  and arguably a consumer-protection violation in jurisdictions
  with "no fake reviews" rules (UK CMA Digital Markets Act, EU
  Omnibus Directive, FTC endorsement guides).
- **What would need to ship.** Choose one and ship:
  1. **(Aligns with CLAUDE.md policy.)** Remove the "if none
     supplied, generate generic-but-specific" instructions in
     `generate-funnel-live.ts` (4 sites). Replace the funnel
     prompt's two `reviews` section roles with "skip this section
     if no testimonials supplied". Add a renderer fallback that
     shows the explicit "Your customer reviews will appear here"
     placeholder when the section is empty/absent.
  2. **(Alternative — recover the existing funnels.)** Plus a
     one-off migration to strip AI-fabricated reviews from
     existing published funnel snapshots where the brief carries
     `funnel_testimonials = []`.
- **Effort.** Small (prompt edits + renderer fallback) + small
  (migration). Could ship in one session.

---

## Section B — Important but not blocking

Items that meaningfully affect product quality but won't break the
platform for early users.

### B1. Approvals Realtime is not in the publication
- Per CLAUDE.md. Add `website_approval_submissions` to
  `supabase_realtime` publication + `RealtimeProvider` channel +
  invalidate handler. **Effort.** Small.

### B2. Operator-facing notification surface is not built
- Per CLAUDE.md `client/notifications/` architectural note. A
  sibling `admin/notifications/` feed reading the same
  `notifications` table with operator triggers (sub-4★ reviews,
  escalated tickets, integration reauth). **Effort.** Medium.

### B3. Automation editor — step timing, add/remove/reorder not wired
- Per CLAUDE.md. Step copy is editable + persists; timing +
  structure is read-only. Delay picker + insert/delete/position
  mutation. **Effort.** Small to medium.

### B4. Real-screenshot page thumbnails on `/website`
- Per CLAUDE.md `PageThumbnail`. Pure CSS wireframes today; a
  render-to-image pipeline is V2. **Effort.** Medium.

### B5. Streaming UX for generation progress
- Per CLAUDE.md `GenerationSplash`. Hardcoded timer today; real
  SSE / streaming is its own session. **Effort.** Medium.

### B6. Per-page-type stats — bounce / submits / funnel CTR
- Per CLAUDE.md `PageGridCard` ("V1 ships AVG TIME … BOUNCE /
  SUBMITS / FUNNEL CTR are Session B"). Migration 0042 closed
  the schema gap; read-layer + UI extension remain. **Effort.**
  Small.

### B7. Prompt-quality polish remaining items
- Per build-roadmap "Phase 6 polish" + prompt-audit.md resolution
  log. Five deferred items: banned-word consolidation across the
  four prompts; voice tone on offer + enhance prompts (currently
  voice-blind); shared base persona (cached system block reused);
  copy-vs-layout via `capabilityHints` (RESOLVED — verify);
  worked-example shots (RESOLVED — verify). **Effort.** Small each,
  4 sessions total, parallel-safe.

### B8. Test-send modals + API-key persistence stubs
- Per CLAUDE.md `AutomationTestSendModal` + `GenerateApiKeyModal`.
  Test-send depends on Phase 7 (Resend/Twilio); API keys need an
  `api_keys` table + the `whk_live_*` issuance + revoke flow.
  **Effort.** Small for API keys; depends on Phase 7 for test-send.

### B9. Generation-log gap for pre-client-row routes
- Per CLAUDE.md parked decision. `generate-offer`, `enhance-field`,
  `enhance-offer`, `generate-seo` failures land in console only
  because `client_id` is NOT NULL. Either relax to nullable or add
  a sister `generation_diagnostics` table. **Effort.** Small.

### B10. Unread per-CTA / per-threshold scroll analytics surfaces
- Per analytics-audit §5.2. Schema closed (migrations 0041 +
  0042); operator-side aggregate views over the rollup columns
  remain. **Effort.** Small.

### B11. Session duration + returning-visitor surface
- Per analytics-audit §4.1 / §4.3. Data exists (`session_id`
  persists, `visitor_id` persists); no query derives session
  duration, no UI surfaces returning-vs-new. **Effort.** Small.

### B12. `leads.submission_id` written but never read (reconciliation deferred)
- Per analytics-audit §1.7 + §2.3. Column populated by
  `/api/forms/submit`; no consumer. Scheduled reconciler comparing
  tracked submits vs leads. **Effort.** Small.

### B13. GBP fallback for empty `funnel_testimonials` (post-Phase-7)
- Per CLAUDE.md parked decision. With GBP wired, empty
  `funnel_testimonials` could resolve to real Google reviews
  instead of A9's placeholder. **Effort.** Small (post-Phase-7).

### B14. Editor test-submit funnel-id attribution (intentional defer)
- Per CLAUDE.md migration 0044 notes. Test submits from a funnel
  preview record `source_kind = 'funnel'` but `source_funnel_id =
  NULL`. Revisit only if test traffic starts polluting the count.
  **Effort.** Small.

### B15. Current CreateClientModal wizard major upgrade *(new this pass)*
- **Source.** Not tracked in CLAUDE.md or build-roadmap; raised
  in conversation. The current `CreateClientModal` (the canonical
  client-create surface that replaced the sunset 8-step wizard)
  has known UX issues that affect every client onboarding:
  modal too small for the content; visual polish lower than the
  rest of the platform; could move to a dedicated `/clients/new`
  page rather than a `Dialog`; could auto-populate fields more
  aggressively (industry defaults, brand defaults, possibly URL
  scraping or GBP lookup); end-to-end feels clunky.
- **What would need to ship.** UX redesign + engineering pass
  across the modal + the create flow. Should be preceded by a
  brief design conversation, since the auto-population sources
  are a real product decision: industry-default templates (small
  effort, deterministic), URL scraping of the operator-supplied
  business website (medium effort, third-party fragility), GBP
  lookup (depends on Phase 7), free-text "tell me about your
  business" with AI extraction (medium effort, prompt-design
  call). These are different effort levels and the choice
  shapes the rest of the work.
- **Effort.** Medium-to-large (UX redesign + engineering across
  multiple files; potentially blocked on Phase 7 for the GBP
  option).

### B16. VERCEL_TOKEN / VERCEL_PROJECT_ID / VERCEL_TEAM_ID env-var operational config *(new this pass)*
- **Source.** `build-roadmap.md` "Deployment env" footer. The
  three env vars are documented in `.env.example` but not
  confirmed set on the deployment. Without them,
  `ConnectDomainButton` saves the domain to the website row but
  does **not** register it with Vercel, so HTTPS never
  provisions — per CLAUDE.md `ConnectDomainButton`: "unset env →
  the domain is still saved, an operator finishes it in the
  Vercel dashboard." This is a quiet degradation operator-side.
- **What would need to ship.** Confirm the three vars are set on
  the production deployment. Add a startup check or operator-side
  warning if absent.
- **Effort.** Small (operational + tiny code warning).

### B17. Recurring booking rolling-window top-up job *(new this pass)*
- **Source.** CLAUDE.md `recurring-setup.tsx` parked note: "Still
  deferred: a top-up job to extend the recurring window past the
  seeded ~10 bookings." A client with an active recurring
  schedule will see their calendar empty out beyond ~10 visits
  ahead until someone re-creates the schedule. **Effort.** Small
  (a daily cron that extends the rolling window).

### B18. Per-operator notification preferences *(new this pass)*
- **Source.** CLAUDE.md `client-notifications.ts` preferences
  surface vs `notifications/queries.tsx` write path. Client users
  have per-channel notification preferences (`client_notifications.ts`,
  SMS / email / push toggles) but the trigger-driven write path
  (migration 0032) does NOT consult them — every fired trigger
  fans to every client user regardless of their stated
  preferences. The Notifications tab is a display stub. **Effort.**
  Small (filter the fan-out in the trigger functions against the
  preference table, or in the notification feed read).

---

## Section C — Deferred by design

### C1. Phase 7 — Integrations (full).
GBP, Meta Ads, GA4, Google Ads, Stripe, Resend, Twilio OAuth +
API wiring. Human-developer-owned with real credentials.

### C2. Phase 8 — Messaging / automation execution engine.
Depends on Phase 7.

### C3. Phase 10 — Production hardening.
Domain management V2, deploy config, env/secrets, error monitoring,
security review, live browser E2E.

### C4. Phase 11 — Proof Page prospecting tool.
Per CLAUDE.md: deferred until the full platform — front and back
end — is working.

### C5. Workspace-governance capabilities (manageBilling, manageTeam, deleteClient).
13-cap builder model doesn't include these. Per CLAUDE.md parked
decision, deferred to the backend pass or first real billing
surface.

### C6. Client-internal role hierarchy (flat for V1).
Per CLAUDE.md. Needs C5 first.

### C7. Multi-operator `{operatorLabel}` token.
`explainers.ts` hardcodes "your operator" / "your account". First
white-label / multi-operator customer.

### C8. Real-screenshot page thumbnails.
V2; CSS wireframe is sufficient for V1 hub.

### C9. Streaming UX for generation progress.
Honest reassurance via timer sufficient for V1.

### C10. TicketsHero + LeadsHero twin merge.
Wait for the next touch on either.

### C11. Multi-page funnel + qualification engine (V2 shapes).
3-step fixed sequence is V1.

### C12. Persisted lead-completion column.
Derived at read time today; cheap. Revisit only if dashboard
filters by completion at scale (≥10k leads).

### C13. Numbered-option-row shared primitive.
`ConflictOptionRow` + `NegativeReviewActionRow` sibling. Extract
on third use.

### C14. Generic `TabsBar` primitive.
`TicketTabsBar` + `LeadTabsBar` siblings. Extract on third use.

### C15. Per-section media upload + crop pipeline.
MediaField is URL-only today. Ships with asset management.

### C16. Service sub-page pipeline (per-service deep landing pages).
Untracked anywhere; only ships if a real customer asks for it.

### C17. Previous 8-step `/clients/new/<step>` wizard. SUNSET. *(corrected this pass)*
- This entry refers to the PREVIOUS multi-page wizard that was
  deliberately sunset. The canonical replacement is the current
  `CreateClientModal` (`components/admin/CreateClientModal.tsx`).
  No further work intended on the 8-step wizard. The current
  modal's own outstanding upgrade work lives in **B15** above —
  treat C17 + B15 as distinct.

### C18. Conversion intelligence design conversation *(new this pass)*
- **Source.** Discussed in conversation as the foundation for the
  optimization agent (auto-improving sites / forms / funnels
  based on engagement data) but the design conversation itself
  has not happened. Outputs would be
  `reference/conversion-intelligence-design.md`: defines what the
  optimization agent needs from the data layer; constrains
  future engagement-tracking schema decisions.
- **Why deferred.** No upstream blocker, but no concrete trigger
  either. Probably most useful after Phase 7 lights up real
  engagement data the agent can act on. Recorded here so it
  doesn't get forgotten.
- **Trigger to revisit.** When Phase 7 + 8 produce enough live
  engagement data that "the agent could meaningfully improve
  something" is a real question — likely 1–2 onboarded customers
  with 30+ days of traffic.

---

## Section D — Phase plan status

| Phase | Status | Notes |
|---|---|---|
| **3b — Booking-write flows** | ✅ DONE | All three flows live; SMS preview still a display stub (Phase 7/8 dep). |
| **4 — Builder family backend** | ✅ DONE (PR #41 / `534de96`) | localStorage stubs deleted; funnel publish/approval explicitly deferred (A3). |
| **5 — Real auth + capability + agency + billing** | ✅ DONE (PR #43 / `1a4705e`) | RLS validation pass owed (A1). |
| **6 — AI generation** | ✅ DONE (PR #47); polish in progress | Verification: Q&A → GenerationContext is closed (A2). Build-roadmap line referring to wizard Q&A wiring is stale. Polish items B7. |
| **7 — Integrations** | ⏸ NOT STARTED | Largest remaining work. Human-owned. A5. |
| **8 — Automation execution engine** | ⏸ NOT STARTED | Depends on Phase 7. A6. |
| **9 — Realtime + notification writes** | ✅ DONE (mostly) | Approvals Realtime not in publication (B1). |
| **10 — Production hardening** | ⏸ NOT STARTED | A4 + A7. |
| **11 — Proof Page prospecting** | ⏸ DEFERRED INDEFINITELY | C4. |

### Sequencing constraints
- Phase 8 depends on Phase 7.
- Phase 10 should run after 7 + 8 so observability covers the
  integration + sender code paths.
- A1 (RLS validation) blocks any production-customer onboarding
  regardless of phase. It is the only Section-A security blocker.

### Effort to complete the plan
- Phase 6 polish: small × 4 sessions.
- Phase 7: large per provider × 7 providers (multi-session per).
- Phase 8: large.
- Phase 9 remainder: small (B1).
- Phase 10: medium-large.
- Phase 11: large.

---

## Section E — Recommendations (revised after verification pass)

Verification re-ordered the top of the list. **A9 promotes ahead
of A1** because A9 is actively false-on-live-funnels today (every
operator without supplied testimonials has invented reviews on
their published funnel), whereas A1 is a latent risk that fires
on cross-tenant access (which can't happen yet because there's
only one operator + their seeded tenants). Both ship before any
new customer onboarding.

### 1. Ship A9 (remove fabricated testimonials + recover existing funnels)
**Ship first.** Per verification: every Claude-generated funnel
with empty `funnel_testimonials` currently has invented customer
reviews on the live funnel, directly contradicting the CLAUDE.md
parked policy. The prompt edits are 4 sites in
`generate-funnel-live.ts` + a renderer fallback + a one-off
migration to strip AI reviews from the two already-published
funnel snapshots that have them (Dublin Clean co; Voltline is
clean because it's the seed). **User impact:** removes the
credibility / consumer-protection-violation exposure on every
live funnel. **Effort:** small, one session.

### 2. Ship A1 (cross-tenant RLS validation pass)
**Ship second.** Per Phase 5's own "Owed" line. The harness +
any fixes it surfaces. **User impact:** prevents the "tenant A
reads tenant B's leads" class of incident before any customer
relies on the boundary holding. **Effort:** medium harness +
small fix pass.

### 3. Cluster the verify-and-finish items (B1 + B12 + B16)
**Ship third** as a single session:
- **B1** — add `website_approval_submissions` to the
  `supabase_realtime` publication + `RealtimeProvider` channel
  (small migration + small client change).
- **B12** — the `submission_id` reconciliation read (small).
- **B16** — confirm `VERCEL_*` env vars are set on the production
  deployment + add a startup warning if absent (small).

A2 (closed) and A8 (closed) drop off the recommendation list.
A9 used to be in this cluster; it has been promoted to #1.

**Effort.** ~400 lines total. **User impact:** removes the
quiet operational degradations + closes the analytics
reconciliation loop.

### 4. Ship A3 (funnel publish + approval lane)
**Ship fourth.** Architecture mirrors website lanes; medium
session. **User impact:** removes the silent trap that funnel
edits can't actually be published.

### 5. Pick A4 OR begin Phase 7 — operator/business call
**Ship fifth — needs a product decision before scheduling.** Two
roads:
- **A4** (run one real customer through the domain-connect flow
  end-to-end against a real registrar). Small-to-medium,
  operational, proves the V1 promise.
- **Phase 7 (A5)** start, likely Stripe first (least-dependency
  provider). Large, multi-session, but unblocks A6 + real
  campaign / review metrics.

### Items intentionally NOT in this top-5
- **A6 (automation engine)** depends on Phase 7 — bundle with
  that road.
- **A7 (production observability)** is Phase 10 — wait until
  Phase 7 has a real sink to monitor.
- **B7 (prompt polish)** is parallel-safe — fill-in sessions
  between bigger items.
- **B15 (CreateClientModal upgrade)** is real work but needs a
  design conversation first; don't schedule the engineering
  before the product call.
- **C18 (conversion intelligence design conversation)** — record
  now, run later when Phase 7+8 produce live data.

---

## Verification pass — what changed

Diff from the original inventory (2026-05-20, branch
`claude/outstanding-work-inventory-BifMN`):

### Status moves
- **A2 closed.** Verified: the wizard's intent + audience + offer
  + business details DO flow into the prompt via
  `briefToGenerationContext`. Build-roadmap line is stale.
- **A8 closed.** Verified: `form_submit_error` event type +
  aggregation + tracker API + `FormBlock` catch-block invocation
  all shipped (migrations 0038–0042 + `webnua-track.js:679` +
  `FormBlock.tsx:75`). The `§3` re-run flag was conservative-stale.
- **A9 promoted to critical with new context.** Verified by
  reading the funnel-generation prompt: the prompt actively
  *instructs* the model to invent testimonials when none are
  supplied (4 sites in `generate-funnel-live.ts`), and Dublin
  Clean co's published funnel snapshot confirms two invented
  testimonials are live. This is the OPPOSITE of the documented
  CLAUDE.md policy. Promoted to Section A and to the #1
  recommendation slot.
- **A4 confirmed as outstanding.** Verified by querying the
  `websites` table: zero rows have a non-webnua.dev domain.
  The custom-registrar pipeline has never been exercised.

### New items added
- **B15** — current `CreateClientModal` wizard major upgrade
  (UX redesign + auto-population sources design call).
- **B16** — VERCEL_TOKEN/PROJECT_ID/TEAM_ID env-var operational
  config confirmation.
- **B17** — recurring booking rolling-window top-up cron.
- **B18** — per-operator notification preferences not consulted
  by the trigger fan-out.
- **C18** — conversion intelligence design conversation
  (recorded so it doesn't get forgotten).

### Categorization fixed
- **C17 reframed.** Now explicitly the SUNSET previous 8-step
  wizard; the current modal's upgrade work moved to its own
  entry (B15). Prevents future confusion that C17 covers the
  current wizard's outstanding work.

### Code-comment sweep
- `grep -rIn "TODO|FIXME|XXX|HACK" src/ public/ supabase/`
  returned zero results. No untracked code TODOs.

### Open ambiguities still flagged
- **B7** — the prompt-audit resolution log claims "copy-vs-layout
  via `capabilityHints`" + "worked-example shots" both RESOLVED.
  Inventory carries them with "verify" qualifiers; a future pass
  should confirm by reading the prompt files at the cited paths.

### Recommendation-list changes
- **A9 promoted to #1** (was a Section-A item but not in top-5).
- **A2 + A8 removed from the list** (both closed).
- **A1 demoted to #2** (was #1).
- **B15 + C18 added as "intentionally not in top-5" items** so
  they don't disappear.
