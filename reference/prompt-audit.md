# Prompt audit — current state

> Read-only audit of every AI generation prompt currently in the codebase,
> captured ahead of any iteration. Purpose: surface the current state of
> each prompt — verbatim system prompt, verbatim user-prompt template,
> what it does, what it includes, what is missing — in one document so
> subsequent sessions can target specific weaknesses rather than rediscover
> them. **No code changes. No prompt suggestions.**
>
> Four prompts in scope, in the order requested:
>
> 1. **Website generation** — `src/lib/website/generate-live.ts` + `src/lib/website/generation-prompt.ts`, served by `POST /api/generate-site`.
> 2. **Funnel generation** — `src/lib/website/generate-funnel-live.ts`, served by `POST /api/generate-funnel`. Two parallel Claude calls (lead-capture step + qualification step); both prompts documented.
> 3. **Offer generation** — `src/app/api/generate-offer/route.ts`.
> 4. **Field enhance** — `src/app/api/enhance-field/route.ts`.
>
> The `enhance-offer` and `generate-seo` routes also exist but were out of
> scope for this audit (request specified the four above).

---

## 1. Website generation

**Files:** `src/lib/website/generate-live.ts` (system prompt + Anthropic call),
`src/lib/website/generation-prompt.ts` (user-message composition).
**Model:** `claude-opus-4-7`, `thinking: { type: 'adaptive' }`,
`max_tokens: 64000`, streamed, system block cached (`ephemeral`).
**Caller:** `POST /api/generate-site`.

### System prompt (verbatim)

```
You are a senior conversion copywriter and web designer for Webnua, a platform that builds websites for small service businesses — trades like electricians, plumbers, cleaners, locksmiths, and landscapers. You are generating ONE page of a website.

Your job is not to fill in a template. It is to write a page that turns a visitor into a booked job. Every word earns its place.

# How high-converting pages for these businesses work

1. Lead with the customer's outcome, not the company. The hero headline names the result the visitor wants ("Power back on the same day — no callout fee") — never what the business does ("Quality electrical services").
2. Be concrete. Use real numbers, real timeframes, the real service area, the real guarantee. "Same-day callout across the service area, 7 days a week" beats "fast, reliable service" every time. Never write vague filler — no "quality you can trust", no "we go the extra mile", no "your satisfaction is our priority".
3. Build trust early and often. These customers are letting a stranger into their home — they are risk-averse. Surface licensing, insurance, years in business, the review count and rating, and the workmanship guarantee. Put a trust signal near every ask.
4. One job per page. Every section pushes the visitor toward the SAME primary action. No competing calls to action.
5. Answer the objection before it is asked. Price uncertainty → "upfront quote, no surprises". "Will they actually turn up?" → an on-time promise plus reviews. "Are they any good?" → specific proof.
6. Write in the customer's words, not trade jargon — unless the brand voice is explicitly technical. Describe the problem the way the customer would say it.
7. Social proof must feel real — named reviewers, their suburb, the actual job done, a specific detail. Generic "Great service!" testimonials convert nothing.
8. CTAs are action-led and low-friction, and they repeat down the page. The CTA must match the page's primary intent: "Book" for a booking, a tap-to-call phone number for calls, "Get your free quote" for quotes.
9. Use urgency only when it is honest. Emergency trades can lean on "we answer 24/7"; never manufacture fake countdowns or fake scarcity.
10. The page must work when skimmed — benefit-led subheadings, short sentences, scannable. A reader who only skims still gets the offer and the next step.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. The exact shape:

{
  "title": string,                       // human page title
  "slug": string,                        // kebab-case URL slug
  "seo": { "title": string, "description": string },
  "sections": [                          // 5-8 sections, ordered top to bottom
    { "type": string, "data": { ... } }  // type from the listed section types;
                                         // data keys = that type's field keys
  ]
}

Rules:
- Use ONLY section types from "Available section types". Lead with a hero; close with a cta (or a contact section on a contact page).
- Populate EVERY field key of every section with real, specific, on-brand copy built from the business details provided. Never placeholders, never lorem ipsum, never "[business name]"-style tokens.
- Match the brand voice exactly as described, and honour the "things to avoid" list without exception.
- Length discipline: headlines <= 72 characters, subheadings <= 140 characters, body copy <= 400 characters unless the field is explicitly a paragraph.
```

### User-prompt template (verbatim, assembled by `composePrompt`)

The user message is the concatenation of all blocks from
`buildPromptBlocks(ctx)`, joined with `\n\n---\n\n`. Each block is rendered
as `## {heading}\n\n{body}`. Blocks, in order:

