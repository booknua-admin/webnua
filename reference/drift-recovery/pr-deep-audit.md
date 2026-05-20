# Drift-recovery PR deep audit

Read-only audit produced in Session B of the three-session drift recovery.
Read the diffs, not the branch names — branch names lie in this window.
Five PRs, examined from the merge diff and the current state of `main`.

---

## PR #41 — `claude/supabase-builder-backend-ACGDR`

**Merge:** `534de96` · 4 commits · 31 files · 2026-05-18 14:45 UTC
**PR title:** _Phase 4: Wire website/funnel builder to live Supabase reads_

### 1. What the branch name implied
A reader would expect the Phase-4 keystone: tear out the localStorage builder
stubs and replace them with Supabase reads + mutations for the website /
funnel builder family.

### 2. What actually shipped
- **Deletions:** `src/lib/website/publish-stub.ts` (797 lines) and
  `src/lib/website/draft-stub.ts` (163 lines) — gone entirely.
- **New modules:** `src/lib/website/queries.tsx` (476 lines, the live read
  layer), `mutations.ts` (385 lines, publish/approve/recall/restore), 
  `content-drafts.ts` (167 lines, autosave write-buffer over the
  `content_drafts` table), `snapshot.ts` (137 lines, the seed-merge logic),
  `builder-events.ts` (29 lines, the `BUILDER_EVENT` reactivity bus).
- **Funnel parallels:** `src/lib/funnel/queries.tsx` (199 lines) +
  `mutations.ts` (71 lines) — funnel reads, but no publish/approval (still
  unwired, see PR notes).
- **Type-only conversions:** `audit-stub.ts` and `website-approval-stub.ts`
  collapsed from data stubs to display-shape modules (the data is now in
  `force_publish_audit_log` and `website_approval_submissions` tables, read
  by `queries.tsx`).
- **Migration:** `0023_seed_builder_websites_funnels.sql` — seed rows so
  the editor has something to open after a fresh hydration.
- **Hook signatures preserved:** `use-autosave.ts` and `use-publish-state.ts`
  kept their return shapes; consumer surfaces unchanged.

### 3. Match score: **clean**
Branch name said "wire the builder backend to live Supabase reads", and
that is exactly what the diff does — surgical replacement of the
localStorage layer with Supabase reads + writes, with consumer APIs
preserved.

### 4. Current state in main
Largely intact. Subsequent PRs touched some of the same files
(`queries.tsx`, `mutations.ts`) — PR #48 / PR #51 / PR #53 / the
domain-management commit `613e39f` added domain-management mutations,
SEO writes, and preflight-related read tweaks — but the core publish /
draft / approval pipeline is as PR #41 shipped it. `publish-stub.ts` /
`draft-stub.ts` have stayed deleted.

### 5. Working / broken / unknown
- **Working:** the builder read path resolves through TanStack Query
  over the real Supabase tables; the `BUILDER_EVENT` bus invalidates
  dependent caches on every mutation; `audit-stub.ts` /
  `website-approval-stub.ts` are now type-only display modules.
- **Broken:** none that read statically. Tab files unmodified by later
  PRs.
- **Unknown:** the RLS posture on `content_drafts` (the user-scoped
  `updated_by = auth.uid()` check) hasn't been negative-tested
  cross-tenant — same caveat CLAUDE.md flags for all Phase-2/3 wiring.
  The funnel approval/publish path is **deliberately unbuilt** even
  here (CLAUDE.md has a separate parked decision); the funnel side of
  this PR is reads + autosave only.

### 6. Doc gaps
The biggest. **None of the new modules appear in CLAUDE.md.** The
"Known component inventory" still references `publish-stub.ts` /
`draft-stub.ts` (which no longer exist) and the seed-data shape; the
new `queries.tsx` / `mutations.ts` / `content-drafts.ts` /
`snapshot.ts` / `builder-events.ts` need inventory lines. Migration
`0023_seed_builder_websites_funnels` not listed. The CLAUDE.md "Open
decisions" entry **"Editor publish/approval layer still on
localStorage"** (around line 929) is **stale and contradicts main** —
PR #41 already resolved it. The "Phase 4" line in build-roadmap.md
also hasn't been marked done.

---

## PR #43 — `claude/real-auth-billing-KG09t`

