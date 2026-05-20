# Drift-recovery session inventory

Read-only audit produced in Session A of the three-session drift recovery.
Inventories what was actually built across the documentation-drift window —
without analysing or fixing anything yet.

## Boundary

The last CLAUDE.md commit that meaningfully reconciled docs with reality
before the drift was **a60b12e** — _"Docs: mark the booking-write flows
resolved + refresh the inventory"_ — landed inside PR #40
(`claude/finish-booking-wiring-hsWd9`) and merged into main at
**2026-05-18 13:17 UTC** (merge `6c6e09f`).

The next three PRs (#41, #42, #43) all merged with **zero CLAUDE.md changes
and zero reference/* changes** — the first three-PR run of total doc silence
in the project's history, and the moment the discipline visibly breaks. The
audit window is therefore **PR #41 onward**, beginning with Phase 4
(`claude/supabase-builder-backend-ACGDR`) at **2026-05-18 14:45 UTC**.

PR #55 (`claude/add-build-roadmap-4TiZo`) is included as the docs-reset
event that closes the window.

## Session inventory

| # | Date | Title / branch | Commits | Files | One-sentence summary | Phase tag | Doc updates? |
|---|---|---|---|---|---|---|---|
| 41 | 2026-05-18 | **Phase 4: Wire website/funnel builder to live Supabase reads** (`claude/supabase-builder-backend-ACGDR`) | 4 | 31 | Replaces the localStorage builder stubs (`publish-stub`, `draft-stub`, `data-stub`) with live Supabase queries + mutations for websites, funnels, drafts, versions, and approvals; adds new `queries.tsx` / `mutations.ts` / `content-drafts.ts` / `snapshot.ts` / `builder-events.ts` modules, plus migration `0023_seed_builder_websites_funnels.sql`. | phase-4 | n |
| 42 | 2026-05-18 | **Surface request-change + approval context for the operator** (`claude/supabase-builder-backend-ACGDR`, re-used branch) | 1 | 10 | Follow-up to PR #41 surfacing request-change and approval context in the operator UI; reused the same branch name as PR #41 (unusual). | phase-4 | n |
| 43 | 2026-05-18 | **Phase 5: wire real auth, capability, agency + billing to Supabase** (`claude/real-auth-billing-KG09t`) | 1 | 45 | Single 45-file commit replacing the auth + capability + agency-policy + plan-catalog + plan-assignment + invite stubs with live Supabase reads/writes; deletes `DevRoleSwitcher` and most of `/dev/*`. | phase-5 | n |
| 44 | 2026-05-19 | **AI generation API** (`claude/ai-generation-api-hxqLl`) | 18 | 32 | Despite the branch name, the contents are the Section Library uplift (Phase 0 + Phase 1 hero), element-inspector editor model, undo/redo, image upload to Supabase Storage, brand fonts, brand style-defaults, device-preview toggle, and hover toolbars replacing the left rail — AI generation itself is not in here. | cross-phase | y |
| 45 | 2026-05-19 | **Section library uplift** (`claude/section-library-uplift`) | 27 | 40 | Largest PR in the window: uplifts trust / reviews / CTA / features / FAQ / header / footer / offer / schedulePicker / thanksConfirmation sections, adds `about` / `gallery` / `contact` sections, introduces icon library + picker + `ColumnsField`, adds the `/dev/sections` review surface, adds design-variety layer to the page generator, and ships the new `CreateClientModal` flow (brief → website + funnel generators → persist). | cross-phase | n |
| 46 | 2026-05-19 | **Form builder** (`claude/debug-admin-access-6knVk`) | 11 | 27 | Branch name is misleading: this is the entire form-builder net-new feature in six phases (config model + `editForms` capability → `FormBlock` renderer + form section type → field editor → lead data layer + attachments bucket → editor test-submit → preflight rules + lead inbox image rendering), plus a Space-key form fix, a `clients_select` RLS fix, and a guard on required create-client fields. | cross-phase | n |
| 47 | 2026-05-19 | **Route create-client through real Claude API; sunset 8-step wizard** (`claude/review-dev-plan-CZkx1`) | 8 | 39 | The actual Phase 6 / AI generation wiring: sunsets the 8-step onboarding wizard, reconciles reference docs with the post-wizard codebase, wires real Claude generation behind the create-client flow, captures brand colours, tunes the generation prompt, adds Phase-2 (real auth) handoff plan, surfaces real `/api/generate-site` errors, raises `max_tokens` to 64000. | phase-6 | y |
| 48 | 2026-05-19 | **Phase 9 — notification write path + Realtime** (`claude/implement-integrations-settings-vVYjl`) | 2 | 6 | Branch name says integrations-settings; contents are migration `0032_notification_write_path.sql` (AFTER INSERT triggers on leads/bookings/reviews/ticket_messages) + `RealtimeProvider` mount + adding the three tables to the `supabase_realtime` publication. | phase-9 | partial |
| 49 | 2026-05-19 | **Reorganize admin sidebar nav; add client deletion; remove hardcoded clients** (`claude/sidebar-scroll-nav-reorganize-JnWn7`) | 6 | 36 | Removes the hardcoded `adminClients` stubs and adds a new-client onboarding flow, replaces client filter chips with a roster-sourced multi-select, wires calendar nav (prev/next/Today/Day-Week-Month), scopes agency list surfaces to the picked sub-account client, keeps the tickets inbox agency-wide, reorganises admin sidebar nav, adds client deletion. | cross-phase | n |
| 50 | 2026-05-19 | **Visitor-engagement design + public-site render pipeline + form rendering** (`claude/visitor-engagement-tracking-GkcwW`) | 6 | 22 | Branch name says visitor-engagement (only the design doc lands here); contents are mostly net-new infrastructure: public-site render pipeline for published websites and funnels, `{host}/{slug}` funnel serving with editable per-client slug, lead-capture form rendering + submission on published sites, public-form endpoint hardening + session-gated data hydration, multi-field add in the form builder. | cross-phase | partial (design doc only) |
| 51 | 2026-05-19 | **Preflight fixes + site-wide SEO editor** (`claude/fix-preview-loading-3CCCH`) | 3 | 17 | Adds a site-wide SEO editor and splits review blockers from warnings, fixes preflight false positives + double-header + in-app publish confirm, scopes the domain-normalisation migration to websites with default hosts only. | fixer | y |
| 52 | 2026-05-19 | **Visitor-engagement build + consent banner** (`claude/add-live-link-visitor-tracking-Y05qa`) | 2 | 13 | Builds visitor-engagement tracking and fixes live-site links; reworks the consent banner into a per-category opt-out popup. | cross-phase | n |
| 53 | 2026-05-19 | **Redesign agency dashboard; custom domains; form + mobile-menu fixes** (`claude/redesign-admin-dashboard-QNUhd`) | 6 | 27 | Branch name covers only the dashboard piece; contents bundle the agency-dashboard triage redesign, a "Re-trigger preview deploy" commit, mobile-header-menu fix on published sites, form submission + form-editor UX fixes + header-CTA link, smart CTA destinations + page-picker for section links, and operator-side custom-domain connect (Vercel integration). | cross-phase | y |
| 55 | 2026-05-20 | **Add build roadmap as canonical reference** (`claude/add-build-roadmap-4TiZo`) | 1 | 1 | Docs-only: adds `reference/build-roadmap.md` and the discipline-restoration note ("from this commit forward, every PR updates either CLAUDE.md, this roadmap, or both"). | docs-reset | partial (new doc, no CLAUDE.md update) |

## Phase breakdown

- **phase-4** (builder family backend): 2 PRs — #41, #42
- **phase-5** (real auth + capability + agency + billing): 1 PR — #43
- **phase-6** (AI generation): 1 PR — #47
- **phase-9** (notification writes + Realtime): 1 PR — #48
- **cross-phase** (multiple phases or out-of-roadmap features): 7 PRs — #44, #45, #46, #49, #50, #52, #53
- **fixer**: 1 PR — #51
- **docs-reset**: 1 PR — #55
- **unclear**: 0 PRs

Total: 14 PRs in the audit window. The roadmap phases account for 5 of 14
(the other 9 are cross-phase work, out-of-roadmap net-new features, or
fixers). Three significant net-new features shipped in this window
without appearing in any phase plan: the **form builder** (PR #46), the
**public-site render pipeline** (PR #50), and **visitor-engagement
tracking** (PRs #50 + #52).

## Doc-update timeline

PRs against CLAUDE.md / reference docs across the window (y = both,
partial = one but not the other, n = neither):

```
PR:  40  41  42  43  44  45  46  47  48  49  50  51  52  53  55
     y   n   n   n   y   n   n   y   p   n   p   y   n   y   p
```

The discipline drop was **abrupt**, not gradual. Three consecutive
zero-doc PRs (#41 → #42 → #43, covering Phase 4 + Phase 5) is the
visible break — this run is the first of its kind in project history,
and all prior windows had at most isolated single-PR doc gaps (#35,
#38). After the break the pattern is **alternating** rather than
recovering: y / n / n / y / partial / n / partial / y / n / y / partial.
CLAUDE.md was touched in 6 of the 14 audit-window PRs (43%), but only
3 of those were substantive sync updates (#44, #47, #53). The roadmap
PR (#55) explicitly names the loss of discipline as the trigger for
its existence.

## The arc, in plain English

Phase 3b closed cleanly with PR #40 (booking-write flows) on the
evening of 2026-05-18, with a final CLAUDE.md update marking the work
done. Phase 4 (`claude/supabase-builder-backend-ACGDR`) opened
immediately afterward, replaced the entire localStorage builder layer
with live Supabase in a four-commit PR, and shipped without doc
updates — a pattern that persisted through Phase 5 (PR #43,
single 45-file commit wiring real auth + capability + agency + billing
in one go). From that point on, PR scope visibly drifts from PR
branch name: PR #44 is named `ai-generation-api` but ships section
library uplift; PR #46 is named `debug-admin-access` but ships the
entire form-builder feature in six phases; PR #50 is named
`visitor-engagement-tracking` but actually delivers the net-new
public-site render pipeline and form submission. The real AI
generation wiring (Phase 6) does land in PR #47, where it co-ships
with a wizard sunset, brand-colour capture, and a partial CLAUDE.md
sync — but the symptom the user is recovering from ("Phase 6
currently broken") is consistent with that PR's mixed scope. The
window closes with PR #55 on 2026-05-20, which adds
`reference/build-roadmap.md` as the new canonical phase tracker and
explicitly names the discipline drop as the trigger.

## Top 5 PRs for deepest review in Session B

Ordered by architectural significance and likelihood of being the
source of current brokenness.

1. **PR #47** — `claude/review-dev-plan-CZkx1` (8 commits, 39 files).
   The actual Phase 6 / AI generation wiring; sunsets the 8-step
   onboarding wizard, swaps the deterministic generator for real
   Claude calls behind `/api/generate-site`, raises `max_tokens` to
   64000, and surfaces real errors. **Most directly relevant to the
   "Phase 6 currently broken" symptom.**
2. **PR #43** — `claude/real-auth-billing-KG09t` (1 commit, 45 files).
   Single largest concentration of risk in the window: replaces auth +
   capability + agency-policy + plan-catalog + plan-assignment + invite
   stubs with live Supabase in one commit, deletes `DevRoleSwitcher`
   and most of `/dev/*`. RLS posture for these tables has not been
   systematically validated (CLAUDE.md flags this gap separately).
3. **PR #41** — `claude/supabase-builder-backend-ACGDR` (4 commits,
   31 files). Phase 4 keystone: replaces ~960 lines of `publish-stub`
   + `draft-stub` with live Supabase queries + mutations across the
   builder family, including the autosave write path to
   `content_drafts`, the publish/approve transactions, and the
   reactivity bus (`BUILDER_EVENT`).
4. **PR #45** — `claude/section-library-uplift` (27 commits, 40
   files). Largest PR in the window by commits; uplifts most of the
   section library and adds the `CreateClientModal` brief →
   website + funnel generator pipeline that the AI generation work
   later sits on top of. If the AI generation is broken, the
   generation-pipeline entry point lives here.
5. **PR #46** — `claude/debug-admin-access-6knVk` (11 commits, 27
   files). The entire form-builder feature in six phases plus
   form-section RLS and the `clients_select` RLS fix — shipped under
   a debug-themed branch name, which means its real surface area was
   never advertised in the branch. Net-new RLS surfaces are a known
   source of cross-tenant correctness risk.