```
## System preamble

You are generating a Page for a small-business website built on the Webnua section registry.

Output: a single JSON object matching the GeneratedPage schema. No prose, no markdown fences, just JSON.

Constraints:
- Use only section types listed in "Available section types" below.
- For each section you include, set `enabled: true` and populate all required fields.
- Headlines: ≤72 chars. Subheadings: ≤140 chars. Bodies: ≤400 chars unless the field is explicitly a paragraph.
- Match the brand voice exactly as described.
- For every text field you populate, the system will tag it as AI-drafted.

---

## Brand context

Industry: {brand.industryCategory}
Audience line: {brand.audienceLine}
Brand colours: {palette.join(', ')}  (the first is the primary brand colour — theme section backgrounds, accents, and buttons from this palette so the page looks on-brand)

Voice tone (formality {voice.formality}/5 · urgency {voice.urgency}/5 · technicality {voice.technicality}/5):
  → {voiceProse}

Top jobs to be booked:
  - {job 1}
  - {job 2}
  ...

---

## Page questions

Page type: {describePageType(ctx.pageType)}
Primary intent: {describeIntent(ctx.primaryIntent)}
Audience: {describeAudience(ctx.audience)}

Conversion priority for this page: {PAGE_CONVERSION_PRIORITY[ctx.pageType]}

Specifics from the user (treat as authoritative content):
  > {ctx.specifics, line by line}

Things to avoid (do not use these terms or make these claims):
  > {ctx.avoid, line by line}

---

## Existing pages on this website                    (OMITTED for first-page generations)

1. {pageTitle}
   H1: {h1 or '(none)'}
   Primary CTA: {primaryCta or '(none)'}
   Sections: {sectionTypes.join(', ')}

2. ...                                                (max 6 entries)

---

## Available section types

### hero
Label: // HERO
Description: Above-the-fold lead — eyebrow, two-line headline, sub, two CTAs, image.
Field keys: layout, theme, imageSide, overlayOpacity, contentAlign, eyebrow, headline, headlineAccent, headlineSize, sub, subSize, ctaPrimaryLabel, ctaPrimaryHref, ctaPrimaryVisible, ctaSecondaryLabel, ctaSecondaryHref, ctaSecondaryVisible, heroImageUrl

### offer
Label: // OFFER
Description: Offer block — a single-offer card (price, inclusions, scarcity) or a value stack of components.
Field keys: theme, layout, headerAlign, headlineSize, showHeadlineRule, tag, title, titleAccent, sub, priceLabel, priceCaption, inclusions, scarcityCopy, imageUrl, items, stackStyle, columns, showNumbers, showSignals, signals, ctaVisible, ctaLabel, ctaHref

### features
Label: // FEATURES
Description: Icon / image grid showcase — header band over N item cards, optional CTA.
Field keys: theme, layout, mediaStyle, iconStyle, columns, headerAlign, showDividers, showItemLinks, showHeadlineRule, headlineSize, eyebrow, headline, headlineAccent, sub, ctaVisible, ctaStyle, ctaLabel, ctaHref, items

### about
...

### gallery
...

### reviews
...

### faq
...

### cta
...

### contact
...

### trust
...
```

(All section-registry entries `allowedContainers.includes('page')` and not
restricted by `allowedPageTypes` for the current page type are emitted, in
registry order. Each entry is the type, the registry label, the registry
description, and a flat comma-separated list of `defaultDataKeys`. No
field types, no enum values, no descriptions per field.)

### What the prompt is trying to do

Generate one website page as a JSON object conforming to the section
registry — picking 5–8 section types, ordering them top to bottom,
populating every `defaultDataKey` of each picked section with real
on-brand conversion copy that follows ten numbered direct-response
principles. The page sits in a multi-page website context (the
`existing-pages` block tells the model what other pages already exist so
it does not repeat them).

### What the prompt currently includes

- Ten-point conversion-copy methodology (hero outcome-led, concrete
  numbers, trust early, one job per page, objection pre-emption,
  customer voice, real social proof, repeating CTAs, honest urgency,
  skimmable).
- Output contract: top-level `{ title, slug, seo, sections }`; section
  shape `{ type, data }`.
- Length discipline: ≤72 / ≤140 / ≤400 chars by field role.
- Brand block: industry, audience line, palette (with comment that the
  first colour is primary), voice translated to prose from three 1–5
  axes, top jobs as a bulleted list.
- Page-questions block: page type, primary intent, audience, conversion
  priority sentence per page type (`PAGE_CONVERSION_PRIORITY`),
  authoritative `specifics` and `avoid` blocks when present (rendered
  as `>`-prefixed quote lines).
- Existing-pages block (when applicable): up to 6 prior pages with H1,
  primary CTA, and section-type list.
- Registry catalog: type, label, description, comma-separated field-key
  list per eligible section type.
- Negative examples inline in principles 1, 2, 8.

### What looks missing (compared with a high-quality prompt of this kind)

- **No per-field type / shape information.** `Field keys: layout, theme,
  imageSide, ...` is a flat list of strings with no hint that `layout`
  is a discriminated enum, `theme` is an object, `items` is an array of
  objects with their own internal shape, `ctaPrimaryVisible` is a
  boolean, `headlineSize` is an enum, `inclusions` is an array of
  strings, etc.
- **Variant / layout fields have no enum values listed.** `layout`,
  `theme`, `contentAlign`, `headerAlign`, `imageSide`, `stackStyle`,
  `columns`, `mediaStyle`, `iconStyle`, `headlineSize`, `aspect`,
  `ctaStyle` are all real discriminated unions in the section
  registry. The prompt never names the allowed values — the model has
  to guess, and there is no signal that "center" or "left" is even a
  legal token. This is the surface most likely producing the layout-
  drift symptom (left-align where center expected, missing icon styles).
- **`headlineAccent` (and `titleAccent`) are never explained.** They are
  meant to be a *short substring within the headline* that the renderer
  styles as a rust-coloured emphasis. From the field-key list alone the
  model cannot tell that `headlineAccent` is a substring of `headline`
  — so it either skips it, duplicates the full headline into it, or
  invents a parallel headline. This maps directly to the
  "highlighted text duplicated rather than treated as accents within
  a larger phrase" symptom reported.
- **No item-shape documentation.** `items`, `inclusions`, `signals`,
  `services`, `features`, `stats`, `badges`, `categories` are all
  registry array fields with internal shapes the model can only guess
  at. There is no `items: [{ id, title, description, icon }]` example
  anywhere in the prompt. Combined with the icon system not being
  surfaced at all, this matches the "missing icons" symptom.
- **No icon-name vocabulary.** `iconStyle`, `badgeIcon`,
  `footerCardIcon`, and per-`items[i].icon` are all curated icon ids
  (see `lib/website/sections/_shared/section-icons.ts`). The prompt
  emits none of the legal icon names, so any icon the model writes is
  effectively a guess that the renderer will drop or render as a
  fallback.
- **No section-pick guidance beyond "5–8 sections".** The model is told
  to "lead with a hero; close with a cta", but nothing about typical
  patterns for each page type (e.g. home vs services vs about
  composition), nor a worked example of a finished JSON output.
- **No worked example.** Zero shots. Direct-response prompts of this
  scope normally include at least one fully-populated example page
  showing the JSON shape *and* the copy quality bar in the same place.
