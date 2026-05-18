# Webnua Backend — page-builder data model

> **Status:** design pass only. No code, no migrations. This is the dedicated
> follow-up `backend-schema-design.md` §7 called for — the design gate before
> the builder-family migrations (Phase 1b) are written.
>
> **Scope:** the five builder questions §7 deferred — section storage (§3.3),
> schema evolution (§3.4 / `[JC-8a]`), image storage, the header/footer
> singleton question (session zero), and the `sections` polymorphic-parent
> question (§10). Baselined against `main` `43e04a5`.
>
> **Headline result:** pressure-testing §3.3 **overturns it.** §3.3 recommended
> normalising the live editable tree into `pages` + `sections` tables. This
> pass finds that wrong — and the simpler model it replaces it with *dissolves*
> the header/footer question and the polymorphic-parent question entirely.
> Three of the five open questions collapse to one decision.

---

## §1 — The core question: how is the live editable tree stored?

A website's content is a tree — pages, each with an ordered list of sections,
plus website-level header / footer / nav. The platform versions this tree:
draft → pending_approval → published → archived (`VersionStatus`). The question
§3 left open: **is the live, currently-editable draft a normalised set of rows,
or is it — like every other version — a frozen JSONB snapshot?**

### 1.1 The two options

**Option A — normalise the live tree (what §3.3 recommended).** `pages` table,
`sections` table (FK to page / funnel-step). The draft is the live normalised
tree; editing mutates `sections` rows. A published `Version` is a JSONB
snapshot *serialized from the tree at publish time*. Rollback *deserializes* an
old snapshot back into the live tables.

**Option B — snapshots uniformly.** Every version — draft included — is a JSONB
snapshot. The draft is simply the `website_versions` row with `status='draft'`;
its `snapshot` holds the whole tree. Publish / submit / rollback are all
"copy a snapshot, set status, move a pointer." No normalised content tables.

### 1.2 §3.3's case for Option A — and why it does not hold

§3.3 argued: *"a `sections` table is right for live data — sections are
individually toggled, reordered, autosaved; per-row storage gives autosave its
natural granularity and lets RLS gate a section without parsing a blob."*

Examined against the actual front end, each clause fails:

- **"individually toggled / reordered"** — toggling `enabled` and reordering
  happen in the editor's in-memory tree (`SectionEditor` local state), then
  autosave persists. A section does not need to be a *row* to be toggled.
- **"autosave granularity"** — the real autosave unit is **the page**, not the
  section. `draft-stub.ts` already keys draft slots `(websiteId, pageId)` — you
  edit one page at a time and its section array flushes together. Per-section
  rows buy nothing autosave needs.
- **"RLS gate a section"** — there is **no per-section RLS requirement.**
  Capabilities resolve per-website (`capability_grants.website_id`); within a
  website, gating is per-*field* and done in the app (the registry's
  `capabilityHints`, the `CopyField`/`MediaField` `CapabilityGate` wrappers).
  `backend-schema-design.md` §4.3 already states per-field caps are not RLS's
  job. Section-level is not either. This benefit is moot.

All three of Option A's stated benefits are either satisfied per-page anyway or
not actually required.

### 1.3 What Option A costs (unstated in §3.3)

- **Two representations** of the same data — a normalised live tree *and* JSONB
  snapshots — with a serialize boundary at publish and a deserialize at
  rollback / restore. Every publish and every rollback crosses it.
- **The draft is asymmetric** — the only "version" that is a live tree rather
  than a blob. Uniform-versioning reasoning breaks at the draft.
- It **needs the polymorphic `sections` parent** (page vs funnel-step vs
  website-singleton) — the §10 open question exists *only* because Option A
  needs a `sections` table.
- It **needs `websites.header_section_id` / `footer_section_id`** — the
  session-zero question exists *only* for the same reason.
- Four extra tables (`pages`, `sections`, `funnel_steps`, `website_nav_links`),
  each with RLS policies, FKs, and cascade rules.

### 1.4 Decision — **Option B.** 🔴

The live editable draft is a `website_versions` row with `status='draft'`; its
`snapshot` JSONB holds the whole content tree. There is **no `pages` table and
no `sections` table.**

Reasoning:

- **One representation.** Publish, submit-for-review, rollback, restore are all
  "copy a snapshot + set status + move a pointer." This is *already* what
  `publish-stub.ts` does (`publishDraft`, `submitForApproval`,
  `restoreVersionAsDraft`). The working front end is already Option B — §3.3
  proposed normalising a tree the codebase never normalised.
- **It dissolves two open questions.** No `sections` table → no polymorphic
  parent (§10 closed). No website-level singleton rows → no
  `header_section_id` FK; header / footer are just `Section` objects in the
  snapshot, exactly as `VersionSnapshot` already carries them (session-zero
  item closed). A model that *eliminates* problem categories rather than
  solving them is the right model.
