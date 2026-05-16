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
| `publish` | Promote draft → live (covers normal publish AND break-glass force-publish; see §2.4) | ✓ | — |
| `approve` | Approve another user's pending draft | ✓ | — |
| `rollback` | Restore a prior published version as the new draft | ✓ | — |
| `manageDomain` | Point custom domain, SSL, DNS verify | ✓ | — |

13 capabilities total. Force-publish is **not** its own capability — see §2.4
for why (it's a UI affordance + audit log on top of `publish`, gated at the
call site by `role === 'admin'`).

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

### 2.0 Funnels and websites — two independent artefacts

The platform builds **two kinds of buildable artefact**, often for the same
client business. They share section vocabulary and brand, but they are
**not** the same thing and the data model must not blur them.

**Funnel** — a linear, conversion-focused sequence. Typically 2–4 steps
(landing → schedule → thanks, or landing → optin → thanks). One purpose
per funnel: one offer, one signup, one bookable thing. **No shared
chrome** — funnel steps are designed to be conversion-optimised in
isolation. Has its own analytics (visitors per step, drop-off,
conversion). A business can have many funnels (one per offer / campaign).
Built initially by the onboarding wizard (see §5); editable in Session 7's
funnel-step editor.

**Website** — a traditional multi-page presence. Pages like Home / About /
Services / Contact. **Shared `Header` and `Footer`** wrapping every
page. A flat **`nav: NavLink[]`** structures the top navigation (capped
at 6 items V1 — see §2.5). One website per business in V1. Pages aren't
sequenced — a visitor can land on any page, navigate freely between them.

**The hard rule:** a client's home page is not their funnel's landing
page. They are different surfaces serving different jobs:

- **Home page** lives on the website. Brand-establishing, multi-CTA, links
  out to services / about / contact / a funnel. Indexed by search.
- **Funnel landing page** lives inside a funnel. Single CTA, no header
  navigation (every link out is an exit), built around one offer. Often
  not indexed (ad-traffic only).

The two reference the same `Section` registry as building blocks and the
same `BrandObject` (one brand per client). Everything else is separate
data, separate routes, separate publish surfaces.

### 2.1 Core types

```ts
// Brand lives on the Client, NOT on Website or Funnel. Both reference
// the client's brand via clientId. One brand per business in V1.
type Client = {
  id: string;
  name: string;
  brand: BrandObject;
  // ...other client fields (status, meta, etc.)
}

// -- Website (multi-page, with shared chrome) ----------------------------
type Website = {
  id: string;
  clientId: string;       // → Client.brand for rendering
  name: string;
  domain: { primary: string; aliases: string[]; sslStatus: 'pending' | 'live' | 'error' };
  pages: Page[];          // unsequenced — visitor lands on any
  header: Section;        // website-level singleton (see §2.5)
  footer: Section;        // website-level singleton
  nav: NavLink[];         // capped at 6 V1 (forcing function — see §2.5)
  pageOrder: string[];    // page ids; drives the "Pages" menu order
  draftVersionId: string;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

type Page = {
  id: string;
  websiteId: string;
  slug: string;             // 'home' | 'about' | 'services' | 'contact'
  title: string;
  type: PageType;           // see below
  sections: Section[];      // ordered; rendered between header & footer
  seo: { title?: string; description?: string; ogImageUrl?: string };
  createdAt: string;
  updatedAt: string;
}

type PageType = 'home' | 'about' | 'services' | 'contact' | 'generic';

type NavLink = {
  label: string;
  target: { kind: 'page'; pageId: string } | { kind: 'href'; href: string };
}

// -- Funnel (linear, conversion sequence) --------------------------------
// Types defined now to lock the shape for Session 7's funnel editor.
// Not yet referenced by any route, stub data, or UI in Session 3.5.
type Funnel = {
  id: string;
  clientId: string;       // → Client.brand for rendering
  name: string;
  domain: { primary: string; aliases: string[]; sslStatus: 'pending' | 'live' | 'error' };
  steps: FunnelStep[];    // ordered sequence
  draftVersionId: string;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

type FunnelStep = {
  id: string;
  funnelId: string;
  slug: string;
  title: string;
  type: FunnelStepType;
  sections: Section[];    // ordered; no header/footer wrapping
  seo: { title?: string; description?: string; ogImageUrl?: string };
  // step-level concerns: gating ("can only reach step 2 from step 1"),
  // analytics ids, etc. — fleshed out in Session 7.
}

type FunnelStepType = 'landing' | 'schedule' | 'thanks' | 'optin' | 'upsell';

// -- Shared (used by both Website pages and Funnel steps) ----------------
type Section = {
  id: string;
  type: SectionType;        // 'hero' | 'offer' | 'header' | 'footer' | ...
  enabled: boolean;
  data: Record<string, unknown>;   // schema validated by the registry per type
  ai?: { draftedFields: string[]; lastRegenAt?: string };
}
```