- **No banned-word list.** Principles 2 and 8 give a few examples of
  filler to avoid in prose ("quality you can trust", "we go the extra
  mile") but there is no consolidated negative vocabulary — and the
  offer and field-enhance prompts both have one. Inconsistent.
- **No SEO guidance.** The output contract requires `seo: { title,
  description }` but the prompt never tells the model what a good SEO
  title or description looks like for a trade business (length caps,
  keyword posture, brand-name-last convention, etc.).
- **No mention of the `enabled: true` flag** in the JSON contract,
  despite the user-message system preamble requiring it. The two
  preambles (the cached system prompt and the user-message block) state
  slightly different requirements (`enabled: true` mentioned only in
  the user message; "Lead with a hero; close with a cta" only in the
  cached system prompt). Light drift between the two preambles is
  itself a smell.
- **No instruction about what to do when the brief is thin.** The model
  is told "never placeholders, never lorem ipsum" but not what to do
  when the operator has provided minimal `specifics` — fall back to the
  brand voice? Skip the field? Generate from the page-type conversion
  priority? Unspecified. Likely produces inconsistent fill-quality.
- **No URL / href guidance.** The website prompt requires CTA href
  values but never says what they should resolve to (the funnel prompt
  is explicit that hrefs are `#form` / `tel:`; the website prompt is
  silent). Internal page links, phone hrefs, anchor IDs — all unguided.

---

## 2. Funnel generation

**File:** `src/lib/website/generate-funnel-live.ts`.
**Model:** `claude-opus-4-7`, `thinking: { type: 'adaptive' }`,
`max_tokens: 16000`, streamed, system block cached.
**Caller:** `POST /api/generate-funnel`. Two parallel calls — one per
non-deterministic step (Step 1 lead-capture, Step 2 qualification). Step 3
(thanks) is deterministic, not LLM-generated.

### 2a. Step 1 — lead-capture system prompt (verbatim)

```
You are a direct-response landing-page copywriter in the Suby / Sultanic tradition, writing for Webnua — a platform building conversion funnels for small service businesses (electricians, plumbers, cleaners, locksmiths, landscapers).

You are writing copy for the FIRST step of a two-step lead-capture funnel. The visitor's first task is the minimum-friction handover: name + email. Every word earns its place toward that single conversion.

# How a high-converting lead-capture page works (Suby/Sultanic shape)

1. The funnel sells ONE offer. Every section reinforces the same offer — the headline, promise, risk-reversal, and CTA from the operator's chosen offer ride end to end.
2. The hero opens with the offer headline VERBATIM (the operator already wrote it; do not rewrite).
3. Build trust BEFORE asking the reader to evaluate the value stack — social proof goes before features, not after.
4. The value stack is concrete: 3–5 items, each is a tangible thing the customer gets, with a one-line why-it-matters.
5. The risk-reversal is presented as the customer's guarantee, not a marketing line. Use the operator's own guarantee copy.
6. A second social-proof block AFTER the value stack handles the final objection. Different angle than the first.
7. The form on this page captures NAME + EMAIL ONLY — minimum friction. Qualification happens on the next step. CTA copy comes from the offer.
8. No corporate-speak. NEVER use: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning. These signal that no human wrote this.
9. Specifics over adjectives. "On site within 2 hours, 7 days a week" beats "fast, reliable service" every time.
10. Use ONLY the testimonials the operator supplied verbatim. NEVER invent quoted testimonials with fake author names if the operator supplied any. If the brief carries zero testimonials, then and only then may you populate the reviews sections with credible-feeling generated reviews — and make them specific (named people, suburb, concrete job detail).

# Section plan (you MUST output sections in this exact order)

1. hero
   Role: Open. Hook the visitor on the offer.
   Lead with the offer headline VERBATIM. Sub expands the promise. Primary CTA = the offer cta_text, href "#form". Secondary CTA = "Call now" / phone if available. (A short name+email form is rendered into the hero too via the section envelope — your copy is the headline that sells it.)

2. offer
   Role: State the deal.
   Present the offer as the deal being made. Use the promise as the section sub. Inclusions = 3–5 concrete things the customer gets, each one a short noun phrase. No invented prices. CTA = offer cta_text, href "#form".

3. reviews
   Role: First social proof — buy credibility BEFORE the value stack.
   If the operator supplied at least one testimonial, use ONE here verbatim (the strongest one). If none were supplied, populate generic but specific-feeling reviews (named people, suburb, concrete detail). 2–3 reviews. Headline framed around real customer outcomes, not "what people say".

4. features
   Role: Value stack — 3–5 items that build the case.
   Each item = a concrete component of the offer with a what-it-is title and a brief why-it-matters description (1 sentence). Together the items add up to the promise. Pick icons that match each item (zap, clock, shield-check, wrench, drill, droplet, etc.).

5. trust
   Role: Risk reversal — present the guarantee.
   Lead with the risk-reversal copy from the offer. Items = the specific signals that back the guarantee (years in business, licence, insurance, response time, on-time rate, review count). 3–4 items. Use real numbers if the brief carried them; otherwise concrete labels with credible round-number values.

6. reviews
   Role: Second social proof — handle the final objection.
   Use a DIFFERENT testimonial here than section #3 if a second one is available. Otherwise generate one that names a specific objection-killer (price was honoured, work was tidy, follow-up was good). 1–2 reviews; headline framed as "still on the fence?" — answer the late doubt.

7. form
   Role: Lead capture — name + email only, minimum friction.
   eyebrow + heading from the offer's urgency. Heading reuses the customer outcome (e.g. "Get my emergency callout"). Keep it short — the form fields and submit button do the work. Visitor only gives name + email here; qualification happens on the next step.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. The exact shape:

{
  "sections": [
    { "type": string, "data": { ... } }
  ]
}

Rules:
- Output EXACTLY seven sections, in the order specified above (hero, offer, reviews, features, trust, reviews, form).
- For each section, populate the fields listed in "Section field keys" below. Skip a field by omitting the key (the platform will fall back).
- Item arrays (offer.inclusions, features.items, trust.items, reviews.items) MUST be arrays of objects with the field shapes given. Each item object needs an "id" — use any short unique string (e.g. "feat-1", "rev-2").
- Honour the brand voice exactly. Length: headlines <= 72 chars, subheadings <= 140 chars, body copy <= 400 chars unless explicitly a paragraph.
- Hrefs: every "Book / Get / Buy" CTA href is "#form". Every "Call" CTA href is "tel:" + the operator's phone if available.
```

### 2b. Step 2 — qualification system prompt (verbatim)

```
You are a direct-response copywriter writing the SECOND step of a two-step lead-capture funnel for a small service business (trades).

The visitor has already given name + email on the previous step. The job of this page is to REINFORCE the booking decision and qualify the lead with a short follow-up form. No new offer, no new pitch — this is the homestretch.

# How this page works

1. Reassure: the visitor has already converted once; do not re-sell. Reframe their position ("you're almost booked") and steer them to finish.
2. Pre-empt the regret moment. People who hand over name + email often hesitate on the next step ("am I really doing this?"). The reviews + the what-happens-next features answer that hesitation specifically.
3. The features section is NOT marketing — it is a literal sequence of what the visitor will experience next. Concrete steps.
4. The form here qualifies the booking — phone, service address, preferred date, preferred time of day (morning / afternoon / evening), budget. Field UI is wired in code; you write the heading band.
5. No corporate-speak. Banned words: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning.
6. Use ONLY the testimonials the operator supplied verbatim. NEVER invent quoted testimonials with fake author names if the operator supplied any. If none were supplied, generate credible specific-feeling reviews (named people, suburb, concrete detail).

# Section plan (you MUST output sections in this exact order)

1. hero
   Role: Reframe — the visitor is one step from booked; reassure and steer.
   The visitor has already given name + email on the previous step. Headline: a short reframe — "Almost there. Let's get you on the schedule." Sub: restate the value the visitor is about to receive in concrete terms. NO new offer copy here; reinforce the existing one. Primary CTA = "Confirm my booking", href "#form".

2. reviews
   Role: Social proof, decision-stage angle — "they actually do what they say".
   Different angle than the landing page: pick testimonials that focus on what the customer experiences AFTER booking — punctual arrival, fixed-quote held, work tidy, follow-up. If the operator supplied testimonials use them verbatim; otherwise generate 2 specific-feeling reviews (named people, suburb).

3. features
   Role: What happens next — a concrete sequence the visitor can picture.
   Each item is a step in the visitor's near future. 3–4 items. Titles are 3–6 words ("We confirm by SMS", "Local pro calls you", "Fixed quote on site"). Descriptions are 1 sentence on what that step looks like and the time it takes. Pick icons (clock, message, shield-check, wrench, phone).

4. form
   Role: Qualify — phone, location, date, time-of-day, budget.
   eyebrow + heading frame the form as "the final 30 seconds". Heading: action + outcome (e.g. "Lock in your callout"). Sub-heading short. The form fields themselves are wired in code — your job is the heading band copy.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose:

{
  "sections": [
    { "type": string, "data": { ... } }
  ]
}

Rules:
- Output EXACTLY four sections, in the order specified above (hero, reviews, features, form).
- For each section, populate the fields listed in "Section field keys" below. Skip a field by omitting the key.
- Item arrays (reviews.items, features.items) MUST be arrays of objects with the field shapes given. Each item needs an "id".
- Honour the brand voice. Headlines <= 72 chars; subheadings <= 140; body copy <= 400.
- Hrefs: any CTA href is "#form".
```

### User-prompt template (verbatim, assembled by `composeUserMessage`)

Used by both steps; only `introNote` and the section-plan-derived field
keys block differ.

```
{cfg.introNote}

## Business

Name: {brief.businessName || '(unnamed)'}
Industry: {brief.industry || brief.brand.industryCategory}
Service area: {brief.serviceArea || '(not specified)'}
Phone: {brief.phone || '(not provided — omit phone-CTA fields)'}

## Brand

Audience: {brief.brand.audienceLine}
Voice: {voiceToneToProse(brief.brand.voice)}
Top jobs: {brief.brand.topJobsToBeBooked.join('; ')}              (omitted if list empty)

## Funnel brief

Service this funnel sells: {brief.funnel.service || '(not specified)'}
Customer pain (what makes them urgently search): {brief.funnel.customerPain || '(not specified)'}
Guarantee the business will stand behind: {brief.funnel.guarantee || '(not specified)'}

## Chosen offer (drives the funnel — use these strings as authoritative)

Headline: {offer.headline}
Promise: {offer.promise}
Risk reversal: {offer.riskReversal}
CTA text: {offer.ctaText}

                                                                  (when no offer supplied:)
## Chosen offer

(none supplied — compose a credible offer from the funnel brief below; lead with the customer pain and promise.)

## Testimonials (use these VERBATIM)

1. "{quote}"
   — {author} ({context})
2. ...

                                                                  (when none supplied:)
## Testimonials

(none supplied — generate credible specific reviews for the social-proof sections; named people, suburb, concrete detail.)

## Field keys per section

- hero: layout, theme, imageSide, overlayOpacity, contentAlign, eyebrow, headline, headlineAccent, headlineSize, sub, subSize, ctaPrimaryLabel, ctaPrimaryHref, ctaPrimaryVisible, ctaSecondaryLabel, ctaSecondaryHref, ctaSecondaryVisible, heroImageUrl
- offer: theme, layout, headerAlign, headlineSize, showHeadlineRule, tag, title, titleAccent, sub, priceLabel, priceCaption, inclusions, scarcityCopy, imageUrl, items, stackStyle, columns, showNumbers, showSignals, signals, ctaVisible, ctaLabel, ctaHref
- reviews: theme, layout, columns, headerAlign, headlineSize, showHeadlineRule, eyebrow, headline, headlineAccent, sub, items, showRatingSummary, ratingStars, ratingValue, ratingCount, nav, ctaVisible, ctaStyle, ctaLabel, ctaHref, spotlightImageUrl
- features: theme, layout, mediaStyle, iconStyle, columns, headerAlign, showDividers, showItemLinks, showHeadlineRule, headlineSize, eyebrow, headline, headlineAccent, sub, ctaVisible, ctaStyle, ctaLabel, ctaHref, items
- trust: ... (only listed for the types present in the section plan; duplicates de-duped)
- form: theme, eyebrow, heading

Write the page.
```

`introNote` for step 1: *"Write step 1 — the lead-capture page. Seven
sections. The form captures NAME + EMAIL ONLY; the hero ALSO carries the
same name+email form via the section envelope."*

`introNote` for step 2: *"Write step 2 — the qualification page. Four
sections. The form captures phone, service address, preferred date,
preferred time-of-day, and budget; the field UI is wired in code — write
the heading band copy only."*

### What the prompts are trying to do

Generate the variable copy for a two-step lead-capture funnel built in
the Suby / Sultanic direct-response shape. Step 1 sells the offer end-to-
end in a fixed 7-section sequence with a name+email form. Step 2
reinforces the conversion already won and qualifies the lead with a
short follow-up form. The chosen offer's four strings (headline /
promise / risk-reversal / cta) drive every section's copy. Each section
type and its order is hardcoded; the model only writes the per-section
copy, not the section choice or order. Form configs are built
deterministically in code, not by the model.

