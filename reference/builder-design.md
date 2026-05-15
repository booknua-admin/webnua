# Webnua Builder — design document

> **Status:** draft for review. No code yet. This is the design pass for Cluster 5
> (the page builder + website management). The prototype is silent on a lot of
> what's below — every judgement call is flagged inline with **`[JC]`** so you
> can scan for them.

---

## 0. Scope and non-goals

**In scope for this design:** the editor that operators (and capability-gated
clients) use to build, edit, and publish website pages. The data shapes that
back it. The save / publish / approval flow. The form-to-page generation that
gets a user from "I need a page" to "here's a draft I can edit."

**Explicitly not in scope:**
- The Webnua Proof Page tool (still deferred until full-stack).
- Themes-as-marketplace, third-party section plugins, multi-tenant template
  sharing. The architecture leaves room; we don't build it.
- Real-time multi-cursor collaboration. Single-editor model with presence
  indicator only.

**This document supersedes the seven decisions in the prior recon message.**
Carry-overs from that recon are noted where used.

---

## 1. The spine — capability model

The Elementor-style point: **one editor renders for everyone; capabilities decide
which controls are live.** Not "client view" vs "admin view." Not "read-only"
vs "edit." A flat set of capability flags on the user (or per-user-per-website),
checked at every control.

### 1.1 The capability set

The capabilities below are the V1 set. Bias toward **fewer, more meaningful**
capabilities — the more atomic they get the harder it is for a non-technical
operator to reason about who can do what.

| Capability | What it gates | Default: admin | Default: client |
|---|---|---|---|
| `viewBuilder` | Seeing the editor surface at all | ✓ | ✓ |
| `editCopy` | Text fields — headline, sub, CTA label, body copy, FAQ q/a | ✓ | — |
| `editMedia` | Image swaps, uploads, gallery edits | ✓ | — |
| `editSEO` | Page title, meta description, OG image, slug | ✓ | — |
| `editLayout` | Reorder sections, toggle sections on/off | ✓ | — |
| `editSections` | Add new sections from registry, remove existing | ✓ | — |
| `editTheme` | Brand tokens (accent, fonts, voice) — site-wide effect | ✓ | — |
| `editPages` | Create / rename / delete pages, change page type | ✓ | — |
| `useAI` | Invoke AI draft / regenerate / "show me 3 alternatives" | ✓ | — (gated under copy) |
| `publish` | Promote draft → live | ✓ | — |
| `approve` | Approve another user's pending draft | ✓ | — |
| `rollback` | Restore a prior published version as the new draft | ✓ | — |
| `manageDomain` | Point custom domain, SSL, DNS verify | ✓ | — |

**Two intentional omissions:**
- No separate `commentOnPage` capability. Threaded comments aren't planned for
  V1; if added later, default-on is fine.
- No per-section-type capability (e.g. `editPricingSection`). The section
  registry could express "this section is operator-only" via metadata, but the
  user-facing capability layer stays page-level. Reasoning: per-section-type
  permissions explode the matrix and confuse operators. **`[JC]`**

### 1.2 How capabilities resolve

Today's `useRole()` evolves to:

```ts
type User = {
  id: string;
  displayName: string;
  role: 'admin' | 'client';
  capabilities: Set<Capability>;
}

useUser(): User
useCapabilities(): Set<Capability>
useCan(cap: Capability): boolean   // sugar for `caps.has(cap)`
```

`useRole()` is **not** removed — it still drives sidebar shape (which nav set,
which workspace block) and route-shell decisions. Capabilities are the
finer-grained layer that lives inside the editor.

**Capability resolution per user:**
1. Role default applies (admin → all caps; client → `viewBuilder` only).
2. Per-website overrides applied on top: a client user can have caps explicitly
   granted (or revoked) per website they have access to.

Stored shape (when backend lands):

```ts
type CapabilityGrant = {
  userId: string;
  websiteId: string | '*';   // '*' = workspace-wide (operators)
  capabilities: Capability[];
}
```

For the stub layer, this lives in the existing role-stub module as a third
"tier" — admin / client-managed (default, view-only) / client-diy (an example
client with copy+media+SEO toggled on so we can demo the real shape).

