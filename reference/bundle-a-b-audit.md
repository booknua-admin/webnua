# Bundle A + B Audit — Generation-Pipeline Quality

> Audit conducted 2026-05-25 against the live `webnua` project (Supabase ref
> `ynfnjskylwlbmgyeeiot`). All SQL output below was captured at that moment;
> figures shift as more sites generate, but the *shape* of the gaps will not
> until the work in this PR ships. Read this end-to-end before implementing
> Bundle A or Bundle B — the numbers anchor every design decision that
> follows.

This audit document is the deliberate first artefact of the
`claude/generation-quality-bundle-a-b-9f2c` branch. Bundle A (honest defaults
+ enum/path validation) and Bundle B (image injection) are implemented
against the findings recorded here.

---

## 1. Symptoms confirmed against production data

### 1.1. Agency value-stack boilerplate leak (Symptom 1)

The `offer` section module ships seed data containing Webnua's own
agency-pitch copy. Whenever the AI omits the `items` array, `withDefaults`
silently overlays the agency pitch onto the customer's snapshot.

**Live count (last 30 days):**

```text
total offers in published/draft versions          : 80
contain "conversion-focused website"              : 15  (18.8%)
contain "weekly scoreboard" / "Local ad targeting"
   / "Retargeting that works"                     : 15  (18.8%)
```

Both counts converge on 15 because every leaking row carries the full
agency-pitch set, not a subset — the entire `SEED_ITEMS` array overlays as
one unit.

**Location:**

- `src/lib/website/sections/offer.tsx:120-151` — `SEED_ITEMS`. Six items.
  Verbatim agency-pitch copy: "A conversion-focused website", "Local ad
  targeting", "Retargeting that works", "Fast lead follow-up", "Automated
  reviews", "A weekly scoreboard".
- `src/lib/website/sections/offer.tsx:114-118` — `SEED_INCLUSIONS`. Three
  electrician-flavoured inclusions ("No call-out surcharges, ever",
  "Same-day repair quote, written", "All work covered by our 12-month
  workmanship guarantee"). These leak the same way as `items` (whenever the
  AI omits `inclusions`) and are wrong for any non-electrician trade.