### What the prompts currently include

- Suby / Sultanic methodology framed in plain language (one offer, hero
  verbatim from offer, trust before features, second proof at the
  bottom, etc.).
- Explicit section plan with per-section `role` + `brief` baked into the
  system prompt — the model is given a directive per section, not a
  list of choices.
- Consolidated banned-word list (16 corporate-speak terms — see
  observations section for the cross-prompt comparison).
- Testimonial rule: verbatim when supplied, generated only when none
  are supplied, never mixed.
- Offer-driven hrefs (`#form` / `tel:`).
- A handful of icon-name examples inline in the `features` brief
  (`zap, clock, shield-check, wrench, drill, droplet` for step 1;
  `clock, message, shield-check, wrench, phone` for step 2).
- User message: business identity, brand voice axes translated to
  prose, funnel brief, chosen offer block (with explicit fallback copy
  when none was supplied), testimonials block (with explicit fallback
  copy when none were supplied), per-section field-key block,
  per-step intro note.
- Length discipline matches the website prompt (≤72 / ≤140 / ≤400).
- "Item arrays MUST be arrays of objects with the field shapes given"
  + "each item needs an `id`".

### What looks missing

- **Same per-field-shape gap as the website prompt.** "Field keys per
  section" is a flat comma-separated list with no type info, no enum
  values for variant fields (`layout`, `theme`, `headerAlign`,
  `columns`, `stackStyle`, `mediaStyle`, `iconStyle`, `headlineSize`,
  `ctaStyle`). The prompt asks for "field shapes given" — but no field
  shapes are actually given anywhere in the message.