**Merge:** `1a4705e` · 1 commit · 45 files · 2026-05-18 21:40 UTC
**PR title:** _Phase 5: Wire agency billing + roster to live Supabase_

### 1. What the branch name implied
Phase 5: replace the auth / capability / agency / billing stub layer
with real Supabase. A read-shape change inside the auth + billing
families.

### 2. What actually shipped
- **Real Supabase Auth.** `src/lib/auth/user-stub.tsx` (despite the
  filename — preserved to avoid touching ~50 import sites) now
  resolves the signed-in user from `supabase.auth.getSession()` +
  `onAuthStateChange` → `public.users` → `capability_grants`.
  Localstorage user-switching, view-as, the four stub users — all
  deleted.
- **`DevRoleSwitcher.tsx` deleted.** Four `/dev/*` pages deleted
  (`/dev/agency-policy`, `/dev/capabilities`,
  `/dev/generation-preview`, `/dev/sections` — though `/dev/sections`
  was kept later). Eleven layouts had their `<DevRoleSwitcher>` mount
  removed.
- **Eight `*-stub` modules converted from localStorage to
  Supabase-backed in-memory caches**, all with their public APIs
  preserved: `agency-policy-stub.ts`, `override-stub.ts`,
  `plan-catalog-stub.ts`, `plan-assignment-stub.ts`,
  `client-invite-stub.ts`, `seat-limit-stub.ts`. New modules:
  `clients/clients-store.ts` (client-roster cache, the slug↔UUID
  translator every other store depends on), `auth/roster-store.ts`
  (the users-with-grants list for the access grid),
  `team/team-invite-stub.ts` (the operator-side invite store, new in
  this PR — there was no localStorage stub before).
- **`DataHydrationProvider.tsx`** — mounted in the root layout,
  hydrates `clients` first then everything else in parallel on every
  auth state change.
- **Migrations 0024 + 0025**: `0024_brands_capability_rls.sql` (RLS
  for the brand-capability surfaces), `0025_seed_agency_billing.sql`
  (the seed rows for the new live tables).

### 3. Match score: **expanded scope**
Branch name says "real-auth-billing"; diff hydrates **nine** in-memory
stores (auth + capability grants + agency-policy + plan-catalog +
plan-assignments + invites + clients + seat-limit + roster) and
deletes the dev infrastructure that supported the stub layer. Auth +
billing is the headline; the actual surface area is the entire stub
elimination pass.

### 4. Current state in main
Substantially intact. Subsequent PRs touched the same files
(`user-stub.tsx`, `clients-store.ts`, `roster-store.ts`,
`team-invite-stub.ts`) — PR #46 added the `editForms` capability to
`capabilities.ts`; PR #49 reworked `admin-clients.ts` further; PR #53
added domain-related changes. The fundamentals laid by PR #43 — real
Supabase Auth, hydrated-from-DB stores, no `DevRoleSwitcher`, no stub
users — are still in place.

### 5. Working / broken / unknown
- **Working:** sign-in via `supabase.auth.signInWithPassword`,
  capability grants resolving from `capability_grants`, all nine
  stores hydrating from Supabase via `DataHydrationProvider`, app
  re-hydrating on `onAuthStateChange`.
- **Broken:** none observable from static reading. The known
  cosmetic-but-noisy issue (CLAUDE.md flags it): a logged-out page
  load fires `hydrateAll` before there's a session, producing a wall
  of `401 permission denied` console warnings — expected, not a bug.
  Fixed by the `DataHydrationProvider` check that the auth event
  carries a `session` before hydrating (visible in the code today).
- **Unknown:** **the cross-tenant RLS validation pass.** CLAUDE.md
  flags this explicitly — the RLS policies are written but have not
  been systematically negative-tested with real `auth.uid()` values
  from different tenants. Single largest unverified surface from this
  PR. Can't determine from static reading; needs a runtime test
  harness against a populated Supabase instance.

### 6. Doc gaps
- **`lib/data/DataHydrationProvider.tsx`** — no CLAUDE.md inventory
  line; mounted in the root layout but not documented.
- **`lib/clients/clients-store.ts`** — new, no inventory line.
- **`lib/auth/roster-store.ts`** — new, no inventory line.
- **`lib/team/team-invite-stub.ts`** — new (the file didn't exist
  before), but CLAUDE.md's `lib/team/` section talks about
  `types.ts` + `roles.ts` only, not the new store.
