# Builder generation design — form-to-page Q&A

> Companion doc to `reference/builder-design.md` §4. That doc establishes
> *that* form-to-page generation exists; this doc locks *what* the form
> asks, *how* it asks it, and *how the answers become a prompt*.
>
> Per the parent doc §4.2, the 5-question sketch was a starting draft —
> "the single highest-leverage design decision in Cluster 5." This doc is
> the focused pass that gate. After this lands, Session 6 builds to it.

---

## 0. What this doc decides — and doesn't

**Decides:**
- The conversational form's interaction model (one card per question,
  back/continue, progress indicator, generation handoff).
- The question set, ordering, required/optional flags, and chip-vs-free-text
  per question — for the **new-page-on-existing-website** flavour.
- The AI prompt construction: what context blocks feed in, what the model
  must return, how the response is validated.
- The capability-gating story for entering / completing the flow.
- The relationship with the existing onboarding wizard (which is the
  first-page-of-website flavour — no parallel implementation).

**Doesn't decide:**
- The actual LLM choice, model version, or token-budget tuning. Session 6
  ships a deterministic stub; real model wiring is a backend pass.
- The validation library (zod / typia / hand-rolled). Section 4 specifies
  the contract; the implementation pass picks.
- Per-section copy heuristics (e.g. "hero headlines should be ≤7 words").
  Those live in the section registry's `defaultData` and in operator-tuned
  prompts later. V1 leans on the model's general taste.

---

## 1. The interaction model

**Cards, not chat.** One question per full-width card. Reasons (carry-over
from parent doc §4.1):
- Predictable count — user sees "Question 2 of 5".
- Reuses `BuilderStepHeader` + `BuilderField` + `BuilderFooterActions`.
- Back button works natively.
- No "hallucinated next question" risk.

**Layout.** Single-column card centred at max-width 640px. Eyebrow shows
`// QUESTION N OF 5`. `BuilderStepHeader` carries the question as `title`
(with `<em>` rust highlight on the verb). Helper text under the title.
Body holds the input (chip row or textarea). Footer = `BuilderFooterActions`
with `progress` = "Question N of 5" and two buttons:
- Required & empty → "Continue →" disabled.
- Optional & empty → "Skip →" + "Continue →" enabled.
- Filled → "Back" + "Continue →".

**Free-text inputs** use `BuilderTextarea` set to `min-h-32`, paste-friendly.

**Chip inputs** use `ChipSelector` variant `pill` for visual parity with the
new-booking modal. Single-select. If a chip set has an "Other" option, that
chip swaps the body for a `BuilderInput` until cleared.

**State** lives in URL search params (`?q1=service&q2=book&q3=ad&...`) so
back/forward and refresh just work. No localStorage draft — these questions
take 60–90s to answer; the cost of losing them to a refresh is small and
recovery infrastructure isn't worth the complexity. (Contrast: editor
autosave matters because edits accumulate over sessions.)

**Progress card after the last question** = review screen showing every
answer with inline "Edit ✎" links that bounce back to that question
preserving the rest of the answers. Submit button: `✦ Generate page →`.

**Generation card** is ink-bg, centred ✦ glyph (rotating), copy says
"Drafting your page…" with a secondary line that cycles through three
phases ("Reading your brand…" → "Choosing sections…" → "Writing copy…").
Synthetic delay: 4–8s, randomised per-load (so it feels real-time). Real
LLM round-trip will hit this same component when backend lands.

**On completion** → router push to `/website/[newPageId]` with the editor
open and the first AI-drafted field selected (so the user sees the AIPill
on a labelled field immediately).

---

## 2. The question set — locked

**Five questions, ~60–90s to answer.** First three required, last two
optional. Order is deliberate: page-type first (because it gates which
sections the AI picks), then intent (gates CTA + conversion sections),
then audience (gates tone). Free-text fields come last so the user has
already framed the page before the heavy lifting starts.

### Q1 — Page type *(required, chip)*

> **What kind of page is this?**

Chips:
- **Service page** — describing one of your services in depth.
- **About page** — who you are, why you do what you do.
- **Contact page** — how customers reach you.
- **Landing page** — a focused page for an ad campaign, offer, or referral source.

Maps to `PageType`:
- Service → `services`
- About → `about`
- Contact → `contact`
- Landing → `generic`