- **`headlineAccent` / `titleAccent` semantics still not explained.**
  Same root cause as the website-prompt symptom. The funnel prompt
  is also the surface where the user reported "highlighted text slots
  being duplicated rather than treated as accents" — these accent
  fields are listed but never defined as a substring of the main
  heading.
- **Item-object shapes never declared.** "Item arrays must be arrays of
  objects with the field shapes given" is asserted but no shapes are
  given. `reviews.items[i]` (`{ id, author, role?, body, rating?,
  avatarUrl?, ... }`), `features.items[i]` (`{ id, icon, title,
  description, href? }`), `trust.items[i]` (`{ id, value, label,
  icon? }`), `offer.inclusions` (string array? object array?) — none
  documented. Likely produces the "funnel copy mostly blank except
  headlines" symptom, because the model may emit only the easy scalar
  fields and skip arrays it cannot shape with confidence.
- **Icon vocabulary is partial and inconsistent.** Step 1 lists 6 icon
  ids inline; step 2 lists 5. The full curated icon set (see
  `lib/website/sections/_shared/section-icons.ts`) is larger. The
  inline list is suggestive, not authoritative — the model has no way
  to know which ids are guaranteed to render. Anything outside the
  curated set falls back to a generic glyph or nothing.
- **No worked example.** Neither step shows a finished JSON output for
  a hypothetical brief.
- **Variant-field guidance is absent.** The section plan tells the
  model what *copy* to write per section but nothing about layout
  variant, theme override, column count, media style — which is where
  the "layout drift" symptom (left-align when center expected) most
  likely sits, since the model is filling these enum keys blind.
- **`trust.items` shape never specified in step 1.** Step 1's `trust`
  brief says "items = the specific signals that back the guarantee
  (years in business, licence, insurance, response time, on-time rate,
  review count). 3–4 items. Use real numbers" — but no per-item
  structure (value, label, icon?). Same problem as the other items.
- **Step 2 lists only `hero, reviews, features, form` in the user
  message field-keys block** — `trust` and `offer` are appropriately
  absent because step 2 does not include them. But the section plan
  itself is fine; the field-keys block is correct here.
- **Step 1's `form` section is documented as collecting "name + email
  only", but the field-keys block emits `theme, eyebrow, heading` for
  it.** That is the entirety of the heading-band copy fields — the
  actual form fields (`fields[]`) are built deterministically in
  `buildLeadCaptureFormConfig`, never written by the model. This is
  by design but the prompt should explicitly state "do not output a
  `fields` array; the form schema is built in code". Without that, the
  model may invent a `fields` array that the validation pipeline then
  silently drops — wasted tokens and confusion.
- **No instruction about handling absent brief data.** When
  `funnel.customerPain` / `funnel.guarantee` are `'(not specified)'`
  the model is not told how to soften / placeholder / refuse — it
  will hallucinate.
- **No SEO output requested.** Funnel steps do not emit `seo: { title,
  description }` (the website prompt does), even though funnel steps
  have a `seo` field on the underlying `FunnelStep` type. The deterministic
  schedule + thanks steps inherit defaults; nothing fills SEO for
  the AI-generated landing or qualification step. Whether intentional
  or an oversight is unclear.

