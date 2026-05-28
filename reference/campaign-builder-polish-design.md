# Campaign builder polish pass — design

> **Status:** Design ratified, not yet built. To launch the work, see
> `## Session-start prompt` at the bottom of this doc. The session split is
> 2.1 → 2.2 → 2.3; ship each as its own PR.
>
> **Why now:** the multi-step wizard at `/campaigns/launch` (Sessions 1 →
> 1.4c) is functionally complete but operationally clunky. Every campaign
> launch — even for a customer with full brand data on file — forces the
> operator through five steps × N inputs. It's the wrong primary surface
> for both day-to-day operator use AND the onboarding magic moment we
> want to build toward.

---

## Vision

**One button. Three angles. Click to launch.**

Replace the wizard as the *primary* entry to `/campaigns/launch` with a
single-screen "✦ Generate my ads" surface. The button pulls everything
we already know about the customer (brand voice, services, audience,
offer, service area, published domain), runs it through Claude, and
returns **three differentiated ad angles** the operator picks from.
Pick 1-3, click Launch, done.

The existing 5-step wizard stays as the **deep-edit surface**, reached
from any node in the post-generation visual tree OR from a tucked
`Open in classic builder →` link for power users.

When brand data is too thin to generate well, fall back to a
**conversational mini-survey** — same UX as the Pattern B
onboarding chat — that asks ONLY for the missing fields and persists
each answer to its canonical brand column. So the chat isn't a
throwaway form; it's a low-friction brand-completion tool. Next
campaign generation skips it.

This same magic-moment surface mounts on the customer dashboard
post-onboarding (once they have a published site + brand) as the
"set up your first ad campaign" step. The onboarding integration is
the V1.1 follow-up; V1 is operator-facing only.

---

## Why three angles, not one offer

Suby / Sultanic direct-response convention: every campaign should test
**multiple angles** because the "winning" angle isn't predictable from
the brief. The proven angle frame set:

| Angle | Pitch shape | When it wins |
|---|---|---|
| **Pain-led** | Lead with the customer's worst-case moment ("Burst pipe at 9pm?"). | Emergency / time-sensitive trades. |
| **Outcome-led** | Lead with the after-state the customer wants ("Sleep in a clean house this weekend."). | Lifestyle / scheduled-comfort services. |
| **Trust-led** | Lead with credibility signals ("15 years on the tools. Same-day fixed quotes."). | High-trust / high-stakes trades, repeat-purchase services. |

The Claude prompt drafts all three with distinct framings — NOT three
worded-differently versions of the same pitch. Each angle becomes its
own ad set when launched (mapping the angle = the "copy axis" from the
Session 1.4a matrix architecture). Operator picks 1, 2, or all 3 to
test in parallel.

**Why three and not five:** five is too many to pick from quickly and
dilutes Meta's optimisation signal at typical Webnua budget levels
(€30-100/day). Three feels like choice; five feels like work.

---

## The three sessions

### Session 2.1 — Generate-3-angles backbone

The minimum end-to-end magic moment for already-onboarded customers.
No chat, no tree visual yet. Just: button → 3 angles → pick → existing
orchestrator launches.

**New:**
- `lib/campaigns/brief-completeness.ts` — `getBriefCompleteness(clientId)`
  reads `brands.offer / services / audience_line / accent_color` +
  `websites.domain_primary` + `client_meta_ad_accounts` and returns
  `{ ready: true } | { ready: false, missing: BriefField[] } | { ready: false, hardBlock: 'no_published_site' | 'no_ad_account' }`.
  The hardBlock cases can't be fixed by chat — they need their own
  remediation surface (publish your site / connect Meta).
- `app/api/integrations/meta_ads/generate-angles/route.ts` — operator-only
  POST route. Reads the same brand+offer+services+audience context the
  Sonnet variant drafter already consumes (see `creative-draft.ts`),
  runs ONE Sonnet call with a system prompt that drafts three
  differentiated angle objects. **Sonnet 4.6** (matches the existing
  variant-drafter model choice — short structured copy doesn't need
  Opus). Returns `{ angles: GeneratedAngle[] }` where each angle is:
  ```ts
  type GeneratedAngle = {
    id: 'pain' | 'outcome' | 'trust';
    label: string;                    // "Pain-led" / "Outcome-led" / "Trust-led"
    rationale: string;                // one-sentence "why this angle for this customer"
    variants: AdCreativeVariant[];    // 2-3 copy variants per angle
    suggestedCtaType: string;
  };
  ```
