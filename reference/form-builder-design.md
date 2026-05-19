# Webnua Builder — lead-capture forms

> **Status:** retroactive design doc. The form builder shipped across seven
> commits (`e01c9ba`…`541becf`) before this doc existed; this records the
> design that was built so the canon is load-bearing again. It answers to
> `builder-design.md` (the section/capability model), `builder-generation-design.md`
> §2 Q2 (the "Get a quote — form/inquiry CTA" intent that anticipated forms),
> and `backend-schema-design.md` §1.5 (`leads` / `lead_events`).

---

## 1. What this is

A lead-capture form is a block of fields (name / email / phone / message /
select / checkbox / image) that a visitor fills in on a published website page
or funnel step. Submitting it creates a real **lead** for the client. Forms are
the conversion mechanism behind the `quote` / `signup` primary intents — the
funnel's `schedulePicker` handles bookings; the form handles everything else.

## 2. Data model — the form lives on the Section envelope

A form is **not** a section's `data`. It is an optional field on the `Section`
envelope: `Section.form?: FormConfig` (`lib/website/types.ts`).

The reasoning (`lib/website/form-config.ts` header): `data` is per-type-typed
(`HeroData`, `ContactData`, …) — a form must be able to attach to **any**
section type without every section module redeclaring it. The envelope already
carries the type-agnostic concerns (`id`, `enabled`, `ai`); `form` is one more.
Because sections persist as free-form JSON (autosave → `content_drafts`,
publish → `versions.snapshot` jsonb — see `backend-builder-data-model.md`), an
optional envelope field needs **no DB migration**; old drafts read it as
`undefined`.

`FormConfig` = `{ title, showTitle, submitLabel, fields: FormField[],
afterSubmit, colors }`. `FormField` carries `type`, `label`, `placeholder`,
`required`, `select` options, and an optional **`leadRole`** (`name | email |
phone`) that maps the submitted value onto a lead identity column. `afterSubmit`
is a discriminated union — `message` / `url` / `nextStep` (funnel-only,
resolves against the live `stepOrder` at submit time, no stored target id).

There is also a dedicated **`form` section type** (`sections/form.tsx`) — a
section whose content *is* a form. It is deliberately thin: its `data` carries
only chrome (theme + eyebrow + heading band); `PagePreviewPane` renders
`<FormBlock>` beneath the section's `Preview`. A `form` section is seeded with a
default `section.form` on add. Any *other* section type may also host a form via
the same envelope field — the `form` section type is just the case where the
form is the section's whole reason to exist.

## 3. The `editForms` capability

Editing a form is gated by **`editForms`** — the 14th capability
(`lib/auth/capabilities.ts`). It is a sibling of `editCopy` / `editMedia` /
`editSEO` / `editLayout` rather than folded into one of them: a form is
structured lead-capture config (fields, validation, lead-role mapping,
post-submit behaviour), not page copy or media, and an operator reasoning about
"who can change the lead form" wants that as its own switch.

> **Note against builder-design §1.1.** That section locks "13 capabilities…
> bias toward fewer." `editForms` crosses that bar to 14 deliberately: forms
> are a distinct editable artefact with their own data shape and their own
> lead-pipeline consequence, and collapsing them under `editCopy` would let a
> copy-only editor silently rewire where leads go. §1.1's table is amended to
> include `editForms`.

Explainer (`lib/auth/explainers.ts`): *"Lead-capture forms are managed by your
operator."* — so a view-only client sees the request-change affordance on form
fields, same as any other gated control.

## 4. Submission → lead (the schema contract)

A submitted form produces exactly what `backend-schema-design.md` §1.5
specifies — no parallel store:

- One **`leads`** row. Fields with a `leadRole` populate the lead's identity
  (`name` / `email` / `phone`); a customer is found-or-created on phone match.
- One **`form_submitted` `lead_events`** row, `payload` carrying the full
  `{ fields: SubmittedFormField[] }` set. This is the canonical typed event
  (vision §7) — the lead's first timeline entry.
- **Image fields** upload to the private **`lead-attachments`** Supabase
  Storage bucket (migration `0031`). The submitted value persists the storage
  **path**, never a URL — the bucket is private, URLs are signed at read time
  ([JC-B2] / backend-builder-data-model §5).

`CreateLeadInput` (`lib/leads/queries.tsx`) carries an optional
`existingLeadId` so a multi-step funnel can thread one visitor session across
steps — capture name/email on the landing step, more detail later, all events
on one lead. The session-`leadId` threading ships with the public renderer; the
field is designed-for now.

The editor preview offers a **test-submit** affordance (`FormTestSubmitContext`)
that creates a real lead against the workspace client, so an operator can
verify the form end-to-end before publish.

## 5. Components

- `sections/form.tsx` — the `form` section type (chrome band only).
- `components/shared/website/FormBlock.tsx` — renders the live form from a
  `FormConfig`; handles validation, image upload, submit → lead.
- `components/shared/website/FormFieldTypePicker.tsx` — the add-field picker.
- `components/shared/website/SectionFormControls.tsx` — the editor inspector
  for a section's `form` (field list, per-field settings, `afterSubmit`,
  colours), gated on `editForms`.
- `lib/website/sections/_shared/section-form-slot.ts` — the shared
  envelope-form plumbing.

## 6. Deliberately not built

- **Multi-step forms.** Designed-for (additive optional keys —
  `FormField.step?`, `FormConfig.steps?`) but not built. No data migration when
  pursued.
- **The public renderer.** The form is built and editable; rendering it on the
  live public site — and the visitor-session `leadId` threading — ships with
  the public-site pipeline (`backend-schema-design.md` §9).
- **Spam / rate-limiting / captcha** on public submission — a public-renderer
  concern, deferred with it.

---

*End of document. The form builder is feature-complete for the editor +
test-submit; public-site rendering is the remaining piece, deferred with the
public-render pipeline.*
