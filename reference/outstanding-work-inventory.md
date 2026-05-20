# Outstanding-work inventory

> Read-only diagnostic. Original pass 2026-05-20 (branch
> `claude/outstanding-work-inventory-BifMN`). Verification pass
> 2026-05-20 (branch `claude/inventory-verification-pass-{auto}`).
> **Re-rank 2026-05-20** — operator clarified A9 (invented
> testimonials are an editable-placeholder feature, not a
> credibility blocker) and B16 (the VERCEL env-var note was an
> accidental copy). Rankings updated, document refreshed.
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
  anon / service-role / per-tenant JWT pattern) that asserts:
  SELECT / INSERT / UPDATE / DELETE on every table by a tenant-B
  user against tenant-A rows returns zero rows or a permission
  error. Also assert the `anon` role is refused everywhere. Fix
  any failures found.
- **Effort.** Medium for the harness; gap-dependent for any fixes
  surfaced (likely small — the policies are written, they need
  validation more than rewriting).

### A2. Wizard Q&A → GenerationContext — VERIFIED CLOSED
- **Verification finding.** Read `CreateClientModal.tsx` +
  `site-generation-stub.ts:briefToGenerationContext` +
  `generation-prompt.ts:buildQuestionsBlock`. The current wizard
  captures `intent` (`PRIMARY_INTENT_CHIPS`) and `audience`
  (`AUDIENCE_CHIPS`) and threads them into
  `ClientBrief.primaryIntent` + `.audience`.
  `briefToGenerationContext` forwards both to `GenerationContext`,
  and `buildQuestionsBlock` emits them into the user prompt
  (`generation-prompt.ts:138-139`). The wizard's free-text `offer`
  field is mapped to `ctx.specifics`. The only `GenerationContext`
  field not populated is `avoid` (always `null`) — a reasonable
  absence for a create-client flow (no "things to avoid" opinion
  before drafted copy exists).
- **Verdict.** Closed by current design. The build-roadmap.md
  line "Wizard Q&A → real `GenerationContext` — still owed" is
  stale (it referred to the now-sunset 8-step wizard). **Action:**
  remove the line from build-roadmap.md in the next housekeeping
  pass.
- **Effort.** Trivial (one-line doc edit).

