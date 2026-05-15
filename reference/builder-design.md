# Webnua Builder — design document

> **Status:** revised after first review. No code yet. This is the design
> pass for Cluster 5 (the page builder + website management). All judgement
> calls from the initial draft have been resolved inline in their sections;
> §8 lists what's still genuinely open (the form-to-page question set in
> §4.2 is the big one — its own design pass before Session 6). The prototype
> is silent on most of what's below; this document is the spec.

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

**V1 boundaries (explicit):**
- **Editor is desktop-only.** Mobile/tablet editor flow is V2.
- **Output pages MUST render responsive** across desktop / tablet / mobile.
  Non-negotiable. The editor's preview-device tabs (existing
  `PreviewPanelBar`) reflect this, and the preflight rule engine (§7)
  validates responsive basics before publish.
- **One default subdomain per workspace** V1 (e.g.
  `<workspace>.webnua.app`). Custom domain management — DNS verify, SSL
  pending, alias mapping — is V2. The `Website.domain` field (§2.1) is
  shaped to support custom domains so the data layer doesn't need rework.
- **Image storage backend** is deferred to the backend design pass.

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
  permissions explode the matrix and confuse operators.

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
operator opts them into more by toggling caps in this panel. Per-user
explicit grants are V1; "DIY tier" preset bundles are V2.

**Forward-compat note:** the `CapabilityGrant` shape from §1.2
(`{ userId, websiteId, capabilities }`) does not preclude a future
named-preset layer (e.g. adding `presetId?: string` that resolves to a cap
bundle server-side, with `capabilities` becoming the resolved override on
top). We don't build that V1, but the data shape stays additive-friendly so
a preset layer can land later without migrating existing grants.

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

The voice-tone data model is three independent 1–5 sliders. The three axes
are largely independent (formality → word choice; urgency → verb selection +
scarcity language; technicality → jargon level), and voice tone feeds every
AI generation — a bad setting poisons every page.

**The default UI is not raw sliders.** Voice tone is set via a preset
picker — three named options that map to fixed slider triples:

- **Friendly local** — casual, low-urgency, plain language (default for
  service businesses).
- **Professional** — middle-of-road formality, low-urgency, light-technical.
- **Premium trade** — semi-formal, low-urgency, light-technical with brand
  confidence.

A "Customise →" affordance reveals the three raw sliders for anyone with
`editTheme` who needs to dial in something unusual. **Stored value is always
the slider triple** regardless of how it was set — presets are
storage-equivalent to their slider state, no separate preset id persists.

Reasoning: the audience is non-technical; surfacing three raw sliders as the
default is unusable, and a bad voice-tone setting poisons every page the AI
generates. Presets cover the realistic majority of cases; sliders are the
escape hatch.

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
  approval queue under normal operation; rollbacks ride the same lanes as
  any other publish.

**Break-glass force-publish.** A separate `forcePublish` capability
(admin-only, granted alongside `publish` by default but split so it can be
revoked independently) allows bypassing the approval lane for emergency fixes
— "client's live site is broken and the approver is asleep" is a real case
a managed product has to handle. Surfaced as a separate confirm-twice action
under a "Force publish (skip approval)" menu — *not* the default Publish
button. Every force-publish writes an audit log entry with actor, timestamp,
and a required free-text reason. The audit log is visible to all admins in
`/settings/access` and to the affected client user as a read-only entry in
their version history.

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

**Submit-mid-edit edge case (Lane B client submits while operator is
editing).** This will happen — two stub users will hit it in Session 5.
Answer: the `pending_approval` snapshot captures **the current server-side
draft state at submit-time**, which by definition includes every autosave
that has flushed (the 5s server flush from §3.2). Any field-edit still
inside the operator's local 500ms debounce window stays in the operator's
editor as unsaved local state and is *not* in the submitted snapshot.

Because Lane B keeps the operator with edit access on the resulting pending
version (§3.3 — operator can "edit further then publish"), the operator's
next autosave rolls those locally-pending edits forward into the same
pending snapshot. **Net effect: nothing is lost.** The only observable thing
is that the snapshot moment is server-time, not operator-keystroke-time, and
the operator sees a toast "Mark submitted for review · your in-flight edits
are still in this draft."

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

A new "Website approvals" tab on the existing `/tickets` inbox (not a
separate route). Reuses the inbox shell and keeps the operator's attention
surface unified. Each pending approval shows: client + page + diff summary
(just "X fields changed in Y sections" for V1, no field-level diff view) +
Approve / Edit / Reject buttons.

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

> **This section is a sketch, not the locked spec.** The exact questions,
> their order, their required/optional flags, the chip-vs-free-text choice
> per question, and the AI prompt construction that consumes them are *the*
> feature determining whether generated pages are any good — which makes
> this the single highest-leverage design decision in Cluster 5. Question 4
> below ("anything specific to say?") is silently doing the heavy content
> lifting and "free text, optional" undersells it. **Before Session 6, this
> gets its own focused design pass in a sibling doc**
> (`reference/builder-generation-design.md`). The sketch below is the
> starting draft for that pass, nothing more — don't build to it.