`home` is **not** an option — a website only has one home page and it's
created through the onboarding wizard (§5 in parent doc). If someone
somehow lands here without a website, the entry redirects to the wizard.

### Q2 — Primary intent *(required, chip)*

> **What's the one thing a visitor should do?**

Chips:
- **Book a job** — drives a schedule-picker CTA.
- **Call now** — phone-first CTA.
- **Get a quote** — form/inquiry CTA.
- **Sign up** — list/newsletter/membership CTA.
- **Read & inform** — no hard conversion (drives sections to be informational rather than conversion-oriented).
- **Other** — free-text input replaces chip selection.

Drives:
- CTA section's button label + intent (`bookingSchedulePicker` vs `callPrompt` vs `quoteForm` etc.).
- Which conversion-oriented sections the AI prioritises.

### Q3 — Audience *(required, chip)*

> **Who's coming to this page?**

Chips:
- **Cold ad traffic** — visitors who don't know us; trust signals weighted heaviest.
- **Existing customers** — already trust us; focus on the offer.
- **Word-of-mouth referrals** — partial trust; social proof matters.
- **Search visitors** — researching, mid-funnel; explanation > selling.
- **Mixed** — balanced default.

Drives:
- Voice tone calibration (cold-ad → urgent/casual; existing customers → calm/casual; search visitors → calm/plain).
- Trust-signal weighting (cold-ad → reviews + guarantee high; existing customers → reviews low).

### Q4 — Specifics *(optional, free text, paste-friendly)*

> **Anything specific to say?**

Placeholder copy guides the user:
> Paste anything that should appear on this page: the offer details, the
> guarantee, what's different about you, specific phrasing you want to use.
> Skip if there's nothing in particular — we'll draft from your brand.

Min-height 32 lines. No char limit (paste-from-doc is a real path).

Drives: free-form prompt context. This is the heavy lifter — when the user
fills this in well, the generated page reflects their actual offer rather
than generic brand voice.

### Q5 — Avoid *(optional, free text)*

> **Anything to avoid?**

Placeholder:
> Terms you don't want used, claims you can't make (regulatory etc.),
> tones that have failed before. Skip if nothing comes to mind.

Drives: negative-prompt block in the AI prompt. Critical for regulated
industries (electrical, plumbing) where over-claiming creates compliance
risk.

---

## 3. The first-page-of-website flavour

**Does NOT live at `/website/new`.** The onboarding wizard at
`/clients/new/<step>` IS this questionnaire — Session 7 refactors the
wizard so steps 2–4 emit the same prompt-context object as the
new-page flow. See parent doc §5.1 for the mapping:

- Wizard Step 1 (Basics) → populates `BrandObject` directly. Not part of
  the page-generation Q&A.
- Wizard Step 2 (Idea) → equivalent to Q2 (Primary intent) + Q3 (Audience)
  combined, plus brand voice tone selection.
- Wizard Step 3 (Offer) → equivalent to Q4 (Specifics) with structured
  fields (price, inclusions, scarcity) instead of free-text.
- Wizard Step 4 (Trust) → feeds prompt context (top jobs, trust signals)
  but isn't a Q&A question itself.

Page type is implicit (`generic` — the landing page).

**Session 7's job:** keep the wizard's per-step URLs and visual frame; swap
the form bodies to produce the same `GenerationContext` shape that Q1–Q5
produces. Run the same generation handler. Drop into the editor in
wizard-frame mode (parent doc §5.2) instead of free-form editor.

---

## 4. The AI prompt construction

### 4.1 The `GenerationContext` object

The Q&A flow's deliverable. Same shape regardless of flavour (new-page
flow populates from Q1–Q5; wizard populates from steps 2–4):

```ts
type GenerationContext = {
  flavour: 'new-page' | 'first-page';
  pageType: PageType;
  primaryIntent: PrimaryIntent;       // 'book' | 'call' | 'quote' | 'signup' | 'read' | { other: string }
  audience: Audience;                 // 'cold-ad' | 'existing' | 'referral' | 'search' | 'mixed'
  specifics: string | null;           // Q4
  avoid: string | null;               // Q5
  brand: BrandObject;
  existingPages: ExistingPageSnapshot[];
};

type ExistingPageSnapshot = {
  pageTitle: string;
  h1: string | null;
  primaryCta: string | null;
  sectionTypes: SectionType[];
};
```