### A3. Funnel publish + approval lane is not built
- **Current state.** Per CLAUDE.md ("Funnel publish / autosave /
  approval — DEFERRED past Session 7") and build-roadmap.md
  Phase 4. The funnel-step editor saves drafts via `useAutosave`,
  but `EditorToolbar` hides both Publish actions when
  `mode.kind === 'funnelStep'`; `useUserPendingSubmission`
  short-circuits to null for funnel mode. A funnel cannot be
  published inside the app today.
- **What would need to ship.** `funnel-publish-stub.ts` parallel
  to website publish lanes, `useUserPendingFunnelSubmission`,
  `FunnelApprovalSubmission` type, funnel-shaped `runPreflight`,
  `/funnels/[id]/review` surface, route the funnel editor's
  toolbar `reviewHref` through it.
- **Effort.** Medium.

### A4. Real public-site hosting — never exercised against a real customer domain
- **Verification finding.** Queried `websites` table: all 21
  rows use `*.webnua.dev` `domain_primary` (e.g.
  `voltline.webnua.dev`, `dublin-clean-co.webnua.dev`). Zero rows
  have a custom external domain. Two rows show
  `domain_ssl_status = 'live'`, the rest are `'pending'`. The
  renderer + middleware + `ConnectDomainButton` + `/api/domains`
  Vercel integration exist (PR #50 + domain-management session)
  but the production path "customer enters their domain at their
  registrar → SSL provisions → middleware routes → tracking script
  fires → rollup populates" has never been exercised.
- **What would need to ship.** Operational: run one customer
  through the full domain-connect flow end-to-end against a real
  registrar's DNS. Add an "is this domain serving" health check
  if surface gaps emerge.
- **Effort.** Small if works first time; medium if `vercel.ts`,
  middleware, or `setCustomDomain` surfaces a gap.

### A5. Integration connect flows are stubs (Phase 7 dependency)
- **Current state.** Per CLAUDE.md `ConnectIntegrationModal`.
  Modal closes on button-press; no `integration_connections`
  table, no OAuth storage, no per-provider API surface. So GBP
  (no reviews auto-pull), Meta / Google Ads (no campaign metrics),
  Stripe (no real billing), Resend / Twilio (no email / SMS —
  automations cannot send).
- **What would need to ship.** Phase 7 in full. Human-developer-
  owned per build-roadmap.
- **Effort.** Large per provider × 7 providers.

### A6. Automation execution engine — automations never fire
- **Current state.** Per CLAUDE.md ("Phase 8 — automations are
  definitions only, nothing sends"). 21 seeded automations across
  four clients. Toggle persists; step copy persists. Nothing
  schedules, evaluates triggers, or sends.
- **What would need to ship.** Phase 8: scheduler,
  `messaging_events` send-log, suppression / priority /
  quiet-hours / frequency-cap policy.
- **Effort.** Large — depends on Phase 7.

### A7. Production observability is missing
- **Current state.** Per build-roadmap.md Phase 10 and
  analytics-audit §1.9 #3. No error-monitoring sink, no DB-side
  alert on insertion-rate drops, no Vercel-log surfacing for
  failed generation runs. Pre-client-row generation routes log
  to `console.warn` only because `generation_log.client_id` is
  NOT NULL.
- **What would need to ship.** Pick a monitoring sink, wire to
  every API route, alert on rate drops + 5xx rates. Optionally
  relax `generation_log.client_id` to nullable.
- **Effort.** Medium.

### A8. Funnel form-submit-error wiring — VERIFIED CLOSED
- **Verification finding.** All four pieces exist and wire
  together: enum value (migration 0038); rollup branch
  (`form_submit_error → 'form_failed'` in 0039 + 0040 + 0041 +
  0042); tracker API (`window.webnuaTrack.formSubmitError` at
  `webnua-track.js:679`); FormBlock catch-block invocation at
  `FormBlock.tsx:75`. Analytics-audit §5.2 RESOLVED marker is
  correct.

---

## Section B — Important but not blocking

### B1. Approvals Realtime is not in the publication
Per CLAUDE.md. Add `website_approval_submissions` to
`supabase_realtime` publication + `RealtimeProvider` channel +
invalidate handler. **Effort.** Small.

### B2. Operator-facing notification surface is not built
Per CLAUDE.md `client/notifications/` architectural note. A
sibling `admin/notifications/` feed reading the same
`notifications` table with operator triggers (sub-4★ reviews,
escalated tickets, integration reauth). **Effort.** Medium.

### B3. Automation editor — step timing, add/remove/reorder not wired
Per CLAUDE.md. Step copy is editable + persists; timing +
structure is read-only. **Effort.** Small to medium.

### B4. Real-screenshot page thumbnails on `/website`
Per CLAUDE.md `PageThumbnail`. **Effort.** Medium.

### B5. Streaming UX for generation progress
Per CLAUDE.md `GenerationSplash`. **Effort.** Medium.

### B6. Per-page-type stats — bounce / submits / funnel CTR
Per CLAUDE.md `PageGridCard`. Migration 0042 closed the schema
gap; read-layer + UI extension remain. **Effort.** Small.

### B7. Prompt-quality polish remaining items
Per build-roadmap "Phase 6 polish" + prompt-audit.md. Five
deferred items: banned-word consolidation across the four
prompts; voice tone on offer + enhance prompts (currently
voice-blind); shared base persona (cached system block reused);
copy-vs-layout via `capabilityHints` (RESOLVED — verify);
worked-example shots (RESOLVED — verify). **Effort.** Small
each, 4 sessions total, parallel-safe.

### B8. Test-send modals + API-key persistence stubs
Per CLAUDE.md. Test-send depends on Phase 7; API keys need an
`api_keys` table + the `whk_live_*` issuance + revoke flow.
**Effort.** Small for API keys; depends on Phase 7 for
test-send.

### B9. Generation-log gap for pre-client-row routes
Per CLAUDE.md parked decision. `generate-offer`, `enhance-field`,
`enhance-offer`, `generate-seo` failures land in console only
because `client_id` is NOT NULL. Either relax to nullable or
add a sister `generation_diagnostics` table. **Effort.** Small.

### B10. Unread per-CTA / per-threshold scroll analytics surfaces
Per analytics-audit §5.2. Schema closed (migrations 0041 +
0042); operator-side aggregate views remain. **Effort.** Small.

### B11. Session duration + returning-visitor surface
Per analytics-audit §4.1 / §4.3. Data exists; no query derives
session duration, no UI surfaces returning-vs-new.
**Effort.** Small.

### B12. `leads.submission_id` written but never read (reconciliation deferred)
Per analytics-audit §1.7 + §2.3. Column populated by
`/api/forms/submit`; no consumer. Scheduled reconciler. **Effort.**
Small.

### B13. GBP fallback for empty `funnel_testimonials` (post-Phase-7)
Per CLAUDE.md parked decision. With GBP wired, empty
`funnel_testimonials` could resolve to real Google reviews
instead of the current AI-generated placeholders. **Effort.**
Small (post-Phase-7).

### B14. Editor test-submit funnel-id attribution (intentional defer)
Per CLAUDE.md migration 0044 notes. Test submits from a funnel
preview record `source_kind = 'funnel'` but `source_funnel_id =
NULL`. Revisit only if test traffic pollutes the count. **Effort.**
Small.

### B15. Current CreateClientModal wizard major upgrade
- **Source.** Not tracked in CLAUDE.md or build-roadmap; raised
  in conversation. The current `CreateClientModal` (the canonical
  client-create surface that replaced the sunset 8-step wizard)
  has known UX issues that affect every client onboarding: modal
  too small for the content; visual polish lower than the rest
  of the platform; could move to a dedicated `/clients/new` page
  rather than a `Dialog`; could auto-populate fields more
  aggressively (industry defaults, brand defaults, possibly URL
  scraping or GBP lookup); end-to-end feels clunky.
- **What would need to ship.** UX redesign + engineering pass.
  Preceded by a brief design conversation: industry-default
  templates (small, deterministic), URL scraping of the
  operator-supplied business website (medium, third-party
  fragility), GBP lookup (depends on Phase 7), free-text
  "tell me about your business" with AI extraction (medium,
  prompt-design call). These are different effort levels and
  the choice shapes the rest of the work.
- **Effort.** Medium-to-large.

### B16. Invented placeholder testimonials need editor UX nudge
- **Source.** Operator clarification this pass. The Claude funnel
  generator deliberately invents specific-feeling testimonials
  ("Aoife M., Rathmines, Dublin 6" with multi-sentence quotes)
  when the operator doesn't supply real ones — verified live on
  Dublin Clean co's published funnel. **Operator stance: these
  are editable placeholders, not deceptive copy.** That stance
  is consistent with the rest of the platform's "AI drafts,
  operator edits" model.
- **Doc reconciliation.** CLAUDE.md currently carries the
  opposite policy: "When the list is empty, the funnel renders
  an explicit 'Your customer reviews will appear here'
  placeholder rather than asking Claude to invent quotes —
  fabricated testimonials are a credibility / consumer-protection
  foot-gun." CLAUDE.md should be updated in the next
  doc-housekeeping pass to reflect the actual stance: invented
  reviews ARE placeholder copy and operators are expected to
  edit them before publish.
- **What would need to ship (optional UX).** A visible "AI-drafted
  placeholder — replace before publishing" affordance on the
  generated review items in the editor, plus a preflight warning
  on the review surface if any `reviews` section still carries
  an `ai.draftedFields` marker and `funnel_testimonials` is
  empty. Both small and additive — they make the placeholder
  posture explicit rather than implicit.
- **Effort.** Small for the doc edit; small for the UX nudge.

### B17. Recurring booking rolling-window top-up job
Per CLAUDE.md `recurring-setup.tsx` parked note. A client with
an active recurring schedule will see their calendar empty out
beyond ~10 visits ahead until the schedule is recreated. Daily
cron extending the rolling window. **Effort.** Small.

### B18. Per-operator notification preferences not consulted by trigger fan-out
Per CLAUDE.md `client-notifications.ts` vs `queries.tsx` write
path. Client users have per-channel preferences (SMS / email /
push) but migration 0032's triggers do not consult them — every
fired trigger fans to every client user regardless. **Effort.**
Small (filter at fan-out in the trigger functions, or at the
feed read).

---

## Section C — Deferred by design

### C1. Phase 7 — Integrations (full).
GBP, Meta Ads, GA4, Google Ads, Stripe, Resend, Twilio OAuth +
API wiring. Human-developer-owned with real credentials.

### C2. Phase 8 — Messaging / automation execution engine.
Depends on Phase 7.

### C3. Phase 10 — Production hardening.
Domain management V2, deploy config, env/secrets, error
monitoring, security review, live browser E2E.

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

### C17. Previous 8-step `/clients/new/<step>` wizard. SUNSET.
This entry refers to the PREVIOUS multi-page wizard, deliberately
sunset. The canonical replacement is the current
`CreateClientModal`. No further work intended. The current
modal's own outstanding upgrade work is **B15** — treat
C17 + B15 as distinct.

### C18. Conversion intelligence design conversation
- **Source.** Discussed in conversation as the foundation for
  the optimization agent (auto-improving sites / forms / funnels
  based on engagement data) but the design conversation has not
  happened. Outputs would be
  `reference/conversion-intelligence-design.md`: defines what
  the optimization agent needs from the data layer; constrains
  future engagement-tracking schema decisions.
- **Trigger to revisit.** When Phase 7 + 8 produce enough live
  engagement data that "the agent could meaningfully improve
  something" is a real question — likely 1–2 onboarded customers
  with 30+ days of traffic.

---

## Section D — Phase plan status

| Phase | Status | Notes |
|---|---|---|
| **3b — Booking-write flows** | ✅ DONE | SMS preview still a display stub (Phase 7/8 dep). |
| **4 — Builder family backend** | ✅ DONE (PR #41 / `534de96`) | Funnel publish/approval explicitly deferred (A3). |
| **5 — Real auth + capability + agency + billing** | ✅ DONE (PR #43 / `1a4705e`) | RLS validation pass owed (A1). |
| **6 — AI generation** | ✅ DONE (PR #47); polish in progress | Verification: A2 closed. Build-roadmap line referring to wizard Q&A wiring is stale. Polish items B7. |
| **7 — Integrations** | ⏸ NOT STARTED | A5. |
| **8 — Automation execution engine** | ⏸ NOT STARTED | Depends on Phase 7. A6. |
| **9 — Realtime + notification writes** | ✅ DONE (mostly) | Approvals Realtime not in publication (B1). |
| **10 — Production hardening** | ⏸ NOT STARTED | A4 + A7. |
| **11 — Proof Page prospecting** | ⏸ DEFERRED INDEFINITELY | C4. |

### Sequencing constraints
- Phase 8 depends on Phase 7.
- Phase 10 should run after 7 + 8 so observability covers the
  integration + sender code paths.
- A1 (RLS validation) blocks any production-customer onboarding
  regardless of phase. Only Section-A security blocker.

---

## Section E — Recommendations (re-ranked after A9 downgrade + B16 removal)

### 1. Ship A1 (cross-tenant RLS validation pass)
**Ship first.** The only Section-A security blocker for paying
customers. Per Phase 5's own "Owed" line. **User impact:**
prevents the "tenant A reads tenant B's leads" class of incident
before any customer relies on the boundary holding.
**Effort:** medium harness + small fix pass.

### 2. Cluster the verify-and-finish items (B1 + B12 + B16)
**Ship second** as a single ~400-line session:
- **B1** — add `website_approval_submissions` to the
  `supabase_realtime` publication + `RealtimeProvider` channel.
- **B12** — the `submission_id` reconciliation read.
- **B16** — ship the "AI-drafted placeholder — replace before
  publishing" affordance on generated review items + preflight
  warning when `funnel_testimonials` is empty AND a `reviews`
  section still carries the AI marker. Plus the CLAUDE.md doc
  edit reconciling the placeholder-policy stance.

**User impact:** removes quiet operational degradations, closes
the analytics reconciliation loop, and makes the placeholder
posture on funnel reviews explicit (so an operator can't
accidentally publish without editing them).

### 3. Ship A3 (funnel publish + approval lane)
**Ship third.** Architecture mirrors website lanes; medium
session. **User impact:** removes the silent trap that funnel
edits can't actually be published.

### 4. Pick A4 OR begin Phase 7 — operator/business call
**Ship fourth — needs a product decision before scheduling.**
- **A4** (run one real customer through the domain-connect
  flow end-to-end against a real registrar). Small-to-medium,
  operational, proves the V1 promise.
- **Phase 7 (A5)** start, likely Stripe first (least-dependency
  provider). Large, multi-session, but unblocks A6 + real
  campaign / review metrics.

### 5. B15 (CreateClientModal upgrade) — design conversation first
**Ship fifth — but only after a design conversation.** The
auto-population sources (industry defaults vs URL scraping vs
GBP lookup vs free-text + AI extraction) are different effort
levels and the product call shapes the rest of the work. Don't
schedule the engineering before the call.

### Items intentionally NOT in the top-5
- **A6 (automation engine)** depends on Phase 7 — bundles with
  that road.
- **A7 (production observability)** is Phase 10 — wait until
  Phase 7 has a real sink to monitor.
- **B7 (prompt polish)** is parallel-safe — fill-in sessions
  between bigger items.
- **C18 (conversion intelligence design conversation)** —
  record now, run when Phase 7+8 produce live data.

---

## Change history

### 2026-05-20 — Re-rank pass (this commit)
- **A9 removed from Section A; B16 reframed as the carry-over
  item.** Operator clarified: invented testimonials are
  editable placeholders, not credibility blockers. The
  carry-over work is making that posture explicit in the UI
  (placeholder badge + preflight warning) and updating CLAUDE.md
  to reflect the actual stance. Captured as the new B16.
- **Old B16 (VERCEL env-var check) removed.** Was an accidental
  note copy from a separate concern.
- **Old B17 → B17** (recurring rolling-window top-up); **old
  B18 → B18** (notification preferences fan-out). No content
  change.
- **Section E re-ranked.** A1 returns to #1; the verify-and-
  finish cluster (now B1 + B12 + new B16) at #2; A3 at #3;
  A4 / Phase 7 decision at #4; B15 design conversation at #5.

### 2026-05-20 — Verification pass
- A2 closed (verified — wizard does feed prompt).
- A8 closed (verified — `form_submit_error` wired end-to-end).
- A9 promoted to critical (later downgraded — see above).
- A4 confirmed outstanding (all 21 websites on `*.webnua.dev`).
- New items added: B15 (modal upgrade), B17 (recurring top-up),
  B18 (notification prefs fan-out), C18 (conversion
  intelligence design).
- C17 reframed as SUNSET prior wizard only.

### 2026-05-20 — Original pass
First inventory. See branch
`claude/outstanding-work-inventory-BifMN` for the original
document.