### 2.2 The section registry

Every section type registers itself with a definition:

```ts
type SectionTypeDefinition<TData> = {
  type: SectionType;
  label: string;                   // "// HERO"
  description: string;
  defaultData: () => TData;
  Fields: ComponentType<{ data: TData; onChange: (next: TData) => void }>;
  Preview: ComponentType<{ data: TData; brand: BrandObject }>;
  capabilityHints?: { copyFields: string[]; mediaFields: string[] };
  // Where this section type can be used. Drives the "Add section" picker
  // and lets us enforce singleton vs stackable semantics in the editor
  // and any backend validation.
  allowedContainers: readonly ContainerKind[];
  allowedPageTypes?: readonly (PageType | FunnelStepType)[];
  implemented: boolean;
}

type ContainerKind =
  | 'page'              // section is added to a Page.sections[]
  | 'funnelStep'        // section is added to a FunnelStep.sections[]
  | 'websiteHeader'     // section IS Website.header (singleton)
  | 'websiteFooter';    // section IS Website.footer (singleton)
```

**V1 section types — stackable (appear in `Page.sections` and/or
`FunnelStep.sections`):**

- `hero` — eyebrow + headline + sub + CTA + hero image
- `offer` — offer card with price + included list + scarcity copy
- `trust` — trust signals row (badges, GBP rating)
- `services` — services menu (rows with name + price + duration)
- `reviews` — reviews carousel (auto-pulls from GBP integration)
- `faq` — Q&A list
- `cta` — final CTA block
- `schedulePicker` — `allowedContainers: ['funnelStep']`, only on
  `funnelStep` of type `'schedule'`
- `thanksConfirmation` — `allowedContainers: ['funnelStep']`, only on
  `funnelStep` of type `'thanks'`

**V1 section types — website-level singletons:**

- `header` — `allowedContainers: ['websiteHeader']`. Logo + nav links +
  optional global CTA. **Implements the same Fields/Preview interface as
  every other section type, but is not stackable.** A Website has exactly
  one `header` (`Website.header`); pages do not have headers in their
  `sections[]`. Wraps every page render automatically.
- `footer` — `allowedContainers: ['websiteFooter']`. Same shape rule:
  exactly one per Website (`Website.footer`); never appears in a page's
  `sections[]`.

**The "section interface ≠ stackable" point matters.** Header and footer
look like sections (they have Fields, Preview, brand-aware rendering)
because reusing the section registry buys us editor parity — the same
shell that edits a hero section edits the header. But they are
**website-level singletons**, not page-level building blocks. The
`allowedContainers` constraint is the data-model enforcement; the §2.6
single-section editor variant is the UX enforcement. Don't add `header`
or `footer` to a `Page.sections[]` even if the type system allows it
slipping through — it would render twice (once from the website wrap and
once inline) and the runtime checks the registry constraint and refuses.

The registry's `capabilityHints` tells the editor which fields are
pure-copy vs media-bearing, so the per-field capability check doesn't
need to be hard-coded in each section's `Fields`.