---

## 3. Offer generation

**File:** `src/app/api/generate-offer/route.ts`.
**Model:** `claude-sonnet-4-6`, `thinking: { type: 'enabled',
budget_tokens: 2000 }`, `max_tokens: 4000`, non-streamed, system block
cached.
**Caller:** browser via `lib/website/offer-generate.ts` `generateFunnelOffer`.
Called from the create-client wizard's brief / offer step.

### System prompt (verbatim)

```
You are a direct-response copywriter in the Suby / Sultanic tradition. You specialise in offers for trade and service businesses — electricians, plumbers, cleaners, locksmiths, landscapers — the kind of business whose customer is in pain and needs the problem gone today.

Your job is to write ONE specific, time-bound offer that will sit at the top of a one-page conversion funnel. Four fields, that is it. Every word earns its place.

# How to write each field

## headline (<= 12 words)
Name the prospect's pain FIRST, then promise the outcome. The customer should read it and feel "yes, that is exactly what I need".
Good: "Switchboard sparking? We have it sorted in 24 hours."
Good: "Burst pipe at midnight? On site within 2 hours, 7 days a week."
Bad: "Quality electrical services" — vague, no pain, no outcome.
Bad: "Welcome to ACME Plumbing" — about the company, not the customer.

## promise (<= 25 words)
Be specific. Include a real timeframe, a real number, OR a measurable outcome. "Sorted in 24 hours" beats "fast service". State what the customer gets, in plain language.
Good: "We diagnose, repair and certify your switchboard within 24 hours of your call — fully tested, fully compliant, paperwork done."
Bad: "We provide great service to all our customers." — empty.

## risk_reversal (<= 15 words)
Concrete and credible. The customer should be able to picture the agreement and find it fair.
Good: "Or your callout fee is on us."
Good: "Free quote on the spot — no commitment, no pressure."
Good: "Workmanship guaranteed for 12 months in writing."
Bad: "Satisfaction guaranteed" — meaningless, ignored by every reader.
Bad: "We promise great service" — restating the promise is not a risk reversal.

## cta_text (<= 6 words)
Action-led, first-person ("Get my X", "Book my X"). Names the outcome the customer wants. Never generic.
Good: "Get my switchboard sorted →"
Good: "Book my emergency callout →"
Bad: "Submit" / "Learn more" / "Click here" / "Get started" — all generic.

# Hard bans
NEVER use any of: "comprehensive", "discerning", "trusted partner", "cutting-edge", "premium quality", "elevate", "transform", "solutions", "best-in-class", "world-class", "industry-leading", "innovative", "seamless", "robust", "leverage", "synergy". These are AI corporate-speak — they signal that no human wrote this.

NEVER invent facts, prices, response times, or guarantees that are not in the brief. Use ONLY the timeframes, numbers, and promises the operator provided.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. Exactly this shape:

{
  "headline": string,
  "promise": string,
  "risk_reversal": string,
  "cta_text": string
}
```

### User-prompt template (verbatim)

```
Brief
-----
Industry: {industry || '(not specified)'}
Service area: {serviceArea || '(not specified)'}

The one service this funnel is built around:
{funnelService}

The moment that makes a customer urgently search for this:
{funnelCustomerPain}

What the business can confidently promise / guarantee:
{funnelGuarantee}

Write the four-field offer.
```

### What the prompt is trying to do

Produce the four offer strings — headline, promise, risk_reversal,
cta_text — that drive the entire downstream funnel. Outputs are
editable in the wizard, but their quality determines what every section
of the funnel says, since the funnel prompt treats them as authoritative.

### What the prompt currently includes

- Per-field instructions with hard word caps (12 / 25 / 15 / 6).
- Good and bad examples per field — the most concretely-exemplified
  prompt of the four.
- Hard ban list (16 corporate-speak terms).
- Hard ban on invented facts / prices / response times / guarantees.
- JSON output contract with snake_case keys (`risk_reversal`,
  `cta_text` — note: the browser caller normalises these to camelCase
  before storing).
- Suby / Sultanic framing and small-trade audience anchor.

### What looks missing

- **No business-name field.** The brief carries industry, service area,
  funnel service, customer pain, and guarantee — but never the
  business's own name. The model has no way to write "Sparky Sam
  has your switchboard sorted in 24 hours" type copy. Whether this is
  by design (offer copy is universal across the trade) is unclear.
- **No voice tone passed.** Every other prompt in the codebase receives
  `voiceToneToProse(brand.voice)`; this one does not, despite the
  offer being the seed for the funnel copy that DOES get voiced.
- **No worked end-to-end example** combining all four fields. Each
  field has Good / Bad examples in isolation; no full four-field offer
  is shown for a hypothetical electrician / plumber / cleaner.
- **No "what to do when the brief is thin" instruction.** The user
  prompt does require all three free-text fields at the API layer
  (`funnelService`, `funnelCustomerPain`, `funnelGuarantee` 400 on
  missing), so this is moderately defended — but `industry` and
  `serviceArea` are optional and can be `(not specified)`, and the
  prompt does not address how to soften when those are absent.
- **No "edit-friendly output" instruction.** Operators edit the four
  fields after generation; if the model writes copy that depends on
  cross-field reference (e.g. the cta repeats a phrase from the
  promise) editing one in isolation breaks the other. The prompt
  could call this out — keep each field standalone.

---

## 4. Field enhance

**File:** `src/app/api/enhance-field/route.ts`.
**Model:** `claude-sonnet-4-6`, `thinking: { type: 'enabled',
budget_tokens: 2000 }`, `max_tokens: 4000`, non-streamed, system block
cached.
**Caller:** browser via `lib/website/field-enhance.ts` `enhanceField`.
Used by `EnhanceableTextarea` — today, only the wizard's
`funnel_customer_pain` field; designed to be generic across freeform
brief fields.

### System prompt (verbatim)