- `src/lib/website/sections/offer.tsx:153-157` — `SEED_SIGNALS`. Three
  generic-but-fabricated trust signals ("No lock-in contracts", "Transparent
  reporting", "Built for trades"). Less obviously a leak but the same
  shape: pitches Webnua's positioning onto the customer's page.
- `src/lib/website/sections/offer.tsx:196-204` — `withDefaults`:
  ```ts
  function withDefaults(data: OfferData): OfferData {
    return {
      ...DEFAULTS,
      ...data,
      inclusions: data.inclusions ?? DEFAULTS.inclusions,
      items: data.items ?? DEFAULTS.items,
      signals: data.signals ?? DEFAULTS.signals,
    };
  }
  ```
  The `?? DEFAULTS.x` pattern is the actual leak vector — `data` overrides
  scalar fields, but for arrays the seed wins on null/undefined. The
  pattern is mirrored in **every** section module's `withDefaults`.

**Same leak class confirmed in:**

- `src/lib/website/sections/cta.tsx:127-131` `SEED_SIGNALS`
  ("100% satisfaction", "Secure & reliable", "24/7 support" — generic
  filler, not agency pitch, but still placeholder content the customer
  did not write).
- `src/lib/website/sections/cta.tsx:154-180` panelA + panelB defaults
  ("Stay in the loop. Subscribe to our newsletter…", "Need help? Our
  support team is here to help…" — direct-response newsletter copy
  unrelated to a trades business).
- `src/lib/website/sections/features.tsx:104-137` `SEED_ITEMS`. Four
  hard-coded service lines: Plumbing / HVAC / Electrical / Cleaning. For
  any trade *other* than these four, the leak is a category error — a
  landscaper's "features" section silently lists "Plumbing — From repairs
  to installations".
- `src/lib/website/sections/hero.tsx:73-93` `DEFAULTS`. Spread-not-array
  pattern (`{ ...DEFAULTS, ...data }`), so only individual omitted fields
  leak — but the strings *are* Voltline-specific ("Power back on,
  guaranteed within the hour.", "Licensed sparkies covering Perth
  metro."). For non-electrician trades, an omitted `headline` would
  produce category-wrong copy.
- `src/lib/website/sections/reviews.tsx:114-136` `SEED_ITEMS` — three
  fabricated testimonials with full names ("Jessica M.", "Daniel R.",
  "Sarah L."). These already have a safety net via the
  `placeholder-testimonials.ts` snapshot detection (B16 in CLAUDE.md),
  but the snapshot only fires when the AI emits them — if the AI omits
  and `withDefaults` silently overlays, the snapshot path is bypassed
  entirely because `toSection` in `generation-stub.ts` snapshots the
  inbound data not the fallback.

**Why this matters.** Anything in `DEFAULTS` that the renderer reads when
`data.x` is null/undefined leaks to the customer-facing snapshot once
serialised through `mergeDraftsIntoSnapshot` / `publishDraft`. The
agency-pitch copy was useful as editor-preview seed (operator opens an
empty offer section and sees what it looks like populated) but it was
never meant to render on a customer site.

### 1.2. Invalid enum emissions survive (Symptom 2)

The catalog in `generation-prompt.ts:352-563` tells the AI exactly which
enum values are valid per variant key. The validation pipeline does not
enforce membership.

**Live count (last 30 days):**

```text
offer sections (last 30d)                            : 80
  - emit layout='single' (invalid; allowed: card|stack) : 10  (12.5%)
  - omit layout entirely                                : 32  (40.0%)

hero sections     : 208;  layout missing : 76  (36.5%)
cta sections      : 180;  layout missing : 66  (36.7%)
features sections : 160;  layout missing : 51  (31.9%)
faq sections      : 150;  layout missing : 64  (42.7%)
reviews sections  : 133;  layout missing : 53  (39.8%)
about sections    : 109;  layout missing : 109 (about has no `layout`)
gallery sections  : 14;   layout missing : 0
```

The `about` / `trust` 100% "layout missing" counts are noise — those
sections don't have a `layout` field at all (about uses `imageSide` +
`extra`; trust uses `display`). The relevant signal is the 30–43% rate
on sections that **do** carry `layout`.

The 10 `offer.layout='single'` cases are the canonical example: the AI
hallucinated an enum value that doesn't exist. The renderer falls back
to whatever its switch hits on default (which, in `offer.tsx`, falls
through to one of `card` / `stack` — but unpredictably so).

**Location:**

- `src/lib/website/generation-stub.ts:309-381` `runValidationPipeline`.
  Currently checks: (a) section type known via `getSectionMeta`, (b)
  container compatibility (`page`), (c) page-type compatibility, (d)
  strips `theme` if present (the design-doc theme-discard guard;
  precedent for our enum guard), (e) reports missing fields. **Never**
  validates enum membership.
- `src/lib/website/generate-funnel-live.ts:716-789` `validateAndAssemble`.
  Same shape, same gap — it also discards `theme` and reports missing
  fields, no enum check.
- `src/lib/website/generation-prompt.ts:352-563` `SECTION_SHAPE_CATALOG`.
  Already lists `{ key, values, guidance }` per variant — the source of
  truth the AI is shown. It is exported and importable; the validators
  just need to consume it.

**The precedent we follow.** `generation-stub.ts:354-365` actively
strips an emitted `theme` field and logs `reason='invalid'`. We follow
this shape verbatim for enum substitution and hallucinated-path
stripping — the new logic is a sibling of the existing theme guard.

### 1.3. Hallucinated image paths in production

The model occasionally invents image paths like
`/images/work-extension-1.jpg` that don't exist anywhere in the public
static tree.

**Live count (last 30 days):**

```text
hero.heroImageUrl     :   208 total | empty 162 (77.9%) | http 20 (9.6%)  | local-path 26 (12.5%)
gallery.items[].url   :    84 total | empty  72 (85.7%) | http  0 (0.0%)  | local-path 12 (14.3%)
about.imageUrl        :   109 total | empty  84 (77.1%) | http  5 (4.6%)  | local-path 20 (18.3%)
```

The "local-path" rows are hallucinations the renderer happily writes
into `<img src=>` — guaranteed 404 in production.

### 1.4. Unsplash stock images unused on the live path (Symptom 5)

`industry-templates.ts` ships hand-curated Unsplash URLs per industry,
but they only fire on the **deterministic fallback path**
(`generate-site` returns 503 → client falls back to `generateSync`).

**Location:**

- `src/lib/website/industry-templates.ts:69-76` — `IndustryStockImages`
  shape: `{ hero: string; gallery: readonly string[]; team?: string }`.
- `src/lib/website/industry-templates.ts:172-180` (electrician) and
  matching blocks per industry (lines 234-, 296-, 357-, 418-, 479-,
  541-, 603-, 660-, 721-, 776-) — 11 industries total, each with one
  hero URL + 3-4 gallery URLs.
- `src/lib/website/industry-templates.ts:995-1051`
  `renderIndustryPromptBlock` — emits *most* of the template into the
  prompt but **omits `stockImages`**. The AI is never told about them.
- `src/lib/website/generation-stub.ts:579` (`fillHero` →
  `heroImageUrl: template.stockImages.hero`) and
  `src/lib/website/generation-stub.ts:735` (`fillGallery` overlays the
  gallery URLs onto base items). Both consume `stockImages` but **only
  fire when `ANTHROPIC_API_KEY` is unset** and `/api/generate-site`
  returns 503.
- `src/lib/website/generate-live.ts` and
  `src/lib/website/generate-funnel-live.ts` — the live Claude paths.
  Neither consumes `stockImages`. Result: in production-with-API-key,
  the deterministic path *never* fires and the stock images are
  unreachable.

**Why this is correct (and why injection lives post-AI).** The brief is
right: putting Unsplash URLs in the prompt asks the AI to hallucinate
something close, which is worse than picking the curated URL ourselves.
Image injection belongs in the validation/assembly pipeline, *after*
the AI returns, *after* hallucinated paths are stripped — co-located
with the existing fallback log.

### 1.5. Top generation_log fallback fields (last 30 days)

For context — the most-omitted fields the validators currently see:

```text
cta.panelB             missing : 66   (panelB is a dual-layout-only field)
cta.panelA             missing : 66
cta.imageUrl           missing : 56
cta.dualDivider        missing : 55
cta.imageSide          missing : 53
cta.overlayOpacity     missing : 52
reviews.spotlightImage missing : 52
hero.overlayOpacity    missing : 48
hero.theme             missing : 48   (theme is stripped on emit — see note)
hero.heroImageUrl      missing : 48
features.ctaStyle      missing : 47
features.ctaHref       missing : 47
features.ctaLabel      missing : 47
```

The `hero.theme: missing` 48 count is a separate bug — `theme` is in
`defaultDataKeys` but the model is told NOT to emit it; the validators
flag it as missing then the theme-discard guard removes it anyway.
That's just noise in the log, not a real fallback. **Not in scope for
this PR** — flagged as a follow-up: remove `theme` from
`defaultDataKeys` after confirming nothing else consumes that field's
presence.

The 48 `hero.heroImageUrl: missing` is the gap Bundle B closes —
right-size to the 77.9% empty count in §1.3.

---

## 2. Existing code shape — what we extend, what we leave

### 2.1. The validation pipelines

Two functions, same shape:

- **Website pipeline.** `src/lib/website/generation-stub.ts:311-381`
  `runValidationPipeline(sections, ctx, generationId)`. Iterates
  sections; per section: looks up `SectionMeta`; drops unknown / wrong
  container / wrong page type; strips `theme` (logs `invalid`); reports
  missing fields against `defaultDataKeys` (logs `missing`); pushes the
  cleaned section. Returns `{ sections, fallbackLog, droppedSections }`.

- **Funnel pipeline.** `src/lib/website/generate-funnel-live.ts:716-789`
  `validateAndAssemble(rawSections, brief, generationId, cfg)`. Same
  three checks (type known, container compatible, theme stripped,
  missing fields reported). Plus: attaches the lead-capture
  `FormConfig` to the `form` section AND to step-1's hero (the
  `attachHeroFormEnvelope` rule).