### 4.2 Prompt blocks

The generation handler composes a single prompt from five blocks:

1. **System preamble.** Constant. Describes the section registry,
   constraints (text length, required fields, JSON output), and the
   contract that every populated field gets `ai.drafted: true`.

2. **Brand context.** Structured rendering of `BrandObject`. Voice tone
   gets translated from numeric axes (1–5 on formality / urgency / technicality)
   to a prose paragraph: e.g. `{ formality: 2, urgency: 4, technicality: 2 }`
   → "Speak casually and with urgency, in plain non-technical language."
   `topJobsToBeBooked` rendered as a bullet list.

3. **Page questions.** Q1–Q5 answers labeled clearly. Empty optional
   answers omitted (don't send "Specifics: null" — send nothing).

4. **Existing pages snapshot.** Helps the model stay tonally consistent.
   For a brand-new website (`existingPages: []`), this block is omitted.
   For an established website, ≤6 pages worth of snapshot data — past 6,
   token budget gets uncomfortable.

5. **Section registry catalog.** Per available section type:
   `{ type, label, description, requiredFields, optionalFields, allowedPageTypes }`.
   Filtered to types where `allowedPageTypes` includes the chosen page
   type (or has no restriction).

### 4.3 Response contract

Model must return JSON matching:

```ts
type GeneratedPage = {
  title: string;
  slug: string;
  type: PageType;
  seo: PageSEO;
  sections: GeneratedSection[];
};

type GeneratedSection = {
  type: SectionType;
  enabled: true;             // generated sections are always enabled
  data: Record<string, unknown>;  // validated per-section
};
```

### 4.4 Validation pipeline

After parsing:
1. **Section type check.** Drop any section whose `type` isn't in the
   registry. Log the rejection so we can tune the prompt.
2. **Container check.** Drop any section whose registry entry doesn't
   include `'page'` in `allowedContainers`.
3. **Page-type check.** Drop any section whose registry entry has
   `allowedPageTypes` set and doesn't include this page's type.
4. **Per-field validation.** For each section, validate `data` against
   the section's shape. Missing required fields → fall back to the
   registry's `defaultData[field]` and DON'T tag that field as
   AI-drafted (the user should see it as a placeholder, not a confident
   AI suggestion).
5. **AI tag.** For every field the model successfully populated, push the
   field name into `section.ai.draftedFields[]`.
6. **Ordering.** Keep the model's order. The model is given the
   page-type-recommended sequence in the prompt and is allowed to
   deviate; review surface flags structural oddities (Session 8 work).

### 4.5 Per-field AI controls (post-generation)

Already specified in parent doc §4.5. Recap:
- `CopyField` shows the AIPill inline with the label when `field` is in
  `section.ai.draftedFields[]`.
- "✦ Regen" cycles through stub alternatives (Session 6 stub) → real
  per-field generation (post-backend).
- "↶ Original" reverts to the original AI-drafted value (stored on first
  edit; if the user reverts and edits again, "Original" still points at
  the original AI draft, not the most recent edit).

The per-field regen prompt uses the same five blocks above, plus the
current section's data + a "regenerate only the `{field}` field" instruction.

---

## 5. Capability gating

The entry to `/website/new` is **only** rendered for users with **both**
`editPages` AND `useAI` capabilities. Reasons:
- `editPages` because the flow creates a new page (writes to the page tree).
- `useAI` because the entire premise is AI generation.

If a user has `editPages` but not `useAI`:
- The "+ New page" CTA on `/website` opens a **manual** new-page modal
  instead — pick a page type from a chip row, get an empty page seeded
  from the section registry's `defaultData`. No Q&A. (V2 work — not
  Session 6 scope; Session 6 hides the entry entirely if `useAI` is
  missing. Document the V2 path here so the gating story is complete.)

If a user has `useAI` but not `editPages`:
- They never see the entry. Their request-change affordance (`<CapabilityGate
  mode="request">`) on the "+ New page" CTA fires the existing
  submit-for-review flow — operator generates the page on their behalf.

Force-publish doesn't intersect this flow (parent doc §3.3 covers the
break-glass discipline; nothing about generation needs special treatment).

---

## 6. The stub generation handler (Session 6 only)

Implementation lives in `src/lib/website/generation-stub.ts`. Shape:

```ts
export async function generatePageStub(
  context: GenerationContext
): Promise<GeneratedPage>;
```

**Behaviour:**
- Synthetic delay: 4–8s, randomised per call (`Math.random() * 4000 + 4000`).
- Deterministic output keyed off `(pageType, primaryIntent, audience)`.
  The free-text `specifics` and `avoid` answers ARE NOT consumed by the
  stub — they're displayed in the generation card so the user can see
  "Reading: <their specifics>" but don't change the output. (Real model
  wiring is the obvious upgrade path; the stub keeps the contract.)
- Output: a populated `GeneratedPage` with 4–6 sections appropriate to
  the page type. Every field tagged in `section.ai.draftedFields`.

**Output recipes (locked for Session 6):**

| pageType | sections |
|----------|----------|
| `services` | hero → services → trust → reviews → cta |
| `about`    | hero → trust → reviews → cta |
| `contact`  | hero → cta → trust |
| `generic`  | hero → offer → trust → services → reviews → faq → cta |

**Copy library.** Three voice variants per recipe (driven by `audience`):
"cold-ad-urgent", "existing-calm", "search-plain". Specifics + avoid
displayed in the generation card but not consumed.

**Why this stub shape?** It lets us ship the entry → form → handoff →
editor loop end-to-end on stub data, which is the real point of Session 6.
The model-quality decisions migrate cleanly into the backend pass without
touching the surface.

---

## 7. Edge cases worth pinning

- **Refresh during Q&A.** State is in URL search params, so refresh
  resumes at the current question. The user loses unsaved free-text in
  Q4/Q5 if they refresh mid-typing — flagged as acceptable (cost is low,
  paste-friendly answers come from a doc anyway).
- **Browser back during generation.** The generation card disables
  browser-back via a `beforeunload` warning ("Generation in progress —
  cancel?"). On confirm, abort the synthetic delay and return to the
  review card.
- **Generation failure (real backend later).** Render an error card with
  "Try again" + "Edit answers" buttons. Don't auto-retry.
- **Duplicate slug after generation.** The handler picks a slug from the
  generated title; if it collides with an existing page, append `-2`,
  `-3` etc. Slugs are mutable in the editor, so this is just a safe
  initial value.
- **Submit-mid-edit on the generated page.** Standard Lane B flow applies
  (parent doc §3.3). The fact that the page was AI-generated is
  invisible to the reviewer — they see the same submission row as any
  other.
- **Operator generating in sub-account mode.** The workspace context
  determines which `Website` the new page lands on. Outside sub-account
  mode (agency view), the entry redirects to the client picker first
  ("Pick a client to generate for") — same pattern as other
  client-scoped operator surfaces.

---

## 8. What's deliberately not in Session 6

- **Operator-tuned prompts per client.** The brand object is good enough
  V1; per-workspace prompt overrides come later if generated pages start
  drifting from brand.
- **A/B alternatives at generation time.** "Generate 3 variations"
  becomes a future affordance on the editor (post-Session 6 polish), not
  the form flow.
- **Multi-page generation in one shot.** Each generation is one page.
  The wizard's "generate the full 3-page funnel" lives in Session 7 and
  composes three single-page generations under the hood.
- **Streaming response.** Stub fakes it with phase copy in the
  generation card; real streaming arrives with the backend.
- **Telemetry on which questions get skipped, which chips picked.**
  Worth instrumenting once real users exist; out of scope for the stub.

---

## 9. File touches expected in Session 6

Roughly 8–10 files:
- `src/lib/website/generation-stub.ts` — handler + recipes + copy library
- `src/lib/website/generation-context.ts` — `GenerationContext` + types
- `src/app/website/new/page.tsx` — flow root
- `src/app/website/new/_questions.tsx` — Q1–Q5 cards + review
- `src/app/website/new/_generating.tsx` — generation card
- `src/components/shared/website/NewPageEntry.tsx` — the "+ New page" CTA on `/website`
- `src/components/shared/website/QuestionCard.tsx` — single Q&A card primitive
- `src/components/shared/website/GenerationStatusCard.tsx` — ink-bg progress card
- CLAUDE.md inventory updates

Touches `lib/website/data-stub.tsx` to wire the generated page into the
website. Touches `lib/auth/explainers.ts` to add an `editPages` explainer
string for the manual-new-page fallback (V2; doc-only mention for now).