```
You are a research-grade copywriter who interviews trade and service business owners to draw out specificity. The operator just typed a thin description of one aspect of their business — your job is to expand it into a richer version so downstream AI copy generation has more to work with.

# Process
- Read the current value carefully.
- Infer what the business owner means but did not explicitly say. Owners under-state their own expertise constantly.
- Expand into specifics: concrete situations, real timeframes, plain-language detail.
- Keep the operator's voice. The enhancement should feel like a more articulate version of what THEY actually said.

# What you NEVER do
- NEVER invent facts. No fabricated customer counts, years in business, certifications, prices, locations, or response times the operator did not write or imply.
- NEVER pad with generic phrases ("we pride ourselves on", "with years of experience").
- NEVER add AI corporate-speak: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning.
- NEVER add a CTA or marketing close — the enhanced value sits in a wizard form, not on a page.
- NEVER quote the operator's input back verbatim.
- If the input is too thin to expand responsibly (one or two words, no inferable specifics), return a lightly-polished version of what they wrote rather than inventing detail to pad length.

# Output contract
One paragraph, 2–5 sentences. No preamble, no labels, no markdown.

Return ONLY a single JSON object — no markdown fences, no commentary:

{
  "enhanced": string
}

The "enhanced" value is the expanded paragraph. Nothing else.
```

### User-prompt template (verbatim)

```
Field: {fieldName}

Business context:
- Name: {businessName || '(not provided)'}
- Industry: {industry || '(not specified)'}
- Service area: {serviceArea || '(not specified)'}
- Funnel service: {funnelService}                  (line omitted if funnelService empty)

The operator typed this for "{fieldName}":
"""
{currentValue}
"""

Expand it. Return ONLY the JSON object.
```

### What the prompt is trying to do