**Why a registry, not hard-coded section components in the editor:**
adding a new section type later (V2) becomes a one-file addition, not an
editor refactor. Also makes form-to-page generation cleaner — the AI
prompt includes the registry's section catalog.

### 2.5 Website navigation

`Website.nav: NavLink[]` is a flat array of nav links, capped at **6
items V1**. Each link targets either an internal page (`{ kind: 'page',
pageId }`) or an arbitrary href (`{ kind: 'href', href }`).

The cap is a forcing function, not an arbitrary restriction. Any
unbounded flat nav with 11+ items needs dropdowns to stay usable; we
won't build dropdowns V1, so the limit ensures the unstructured-flat
nav stays in its lane. V2 introduces dropdowns + sub-pages and the cap
relaxes.

### 2.6 Single-section editor variant

When the operator opens `/website/header` or `/website/footer`, the
editor runs in **`'website-singleton'`** mode. Same `SectionEditor`
shell as page editing — same toolbar, rail, preview pane composition —
with three explicit differences:

- **Toolbar tabs replaced by breadcrumb.** Page-editing mode shows page
  tabs (Home / About / Services / Contact). Singleton mode shows
  `← Back to website hub · Header` (or `Footer`) as a static breadcrumb.
- **Rail header changes.** `// SECTIONS` becomes `// WEBSITE-LEVEL ·
  HEADER` (or `· FOOTER`). The single row shows the section's summary
  but with no drag handle (you can't reorder a singleton), no enable
  switch (singletons are always on, by definition), and no "+ Add
  section" footer button. In place of the add button: a small explainer
  card reading *"Wraps every page on this website. Editing fields above
  changes what every page renders. — Field editing lands in Session 4."*
- **Preview pane renders only the singleton.** Full-width preview of just
  the header (or footer) — no surrounding page sections — so the
  operator sees the singleton in isolation.

Implementation: `SectionEditor` takes a discriminated `mode` prop:
`{ kind: 'page', page }` or `{ kind: 'singleton', section, label }`.
Toolbar + rail + preview branch on `mode.kind`. The rest stays shared.

### 2.3 The brand object

**Lives on the `Client`**, referenced by both `Website` and `Funnel` via
`clientId`. One brand per business in V1 — both the website's pages and
the business's funnels render against the same brand tokens, voice tone,
and audience context. Prepended to every AI generation prompt, and used
by section `Preview` components for visual on-brand rendering:

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

**Break-glass force-publish.** Bypassing the approval lane for emergency
fixes — "client's live site is broken and the approver is asleep" — is a
real case a managed product has to handle. Implementation: **not a separate
capability** (a separate cap either lives in admin-defaults and undercuts
the break-glass framing, or sits outside defaults and forces every admin to
self-grant on first use). Instead, force-publish is a UI affordance + audit
discipline layered on top of the existing `publish` cap:

- Surfaced as a separate confirm-twice action under a "Force publish (skip
  approval)" menu — *not* the default Publish button.
- The menu item is conditioned at the call site on `role === 'admin'`.
  Clients never have `publish` in their default cap set anyway, so the
  `role` check is the meaningful gate.
- Every force-publish writes an audit log entry with actor, timestamp, and
  a required free-text reason.
- The audit log is visible to all admins in `/settings/access` and to the
  affected client user as a read-only entry in their version history.

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

> **Revised — wizard-refactor reconciliation pass.** The §5.1 / §5.2 / §9
> inconsistency flagged before Session 7 completion is resolved here. The
> wizard adopts the **hybrid model**: the Session-6 Q&A flow drives
> generation, then a dedicated wizard-frame editor step walks the generated
> draft, then the review surface gates publish. This §5 is now concrete
> enough to build from with no further interpretation; the Session 7
> completion plan is written against the §5.1 table once this is committed.

The onboarding wizard at `/clients/new/<step>` is **the form-to-page
generation flow for the first funnel of a new client**, plus brand-object
initialisation, plus a guided edit of the AI-generated draft. It is **not** a
parallel implementation of the editor — the steps that edit sections run the
same `SectionEditor`, in a constrained mode.