- The CLAUDE.md inventory entries for the 8 converted stubs still
  describe them as **"STUB. localStorage-backed"** — they're now
  Supabase-backed caches. Each entry needs updating.
- Migrations `0024` + `0025` not documented.
- Build-roadmap.md Phase 5 not marked done.

---

## PR #45 — `claude/section-library-uplift`

**Merge:** `412f5c9` · 27 commits · 40 files · 2026-05-19 04:35 UTC
**PR title:** _Expand section library: add About, Features, Contact,
Gallery; uplift existing sections_

### 1. What the branch name implied
Add four new section types and uplift the existing ones (more
variants, better fields). A section-library scope.

### 2. What actually shipped
- **Section library uplift (the headline):** 12,655 insertions, almost
  entirely in `src/lib/website/sections/*.tsx`. Adds `about.tsx`
  (1,060 lines), `contact.tsx` (909 lines), `features.tsx` (956
  lines), `gallery.tsx` (821 lines); massive rewrites of `cta.tsx`
  (1,113), `faq.tsx` (969), `footer.tsx` (979), `offer.tsx` (1,126),
  `reviews.tsx` (1,067), `trust.tsx` (855), `header.tsx` (414),
  `schedulePicker.tsx` (308), `thanksConfirmation.tsx` (349). Each now
  carries multiple layout variants with per-variant element
  inspectors.
- **New shared field components:** `section-icons.ts` (214 lines —
  icon library), `_shared/IconField.tsx`, `_shared/ColumnsField.tsx`,
  `_shared/SocialGlyph.tsx`, `_shared/StarRow.tsx`,
  `_shared/grid.ts`.
- **Major net-new feature not implied by the name:** the
  **`CreateClientModal`** (578 lines) and `CreateClientButton`
  (29 lines), and the `result` viewer page
  (`src/app/(admin)/clients/new/result/page.tsx`, 230 lines).
- **The brief → site generation pipeline:** `lib/clients/create-client.ts`
  (185 lines, Supabase write path that bundles a generated client +
  brand + website + funnel + their draft versions),
  `lib/website/site-generation-stub.ts` (98 lines, the multi-page
  generator that runs `generatePageStub` once per page type).
- **Design-variety layer in `generation-stub.ts`** — seeded recipe
  picking, light/dark band rhythm, per-section design surface.