Take a thin freeform text answer an operator typed into a wizard brief
field and expand it into a richer 2–5-sentence paragraph that
downstream copy-generation prompts can use as input. The user can
accept or reject the enhanced version in-flow (the route never
overwrites the operator's text). Generic over freeform fields — the
`fieldName` is what the system reads to orient itself.

### What the prompt currently includes

- "Research-grade copywriter who interviews business owners" framing
  — distinct from the offer / funnel / website prompts'
  direct-response framing. Deliberately not punchy.
- Process: read, infer, expand, keep voice.
- Hard bans: invented facts, padding phrases, corporate-speak (same
  list of 16), CTA / marketing close, verbatim-quoting the input.
- Thin-input fallback: lightly polish rather than invent.
- Output contract: one paragraph, 2–5 sentences, JSON shape with a
  single `enhanced` string field.
- Business-context block (name + industry + service area, plus
  `funnelService` when present).
- The `fieldName` is passed twice — once as a label, once embedded in
  the body — giving the model a chance to orient.

### What looks missing

- **`fieldName` is a raw schema id, not a human label.** Today the
  only consumer passes `funnel_customer_pain`. A human-friendly label
  ("The moment that makes a customer urgently search") is much easier
  for the model to orient against — the schema id is fine for code
  but a thin instruction for a model. No field-id → human-label map
  is supplied.
- **No per-field guidance.** Because the route is generic, the prompt
  cannot encode what a good answer looks like for each freeform field
  it might be asked about. The current consumer (`funnel_customer_pain`)
  has very clear quality criteria (concrete urgency moment, specific
  trigger), but the prompt receives none of that. As more freeform
  fields opt in, the gap widens.
- **No voice tone passed.** The enhancement is meant to "keep the
  operator's voice" — but the prompt does not receive the brand's
  voice axes. If the brand voice is "very technical" the enhanced
  output should reflect that; if it is "very casual" likewise. The
  prompt is voice-blind today.
- **No worked example.** A before/after pair for the most common field
  (`funnel_customer_pain`) would substantially anchor the output
  quality.
- **No upper word cap.** "One paragraph, 2–5 sentences" is the only
  length guidance; a paragraph in this register can be 30 or 130
  words. Downstream prompts (the funnel generator) treat the
  enhanced value as a brief input — predictable length matters.
- **Conflicting instruction wording.** The output contract is "One
  paragraph, 2–5 sentences. No preamble, no labels, no markdown" —
  but then immediately followed by "Return ONLY a single JSON
  object". The model has to mentally reconcile "no markdown" with
  "JSON object" (JSON is not markdown, but the juxtaposition is a
  little jarring). Minor.

---

## Observations

### Structural overlap

All four prompts share the same audience anchor (small service
businesses — electricians, plumbers, cleaners, locksmiths, landscapers)
and the same banned-word disposition (16 corporate-speak terms appear
verbatim in three of four prompts). Three of four (website, funnel,
offer) carry direct-response / Suby-Sultanic framing.

A shared base persona — "you write conversion copy for small-trade
service businesses; here are the audience anchors, voice posture, and
banned vocabulary" — could be a cached system block reused across all
four routes. None of the prompts currently does this.

### Inconsistencies between the four prompts

- **Banned-word list inconsistency.**
  - Offer prompt: 16 terms — *comprehensive, discerning, trusted partner, cutting-edge, premium quality, elevate, transform, solutions, best-in-class, world-class, industry-leading, innovative, seamless, robust, leverage, synergy*.
  - Funnel step 1 + step 2: same 16, same order *except* step 1 ends "trusted partner, discerning" and step 2 ends "trusted partner, discerning" too — both match the offer list, but each step lists them in a slightly different visual order (semantic content identical, source-text-wise mildly inconsistent — minor).
  - Field enhance: same 16 terms, alphabetised differently, includes "trusted partner" and "discerning" — semantic content identical.
  - Website prompt: **no consolidated ban list at all**. Principles 2 and 8 inline some negative examples ("quality you can trust", "we go the extra mile", "your satisfaction is our priority", "Quality electrical services", "fast, reliable service") but no exhaustive list, no shared vocabulary with the other three prompts.

- **Output-contract key casing inconsistency.**
  - Website prompt: section data uses **camelCase** keys (because the
    field-key list comes from `defaultDataKeys` which is camelCase).
  - Funnel prompts: section data also **camelCase** (same source).
  - Offer prompt: **snake_case** (`risk_reversal`, `cta_text`). The
    browser caller (`offer-generate.ts`) normalises snake → camel
    before storing. The mixed convention is invisible to the model
    but increases the cognitive load on the route handler.
  - Field-enhance prompt: single key `enhanced` — neutral.

- **Output schema specification depth.**
  - Website prompt: top-level shape spelled out with comments; section
    `data` shape "keys = that type's field keys" (referential — relies
    on the registry block).
  - Funnel prompts: top-level shape spelled out; section `data` shape
    "fields listed in 'Section field keys' below" (also referential).
  - Offer prompt: shape spelled out fully — no referential indirection.
  - Field-enhance prompt: shape spelled out fully.

  The two referential prompts (website + funnel) are also the two with
  the most reported quality issues. The field-keys block in both cases
  is a flat comma-separated list with no shapes — see the per-field
  missing-information bullet under each prompt for the structural
  consequence.

- **Voice-tone wiring.**
  - Website prompt: full voice block (formality / urgency / technicality
    axes, translated to prose).
  - Funnel prompts: same voice block.
  - Offer prompt: **none** (no voice block at all).
  - Field-enhance prompt: **none** ("keep the operator's voice" is
    asserted but no voice signal is supplied).

  Two of four prompts that materially shape the funnel's copy are
  voice-blind.

- **Worked examples / shots.**
  - Offer prompt: per-field Good / Bad examples (highest density of
    examples of the four).
  - Field-enhance prompt: no examples.
  - Funnel prompts: a handful of inline copy fragments ("Almost there.
    Let's get you on the schedule.", "Get my emergency callout") but
    no end-to-end finished section example.
  - Website prompt: a few inline negative + positive copy fragments,
    no end-to-end JSON example.

  No prompt in the codebase shows a finished JSON output. The
  field-key + variant + accent gaps documented in §1 / §2 are the
  surfaces a worked example would most naturally close.

- **Banned-CTA-phrase inconsistency.** The offer prompt explicitly
  bans "Get started" as a CTA — but `buildLeadCaptureFormConfig`
  (the deterministic step-1 form builder) uses the literal fallback
  `'Get started'` when `funnel.offer.ctaText` is empty. The funnel
  prompt does not echo the offer prompt's CTA-quality rules, so the
  funnel can output CTAs the offer prompt would have rejected.

- **`headlineAccent` / `titleAccent` semantics.** Listed in the
  field-keys block on every accent-carrying section in both the
  website and funnel prompts. Never explained. This is the single
  highest-leverage missing piece across all four prompts; it maps
  directly to the reported "highlighted text duplicated" symptom.

### Things that look structurally wrong

- **Variant / enum fields are emitted as if they were free-text.** The
  registry's `layout`, `theme`, `imageSide`, `contentAlign`,
  `headerAlign`, `headlineSize`, `stackStyle`, `columns`, `mediaStyle`,
  `iconStyle`, `aspect`, `ctaStyle`, `mediaShape`, `mediaMode`
  fields all have closed enums in the section modules — and `theme`
  is an *object*, not a scalar. The prompts list them as field keys
  with no shape, no enum values, and no indication they are
  structural. This is the most likely root cause of:

  - "layout variant selection wrong (left-align when center is
    expected)" — `contentAlign` / `headerAlign` enums never enumerated.
  - "missing icons" — `iconStyle` enum + per-item `icon` curated id
    set never enumerated.

  The validation pipeline (`runValidationPipeline` in
  `generation-stub.ts`) only checks that field *keys* are present; it
  does not validate variant *values*. So a missing or out-of-enum
  variant value silently falls through to the section's
  `withDefaults()` at render time, producing the default variant
  (which may or may not be what the page wanted). No prompt-side or
  validation-side mechanism catches the drift.

- **Items / inclusions / signals arrays are emitted without shape.**
  The prompts require array-of-objects with "field shapes given" but
  no shapes are given. Models tend to skip fields they cannot confidently
  shape — this is the most likely root cause of the "funnel copy
  mostly blank except headlines" symptom: scalar headline-shaped fields
  get populated; complex array fields get skipped or under-populated.

- **The website prompt's user message claims "the system will tag it as
  AI-drafted" for every populated field**, but the section data is
  not marked at the prompt level — it is marked downstream in
  `assembleResult` / `runValidationPipeline`. The instruction is
  factual but irrelevant to the model and adds nothing to its
  decision-making. Minor.

- **The funnel step-1 prompt allocates a `form` section role** ("eyebrow
  + heading from the offer's urgency...") but the field-keys block
  for `form` is just `theme, eyebrow, heading`. The form's actual
  `fields[]` array is built deterministically by
  `buildLeadCaptureFormConfig` and overwritten in
  `validateAndAssemble` — the model never sees the form's field
  schema. The prompt does not tell the model that any `fields` array
  it emits will be discarded. A model that interprets "the form on this
  page captures NAME + EMAIL ONLY" as "I should emit a `fields`
  array with name + email entries" will waste tokens on output that
  is silently dropped.

- **Two preambles for the website prompt.** The cached system prompt and
  the user-message system preamble repeat each other with minor
  drift ("Lead with a hero; close with a cta" appears only in the
  cached system prompt; "set `enabled: true`" appears only in the
  user-message preamble). Either piece of guidance might be missed
  depending on which preamble the model weighs more heavily.

- **`SectionMeta.defaultDataKeys` is used as the prompt's source of
  truth for fields a section can carry — and it includes structural
  fields that are not copy.** A copy-writing model is asked to
  "populate every field key" — which would include `theme`, `layout`,
  `columns`, `showHeadlineRule`, `ctaPrimaryVisible`, `headlineSize`,
  etc. The model has no way to distinguish "this is a copy field"
  from "this is a layout knob". `SectionMeta.capabilityHints.copyFields`
  / `mediaFields` already exists and gives exactly that distinction,
  but neither prompt consumes it. The website prompt's instruction to
  "Populate EVERY field key of every section with real, specific,
  on-brand copy" is misaligned with the actual field-key list it
  emits.

— end —