- **It makes schema evolution uniform** — see §3.
- **Phase 1b becomes near-mechanical** — the tables map 1:1 onto the existing
  `draft-stub` / `publish-stub` / `website-approval-stub` modules.

### 1.5 What Option B costs — honestly

- **The whole content tree is one JSONB per version, loaded wholesale.** This
  is *correct* for the editor (it wants the whole tree — page list, jump
  between pages). It is a consideration for **public-site rendering** (render
  one published page → load the whole published snapshot). Mitigation: a
  published version is **immutable**, so its rendered output caches
  indefinitely; and public rendering is a separate, later concern
  (`backend-schema-design.md` §9 keeps the rendered-site pipeline out of V1
  scope). A publish-time per-page extraction into a render store can be added
  then if needed. This does not drive the editor's data model.
- **`pages` / `sections` are not FK targets.** The ticket request-change
  context (`tickets.context_page_id`, `context_section_id`) becomes a `text`
  soft-reference into the snapshot JSON rather than a real FK. `context_website_id`
  stays a real FK. This is a minor, contained loss — the page/section ids are
  still stable uuids, just not DB primary keys. A 2-column identity-only
  `pages` table purely to restore FK-target-hood was considered and rejected
  (a table whose only job is aesthetic FK integrity is not worth its weight).

The public-render cost is real and named; it is outweighed. Option B stands.

---

## §2 — Autosave: the draft baseline + write-buffer

Option B does not mean every keystroke rewrites a multi-page snapshot. The
front end already has the right shape and the backend mirrors it:

- The draft `website_versions` row is the **baseline** snapshot.
- A **write-buffer** holds unsaved per-page edits — mirroring `draft-stub.ts`'s
  `(websiteId, pageId)` slots. `getEffectiveDraftSnapshot` already merges
  baseline + buffer; the backend keeps that exact function shape.
- On publish / submit, buffer + baseline fold into the new version's snapshot;
  the buffer is cleared (`clearDraftsForWebsite`).

The buffer is a table — `content_drafts` — keyed by the scope the stub's
`DraftSlot` discriminator already defines (`page` / `header` / `footer` /
`funnel_step`):

```
content_drafts
  id            uuid PK
  scope_kind    draft_scope_kind not null   -- 'page'|'header'|'footer'|'funnel_step'
  website_id    uuid null FK→websites(id)
  funnel_id     uuid null FK→funnels(id)
  page_key      text null     -- page/step id for 'page'/'funnel_step'; null for header/footer
  sections      jsonb not null
  saved_at      timestamptz not null
  updated_by    uuid not null FK→users(id)
  UNIQUE (scope_kind, website_id, funnel_id, page_key)
```

This is a **transient write-buffer**, not the content model — so the
nullable-`website_id`/`funnel_id` shape (the thing §10 objected to for a
*content* table) is acceptable here; the stakes that made it an anti-pattern
for permanent content do not apply to an autosave buffer. Splitting it into
`website_content_drafts` / `funnel_content_drafts` is a minor Phase-1b call,
flagged `[JC-B1]`, not load-bearing.

Autosave granularity is therefore **per-page** — a flush rewrites one
`content_drafts` row, never the whole snapshot. The baseline draft version's
snapshot is only rewritten at publish/submit/recall time.

---

## §3 — Schema evolution: ratifying `[JC-8a]`

`backend-schema-design.md` §3.4 already settled this — **eager bulk migration**:
when a section's `*Data` shape changes in V2, a deploy-time script walks every
snapshot, applies the registry's migration chain, persists. **Ratified.**

Option B makes it *cleaner* than §3.4 anticipated: with no live `sections`
table, **all** section data lives in version snapshots — `website_versions`,
`funnel_versions`, and the `content_drafts` buffer. The eager-bulk pass walks
exactly those three; there is no separate "live rows" population to migrate on
a different schedule. The asymmetry §3.4's earlier draft worried about is gone
outright. `schema_version` rides on each section object inside the snapshot
JSON, and remains a detection backstop, not a per-read mechanism (§3.4).

The §3.4 wrinkle stands and is handed to Phase 1b: the migration functions are
TypeScript in the registry, so the bulk migration is a deploy-time Node / edge
script paired with the DDL migration, not a `.sql` file alone.

---

## §4 — `data` validation: no database CHECK

§7 asked whether section `data` should carry a DB `CHECK` against a JSON
schema. **Decision: no.**

- Under Option B `data` is nested inside a snapshot JSONB — there is no
  per-section column to `CHECK` against in the first place.
- The registry **already** validates `data` per section type at the
  Fields/Preview boundary (`registry.ts` — every section module exports its
  `*Data` type + `defaultData()`).