A note on artefact: the wizard produces a **`Funnel`** (landing → schedule →
thanks), not a `Website` (see §2.0). The funnel data model is
`lib/funnel/types.ts`; the generated funnel lands on `/funnels/[id]`.

### 5.1 The eight wizard steps — post-refactor

The refactor grows the wizard from 7 steps to **8**: a new **Draft
walk-through** step is inserted after generation — the explicit home for the
guided section edit, which is the gap the old §5.1/§5.2 left unplaced.
`ONBOARDING_STEPS` gains a `draft` entry, `ONBOARDING_TOTAL_STEPS` becomes 8,
and every "Step N of 7" label shifts — a deliberate, tracked consequence.

Generation is **not a routed step** — it is the Step 4 → Step 5 transition,
surfaced by the Session-6 `GenerationStatusCard` (ink-bg, rotating ✦) during
the synthetic delay, after which the router pushes to `/clients/new/draft`.

| # | Step (slug) | Data it edits | UI mode | Current preview snapshot | Replaces with |
|---|---|---|---|---|---|
| 1 | Basics (`basics`) | `BrandObject` — business name, owner, trade, service area, licence, response promise, website URL | Static form, single column | `previewAfterBasics` (skeleton) | **No preview** — basics is a brand form; the Q&A flow has no preview pane |
| 2 | Idea (`idea`) | `GenerationContext` — primary intent, audience, big-idea reframe choice, voice tone | Q&A card(s) — chip / select (`QuestionCard`) | `previewAfterIdea` | **No preview** — Q&A cards are single-column |
| 3 | Offer (`offer`) | `GenerationContext` — offer specifics (anchor, rates, guarantee) as structured input fields | Q&A card / structured form | `previewAfterOffer` | **No preview** |
| 4 | Trust (`trust`) | `GenerationContext` — trust signals + jobs menu (prompt context). Continue → generation | Q&A card / structured form (`JobsMenuEditor` stays as input UI) | `previewAfterTrust` | **No preview** |
| 5 | Draft walk-through (`draft`) — **NEW** | The generated `Funnel`'s `Section[]` — copy + media of every section across all 3 funnel steps | **Wizard-frame mode** — `SectionEditor` `{ kind: 'wizard' }` (§5.2) | n/a (new step) | Registry `<Preview>` rendering of live `Section` data |
| 6 | Automations (`automations`) | The funnel's automation set | Static surface — existing `AutomationCard` list | none (full-width) | Unchanged |
| 7 | Review (`review`) | Nothing — read-only verification | **Content summary** — adapted `ReviewCard` grid over the generated funnel (see note) | none | Content summary |
| 8 | Published (`published`) | Nothing — publish event | Static success screen | none | Unchanged — publishes the `Funnel`, lands on `/funnels/[id]` |

After publish, the operator lands on the funnel hub for that client; the
funnel editor is fully unlocked from there.

> **Note on Step 7.** A full `PreflightChecklist`-backed review *surface*
> (the Session-8 `/website/review` shape) is the eventual target, but
> `runPreflight` is website-snapshot-shaped and funnel preflight is
> deferred alongside funnel publish (CLAUDE.md parked decision; §9). Until
> that lands, Step 7 stays a **content summary** — the adapted `ReviewCard`
> grid pointed at the generated funnel's sections. It swaps to the real
> review surface when funnel publish/preflight is built.

> **Note on `ONBOARDING_TOTAL_STEPS`.** The §5.1 table has 8 rows because it
> counts the post-publish `published` step. The `ONBOARDING_STEPS` const
> does not include `published` (it is a post-publish state, not a step you
> fill in) — so the const goes from **6 entries to 7**, and
> `ONBOARDING_TOTAL_STEPS` 6 → 7. "Step N of 7" in the UI.

### 5.2 Wizard-frame mode — concrete spec