The funnel pipeline does NOT check `allowedPageTypes` (funnel sections
don't have one). The website pipeline does NOT attach forms. Bundle A's
shared helpers (enum validation, hallucinated path stripping, image
injection) need to work for both — extracted into a server-safe shared
module both pipelines import.

### 2.2. `FallbackLogEntry` and the route writer

`FallbackLogEntry` (defined `generation-stub.ts:67-73`) carries:

```ts
{ generationId, sectionType, fieldName, reason: 'missing' | 'invalid', modelValue? }
```

The funnel pipeline imports the type from
`generate-funnel-live.ts:55`. **The `reason` field is a Postgres enum**
on `public.generation_log.reason`:

```text
generation_fallback_reason : missing | invalid
```

**Decision (locked).** New diagnostics (substituted enum, stripped
hallucinated path, injected stock image) re-use the existing two
values — no migration. The mapping:

| Pipeline action            | `reason`  | `modelValue` carries          |
|----------------------------|-----------|-------------------------------|
| Field absent / null        | `missing` | (none — `modelValue` omitted) |
| Theme strip                | `invalid` | the stripped theme object     |
| Enum value not in catalog  | `invalid` | the rejected enum value       |
| Hallucinated image path    | `invalid` | the rejected URL              |
| Image injected from stock  | `missing` | the URL we injected (string)  |

Image injection is logically a "missing-then-filled" case — the field
is absent (or just got cleared because it was a hallucination), and we
filled it with an industry-template URL. Logging it as `missing` keeps
the audit signal clean: a `missing`-with-`modelValue` row in
`generation_log` for image fields = "we injected"; a `missing`-without-
`modelValue` = "we left empty". Operators inspecting the log later
can distinguish injections from holes.

The brief asks for new reason values (`'injected_image'` /
`'fallback_image'`). I'd add them if the enum allowed it (it would be
the cleanest answer) — but adding to a pg enum requires a migration,
and the brief explicitly says reason values "should be additive". Using
the existing values is the smaller, additive change; a future session
can graduate to a richer enum if/when the volume warrants the schema
churn. Recorded in CLAUDE.md "Phase 6 generation fallback policy"
parked decision.