- A DB-level JSON-schema CHECK would have to be migrated *every time a section
  shape changes* — exactly the churn `[JC-8a]` exists to avoid.

Validation stays **app-level**, consistent with `[JC-9]`'s policy-value
decision. A `data` shape that fails the registry check surfaces as
`AppError` `kind: 'validation'` (`src/lib/errors.ts`). The database stores
`jsonb`; the application guarantees the shape.

---

## §5 — Image storage

`BrandObject.logoUrl`/`faviconUrl`, `PageSEO.ogImageUrl`, and hero/media
section fields are URL strings. Where the bytes live was left open.

**Decision: Supabase Storage.** `[JC-B2]`

- **One vendor, one auth model.** Storage objects are RLS-gated by the same
  `auth.uid()` / capability primitives as every table (§4 of the schema doc) —
  a client's brand assets and page images scope to their client with the
  policies already being written. S3 would mean a second IAM model; Cloudinary
  a third vendor and bill.
- **Built-in image transformation/CDN** covers the platform's actual needs
  (logo, hero, OG-image resizing + format) — Cloudinary's richer transform
  pipeline is not needed here.
- **No new SDK, account, or billing relationship.**

Mechanics (Phase 1b / Phase 3 — not V1 schema-affecting): one bucket,
per-client folders, RLS on the bucket keyed to `accessible_client_ids()`. The
DB columns **store the storage object path**, not a baked URL; the app resolves
a signed or public URL at read time (a baked URL rots when buckets/CDNs move).

This decision **touches no table** — every column stays a string. It gates the
media-section and brand-asset upload work, nothing in the schema.

---

## §6 — The resulting builder schema (delta vs `backend-schema-design.md` §1.4)

§1.4 of the schema doc was written under Option A. This pass supersedes its
builder tables. The ratified set:

**Tables that survive (with edits):**
- `websites` — **drop `header_section_id` / `footer_section_id`.** Header and
  footer live in the version snapshot.
- `website_versions` — `snapshot` JSONB is the whole tree:
  `{ pages, header, footer, nav, pageOrder }`, each page carrying its
  `sections[]`. Each section object carries `schema_version`.
- `funnels` — unchanged.
- `funnel_versions` — `snapshot` = `{ steps, stepOrder }`, steps carrying
  `sections[]`.
- `website_approval_submissions`, `funnel_approval_submissions`,
  `force_publish_audit_log` — unchanged (they FK `websites` / `*_versions`).

**Tables removed:**
- `pages`, `sections`, `funnel_steps`, `website_nav_links` — all content now
  lives in version snapshots.

**Table added:**
- `content_drafts` — the autosave write-buffer (§2).

**FK → soft-reference changes:**
- `tickets.context_page_id`, `context_section_id` → `text` (soft refs into
  snapshot JSON). `context_website_id` stays a real FK.

**RLS** for the builder family is now simple: every builder table is
website-scoped or funnel-scoped (→ client-scoped) and gated by
`has_capability(website_id, …)` exactly as §4.3 of the schema doc describes —
but with **no per-section row policies to write**, because there are no
section rows.

---

## §7 — What this means for Phase 1b

Phase 1b builds `websites`, `website_versions`, `funnels`, `funnel_versions`,
`content_drafts`, the two approval tables, and `force_publish_audit_log` — plus
their RLS. The model is now a near-mechanical translation of the existing
`draft-stub.ts` / `publish-stub.ts` / `website-approval-stub.ts` modules, which
already implement Option B. The section registry (`lib/website/registry.ts`)
is untouched product code — it is the app-level `data` validator (§4) and the
home of the migration functions (§3).

The eager-bulk migration *script* mechanics (§3) are the one genuinely new
build in Phase 1b; everything else is the stub promoted to Postgres.

---

## §8 — Open calls for review `[JC]`

- **`[JC-B1]` `content_drafts` — one polymorphic table vs split.** One table
  with nullable `website_id`/`funnel_id` (proposed — acceptable for a transient
  buffer) vs `website_content_drafts` + `funnel_content_drafts`. Minor; not
  load-bearing.
- **`[JC-B2]` Image storage = Supabase Storage.** Confirm over S3 / Cloudinary.
- **The §1.4 supersession.** This pass overturns `backend-schema-design.md`
  §3.3 and rewrites §1.4's builder tables. On approval, the schema doc gets a
  small amendment: §3.3 marked revised, §7 marked done, §10's polymorphic-parent
  item marked closed, and §1.4's builder subsection pointed here as the
  authority. Flagging that amendment rather than making it pre-emptively.

---

*End of document. Design pass only. On approval this ratifies
`backend-schema-design.md` §3 + §7 and the builder family is cleared for
Phase 1b — which still runs after Phase 1 (non-builder migrations).*