Wizard-frame mode is the section editor running under a constrained frame.
**Implementation note (Session 7):** it was built as a sibling component,
`WizardSectionEditor`, rather than a fourth `SectionEditor` mode discriminator
— the three existing `SectionEditor` modes share helpers keyed on a
`{ website }` / `{ funnel }` shape the per-step walk doesn't fit, and keeping
the working 3-mode editor untouched avoided regression risk. It composes the
same `PagePreviewPane` + `SectionFieldsPanel` + `useAutosave`. Props:
`{ funnel, steps, onExitForward, onExitBack }`; the walk index is internal
state.

The editor walks a **flattened section list** — every section of every step,
in step order
(landing's hero / offer / trust / services / cta, then schedule's
schedulePicker, then thanks's thanksConfirmation). Exactly one section is
"current" at a time.

Concrete differences from the standard editor:

- **No `EditorToolbar`.** The wizard page's own chrome (`Topbar` +
  `BuilderStepHeader`) sits above; the editor renders no toolbar of its own.
  → no page/step tabs, no Publish / Submit / Force-publish, no "View live",
  no autosave indicator.
- **No section rail.** The wizard pre-determines which sections exist; the
  user cannot reorder, add, remove, or toggle them. `SectionListRail` is not
  rendered.
- **Preview pane** renders the **current funnel step's** full section stack
  (registry `<Preview>` components), with the section under edit
  ring-highlighted — context, not just the isolated section.
- **Fields panel** is always open, showing exactly one section's `<Fields>`
  (the current section in the walk). No close button — there is no
  "deselected" state in wizard mode.
- **Footer** is `BuilderFooterActions` (the wizard footer), not editor chrome:
  a `Section N of M` progress label + Back / Continue. Continue advances
  `walkIndex`; Continue on the last section routes to Step 6 (Automations);
  Back on the first section routes to Step 4 (Trust).
- **Capabilities locked** to a fixed `{ editCopy, editMedia, useAI }` triple,
  resolved via a session-local override regardless of who launched
  onboarding. The wizard's flow is its own UX contract — no `editLayout` /
  `editSections` / `editTheme` / `publish` affordances mid-wizard (most are
  already absent with the rail + toolbar gone; the lock is what guarantees
  `CopyField` / `MediaField` render editable, not as the request-change
  affordance, for any launcher).
- **Autosave still runs** — edits persist to a funnel-keyed `DraftSlot` so
  backing out and resuming loses nothing. Only the *indicator* is gone; the
  `BuilderFooterActions` progress label is the wizard's chrome.

Layout: two columns (`preview | fields`) — no third rail column, since the
rail is suppressed.

### 5.3 `FunnelLandingPreview` — deleted, not adapted

§5.2's earlier draft offered "thin adapter or deleted." **Decision: deleted.**

Post-refactor, **zero** wizard steps consume `FunnelPreviewState`: steps 2–4
(Q&A) have no preview pane; step 5 (draft walk) and step 7 (review) render the
registry `<Preview>` components against real `Section[]`. The "thin adapter"
option only made sense in a world where the wizard kept a bespoke preview
shape fed from draft state — and that world is gone, because the wizard-frame
editor *is* `SectionEditor`, which already renders registry `<Preview>`s via
`PagePreviewPane`. An adapter would be a wrapper with no distinct caller —
dead code wearing a compatibility label, which CLAUDE.md's "no dead code"
rule forbids.

Deleting `FunnelLandingPreview` also retires its dependents: the four
`previewAfter*` snapshots and the `FunnelPreviewState` / `FunnelHeader` /
`FunnelEyebrowConfig` / `FunnelHeadlineConfig` / `FunnelSubConfig` /
`FunnelOfferCardConfig` / `FunnelCtaConfig` / `FunnelTrustConfig` /
`FunnelJobsConfig` types in `lib/onboarding/types.ts`. Net result: one preview
implementation across the whole platform — the section registry's `<Preview>`.

### 5.4 Stub-data consolidation

Today `lib/onboarding/voltline-build.tsx` and `lib/funnel/data-stub.tsx` are
parallel representations of the same Voltline funnel. The refactor resolves
this:

- **`lib/funnel/data-stub.tsx` survives as the single source of truth for the
  generated funnel's section content.** It is already registry-backed
  (hero / offer / trust / services / cta + schedulePicker +
  thanksConfirmation). The wizard's funnel-generation stub returns this funnel
  for Voltline's deterministic Q&A inputs.
- **`lib/onboarding/voltline-build.tsx` slims down.** Deleted from it: the
  four `previewAfter*` snapshots — redundant preview-rendering data retired
  with `FunnelLandingPreview` (§5.3). Surviving in it: `voltlineBasics`
  (brand seed — feeds the Step 1 form and the Client's `BrandObject`),
  `voltlineReframes` (Q&A answer options for the Big Idea step),
  `voltlineOffer` / `voltlineTrust` / `voltlineJobs` (the demo's structured
  Q&A *answers* for Steps 3–4 — see below), `voltlineAutomations` (Step 6's
  data — a separate concern), `voltlineNextSteps` (Step 8's cards).
- **`voltlineOffer` / `voltlineTrust` / `voltlineJobs` are kept**, not
  deleted. Per `builder-generation-design.md §3` the wizard's Steps 3–4 keep
  *structured input fields* (price / inclusions / scarcity; trust signals +
  jobs), and those need demo pre-fill values. These are the demo's *Q&A
  answers*, not funnel content — no more redundant with `data-stub.tsx` than
  Session 6's Q&A answers are with its generated page. The duplication §5.3
  correctly kills is the redundant *preview rendering*
  (`FunnelLandingPreview` + `FunnelPreviewState` + snapshots).
- The wizard's Step 3/4 form fields are generation **inputs**, not stores of
  final funnel content — the final content is whatever generation emits
  (= `data-stub.tsx`). No duplication of *content*, only of *input shape* vs
  *output shape*, which is correct and intended.
- Optional tidy: with its funnel-content gone, `voltline-build.tsx` is now
  "Voltline onboarding inputs"; a rename to `voltline-onboarding.tsx` is
  reasonable but not required — left to the implementing session's discretion.

### 5.5 Migration shape

The wizard's per-step routes keep their URLs (a `draft` route is added). Steps
2–4 swap one-off field components for Q&A cards emitting a `GenerationContext`;
Step 5 mounts `SectionEditor` in wizard mode; Step 7 renders the content
summary. The funnel-generation stub is a **deterministic passthrough** —
`generateFunnelStub(ctx)` returns the registry-backed Voltline funnel from
`data-stub.tsx` after a 4–8s synthetic delay. (Session 6's `generatePageStub`
is *website-page*-shaped — its recipes cannot emit the funnel-only
`schedulePicker` / `thanksConfirmation` sections — so "compose three page
generations" per generation-design §8 is the *real-backend* path, not the
stub.) This is no longer the original
"~6–8 file touches" estimate — with the new step, the new editor mode, and the
stub consolidation it is a substantial session. The concrete file-by-file
plan is written against this §5 once it is reviewed and committed.

### 5.6 Forward note — self-serve onboarding

Webnua is operator-mediated today; a self-serve SaaS tier where the account
owner onboards themselves is on the near horizon. The hybrid model holds up
well for that future — the Q&A flow is the low-friction entry self-serve
users expect, and the wizard-frame walk (Step 5) is a gentle, hand-held
on-ramp to content editing before the user ever meets the full editor. Two
things the implementing session should keep self-serve-ready, without building
for it yet:

- **Route / access.** The wizard lives at `/clients/new/*` under the
  `(admin)` route group — operator-only by URL shape. Self-serve onboarding
  must be runnable by the signing-up account owner. Don't deepen the
  `(admin)` coupling; when the wizard routes are touched, treat the
  operator-only placement as provisional (same reasoning as §6's "editor URL
  must not be operator-only by shape").
- **Initiator framing.** §5.2 says wizard mode is "operator-initiated." Read
  that as "onboarding-initiated" — the locked cap set is a UX contract that
  applies identically whether an operator or a self-serve user is driving.

This is a forward note, not Session 7 scope — recorded so the hybrid choice
isn't quietly re-litigated when the SaaS tier lands.

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
- §5 — wizard-refactor model reconciled (hybrid: Q&A → generate →
  wizard-frame draft walk → review); the §5.1 / §5.2 / §9 inconsistency is
  fixed, and §5.1 now carries a concrete 8-step build table.
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
  admin (all 13 caps), Mark@Voltline (copy+media+SEO+useAI), Anna@FreshHome
  (view-only).
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

**Session 3 — Website hub + read-only mode editor shell.** ✅ shipped.
- `/website` route — page grid, version history, publish state, "+ New page"
  CTA gated on `editPages`.
- `/websites` route — admin-only cross-client matrix.
- `<SectionEditor>` shell — toolbar (page tabs, autosave indicator,
  publish/submit), left rail (section list with toggles, all
  capability-gated), right pane (per-section `<Preview>` components).
- **Discovered post-ship:** what shipped renders pages as a funnel, not as a
  website. Funnel/website distinction wasn't pinned in §2 at that time —
  doc has since been corrected (§2.0). Fix-up work moved to Session 3.5.

**Session 3.5 — Funnel/website split + website chrome.**
- Pin the funnel-vs-website distinction in `lib/`: `lib/website/types.ts`
  becomes website-only (Home / About / Services / Contact / generic page
  types; `header` / `footer` / `nav` on `Website`); new `lib/funnel/types.ts`
  holds editable `Funnel` + `FunnelStep` types **shape-only** — no stub
  data, no routes, no UI references (locks the model for Session 7).
- Brand migrates from `Website` to `Client` (`AdminClient.brand` in the
  stub layer). Website and Funnel both reference brand via `clientId`.
- `header` and `footer` join the section registry as website-level
  singletons with `allowedContainers: ['websiteHeader' | 'websiteFooter']`.
- Stub data restructure: Voltline gets a small Website (Home + About +
  Contact partial-build; Services empty — demonstrates partial state);
  FreshHome gets a real Website (4 pages, published); KeyHero gets a
  Website (draft, never published); NeatWorks empty. Voltline's existing
  funnel data (under `lib/funnels/`) stays untouched — analytics-detail
  stub from Cluster 4, unrelated to the editable Funnel model.
- `/website` hub redesigned: header/footer cards with their own Edit
  affordances, page grid by type, nav-config card capped at 6 items.
- `EditorToolbar` page-tabs prop generalised to `{ id, label, href }[]`.
- New routes `/website/header` and `/website/footer` mount `SectionEditor`
  in singleton mode (see §2.6) — same shell, different content.

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

**Session 7 — Funnel editor + wizard refactor.**

Funnel work in one bundle. The wizard generates a `Funnel`; the funnel
editor is where its output lands; admins need to view funnels the same
way they view websites. All three depend on each other so they ship
together.

*Funnel editor + accessibility:*
- Move `/funnels` from `(client)/` to top-level shared route (same shape
  as `/website` after Session 3.5). Layout dispatches sidebar by role.
- Add `/funnels` to `admin-nav.ts` so operators can reach it.
- `/funnels` page becomes context-aware: admin agency mode → cross-client
  matrix (mirrors `/websites`); admin sub-account → that client's funnel
  list; client → their funnels.
- New route `/funnels/[id]/edit/[stepId]` mounts `SectionEditor` with a
  new `mode` variant: `{ kind: 'funnelStep', steps, step }`. Toolbar
  renders step tabs prefixed `01 ·`, `02 ·`, `03 ·` to communicate
  sequence.
- Add "Edit funnel →" CTA to `FunnelHero.actions` on `/funnels/[id]`,
  gated on any edit capability.
- New `lib/funnel/data-stub.tsx` populating Voltline's funnel against
  the Session 3.5 types. Coexists with the existing analytics-detail
  stub at `lib/funnels/`.

*Wizard refactor* — **shipped (Session 7A / 7B / 7C).** Built to the §5
revision (hybrid model) and the §5.1 table:
- Wizard grew by one step — a `draft` walk-through inserted after generation.
  `ONBOARDING_STEPS` 6 → 7 entries.
- Wizard-frame mode built as `WizardSectionEditor`, a sibling of
  `SectionEditor` (see §5.2 implementation note) — mounted at
  `/clients/new/draft`. `CapabilityOverrideProvider` locks its cap set.
- Steps 1–4 dropped `FunnelLandingPreview` → single-column forms; the trust
  step triggers `generateFunnelStub` (a deterministic passthrough to the
  Voltline funnel — §5.5). Step 7 (review) is a content summary (§5.1 note).
- `FunnelLandingPreview` + `FunnelPreviewState` + the `previewAfter*`
  snapshots **deleted** — §5.3. `lib/funnel/data-stub.tsx` is the single
  source of truth for funnel content — §5.4.
- **Not done (deferred):** the wizard does not yet fold its Q&A answers into
  a real `GenerationContext` (the stub generation ignores them); funnel
  publish / preflight is unbuilt (see the funnel-publish deferral above).

**Session 8 — Preflight + publish UI + rollback + versions panel.**
- `lib/website/preflight.ts` rule engine.
- Review surface (Screen 43-equivalent) with checklist + per-page review
  cards.
- Versions panel in the website hub with "Restore as draft" affordance.
- Domain status indicator (UI only — actual DNS work is a backend concern).

**Pre-Cluster-6 cleanup — tracked, not yet scheduled.** Surfaced by the
pre-Session-7 codebase audit; to be done either bundled with the Session 7
wizard refactor or as its own tiny session before Cluster 6 — but not
allowed to drift again:
- Extract `lib/calendar/tones.ts` — the `CalendarClientTone` parked
  decision's trigger fired when booking-detail landed (Cluster 2 ·
  Session 2); inline hex still lives in `BookingPill` / `AdminBookingHero` /
  `CalendarTodayPanel`.
- `TicketSideCard` → `RailCard` rename + migrate the 3 rail surfaces
  (tickets / leads / bookings) + absorb `LeadRailCard`'s tone vocabulary —
  the parked decision says "trigger has fired, extract pending"; CLAUDE.md
  insists this be its own session, not bundled with feature work.
- The `bg-card` vocabulary hole — Webnua-authored files use the shadcn alias
  `bg-card` (76×) because there is no Webnua-named white-surface token.
  Resolve: add a `--color-surface` token, or document `bg-card` as the
  sanctioned white-surface exception in CLAUDE.md's bright-line rule.

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
- **Brand-tone drift across pages.** Voice tone is set per-client but the
  AI may still produce tonally inconsistent copy across pages over time as
  the model drifts or the prompt context window fills. No automated drift
  detection in V1; operators eyeball it. If this becomes a real problem,
  the answer is a per-client "tone reference" snippet (a frozen passage
  the operator hand-tunes) that gets prepended to every generation prompt.
- **`lib/funnel/` vs `lib/funnels/` namespace overlap.** Session 3.5 adds
  editable `Funnel` + `FunnelStep` types in `lib/funnel/types.ts`. The
  existing `lib/funnels/` (plural, Cluster 4) holds the analytics-detail
  types for `/funnels/[id]` (`FunnelDetail`, `FunnelVersion`,
  `FunnelAggMetric`, etc.) — a different concern (read-only detail view,
  not editable build model). The dir names disambiguate (singular = build
  model; plural = analytics-detail) but the overlap is uncomfortable. When
  Session 7 wires the funnel-step editor and the two domains start
  interacting, consider hoisting analytics into `lib/funnels-analytics/`
  or merging both under `lib/funnel/{builder,analytics}/`. Don't refactor
  preemptively; act on the first real friction.

---

*End of document. Open items tracked in §8. Sibling design pass for §4.2
generation Q&A to land before Session 6 starts.*