- **`services.tsx` dropped to `implemented: false`** — the section
  type was deprecated (kept in the registry so seed pages still
  parse, but new sections can't be added).
- **RLS migration `0028_fix_clients_select_returning.sql`** — the
  drop / re-add of the `clients_select` policy so `INSERT … RETURNING
  *` from `create-client.ts` works.

### 3. Match score: **expanded scope**
Branch name describes one of three significant pieces. The section
uplift IS the largest piece, but the `CreateClientModal` flow (with
its result-viewer page, brief-to-site pipeline, and corresponding RLS
fix) is a substantial net-new feature — the canonical client-creation
path that CLAUDE.md now treats as the only way to create a client.
27 commits over a single PR also suggests a long working session that
absorbed multiple concerns.

### 4. Current state in main
Mostly intact. Some sections (`offer`, `cta`) had preflight rules
amended by PR #46 to handle the new layout variants. PR #47 deleted
the 8-step wizard and replaced the wizard `/clients/new/<step>/*`
routes with the `CreateClientModal` quick-create flow (which had
landed here in PR #45 — PR #47 just deleted the parallel wizard
implementation). `create-client.ts` was edited later by `e8591e6`
(funnel slug fix) and `896ff78` (path-based funnel routing).

### 5. Working / broken / unknown
- **Working:** all 12 implemented section types render and edit;
  `CreateClientModal` walks through five steps and commits a real
  `clients` + `brands` + `websites` + `funnels` + draft-version
  bundle; the `result` page renders generated previews.
- **Broken:** none observable statically — the section editors and
  the create flow are fully wired.
- **Unknown:** runtime correctness of the new section data
  shapes against any existing seed data — particularly the deprecated
  `services.tsx` (still in the registry as `implemented: false`).
  Whether Supabase migration 0028 ran cleanly on the deployed project.

### 6. Doc gaps
- The four new section types (`about`, `contact`, `features`,
  `gallery`) **are** mentioned in the CLAUDE.md section-library
  uplift Phase 0 entry, but only as future additions to the union —
  no inventory lines for the section modules themselves.
- The five `_shared/` field components (`IconField`, `ColumnsField`,
  `SocialGlyph`, `StarRow`, `section-icons.ts`, `grid.ts`) are
  undocumented.
- **`CreateClientModal` IS documented** (the post-cluster create-client
  flow entry near line 339). The result-viewer page
  (`/clients/new/result`) isn't mentioned by route.
- **`site-generation-stub.ts`** is mentioned by name in the
  create-client section but not given its own inventory entry.
- The design-variety layer added to `generation-stub.ts` (seeded
  recipe picking, surfaces, per-section design) is undocumented —
  the existing entry describes the deterministic-recipe model.
- Migration `0028_fix_clients_select_returning.sql` not listed.
- `services.tsx`-deprecated note worth a parked-decision style line.

---

## PR #46 — `claude/debug-admin-access-6knVk`

**Merge:** `89e40ed` · 11 commits · 27 files · 2026-05-19 06:01 UTC
**PR title:** _Add lead-capture form builder and form section type_

### 1. What the branch name implied
Nothing about form-building. "debug-admin-access" sounds like a
short-lived fixer branch addressing a permissions issue.

### 2. What actually shipped
- **The entire form-builder feature in six phases.** The merge title
  is honest; the branch name isn't.
- **Capability model**: new `editForms` capability added to the
  `Capability` union, `ALL_CAPABILITIES`, `CAPABILITY_LABEL`,
  `CAP_EXPLAINER`; migration `0029_capability_enum_add_editforms.sql`
  adds the corresponding Postgres enum value.
- **Data envelope:** `Section.form?: FormConfig` added to `types.ts`;
  new `lib/website/form-config.ts` (176 lines) defines the field
  shape (name / email / phone / message / select / checkbox / image)
  and field-level config (`required`, `placeholder`, etc.).
- **New section type:** `lib/website/sections/form.tsx` (196 lines)
  registers the `form` section type; migration
  `0030_section_type_add_form.sql` extends the `section_type`
  Postgres enum.
- **Editor:** `FormBlock.tsx` (399 lines — the rendered form),
  `SectionFormControls.tsx` (714 lines — the per-field editor),
  `FormFieldTypePicker.tsx` (60 lines), `section-form-slot.ts` (37
  lines — which sections can host a form), updates to `PagePreviewPane`,
  `SectionEditor`, `SectionFieldsPanel`, `WizardSectionEditor`,
  `SectionShell`, `SelectableElement`, `hero.tsx` (hero gained a
  form slot).
- **Lead data layer:** `lib/leads/upload-attachment.ts` (47 lines —
  the image-attachment upload path); `lib/leads/queries.tsx` gained
  210 lines (form-submitted event handling in the timeline /
  conversation views).
- **Attachments bucket:** migration
  `0031_lead_attachments_bucket.sql` (50 lines — storage bucket +
  RLS).
- **Preflight rules** for forms (111 lines added to `preflight.ts`).
- **Two RLS-adjacent fixes** bundled in: the `clients_select` fix
  from PR #45 was further tuned, and a guard on required
  create-client fields was added (`create-client.ts` +9 lines).

### 3. Match score: **misaligned**
The branch name describes **none** of the work. The merge title is
accurate, but anyone reading the branch list would have no signal
that the entire form-builder feature was shipping in this PR. This is
the clearest single instance of the drift pattern.

### 4. Current state in main
Largely intact. Subsequent PRs (#50, #51, #53) added form-related
fixes (multi-field add, form submission UX, header CTA link),
public-site form rendering, and form-builder UX polish — but the
foundational form-builder shape PR #46 built is unchanged.

### 5. Working / broken / unknown
- **Working:** `editForms` capability surfaces in the cap layer; the
  form section type renders and edits in the section editor; the
  form-attachments bucket exists; preflight rules fire on
  unconfigured form sections.
- **Broken:** none observable from static reading.
- **Unknown:** RLS correctness on the new
  `lead_attachments` storage bucket (migration 0031) — net-new RLS
  surface, not negative-tested cross-tenant. Same caveat as the rest
  of the new RLS work. Whether the `section_type` enum migration
  (0030) succeeded on the deployed project — `alter type … add value`
  on Postgres can fail in a transaction depending on the migration
  driver's settings.

### 6. Doc gaps
- The form-builder design doc (`reference/form-builder-design.md`)
  was added in PR #47 as a retroactive design doc — so the design is
  documented, but it landed one PR after the feature.
- **In CLAUDE.md**: the `editForms` capability is mentioned in the
  capability list line (the rolled-up "14 capabilities" line) and
  the form-builder is mentioned in the parked-decisions block — but
  there are **no inventory entries** for `FormBlock`,
  `SectionFormControls`, `FormFieldTypePicker`, the `form` section,
  `form-config.ts`, `upload-attachment.ts`, the `section-form-slot`
  helper. Six undocumented components for one of the most significant
  feature additions in the window.
- Migrations `0029`, `0030`, `0031` not listed in CLAUDE.md.
- The new preflight rules (form-validity) need a line in the
  preflight entry.

---

## PR #47 — `claude/review-dev-plan-CZkx1`

**Merge:** `efc4374` · 8 commits · 39 files · 2026-05-19 08:36 UTC
**PR title:** _Sunset onboarding wizard; wire real Claude-backed
site generation_

### 1. What the branch name implied
"review-dev-plan" sounds like a doc-only / planning PR — a review of
the build plan. Nothing about Phase 6, Claude wiring, or wizard
sunsetting.

### 2. What actually shipped
- **The 8-step `/clients/new/<step>` onboarding wizard deleted in
  full.** Eight route files removed; six onboarding components
  removed (`JobsMenuEditor`, `NextStepCard`, `PublishCTACard`,
  `PublishedSuccessHero`, `ReframeOptionCard`, `ReviewCard`); the
  wizard-only `AutomationCard`, `BuilderLayout`, `PreviewPanelBar`,
  `WizardSectionEditor`, and `lib/onboarding/*` deleted. Total: 2,254
  deletions.
- **The real Claude generation path:** new server route
  `src/app/api/generate-site/route.ts` (72 lines) that runs four
  `generatePageLive` calls in parallel; new
  `src/lib/website/generate-live.ts` (164 lines, the actual Claude
  call using `@anthropic-ai/sdk`).
- **Browser-side wiring:** `lib/website/site-generation-stub.ts`
  `generateSiteStub` was changed to `fetch('/api/generate-site')` and
  fall back to the deterministic generator on failure.
- **`createClientWithGeneration`** updated to call `generateSiteStub`
  (which now hits the real route).
- **Prompt tuning:** `generation-prompt.ts` (+24 lines, +5/+0 in
  voice-tone-to-prose translation); the `SYSTEM_PROMPT` in
  `generate-live.ts` lays out the conversion-copywriter persona +
  output contract.
- **Brand colours:** `BrandObject.brandColors` captured by the modal
  + threaded into generation.
- **`@anthropic-ai/sdk@^0.96.0`** added to `package.json`.
- **`max_tokens` raised to 64000**, `thinking: { type: 'adaptive' }`.
- **Doc updates:** CLAUDE.md (68 lines — including the auth
  correction "auth is done, not a stub"), `builder-design.md` (+25),
  `builder-generation-design.md` (+23), `form-builder-design.md`
  (+121, the retroactive form-builder doc).

### 3. Match score: **partial** (with a wildly misleading branch
name)
The shipped work substantively matches the **merge title** ("Sunset
onboarding wizard; wire real Claude-backed site generation"). It does
not match the **branch name** (`review-dev-plan`), which would lead a
reader to expect a doc-only PR. The bundled scope is also large for
a single PR — wizard removal, Claude wiring, retroactive form-builder
design doc, max_tokens tune — but each piece is internally coherent.

### 4. Current state in main
**The generation code is exactly as PR #47 shipped it.** Verified
via `git log efc4374..HEAD -- generate-live.ts route.ts
site-generation-stub.ts generation-stub.ts generation-prompt.ts` —
zero commits since PR #47 have touched any of these files.
`create-client.ts` was touched twice afterwards (funnel slug + path-
based routing) but the generation invocation is unchanged.

### 5. Working / broken / unknown
- **Working:**
  - `/api/generate-site` route handler is correctly server-only
    (the Anthropic SDK never leaks into the browser bundle).
  - The route returns 503 when `ANTHROPIC_API_KEY` is unset and
    surfaces a real 500 with `{ name, status, detail }` on Claude
    failure (commit `88031aa` added this).
  - The `composePrompt` + `assembleResult` pipeline is shared between
    the deterministic stub (`generateSync`) and the real-LLM path
    (`generatePageLive`) — so the validation pipeline (§4.4) runs
    consistently in both.
  - `createClientWithGeneration` correctly awaits the async
    `generateSiteStub` and threads the result into Supabase inserts.
- **Broken / suspect — this is the Phase 6 break:**
  - **Silent client-side fallback on `!response.ok`.** Look at
    `site-generation-stub.ts` lines 94-110. When `/api/generate-site`
    returns 500 (real Claude failure, network error, malformed JSON
    from the model), the client side does:
    ```
    if (response.ok) {
      return (await response.json()) as SiteGenerationResult;
    }
    // 503 (not configured) / 500 (failed) → fall through to the stub.
    ```
    The 500 response body — which the server commit `88031aa` was
    written specifically to populate with the real error — is never
    read on the client. Every Claude failure silently degrades to the
    deterministic stub. From the user's perspective the create-client
    flow completes successfully every time; the website looks like
    the stub recipe; there's no indication anything went wrong. This
    is consistent with the symptom "Phase 6 currently broken" — Phase
    6 *appears* to work but never actually runs the LLM if anything
    is off (bad key, rate-limited account, JSON parse failure on a
    real generation, network blip).
  - The server route's 500-body detail surfacing exists but is
    unreachable from the UI because the client throws it away. There
    is no Network-tab inspection path either, since the response is
    awaited inside the modal's import-and-call chain and the modal
    catches only thrown errors.
  - **`generation_log` is never written.** The roadmap (`Phase 6` line
    in `reference/build-roadmap.md`) says "record runs in
    `generation_log`". The table exists (migration `0011`) and has
    RLS policies; nothing inserts into it. `generate-live.ts` does
    not write a row. Loss of observability — there's no record of
    what the LLM was asked, what it returned, or whether it ran.
  - **Funnel generation is NOT wired to real Claude.** `createClientWithGeneration`
    calls `generateFunnelSync(brief)` directly (a deterministic
    function), bypassing any LLM. The CLAUDE.md inventory line is
    accurate ("Real funnel generation is not wired yet"), but it's
    worth naming as part of the Phase-6 picture: only the website
    half of the generator is on Claude.
- **Unknown:**
  - Whether `ANTHROPIC_API_KEY` is actually set in the deployed
    environment. Can't verify from the repo alone — would need
    access to the deployment env. If it's unset the route returns
    503 → client falls back → user gets the stub. If it's set but
    invalid → 500 → user gets the stub. Same observable behaviour.
  - Whether `claude-opus-4-7` (the model name in `generate-live.ts`
    line 25) is the correct id for the actual Anthropic API in May
    2026 — can't verify without an SDK probe.
  - Whether the 300s `maxDuration` is respected by the deployment
    runtime (Vercel free tier caps at 60s; Pro at 300s). If the host
    times out at 60s, four parallel Opus calls with adaptive
    thinking + 64000 max_tokens will frequently exceed it → 500 →
    silent stub fallback.

### 6. Doc gaps (Phase-6-specific)
- **`/api/generate-site/route.ts`** — CLAUDE.md mentions it inline
  in the create-client section but it doesn't have its own
  inventory line under any "API routes" heading (which doesn't exist
  in CLAUDE.md at all).
- **`lib/website/generate-live.ts`** — mentioned by name in the
  create-client section, no dedicated inventory entry.
- **`lib/website/site-generation-stub.ts`** — mentioned by name but
  no entry; the silent-fallback behaviour isn't documented as a
  trade-off (which makes it look like an oversight rather than a
  decision).
- **The `/api/generate-seo` route** (which also uses Claude and was
  added at some point — `head -25` shows it as a real route handler)
  isn't in CLAUDE.md either.
- The build-roadmap.md Phase-6 entry isn't marked done, and the
  "record runs in `generation_log`" sub-bullet is unresolved.
- **No parked decision** captures the silent-fallback design choice.
  Either it was intentional (the create flow shouldn't hard-fail on
  Claude flakiness so the operator can retry) or accidental — in
  either case it deserves to be visible.

### 7. Phase 6 generation-flow trace (where the break is)

The call chain as it exists today:

```
CreateClientModal.handleGenerate()                  [src/components/admin/CreateClientModal.tsx:172]
    └─> createClientWithGeneration({ brief, … })    [src/lib/clients/create-client.ts:45]
            └─> generateSiteStub(brief)             [src/lib/website/site-generation-stub.ts:85]
                    └─> fetch('/api/generate-site') [line 95]
                            ├─ response.ok    → return SiteGenerationResult
                            └─ !response.ok   → SILENT FALLBACK ⚠
                                              → generateSiteSync(brief) [stub]
                            └─ fetch throws (non-abort)
                                              → SILENT FALLBACK ⚠
                                              → generateSiteSync(brief) [stub]
            └─> generateFunnelSync(brief)           [deterministic; never Claude]
            └─> supabase.from('clients').insert(…)  [Supabase write]
```

On the server (when `/api/generate-site` runs):

```
POST /api/generate-site/route.ts
    ├─ no ANTHROPIC_API_KEY → 503 {"error":"generation-not-configured"}
    └─ has key:
        └─> Promise.all([4× generatePageLive(ctx)])  [parallel page generation]
                └─> anthropic.messages.stream({
                      model: 'claude-opus-4-7',
                      max_tokens: 64000,
                      thinking: { type: 'adaptive' },
                      system: [SYSTEM_PROMPT, cache_control: ephemeral],
                      messages: [{ role: 'user', content: composePrompt(ctx) }],
                    })
                └─> stream.finalMessage()
                └─> parse JSON from text content
                └─> assembleResult(ctx, sections, generationId, {…})
        ├─ all 4 succeed → return { generationId, pages, header, footer }
        └─ any throws → 500 { error, name, status, detail }
                ⚠ THE CLIENT NEVER READS THIS BODY ⚠
```

**The break is on line 104 of `site-generation-stub.ts`:** the
`if (response.ok)` branch doesn't have a corresponding error-handling
branch that surfaces the 500 detail. Every non-success outcome
collapses to "silently call the deterministic stub". The most
recent commit (`88031aa`, three commits after wiring) acknowledged
this gap on the server side ("Surface the real /api/generate-site
error so it is visible in the Network tab without digging through
host function logs") — but the client still doesn't propagate it
upward. The fix is small (parse the 500 JSON body, throw a typed
`AppError` with the detail, let the modal's catch surface it) and is
the single highest-leverage Phase-6 fix.

---

## Summary — branch-name vs work mismatch pattern

Of the five PRs:
- **1 of 5 (PR #41)** had a branch name that matched the shipped work
  cleanly.
- **2 of 5 (PR #43, PR #45)** had branch names that described a
  subset of what shipped (scope-expanded mid-session — auth + billing
  became 9 stores; section-library uplift bundled the create-client
  modal + brief-to-site pipeline).
- **1 of 5 (PR #47)** had a branch name (`review-dev-plan`) that
  described nothing of the shipped work — but the **merge title was
  accurate**. The branch name appears to be from an early planning
  pivot that got renamed in the PR description, not the branch.
- **1 of 5 (PR #46)** had a branch name (`debug-admin-access`) that
  was completely misleading and stayed misleading through the merge.
  The merge title was accurate; the branch name was dead.

**The pattern:** branch names get fixed at session-start based on the
first thing the operator intends to do, and don't get renamed when
the work pivots. PR titles and merge messages **do** get
substantively rewritten and are roughly trustworthy; branch names are
not. Roughly half the time the branch name describes the actual
work; the other half it describes an early subset or a sibling task
that got abandoned. **In this window, only the merge commit message
should be trusted.** Branch names are not reliable signal — and the
discipline-restoration prompt for future sessions needs a "rename
your branch when scope changes" or "tag the branch with the actual
shipped scope at merge" rule.

---

## State of main, post these 5 PRs

**Builder backend (Phase 4).** Live. `publish-stub.ts` and
`draft-stub.ts` are gone; `queries.tsx` + `mutations.ts` +
`content-drafts.ts` + `snapshot.ts` + `builder-events.ts` are the
real read/write layer over `website_versions` /
`website_approval_submissions` / `force_publish_audit_log` /
`content_drafts` / `brands` / `websites`. The reactivity bus
(`BUILDER_EVENT`) refreshes dependent surfaces. CLAUDE.md's "still on
localStorage" gap note is stale. Funnel side is reads + autosave
only — publish/approval still unbuilt as a deliberate decision.

**Auth (Phase 5).** Real Supabase Auth, end to end.
`user-stub.tsx` resolves the signed-in user from `auth.getSession()`
+ `onAuthStateChange` → `public.users` → `capability_grants`.
`(auth)/login/page.tsx` is a real `signInWithPassword` screen.
`DevRoleSwitcher` deleted; four `/dev/*` pages deleted (only
`/dev/sections` survives). Eight `*-stub` modules retain their
filenames but are now Supabase-backed in-memory caches hydrated by
`DataHydrationProvider`. **Owed:** systematic cross-tenant RLS
validation pass — never done; the policies are written but not
negative-tested.

**AI generation (Phase 6).** Wired but silently degrades. The
`/api/generate-site` route exists, the Anthropic SDK is installed
(`@anthropic-ai/sdk@^0.96.0`), `generate-live.ts` makes real
streamed Opus calls with `adaptive` thinking and `max_tokens: 64000`,
prompt tuning is in. **The break:** on any non-OK response from
the route, `site-generation-stub.ts` silently falls back to the
deterministic recipe stub. The user always sees a completed flow;
the server's helpful 500-body detail is never read by the client.
Funnel generation is still 100% deterministic (`generateFunnelSync`
inline; no Claude). `generation_log` table exists but nothing
writes to it. Whether `ANTHROPIC_API_KEY` is configured in deployment
is unknown from the repo alone.

**Section library (Phase 6 sibling).** Twelve implemented section
types — eight uplifted with layout variants, four net-new (`about`,
`features`, `gallery`, `contact`). One deprecated (`services` —
`implemented: false`). New shared field components (`IconField`,
`ColumnsField`, `SocialGlyph`, `StarRow`) and `section-icons.ts`.
Form-builder is on top of this: the `form` section type, the
`Section.form` envelope config, the `FormBlock` renderer, the
`SectionFormControls` editor, the `lead_attachments` Storage bucket,
`form_submitted` lead events. `editForms` capability is in the cap
union; `0029` extended the Postgres enum.

**Create-client pipeline.** The canonical client-creation path is
the five-step `CreateClientModal`. It captures one brief, runs the
website + funnel generators, persists `clients` + `brands` +
`websites` + `funnels` + their draft versions, and routes to
`/clients/new/result`. The 8-step `/clients/new/<step>` wizard is
deleted (PR #47). The website generator goes through Claude (with
the silent-fallback caveat above); the funnel generator does not.
`create-client.ts` is the Supabase write path, RLS-bounded to
operator role.

---

## Top 3 fix candidates ranked by leverage

1. **Surface the `/api/generate-site` 500 in `site-generation-stub.ts`.**
   Single-file change (~15 lines): on `!response.ok`, parse the
   response JSON, throw a typed `AppError` with the server's
   `{ name, status, detail }`. The 500-body the server already
   produces becomes visible in the `CreateClientModal`'s error pane.
   Removes the silent-fallback masking that turns every Phase-6
   failure into an apparent stub success. Highest leverage by a
   wide margin — converts a class of invisible failures into
   actionable errors.

2. **Write to `generation_log` from `generate-live.ts`.** Server-only
   insert at the end of each `generatePageLive` (model id, prompt
   tokens, completion tokens, generation_id, success/error). The
   table + RLS policies already exist (migration `0011`); this just
   wires the insert. Closes the observability gap the roadmap
   explicitly named, gives an audit trail for every LLM call, and
   makes intermittent Claude failures diagnosable after the fact.

3. **Reconcile CLAUDE.md inventory with PR #41 + PR #46 +
   PR #47 / Phase 6.** Remove the stale "publish-stub still on
   localStorage" parked decision; add inventory lines for the six
   undocumented form-builder components, the
   `lib/data/DataHydrationProvider`, `lib/clients/clients-store`,
   `lib/auth/roster-store`, `lib/team/team-invite-stub`, `queries`/
   `mutations`/`content-drafts`/`snapshot`/`builder-events`, the
   `/api/generate-site` + `/api/generate-seo` routes. Update the
   eight Supabase-backed `*-stub` entries to drop the "localStorage"
   label. The doc work is the load-bearing piece that makes future
   sessions stop drifting — without it, the next session reads the
   stale inventory and rebuilds something that exists.