- `lib/integrations/meta-ads/generate-angles.ts` — browser caller for the
  route (same shape as `creative-draft.ts`).
- Replace `app/campaigns/launch/page.tsx` (or split into a dispatcher).
  New single-screen surface:
  - Top: client/brand summary card (what we already know).
  - Big rust button: `✦ Generate my ads`. Disabled when hardBlocks are
    set, surfaces the matching CTA inline instead.
  - On click: in-progress splash (rust spinner + "Drafting three
    angles…"). Lands on the angle-picker screen on success.
  - **Angle-picker screen:** 3 horizontal cards (`Pain-led` /
    `Outcome-led` / `Trust-led`). Each shows the rationale + the
    variants' headlines. Operator ticks 1-3 angles. Auto-fills stock
    images from `industry-templates.ts` `stockImages` (already wired);
    multi-upload override (the input shipped in #163).
  - **Launch CTA at bottom.** Auto-resolves: country from
    `clients.service_area`, daily budget from the industry template's
    `defaultDailyBudgetCents`, run-until-stopped on, lead-form-on-Meta
    objective default. The operator can override via a `Show details ↓`
    expansion that drops in the existing targeting / budget controls
    from the wizard's Step 2 + Step 3 (inline, not as a separate step).
- **Reuse the existing orchestrator** (`launchMetaCampaign`) unchanged.
  Each picked angle becomes one ad set (one copy variant per ad set or
  multiple, operator's pick). The matrix architecture (Session 1.4a) +
  carousel format (this PR) all work as-is.

**Out of scope for 2.1:**
- Chat-based missing-field capture (Session 2.2).
- Post-launch tree visualization (Session 2.3).
- Per-angle image overrides via separate uploads (V1.1 — V1 carries one
  shared image pool across all picked angles).
- Unsplash API for stock pulls (V1.1 — V1 uses the curated
  `industry-templates.ts` set).
- Onboarding-flow integration (V1.1 — V1 is operator-facing only).

**Acceptance:** an operator with a published site, populated brand,
populated offer, and a connected Meta ad account can click two buttons
(`✦ Generate` then `Launch`) and have a 3-angle campaign live on Meta.

---

### Session 2.2 — Conversational brief-completion

When `getBriefCompleteness` returns missing fields, the button label
flips and clicking opens a chat dialog asking ONLY for what's missing.
Each answer persists to its canonical brand column.

**New:**
- `components/admin/campaigns/BriefCompletionChat.tsx` — `'use client'`
  chat dialog. Reuses the conversational onboarding chat shell
  (`/sign-up` chat — see CLAUDE.md "Conversational onboarding"). Takes
  `missing: BriefField[]` + `clientId`, asks one short question per
  missing field, persists answers as they're captured, fires
  `onComplete` when done.
- Question set per field (lock these in at session start — they're the
  customer-facing copy):
  | Field | Question | Skip behaviour |
  |---|---|---|
  | `offer` | "What's the one thing you'd put on a billboard for this business — the promise that gets the click?" | Skip → leave NULL, generator falls back to a generic promise built from `services[0]` + `audience_line`. |
  | `audience_line` | "Who's the customer you most want more of? One sentence." | Skip → fall back to `industry-templates.ts` template default. |
  | `services` (empty) | "What are your top 3 services? Comma-separated." | Skip → block (services is non-negotiable for any meaningful ad). |
  | `accent_color` | "Pick one — what's your brand colour?" (3 swatches from `industry-colors.ts` defaults + custom). | Skip → use industry default. |
- Each answer writes through to the real `brands` row column via the
  browser Supabase client (same RLS path as `/settings/brand` already
  uses).
- After the last turn auto-fires generation. No "review answers"
  intermediate step.
- Button label adapts: `✦ Generate my ads — 2 quick questions first`
  when missing > 0. Number reflects actual missing-field count.

**Hard blocks bypass the chat entirely:**
- No published site → render an "Publish your site first → /website"
  card. Don't even show the Generate button.
- No Meta ad account → render an "Connect Meta first →
  /settings/integrations" card.

**Persistence trigger to revisit:** every answer auto-saves to the
canonical column. If operators report that asking the chat questions
mid-flow feels like data is being silently changed (it IS — that's the
point), surface a small footer note: "Saved to your brand profile —
edit later at /settings/brand". V1 ships without the note; add if real
operator confusion arises.

**Out of scope for 2.2:**
- "Save my answers for review before generation" intermediate step.
  Friction is the enemy of magic.
- Asking ad-axis questions (budget / targeting / objective) in chat.
  Those have sensible defaults; pulling them into chat dilutes the
  brand-completion intent.

**Acceptance:** an operator who clicks `✦ Generate my ads` on a
customer with empty `brands.offer` and `brands.audience_line` sees a
two-turn chat, answers each in <30 seconds, and lands on the same
angle-picker screen as the 2.1 flow.

---

### Session 2.3 — Visual campaign tree + per-node edit

Replace the wizard as the primary edit surface. Once a campaign is
generated (or already exists), show its hierarchy as a tree and let the
operator click any node to edit just that piece.

**New:**
- `components/admin/campaigns/CampaignTree.tsx` — `'use client'`. Renders
  the post-generation campaign as a visual tree:
  ```
  Campaign · "Voltline · Lead-gen · 2026-05-28"
    ├── Ad set 1 · Pain-led  · 3 variants × 2 images = 6 ads
    ├── Ad set 2 · Trust-led · 2 variants × 2 images = 4 ads
    └── Ad set 3 · Carousel  · 1 variant × 5 cards   = 1 ad
  ```
  Each node is clickable. Click an ad set → opens the per-node editor.
- `components/admin/campaigns/AdSetEditorPanel.tsx` — `'use client'`.
  Focused edit panel for ONE ad set: copy variants (the existing
  variant cards from the wizard's step 4), images, targeting overrides
  (collapsed by default — most ad sets inherit campaign-level
  targeting), budget split if CBO is off (V1.1).
- `components/admin/campaigns/CampaignEditorPanel.tsx` — for campaign-
  level edits (name, objective, daily budget, schedule).
- Top-right of `/campaigns/launch` mounts the tree if a campaign is
  in-flight (mid-launch) OR if reached via `/campaigns/:id/edit` from
  an existing campaign.
- "Open in classic builder →" link tucked at the bottom — drops into
  the full 5-step wizard. Reachable but not the default.

**Pre-launch tree:**
- After generation lands on the angle-picker screen and operator picks
  angles, instead of jumping straight to launch the operator sees the
  tree shape they're about to ship. Big `Launch all →` button at the
  root. Per-node edit is optional; defaults are launch-ready.

**Post-launch tree:**
- Once a campaign is on Meta, the same tree shape renders on the
  campaign detail page reachable from `/campaigns` admin roster. Click
  any node to edit (writes through to Meta via existing pause /
  activate / update routes — campaign-level / ad-set-level edits are a
  V1.1 scope expansion; V1 supports launch-time edits only).

**Out of scope for 2.3:**
- Drag-to-reorder ad sets (no functional reason; Meta doesn't honour
  position).
- Inline campaign rename without a save button.
- Multi-select bulk edit across ad sets.
- Post-launch on-Meta edits beyond pause/activate (V1.1 — needs new
  orchestrator paths for `updateAdSet` etc.).

**Acceptance:** an operator generating a 3-angle campaign sees the
tree with 3 ad sets, clicks `Ad set 2` to edit one copy variant's
headline, clicks `Launch all`, and the campaign goes live with the
tweaked headline.

---

## Architecture decisions locked at design time

- **No new migrations.** Everything reuses existing tables:
  - `meta_campaign_launches` (Session 1.4a) captures the angle pick + a
    snapshot of the brief at launch time. The `targeting_full_spec`
    jsonb already supports arbitrary structure; angle metadata lands
    there for training-set extraction.
  - `meta_ad_creatives` per-cell rows unchanged.
  - `brands.offer / services / audience_line / accent_color` are the
    persistence target for chat answers — all already exist.
- **Sonnet 4.6, not Opus**, for `/api/integrations/meta_ads/generate-angles`.
  Same model choice as the existing `creative-draft.ts` variant
  drafter — short structured copy doesn't need Opus pricing. Anthropic
  constraint: Sonnet 4.6 takes `thinking: { type: 'enabled',
  budget_tokens }` with `max_tokens > budget_tokens`. Use
  `budget_tokens: 3000, max_tokens: 6000` (3-angle output is roughly
  2-3x the size of the variant drafter's output).
- **Banned-word list + length caps** reused verbatim from
  `creative-draft.ts`. No new prompt-engineering ground to break — the
  existing anti-corporate-speak + per-field length limits already pass
  Meta's automated ad review.
- **The chat is conversational, not modal.** Reuse the
  `/sign-up` chat shell's `ConversationView` component (or sibling).
  No "submit your answers" flow — answers stream in turn-by-turn, write
  to the DB on each turn, last turn auto-completes.
- **Pre-flight order:**
  1. Hard blocks first (no site / no ad account) — render the
     remediation card, no generation possible.
  2. Soft blocks (missing brand data) — flip button label, opens chat.
  3. Ready → generate immediately.
- **One image pool per campaign in V1.** All picked angles share the
  same image set the operator uploaded (or the auto-filled stock).
  Per-angle image overrides land in V1.1 (~one more session of work;
  needs the tree node-editor anyway).
- **`/api/integrations/meta_ads/generate-angles` rate limit:** add an
  `ai_angles_gen` config to `lib/rate-limit/index.ts` capped at
  3/client/24h. Same rationale as `ai_site_gen` /
  `ai_funnel_gen` — generation is expensive, the operator shouldn't
  burn it casually. Manual regenerate is the same call so the cap
  applies.
- **`generation_log` write:** every angle-gen call writes a row per
  per-field fallback (same pattern as `/api/generate-site`), gated on
  `clientId`. Lets operators audit "why did Sonnet pick this angle".
- **Onboarding integration is V1.1.** The customer-dashboard "Set up
  your first ad campaign" tile mounts the same Generate surface but
  with hard-coded "you're new — let's set you up" framing. Out of
  scope for the three V1 sessions; sized as one follow-up session that
  bolts the existing surface onto the onboarding dispatcher.

---

## What this replaces

- `/campaigns/launch` page-shape: from "wizard root" to "Generate root,
  wizard as edit surface". The `LaunchCampaignWizard` component stays
  in place; its mount point shifts from the page root to the
  per-node-edit panel.
- The "first campaign" friction in onboarding: V1.1 will mount the
  Generate surface directly on the customer dashboard.

## What this does NOT replace

- The orchestrator (`launch-orchestrator.ts`) is unchanged. Same Meta
  API chain; same persistence shape; same matrix architecture; same
  carousel support.
- The variant drafter (`/api/integrations/meta_ads/draft-creatives`)
  stays — used by the per-node edit panel's "Regenerate variants for
  this ad set" affordance.
- The existing image upload + carousel/single-image format toggle (PR
  #163) — reused as-is by both the Generate flow and the per-node edit
  panel.

---

## Open questions to lock at session-start

1. **Sub-account-required check:** today `/campaigns/launch` requires
   the operator to have an active sub-account picked
   (`useWorkspace().activeClientId`). The Generate flow is the same
   — confirm at session-start whether to add an "agency-mode → pick a
   client first" guard (likely yes, same shape as the existing one).
2. **Skipping the angle picker:** if Sonnet returns 3 angles and the
   operator just wants to launch all 3, can we skip the picker and go
   straight to the tree-with-Launch-all? V1 says yes — auto-select all
   three by default; operator unticks any they don't want.
3. **Refresh-mid-generation:** does refreshing the browser during the
   ~10-30s Sonnet call lose the result? V1 says yes (cheap to retry,
   no persistence overhead). Re-evaluate if operators report it.

---

## Session-start prompt

Copy-paste into a new Claude Code session to start Session 2.1:

```
Session 2.1 — Meta Ads campaign builder polish pass · generate-angles backbone.

You're picking up the design ratified in `reference/campaign-builder-polish-design.md`. PR #163 (multi-image upload + Carousel) is in-flight; build on top of it (it doesn't block this session — orchestrator changes don't collide).

YOUR TASK
Ship Session 2.1: the magic-moment surface for already-onboarded customers. One button → 3 Claude-generated angles → pick → existing orchestrator launches. NO chat (that's 2.2). NO tree visualization (that's 2.3). Just prove the end-to-end magic moment for the happy path.

REQUIRED READING (in order — CLAUDE.md is auto-loaded at session start)
1. `reference/campaign-builder-polish-design.md` — full design + the "Session 2.1" section specifically.
2. CLAUDE.md sections:
   - "Meta Ads launch wizard — Session 1.4a (matrix testing)" inventory
   - "Meta Ads templated launch (Phase 7.5 · Session 1)" inventory
   - "Funnel-offer generator — Sonnet 4.6 (not Opus), editable after generation" parked decision
   - "Worked examples — all four AI generation prompts use the same fictional anchor business" parked decision
3. Existing Sonnet drafter to mirror the prompt + JSON-output + fallback pattern:
   - `src/lib/integrations/meta-ads/creative-draft.ts`
   - `src/app/api/integrations/meta_ads/draft-creatives/route.ts`
4. Existing orchestrator + payload shapes (consume as-is):
   - `src/lib/integrations/meta-ads/launch-orchestrator.ts`
   - `src/lib/integrations/meta-ads/use-meta-ads.ts` (LaunchCampaignPayload)
5. Existing wizard (becomes the edit surface in 2.3; for now stays as the secondary path):
   - `src/components/admin/campaigns/LaunchCampaignWizard.tsx`

HARD CONSTRAINTS
- NO new migrations. Reuse `meta_campaign_launches` jsonb columns for any angle metadata; reuse `brands.offer / services / audience_line` as the source of truth for the brief.
- Sonnet 4.6 (matches creative-draft.ts), `thinking: { type: 'enabled', budget_tokens: 3000 }`, `max_tokens: 6000` (Anthropic requires max_tokens > budget_tokens).
- Reuse the banned-word list + length caps from creative-draft.ts. Don't re-invent — same prompt-engineering passes Meta's automated review.
- No `generation_log.client_id IS NOT NULL` constraint violations — pass `clientId` to the log writer.
- Add `ai_angles_gen` to `lib/rate-limit/index.ts` capped at 3/client/24h.
- Add the angle-gen route to `RATE_LIMITS` enforcement at the route entry point (same pattern as `generate-site`).
- Webnua palette only in Webnua-authored UI (CLAUDE.md design-system bright line). No shadcn role tokens beyond bg-card.
- Anti-fabrication: don't invent customer-specific claims (rating numbers, review counts, certifications). Use real brand data only; fall back to qualitative language ("honest upfront pricing") when specifics aren't on file.
- Sub-account-mode required (no agency-mode generation — same gate the existing wizard uses).

DELIVERABLES
1. `src/lib/campaigns/brief-completeness.ts` — `getBriefCompleteness(clientId)` returning the discriminated union from the design doc. Hard-block detection (no published site, no ad account) comes BEFORE soft-block (missing brand fields).
2. `src/app/api/integrations/meta_ads/generate-angles/route.ts` — operator-only POST, Sonnet 4.6, three-angle output, JSON-only, defensive parse. Same `503/400/500` shape as `/api/generate-offer`.
3. `src/lib/integrations/meta-ads/generate-angles.ts` — browser caller.
4. Rewrite `src/app/campaigns/launch/page.tsx` to dispatch on completeness state. Mount a new `GenerateAdsView` component for the happy path; keep the existing wizard reachable via `?mode=classic` query param OR an inline link (operator decision).
5. New `src/components/admin/campaigns/GenerateAdsView.tsx` — single-screen Generate surface (button → splash → angle picker → launch).
6. New `src/components/admin/campaigns/AnglePickerCards.tsx` — three angle cards with checkbox + rationale + per-angle variant preview.
7. Reuse `LaunchCampaignWizard` as-is for the "Open classic builder →" link target. Don't touch it in this session.

PROCESS
Follow the CLAUDE.md workflow rules: plan before code, confirm scope on >5 file changes, commit at every working state, run `npx tsc --noEmit` + `npx eslint` clean before each commit. Push to a fresh branch (NOT claude/carousel-multi-upload — that's PR #163's branch).

DO NOT BUILD IN 2.1
- The brief-completion chat (Session 2.2).
- The post-generation tree visualization or per-node editors (Session 2.3).
- Per-angle image overrides (V1.1).
- Onboarding-flow integration (V1.1).
- Any orchestrator changes (Sonnet drafting is upstream of the orchestrator — the existing path consumes the picked angles as ordinary copy variants).

When done, commit + create a PR + ask the operator to merge PR #163 first so the carousel + multi-upload bits are available for 2.2's chat flow and 2.3's tree.
```

That's the full plan. Sessions 2.2 + 2.3 get their own session-start
prompts once 2.1 lands — they each reference back to this doc.