Starting-draft questions for an existing-website new page:

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
  own UX contract. (Wizard mode is operator-initiated during onboarding and
  doesn't honour the operator's full cap set — the UX flow is the contract,
  not the user's caps.)

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

## 8. Open questions — index

Resolved decisions live in their respective sections above. This list is
only what's still genuinely open after the review pass.

| § | Question | Status |
|---|---|---|
| 4.2 | The exact question set for form-to-page generation, in what order, which are required, free-text vs chip, and the AI prompt construction that consumes them. | **Deferred to its own design pass** in `reference/builder-generation-design.md` before Session 6. Highest-leverage single decision in this cluster. |
| 10 | Section registry schema evolution — how to handle changes to an existing section type's data shape when live pages and archived snapshots hold the old shape. | Flagged in §10 as a known sharp edge. Solve in the backend design pass. |
| — | Image storage backend — Supabase storage vs Cloudinary vs ... | Defer to backend pass. |

Closed in this revision:
- §1.1 — page-level caps only; per-section-type permissions surfaced via
  section-registry metadata, not user caps.
- §1.4 — per-user explicit grants V1; preset bundles V2; `CapabilityGrant`
  shape stays preset-compatible.
- §2.3 — preset picker is the default UI; sliders behind "Customise →";
  data model is always the slider triple.
- §2.4 — through-the-lane rollback; separate audit-logged `forcePublish`
  capability as break-glass.
- §3.4 — approval queue as a tab on `/tickets`, not its own route.
- §5.2 — wizard mode locks to a fixed cap set, ignoring user caps.
- Domain management — V2; one default subdomain per workspace V1.
- Mobile — editor desktop-only V1; output pages MUST be responsive.

---

## 9. Revised session plan

The prior recon proposed five sessions starting with a refactor. With the
capability layer as the spine, the order changes — and the count grows by
two. Each session is still commit-clean.

**Session 1a — Capability model + `<CapabilityGate>`.** The blocking infra.
- `lib/auth/capabilities.ts` defining `Capability`, `User`, `CapabilityGrant`,
  `useUser`/`useCapabilities`/`useCan`.
- Evolve role stub to support per-user capability grants. Three stub users:
  admin (all caps including `forcePublish`), Mark@Voltline
  (copy+media+SEO+useAI), Anna@FreshHome (view-only).
- `<CapabilityGate>` primitive — wraps any control with hide / disable /
  request-change-affordance modes. Per-cap explainer strings table.
- **No editor work, no new routes, no settings UI.** Purely the layer every
  later session depends on. Lands as its own PR; reviewed in isolation
  before 1b starts.

**Session 1b — Operator UI for caps + `viewAsUser`.**
- New admin settings tab `/settings/access` with `<CapabilityToggleGrid>`
  (rows = users × websites, columns = capabilities, cells = `Switch`).
- `viewAsUser` operator-only mode wired into the dev-tools floating bar
  (alongside the existing role switcher, which the cap layer evolves rather
  than replaces — role still drives sidebar shape per §1.2).
- The force-publish audit log surface (read-only list in `/settings/access`).
- Depends on 1a being merged first.

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

Nine sessions total (1a + 1b + 2–8). Sessions 1a, 1b, and 2 are foundational;
3, 4, and 5 are the meat; 6, 7, 8 are scope-completion.

**Suggested commit cadence:** session 1a lands as its own PR before anything
else starts. The cap layer is the spine, touches every later session, and
deserves a working review in isolation. 1b can land in the same PR as 2 if
the cap-layer surface area looks small in practice, but default is its own
PR too.

---

## 10. What this design intentionally doesn't decide — and known sharp edges

**Doesn't decide:**

- **Backend technology choices** for the website store / version snapshots /
  AI generation calls — those belong in the backend pass.
- **Pricing of capability tiers** — whether "DIY tier" is its own SKU or a
  per-cap upsell — that's a product decision, not a builder-architecture one.
- **Theming beyond brand tokens** — custom CSS, per-page overrides, dark mode
  — V2.
- **Multi-language / i18n** — V2.
- **Analytics surfaces inside the editor** — page perf is in the website hub
  via the perf snapshot card; per-section heatmaps / A-B test slots are V2.

**Known sharp edges (flagged, not solved):**

- **Section registry schema evolution.** The registry pattern in §2.2 is
  great for *adding* section types. It says nothing about *changing* an
  existing section type's data schema once live pages and archived version
  snapshots are populated with the old shape. Real cases this will hit:
  renaming a field (`headline` → `title`), splitting a field in two (a
  single `cta` field becoming `ctaPrimary` + `ctaSecondary`), deprecating a
  field, tightening a previously-optional field to required. We don't solve
  this V1, but the backend design pass should include either schema
  versioning at the section level (`Section.schemaVersion: number` with
  per-version migration functions) or a "shadow registry" pattern where the
  old shape stays readable indefinitely. Flagging it now so we don't ship
  V1 and then discover we can't rename a field without rewriting every
  archived snapshot.
- **AI generation cost / rate limits at scale.** Every page generation is an
  LLM round-trip; every "show me 3 alternatives" is another. At one client
  this is invisible; at fifty clients regenerating headlines all afternoon
  it's a real cost line. The cap layer at least gates who can trigger
  generation (`useAI`), but per-user/per-workspace generation budgets are a
  V2 concern surfaced here so the backend pass plans for metering from the
  start.
- **Brand-tone drift across pages.** Voice tone is set per-website but the
  AI may still produce tonally inconsistent copy across pages over time as
  the model drifts or the prompt context window fills. No automated drift
  detection in V1; operators eyeball it. If this becomes a real problem,
  the answer is a per-website "tone reference" snippet (a frozen passage
  the operator hand-tunes) that gets prepended to every generation prompt.

---

*End of document. Open items tracked in §8. Sibling design pass for §4.2
generation Q&A to land before Session 6 starts.*