### 1.3 How capabilities gate controls in the UI

Every interactive control in the editor wraps in a capability check. Three
display modes by control:

- **Hide entirely** — for controls whose existence would confuse a user without
  the cap. Examples: `publish` button, `rollback` affordance, `manageDomain`
  panel. If you can't do it and you wouldn't ever care to know it exists,
  don't show it.
- **Disabled with tooltip** — for controls a user can see (because they're part
  of the page's visible structure) but can't action. Examples: section drag
  handles when no `editLayout`, the "Add section ↓" button when no
  `editSections`. Tooltip text comes from a per-cap explainer string.
- **Replaced with request-change affordance** — for controls a managed-tier
  client should know they can change *via Webnua*, even if not directly.
  Example: an editable copy field in a section the client doesn't have
  `editCopy` for shows as read-only with a hover affordance "Request a change
  →" that opens a prefilled ticket scoped to that field.

The third mode is the **bridge between the capability model and the existing
tickets system.** A request-change ticket is no longer a separate flow that
replaces the editor — it's the editor's overflow path for users without a
given cap. Tickets carry structured metadata: `{ websiteId, pageId, sectionId,
fieldKey?, requestedChange }` so an operator can land directly in the editor
at the right field.

This means the previously-separate "Request a change" UX from the prototype
collapses into a context-action available wherever a user lacks a cap they
might want to exercise. Cleaner, and architecturally consistent.

### 1.4 Operator UI for managing capabilities

A new tab in the existing settings shell — admin-only:

- `/settings/access` (admin tab) — lists all client users across all
  workspaces, with a per-user expansion showing per-website capability toggles.
  Reuses `SettingsPanel` + `SettingsSection` + a new `CapabilityToggleGrid`
  component (rows = websites, columns = capabilities, cells = `Switch`).

For the V1 onboarding flow, every new client user defaults to view-only. The
operator opts them into more by toggling caps in this panel. **`[JC]`** —
alternative is a "DIY tier" preset on the client subscription that grants a
fixed cap bundle, but I'd push that to V2; per-user explicit grants are more
flexible and Webnua is operator-mediated anyway.

### 1.5 Preview-as-user (operator-only)

`viewAsUser` is an operator-only **mode**, not a capability. From the editor's
top toolbar, an operator can switch the local capability set to a chosen
client user's effective set, to see the editor as that user sees it. No data
changes — purely a session-local capability override. Critical for support
("Mark says he can't change his price — let me see what he sees").

---

## 2. Data model

### 2.1 Core types

```ts
// A website belongs to a client. One client = one website (V1).
// Multiple websites per client is V2; the data shape supports it.
type Website = {
  id: string;
  clientId: string;
  name: string;          // "Voltline"
  domain: { primary: string; aliases: string[]; sslStatus: 'pending' | 'live' | 'error' };
  brand: BrandObject;
  pageOrder: string[];   // page ids in nav order
  draftVersionId: string;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

type Page = {
  id: string;
  websiteId: string;
  slug: string;             // 'home' | 'emergency-callout' | etc.
  title: string;
  type: PageType;           // see registry below
  sections: Section[];      // ordered
  seo: { title?: string; description?: string; ogImageUrl?: string };
  createdAt: string;
  updatedAt: string;
}

type PageType = 'landing' | 'schedule' | 'thanks' | 'generic';
// V1 ships landing/schedule/thanks; 'generic' is the V2 escape hatch
// for free-form pages. Data shape supports it today.

type Section = {
  id: string;
  type: SectionType;        // 'hero' | 'offer' | 'trust' | 'services' | ...
  enabled: boolean;
  data: Record<string, unknown>;   // schema validated by the registry per type
  ai?: { draftedFields: string[]; lastRegenAt?: string };
}
```

### 2.2 The section registry

Every section type registers itself with three pieces:

```ts
type SectionTypeDefinition<TData> = {
  type: SectionType;
  label: string;                   // "// HERO"
  schema: ZodSchema<TData>;        // validates the data blob
  defaultData: () => TData;        // for "Add section"
  Fields: ComponentType<{ data: TData; onChange: (next: TData) => void }>;
  Preview: ComponentType<{ data: TData; brand: BrandObject }>;
  capabilityHints?: { copyFields: string[]; mediaFields: string[] };
}
```

V1 section types (mirrors the prototype's landing-page section list):
- `hero` — eyebrow + headline + sub + CTA + hero image
- `offer` — offer card with price + included list + scarcity copy
- `trust` — trust signals row (badges, GBP rating)
- `services` — services menu (rows with name + price + duration)
- `reviews` — reviews carousel (auto-pulls from GBP integration)
- `faq` — Q&A list
- `cta` — final CTA block
- `schedulePicker` — only valid in `schedule` page type
- `thanksConfirmation` — only valid in `thanks` page type

The registry's `capabilityHints` tells the editor which fields are pure-copy vs
media-bearing, so the per-field capability check ("can this user edit this
specific field?") doesn't need to be hard-coded in each section's `Fields`.

**Why a registry, not hard-coded section components in the editor:** adding a
new section type later (V2) becomes a one-file addition, not an editor
refactor. Also makes the form-to-page generation cleaner — the AI prompt
includes the registry's section catalog.

### 2.3 The brand object

Lives on the website, prepended to every AI generation prompt, and used by
section `Preview` components for visual on-brand rendering:

```ts
type BrandObject = {
  accentColor: string;           // hex
  logoUrl: string | null;
  faviconUrl: string | null;
  voice: VoiceTone;
  audienceLine: string;          // "tradies in Perth's outer suburbs"
  industryCategory: string;      // "electrical services"
  topJobsToBeBooked: string[];   // 3–5 short phrases pulled from services
}

type VoiceTone = {
  formality: 1 | 2 | 3 | 4 | 5;     // formal ↔ casual
  urgency: 1 | 2 | 3 | 4 | 5;       // calm ↔ urgent
  technicality: 1 | 2 | 3 | 4 | 5;  // plain ↔ technical
}
```

The voice-tone sliders are **`[JC]`** — the prototype is silent. I picked three
axes because: formality dictates word choice, urgency dictates verb
selection + scarcity language, technicality dictates jargon level. These three
are largely independent. Could collapse to a single "tone" selector with
preset values ("Friendly local", "Professional", "Premium") but I think the
sliders are more honest about how AI-tuning actually works and let an
operator dial in for an unusual brand. Open to challenge.

The brand object is populated initially from the onboarding wizard
(Cluster 3's existing `voltlineBasics` etc. already cover most of it) and is
editable per-website by anyone with `editTheme`.

### 2.4 Versioning

```ts
type Version = {
  id: string;
  websiteId: string;
  status: 'draft' | 'pending_approval' | 'published' | 'archived';
  snapshot: { pages: Page[]; brand: BrandObject; pageOrder: string[] };
  createdBy: string;        // userId
  createdAt: string;
  publishedAt?: string;
  publishedBy?: string;
  notes?: string;           // optional human note on what changed
  parentVersionId?: string; // the version this draft branched from
}
```

- A website always has exactly one `draft`, optionally one `pending_approval`,
  and zero or more `published` versions in history (current = the most recent
  one).
- Draft and published live in the same table — distinguished by status.
- `archived` = old published versions; kept for rollback within the configured
  window (default 90 days; older snapshots are deleted from cold storage).
- Rollback = create a new `draft` from an archived snapshot, then publish
  through the normal flow. **No "instant rollback" button** that skips the
  approval queue; if a managed client has a publish-blocking cap, even
  operator rollbacks go through them. Open to challenge — there's an argument
  for "operator can always force-publish in an emergency" with an audit log
  entry. **`[JC]`**

---

## 3. Save, publish, approval

### 3.1 Whose draft is it?

**Single shared draft per website.** Anyone with edit caps on a website
mutates the same draft. Three rejected alternatives:

- **Per-user draft branches** — too heavy. Webnua is operator-mediated; one
  active editor at a time is the actual usage pattern.
- **Operator and client drafts kept separate, merged on publish** — same
  problem. Real merge UX is hard and we'd never need it.
- **Locking (one-editor-at-a-time)** — hard rule. Frustrating when a session
  goes idle. Soft presence indicator is enough.

**Concurrency strategy:** optimistic, last-write-wins on field. A presence
indicator in the top toolbar shows other editors currently active on the
page ("● Mark editing"). When two users edit the same field within a second
of each other, the later save wins; the earlier user sees a toast "Mark also
edited Headline · refreshed". No conflict resolution UI for V1.

### 3.2 Autosave

- Debounced 500ms after last keystroke per field.
- Server flush every 5s OR on field-blur, whichever comes first.
- Toolbar indicator: `● AUTOSAVED 8s ago` (mirrors automation editor's
  Cluster 3 pattern) — `●` rust pulse when unsaved, good-green static when
  synced.
- Optimistic UI: the editor never blocks on save. Errors surface as a toast
  and the field stays editable.

### 3.3 The three publish lanes

Capability tier determines what happens on save. **The save itself is
identical** — it's only the path to "live" that differs.

**Lane A — full publisher (`editX` + `publish`):** typical operator. Save
writes to the draft. A "Publish →" button in the top toolbar promotes the
draft snapshot to a new `published` version. Requires preflight pass.

**Lane B — editor without publish (`editX`, no `publish`):** typical opted-in
client. Save writes to the draft. The "Publish →" button is replaced with
"Submit for review →". On submit, the current draft snapshot is locked into a
`pending_approval` version, an operator gets a notification (via the existing
ticket system, category `website-approval`), and the editor enters a
read-only state for that user until the operator either:
- **Approves and publishes:** `pending_approval` → `published`, draft unlocks.
- **Edits further then publishes:** operator's edits roll into the same
  pending snapshot, then publish.
- **Rejects with comment:** snapshot is archived, draft unlocks for the
  client, comment goes back as a ticket reply.

**Lane C — view-only (`viewBuilder`, no edit caps):** the request-change
affordance from §1.3. No save flow — clicking "Request a change" on any
read-only field opens a ticket prefilled with the field reference and the
user's intended change. Operator picks up the ticket, edits in the editor,
publishes through Lane A.

### 3.4 The approval queue

A new admin surface — `/website-approvals` (or surfaced as a count badge on
the existing `/tickets` inbox under a "Website approvals" tab; **`[JC]`** I'd
prefer the latter, it reuses the inbox shell and keeps the operator's
attention surface unified). Each pending approval shows: client + page +
diff summary (just "X fields changed in Y sections" for V1, no field-level
diff view) + Approve / Edit / Reject buttons.

---

## 4. Form-to-page generation

The user's framing: "answer a few questions → get an on-brand page → land in
editor." Two flavours: **first-page-of-website** (long form, covers brand
too) and **new-page-on-existing-website** (short form, brand inherited).

### 4.1 Conversational form, not chat

Q&A cards, one question at a time, "next →" between them. **Not** a chatbot
loop. Reasoning:
- Predictable question count — user knows how far they are.
- Reuses existing wizard primitives (`BuilderStepHeader`, `BuilderField`,
  `BuilderFooterActions`).
- Easier to back-button.
- No risk of "hallucinated next question."

Free-text answers accept long input (paste-from-doc is a real path). The AI
prompt downstream uses *all* answers + the brand object + the section
registry catalog as a single prompt, returning a full populated `Page`.

### 4.2 The questions (new-page flavour)

These are the questions for an existing-website new page. **`[JC]`** — the
exact set is a design call. Starting point:

1. **What kind of page is this?** (chip select: Landing / Service / About / Contact / Custom)
   → drives `PageType` and the section template chosen.
2. **What's the one thing a visitor should do?** (chip select: Book / Call / Get a quote / Sign up / Read / Other)
   → drives the CTA section's data + headline framing.
3. **Who's coming to this page?** (chip select: Cold ad traffic / Existing customers / Referrals / Search / Mixed)
   → drives copy formality + trust-signal weighting in the AI prompt.
4. **Anything specific to say?** (free text, optional, paste-friendly)
   → free-form context.
5. **Anything to avoid?** (free text, optional)
   → negative-prompt / brand guardrails.

Five questions, the last two skippable. ~60–90s to fill in.

### 4.3 The questions (first-page-of-website flavour)

This is what the onboarding wizard already asks. **The wizard's existing
6-step flow IS this questionnaire.** No parallel implementation. See §5.

### 4.4 How "on-brand" is derived and applied

The brand object (§2.3) is populated initially from the onboarding wizard.
For every subsequent page generation:

- The AI prompt is composed from:
  1. A system preamble describing the section registry and constraints.
  2. The brand object as structured context (voice tone → translated to a
     prose paragraph; topJobsToBeBooked → rendered as a list).
  3. The 5 page-specific question answers.
  4. A snapshot of the website's other pages' headlines + CTAs (so new pages
     stay tonally consistent with what's already published).
- The AI returns a JSON object matching `Page` schema, which the system
  validates against the section registry's per-section schemas, fills in
  defaults for any missing fields, marks every AI-drafted field's `ai.drafted`
  flag, and creates the page.
- Visual on-brand-ness is automatic — section `Preview` components consume
  the brand object and render with brand tokens (color, font).

### 4.5 Generation handoff

After Q&A:
- A "// GENERATING ✦" progress card displays for 3–8s (synthetic delay during
  stub; real LLM round-trip later).
- On completion, route to the editor at the new page. Every AI-drafted field
  is marked with the existing `AIPill` ("✦ AI-DRAFTED") inline with its label.
- Per-field "show me 3 alternatives" + "↶ Original" controls are gated by
  `useAI` capability; both call the same generation endpoint with a single
  field's context.

### 4.6 What if the user has no edit caps?

If a client without `editPages` triggers form-to-page somehow, we don't show
the entry at all (button is hidden under §1.3 mode "hide entirely"). For
managed-tier clients the entire generation flow is operator-only.

---

## 5. The wizard as constrained wrapper

The onboarding wizard at `/clients/new/<step>` is **the form-to-page
generation flow for the first page of a new website**, plus the brand-object
initialisation, plus a guided edit of the AI-generated draft. It should not
be a parallel implementation of the editor.

### 5.1 What the wizard becomes, post-Cluster-5

- **Step 1 (Basics)** stays as-is — populates `BrandObject.audienceLine`,
  `industryCategory`, business name, etc.
- **Steps 2–4 (Idea / Offer / Trust)** become the §4.2-style Q&A questions
  that drive form-to-page generation for the landing page. Same primitives,
  same data, just a different visual frame.
- **The transition from Step 4 to Step 5** triggers AI generation of the full
  3-page funnel (landing + schedule + thanks).
- **Step 5 (Automations)** stays as-is — separate concern, doesn't change.
- **Step 6 (Review)** becomes the editor's review surface (§7) running in
  wizard-frame mode — same `PreflightChecklist`, same per-page review cards.
- **Step 7 (Published)** is the publish event.

After publish, the operator lands on the website hub for that client — the
editor is fully unlocked from there on.

### 5.2 The "wizard frame" mode

The editor supports a **wizard mode** flag that changes its presentation:
- Hides the section list and "Add section" UI (the wizard pre-determines
  which sections are present).
- Hides page tabs (only the landing page exists during the wizard).
- Shows only one section's `<Fields>` at a time, advancing on "Continue →".
- Replaces the autosave indicator + "Publish" button with the wizard footer
  (`BuilderFooterActions` from existing).
- Locks capabilities to a fixed set (`editCopy` + `editMedia` + `useAI`)
  regardless of the user's actual cap set, since the wizard's flow is its
  own UX contract.

This means the wizard's "preview pane" is no longer the standalone
`FunnelLandingPreview` — it's the section registry's `<Preview>` components
driven by the live draft state. **`FunnelLandingPreview` becomes a thin
adapter** that pulls draft state and dispatches to per-section previews. The
section-optional behaviour is preserved by the registry naturally (sections
with `enabled: false` or unfilled-required-fields don't render).

### 5.3 Migration cost

The wizard's existing per-step pages keep their URLs and routing — they're
the visual presentation. Their internal forms swap from one-off field
components to the section-registry's `<Fields>` components. Stub data
(`voltlineBasics`, `voltlineOffer`, etc.) becomes the seed for the
wizard-generated draft. Estimated ~6–8 file touches.

---

## 6. URL structure and routes

Carrying forward from the recon:

- `/website` (client-facing) — for a client user with `viewBuilder`, this is
  the website hub for *their* workspace. Page grid, perf snapshot, version
  history. Editor is reached by clicking a page.
- `/website/[pageId]/edit` — the editor. Same route works for admin, just
  scoped by the active workspace.
- `/website/[pageId]/review` — preflight + publish.
- `/website/new` — form-to-page generation entry.

Operator's cross-client view:
- `/websites` — admin-only matrix (one row per client × columns: page count,
  pending approvals, version status, last published). Clicking a row deep-
  links into that client's `/website` hub via a workspace-context switch
  (the existing admin client picker already handles workspace context).

**Why not `/clients/[id]/website/...`** as I proposed in the recon: putting
the editor under `/clients/[id]/...` is operator-only by URL shape, which
breaks the capability model — a client user landing in the editor needs the
URL to make sense from their perspective. The active workspace is set by the
sidebar's client picker (admin) or fixed (client); the URL stays clean.

Per-page detail uses `[pageId]` not slug — slugs are user-editable and we
don't want links to break on rename.

---

## 7. Preflight, publish, rollback

(Carried over from recon, lightly revised for the capability model.)

**Preflight** — declarative rules in `lib/website/preflight.ts` that read the
draft snapshot and return `{ rule, status: 'pass' | 'warn' | 'fail', message,
fixHref }`. Rules cover: required fields populated, integration prerequisites
(GBP for reviews section, calendar for schedule page), basic SEO (title +
description present), images sized, accessibility basics.

**Publish UI** — the review surface (Screen 43-equivalent) renders the
preflight checklist + per-page thumbnail review cards. Hard-fail rules block
publish; warnings allow override with confirmation. The "Publish" button
respects capability lane (§3.3).

**Rollback** — a "Versions" panel in the website hub lists every published
version. Clicking a version offers "Restore as draft." Restoring creates a
new draft from that snapshot; from there, the normal publish flow applies.
No instant-revert; every change goes through review.

---

## 8. Open questions and judgement calls — index

Scan-target list of every place I'm guessing. Each tagged inline above with
**`[JC]`**.

| § | Question |
|---|---|
| 1.1 | Per-section-type capabilities (`editPricingSection` etc.) — leave out, surface via section-registry metadata only? |
| 1.4 | "DIY tier" preset bundles vs purely-explicit per-cap grants? |
| 2.3 | Voice tone as 3 sliders vs 1 preset selector? |
| 2.4 | Should operator emergency rollback bypass approval lane, or always go through it? |
| 3.4 | Approval queue as new `/website-approvals` route OR a tab on existing `/tickets` inbox? (I lean inbox tab.) |
| 4.2 | Exact 5 questions for new-page Q&A — what we ask, in what order, which are required. |
| 5.2 | Should wizard mode lock to a fixed cap set or honour the operator's caps? (I went fixed for simplicity.) |
| — | Domain management UX (DNS verify, SSL pending) — designed enough to ship V1, or punt to V2 and assume one default subdomain per workspace? |
| — | Mobile editor — is the editor desktop-only V1, or do we need a mobile editor flow at all? Prototype is desktop-only. |
| — | Image storage backend — Supabase storage vs Cloudinary vs ...? Decide with the backend pass. |

---

## 9. Revised session plan

The prior recon proposed five sessions starting with a refactor. With the
capability layer as the spine, the order changes — and the count grows by
two. Each session is still commit-clean.

**Session 1 — Capability layer + user model evolution.**
- New `lib/auth/capabilities.ts` defining `Capability`, `User`,
  `useUser`/`useCapabilities`/`useCan`.
- Evolve role stub to support per-user capability grants. Three stub users:
  admin (all caps), Mark@Voltline (copy+media+SEO+useAI), Anna@FreshHome
  (view-only).
- New `<CapabilityGate>` primitive — wraps any control with hide / disable /
  request-change-affordance modes.
- New admin settings tab `/settings/access` with `<CapabilityToggleGrid>`.
- `viewAsUser` operator override in dev-tools.
- **No editor work yet.** Pure infra.

**Session 2 — Data model + section registry framework.**
- `lib/website/types.ts` — `Website`, `Page`, `Section`, `Version`,
  `BrandObject`, etc.
- `lib/website/registry.ts` — registry pattern, registration helper.
- Stub registries for three section types (hero, offer, services) — minimum
  to prove the pattern. The other six come in Session 4.
- Stub data: Voltline website (3 pages, fully populated, published), FreshHome
  website (mid-edit draft, one pending approval), KeyHero website (just
  generated, never published).

**Session 3 — Website hub + read-only mode editor shell.**
- `/website` route — page grid, version history (reuse `FunnelHistoryCard`
  shape), publish state, "+ New page" CTA gated on `editPages`.
- `/websites` route — admin-only cross-client matrix.
- `<SectionEditor>` shell — top toolbar (page tabs, autosave indicator,
  presence, publish/submit button), left rail (section list with toggles, all
  capability-gated), right pane (per-section `<Preview>` components).
- All capability gating active from session-one — Anna sees fully read-only,
  Mark sees copy+media-active, admin sees everything.

**Session 4 — Per-section editors + capability-gated field editing.**
- Build `<Fields>` + `<Preview>` for the remaining six section types
  (trust, reviews, faq, cta, schedulePicker, thanksConfirmation).
- Wire per-field capability checks (the request-change affordance is the
  payoff here for view-only users).
- AI controls (`useAI` cap) — "show me 3 alternatives", "↶ Original".

**Session 5 — Save / autosave / publish lanes / approval queue.**
- Autosave debounce + sync indicator.
- Three lanes (§3.3) — full publisher, submit-for-review, view-only.
- `/tickets` inbox gets a "Website approvals" tab; pending-approval ticket
  category surfaced.
- Approval queue actions (approve / edit / reject).

**Session 6 — Form-to-page generation.**
- Conversational Q&A flow at `/website/new`.
- Stub generation handler (synthetic delay, deterministic mock output keyed
  by question answers).
- Drop into editor with `[AI-DRAFTED]` flags on every field.

**Session 7 — Refactor onboarding wizard onto the editor engine.**
- Wizard-frame mode flag for `<SectionEditor>`.
- Step 5 onwards switches to use the registry-driven section editing.
- `FunnelLandingPreview` becomes a thin adapter or is deleted in favour of
  registry `<Preview>` rendering.
- Wizard's stub data feeds the section registry's seed.

**Session 8 — Preflight + publish UI + rollback + versions panel.**
- `lib/website/preflight.ts` rule engine.
- Review surface (Screen 43-equivalent) with checklist + per-page review
  cards.
- Versions panel in the website hub with "Restore as draft" affordance.
- Domain status indicator (UI only — actual DNS work is a backend concern).

Eight sessions total. Sessions 1 and 2 are foundational and small; 3, 4, and
5 are the meat; 6, 7, 8 are scope-completion.

**Suggested commit cadence:** session 1 lands as its own PR before any other
session starts. The cap layer touches every later session, and a working
review of it in isolation is worth the gate.

---

## 10. What this design intentionally doesn't decide

- **Backend technology choices** for the website store / version snapshots /
  AI generation calls — those belong in the backend pass.
- **Pricing of capability tiers** — whether "DIY tier" is its own SKU or a
  per-cap upsell — that's a product decision, not a builder-architecture one.
- **Theming beyond brand tokens** — custom CSS, per-page overrides, dark mode
  — V2.
- **Multi-language / i18n** — V2.
- **Analytics surfaces inside the editor** — page perf is in the website hub
  via the perf snapshot card; per-section heatmaps / A-B test slots are V2.

---

*End of document. Review notes welcome inline; flag any `[JC]` you want to
overrule and we'll fold the answer back in before sessions begin.*