The route writer (`/api/generate-site/route.ts:118-142` +
`/api/generate-funnel/route.ts:123-145`) is shape-agnostic — it just
serialises the `FallbackLogEntry[]` into rows. No change needed there.

### 2.3. `SECTION_SHAPE_CATALOG` is server-safe

Verified: `generation-prompt.ts` is *not* `'use client'` and is already
imported by `generate-live.ts` / `generate-funnel-live.ts` (both
server-only). `SECTION_SHAPE_CATALOG` is `export const`. It is the
authoritative source for allowed enum values per `(sectionType,
variantKey)`. Bundle A's `validateEnums` helper imports it directly.

### 2.4. Where image injection happens

Per Bundle B's design (post-AI, pre-snapshot):

1. AI returns raw sections.
2. Theme-discard guard runs (existing).
3. **New: enum-membership guard runs** (Bundle A.2).
4. **New: hallucinated-path strip runs** (Bundle A.4).
5. **New: stock-image injection runs** (Bundle B.1), filling slots
   that are now empty.
6. Item-count vs columns reconciliation (Bundle A.3).
7. Missing-field reporting + `populatedFields` derivation (existing).
8. Section returned.

Order 4→5 is intentional: B1's strip runs *before* B's injection so a
fresh stock URL replaces the stripped hallucination. Documented in
code comments.

### 2.5. `stockImages` per industry — sufficiency check

All 11 industries (electrician, plumber, cleaner, landscaper, roofer,
painter, hvac, locksmith, handyman, carpenter, generic) carry:

- `hero: string` (one URL)
- `gallery: readonly string[]` (3-4 URLs)
- `team?: string` (optional; sparsely populated)

No industry is sparse on `hero` or `gallery`. Bundle B's helper can
assume both fields are present for every `IndustryKey`. The optional
`team` is only used by `about` sections that ask for a portrait —
fall back to `gallery[0]` when absent.

**Image accessibility — deferred.** Bundle B.3 ships a standalone
script `scripts/audit-stock-images.ts` that probes every URL. Any 404s
are reported in the PR description for a follow-up refresh session;
this PR does not change the URLs themselves (out of scope, and a 404
in `stockImages` does no worse than the current empty state).

---

## 3. Implementation outline

### 3.1. New module: `src/lib/website/generation-validation.ts`

Server-safe (no `'use client'`), pure functions, no I/O:

- `validateEnums(type, data) → { data, fallbacks }` — for every catalog
  entry under `SECTION_SHAPE_CATALOG[type].variants`, check if
  `data[key]` is present AND not in `values`. If invalid, substitute
  with the first listed value AND record a `FallbackLogEntry`
  `(reason='invalid', modelValue=<the bad value>)`. If absent, leave
  it alone (the existing missing-field pass handles that).
- `stripHallucinatedImages(type, data) → { data, fallbacks }` — for
  every known image field (`heroImageUrl`, `imageUrl`,
  `spotlightImageUrl`, `items[].imageUrl` for sections that carry
  image-bearing item arrays), if the string is non-empty AND doesn't
  start with `http://`, `https://`, or `/` followed by a known asset
  prefix, clear it AND record `(reason='invalid', modelValue=<the bad
  URL>)`. Known image fields per section type are read from
  `SectionMeta.capabilityHints.mediaFields` — already an enumeration
  of "fields that hold media". Item-array image fields (gallery items'
  `imageUrl`, features items' `imageUrl`) are listed in a small
  per-section table inside the module.
- `reconcileColumns(type, data) → data` — for sections with
  `(items, columns)`: if `items.length < columns`, clamp `columns`
  down to `items.length`. If `items.length` ≥ `columns * 3 + 1`,
  leave it (model wanted that many; wrap is fine).
- `injectStockImages(type, data, industry, designerSeed) → { data, fallbacks }` —
  for any image slot that is now empty (whether AI omitted or B4
  stripped), fill from `industryTemplate.stockImages.{hero, gallery,
  team?}`. Designer seed lets us pick different gallery indices per
  call so a same-industry hero + cta don't share the same photo where
  the template has multiple. Logs `(reason='missing',
  modelValue=<injected URL>)` so the audit trail flags injections.

### 3.2. Section-default cleanup

- `offer.tsx` — replace `SEED_ITEMS` (agency pitch) with `[]`. Update
  `withDefaults` to `data.items ?? []` (or remove the fallback
  entirely — see below). Replace `SEED_INCLUSIONS` with `[]`. Replace
  `SEED_SIGNALS` with `[]`. The renderer must tolerate empty arrays —
  audit the previews and fix if they crash.
- `cta.tsx` — replace `SEED_SIGNALS` with `[]`. Replace panelA / panelB
  copy with a neutral "Title goes here / Sub goes here" pair. PanelA
  and panelB only render in `layout='dual'`; the AI can still populate
  them, but the fallback won't leak "newsletter" copy.
- `features.tsx` — replace `SEED_ITEMS` (hardcoded plumbing / HVAC /
  electrical / cleaning) with `[]`. The renderer must tolerate an
  empty grid.
- `hero.tsx` — replace Voltline-specific strings ("Power back on,
  guaranteed within the hour.", "Licensed sparkies covering Perth
  metro.") with industry-aware placeholders that resolve at render
  time *or* with neutral strings. The first option is structurally
  invasive (the section module is `'use client'` and would need to
  import the industry resolver). The second is honest: a neutral
  fallback ("Your headline goes here." / "Your sub goes here.") is
  clearly placeholder text the operator will replace, but it never
  ships in production because the AI fills both. The leak only fires
  if the AI omits, and in that case neutral copy is *better* than
  industry-specific copy that happens to match the operator's trade
  by accident.
- `reviews.tsx` — replace `SEED_ITEMS` (three fabricated testimonials)
  with `[]`. The B16 `placeholder-testimonials.ts` snapshot already
  covers AI-emitted invented reviews; emptying the seed closes the
  parallel "AI omitted → seed leaks" path.
- `about.tsx`, `trust.tsx`, `faq.tsx`, `contact.tsx`, `gallery.tsx`,
  `header.tsx`, `footer.tsx` — these carry generic chrome that's
  legitimately useful as editor placeholder ("Years in business",
  "Get in touch"). Audit each for any Voltline-specific or agency-pitch
  content. Most are fine. The few that aren't (e.g. the
  `contact.tsx` "hello@example.com" / "(555) 123-4567" defaults —
  generic placeholders, not agency pitch, but they could embarrass a
  customer who forgets to publish-edit) get replaced with empty
  strings.

For each cleaned default, `withDefaults` either:
(a) loses the `data.x ?? DEFAULTS.x` clause (renderer reads `data.x`
directly, which may be undefined; renderer handles that), OR
(b) keeps it with the now-empty `[]` / `''` default so the
renderer gets a consistent shape.

Choice per-array: keep `withDefaults` consistent with the existing
renderer call sites (`d.items.map(...)`) — option (b) is safer and
shorter. The empty array fallback IS the renderer's "no content" path.

### 3.3. Wiring into the two pipelines

`generation-stub.ts` `runValidationPipeline`:

```text
1. drop on type / container / page-type checks   (existing)
2. theme strip                                   (existing)
3. validateEnums(type, data)                     (NEW — Bundle A.2)
4. stripHallucinatedImages(type, data)           (NEW — Bundle A.4)
5. injectStockImages(type, data, industry)       (NEW — Bundle B.1)
6. reconcileColumns(type, data)                  (NEW — Bundle A.3)
7. missing-field reporting on defaultDataKeys    (existing)
```

`generate-funnel-live.ts` `validateAndAssemble`:

Same pipeline. The funnel context already carries `brief` (which
includes `industry`); pass `brief.industry` through to
`injectStockImages`.

### 3.4. Deterministic-path consolidation

`generation-stub.ts:fillHero` (line 579) and `fillGallery` (line 735)
currently consume `stockImages` inline. Refactor both to call
`resolveStockImage(industry, sectionType, fieldKey, index?)` so the
live path and deterministic path share one helper. Net delta:
deterministic path keeps working (same URLs, same fields), live path
now also fills them.

---

## 4. Out of scope (deferred)

- **Bundle C — section variety.** Recipe / section-plan / prompt
  changes that diversify visual structure. The CLAUDE.md drift this
  introduces is explicitly listed as a Bundle C concern.
- **AI prompt edits.** `generation-prompt.ts` is read-only this PR.
  `SECTION_SHAPE_CATALOG` is imported but not changed.
- **Model selection.** Opus on funnel / Sonnet on offer stays.
- **Stock-image URL refresh.** The `scripts/audit-stock-images.ts`
  helper reports any 404s; refreshing them is a follow-up.
- **`generation_log.reason` enum expansion.** Using the existing two
  values (`missing` / `invalid`) plus `modelValue` to disambiguate
  injections from holes is sufficient for V1. A richer enum
  (`enum_substituted` / `path_stripped` / `image_injected`) is a
  later schema migration.
- **Header / footer image injection.** Not in audit's image-empty
  numbers (header.logoImageUrl is operator-uploaded; footer doesn't
  carry images). Not in scope.
- **Public-render image lazy-load / `next/image`.** Image perf is its
  own concern. This PR puts a URL on every section; how the renderer
  presents it is unchanged.

---

## 5. Verification plan (run before PR open)

1. **Pattern B signup E2E.** Sign up at `/sign-up`, complete the wizard,
   visit `{slug}.webnua.dev`. Confirm: no agency pitch in any offer,
   hero has an industry-appropriate Unsplash image, gallery (if
   recipe includes one) has images, offer layout is `card` or
   `stack` (never `single`).
2. **Cross-industry generation.** Electrician (Dublin), cleaner
   (London), landscaper (Cork). Different hero photos. Different
   trust-signal sets. No category-error features.
3. **Forced AI failure.** Block the API or pass a malformed brief.
   Verify deterministic fallback is honest — no agency pitch, stock
   images present, layouts valid.
4. **Image accessibility.** `curl -I` against 5 generated heroes +
   galleries. All 200. Any 404s = follow-up.
5. **`generation_log` spot-check.** Fresh generation; confirm
   `reason='invalid'` rows for `modelValue='single'` on
   `(section_type=offer, field_name=layout)` if AI hallucinates again
   (or for `theme` if AI emits it), and `reason='missing'` rows with
   non-null `modelValue` on image fields (the injection signal).
6. **`pnpm typecheck` + `pnpm lint`.** Clean.

---

## 6. Risk register

- **Section renderer crashes on empty arrays.** Mitigation: audit each
  renderer for `data.items.map`, `data.items.length` etc.; ensure
  graceful empty handling. The audit is part of Bundle A's section
  cleanup commit.
- **Industry resolution returns `'generic'` for an unmatched brief.**
  `industry-templates.ts` `GENERIC` carries `stockImages.hero` and
  `gallery`. Verified above. No risk.
- **Enum substitute is wrong for the section's intent.** Picking the
  catalog's first value can be visually unexpected if the AI was
  *intending* something specific. Mitigation: log to `generation_log`
  so operators can review patterns; the editable-after-generation UX
  lets the operator fix it in two clicks. Documented in CLAUDE.md.
- **Stock image collisions across heroes/CTAs on the same page.** A
  hero and a CTA on the same industry-electrician page would both
  pick `stockImages.hero` without a designer seed. Mitigation: pass
  a per-page designer seed to `injectStockImages` so CTA picks a
  different gallery index when hero already took the hero URL.
- **Funnel reviews placeholder snapshot.** `generation-stub.ts:393-398`
  snapshots reviews items for the B16 nudge. Emptying `SEED_ITEMS`
  in `reviews.tsx` means `toSection` snapshots an empty array if the
  AI omits — which is fine; the B16 nudge correctly reports zero
  unedited placeholders.

---

## 7. Sign-off

Audit complete. Numbers confirmed against the live `webnua` project.
Bundle A and Bundle B implementations follow this document. Any
deviation that arises during implementation gets recorded back here
with a `[deviation:YYYY-MM-DD]` marker so the audit and the code stay
in agreement.
