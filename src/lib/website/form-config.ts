// =============================================================================
// Form config — the shape of a lead-capture form attached to a section.
//
// A FormConfig lives on the Section ENVELOPE (`Section.form?`), not in a
// section's `data`. `data` is per-type-typed (HeroData, ContactData, …); a
// form must attach to ANY section type without each module redeclaring it.
// The envelope already carries the type-agnostic concerns (`id`, `enabled`,
// `ai`) — `form` is one more. Sections persist as free-form JSON (autosave →
// content_drafts, publish → versions.snapshot jsonb), so an optional envelope
// field needs no DB migration; old drafts read it as `undefined`.
//
// Multi-step forms are an OPTIONAL future extension and are NOT built here.
// When pursued: FormField gains `step?: number`, FormConfig gains
// `steps?: { title: string }[]`, and <FormBlock> renders one step at a time.
// Both are additive optional keys — no data migration.
//
// Cross-step lead linking (name/email on a funnel landing step, more detail
// on step 2) is designed-for but not wired: the schema already lets one lead
// own many `form_submitted` lead_events. The live wiring is a stable visitor-
// session `leadId` threaded between steps — it ships with the public renderer
// (see CreateLeadInput.existingLeadId in lib/leads/queries.tsx).
// =============================================================================

import type { PageLink } from './types';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'image'
  | 'date';

/** Maps a field's submitted value onto a lead identity column. One field per
 *  role; a field with no role only lands in the lead_event payload.
 *
 *  `address` is recognised by the route's existing-lead branch (FIX A — funnel
 *  step 2 captures a service address; without a role tag the value would land
 *  in `lead_events.payload` only and never reach `customers.address`). New
 *  identity roles go here, not in heuristic detection at the call site.
 *
 *  `service` tags the field describing what the lead is asking for — feeds
 *  `{{lead.service}}` in automation bodies. Replaces the previous label-regex
 *  fallback (`SERVICE_FIELD_RE`) which only matched English-language labels
 *  like "service" / "enquiry" / "help". The regex stays as a fallback for
 *  legacy forms that never tagged the field. */
export type FormFieldLeadRole = 'name' | 'email' | 'phone' | 'address' | 'service';

export type FormField = {
  /** Stable id — also the element-inspector `selectedElement` id. */
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  /** `select` only — the dropdown options. Ignored when `useServicesList`
   *  is set; options are then resolved from the brand's services list at
   *  render time. */
  options?: string[];
  /** `select` only — flag the dropdown as "the services picker". When set:
   *   • options come from `BrandObject.services` (live) at render time;
   *   • the submitted value is the picked option's string (snapshot, not
   *     a foreign key — a lead from 3 months ago stays readable when the
   *     services list later changes);
   *   • the editor hides the per-field `options[]` editor + forces
   *     `leadRole = 'service'` so `{{lead.service}}` in automations
   *     resolves correctly with zero further config.
   *  This is the "out of the box" path the default form ships. */
  useServicesList?: boolean;
  leadRole?: FormFieldLeadRole;
};

/** What happens after a successful submit. `nextStep` is funnel-only and
 *  resolves against the live FunnelVersionSnapshot.stepOrder at submit time —
 *  no target id is stored, so reordering steps stays correct. */
export type FormAfterSubmit =
  | { kind: 'message'; heading: string; body: string }
  | { kind: 'url'; url: string }
  | { kind: 'nextStep' };

/** Optional per-form colour overrides. Absent keys fall back to the brand
 *  accent / section theme at render time (see <FormBlock>). */
export type FormColors = {
  background?: string;
  fieldBackground?: string;
  fieldBorder?: string;
  label?: string;
  buttonBackground?: string;
  buttonText?: string;
};

export type FormConfig = {
  title: string;
  showTitle: boolean;
  submitLabel: string;
  fields: FormField[];
  afterSubmit: FormAfterSubmit;
  colors: FormColors;
};

/** Editor test-submit context — when present a form in the editor preview
 *  shows a "Test submit" affordance that creates a real lead. */
export type FormTestSubmitContext = {
  /** The client UUID the test lead is created against. */
  clientId: string;
  /** Categorical surface attribution — written to `leads.source_kind` and
   *  surfaced on the inbox row's Source column. */
  surfaceKind: 'website' | 'funnel';
  /** Funnel-only — the funnel UUID the test-submit is being run against. Written
   *  to `leads.source_funnel_id` so test leads attribute to the funnel under
   *  edit (FIX E). The previous omission meant test leads carried
   *  `source_kind='funnel'` but `source_funnel_id=NULL`, polluting the funnel
   *  conversion-attribution count. Omitted on the website editor. */
  funnelId?: string | null;
  /** Human label of the form's origin, e.g. "Form · Hero". */
  sourceLabel: string;
};

/** A page the after-submit redirect can target — fed to the form-settings
 *  inspector so the redirect is picked from the site's pages, not typed.
 *  Alias of the shared {@link PageLink} (the CTA pickers use the same shape). */
export type FormPageLink = PageLink;

/** A single field's submitted value — assembled by FormBlock on submit and
 *  handed to the lead-creation layer. For an `image` field `value` is the
 *  file name and `imagePath` is the uploaded `lead-attachments` storage
 *  path (the bucket is private — a path, never a URL, is persisted). */
export type SubmittedFormField = {
  fieldId: string;
  label: string;
  type: FormFieldType;
  value: string;
  /** Carried through from the field config — drives lead identity mapping. */
  leadRole?: FormFieldLeadRole;
  imagePath?: string;
};

// ---- Helpers ----------------------------------------------------------------

/** Stable field id. Mirrors the `makeId()` pattern in the section modules. */
export function makeFieldId(): string {
  return `fld-${Math.random().toString(36).slice(2, 9)}`;
}

const FIELD_TYPE_LABEL: Record<FormFieldType, string> = {
  text: 'Name',
  email: 'Email',
  phone: 'Phone',
  textarea: 'Anything else we should know?',
  select: 'Choose an option',
  checkbox: 'I agree',
  image: 'Upload a photo',
  date: 'Preferred date',
};

const FIELD_TYPE_PLACEHOLDER: Record<FormFieldType, string> = {
  text: 'Your name',
  email: 'you@example.com',
  phone: '0400 000 000',
  textarea: 'A few details about the job',
  select: '',
  checkbox: '',
  image: '',
  date: '',
};

/** A fresh field of the given type, with a sensible label, placeholder, and
 *  an auto-assigned leadRole for the contact types. */
export function defaultFormField(type: FormFieldType): FormField {
  const field: FormField = {
    id: makeFieldId(),
    type,
    label: FIELD_TYPE_LABEL[type],
    required: type === 'email',
  };
  const placeholder = FIELD_TYPE_PLACEHOLDER[type];
  if (placeholder) field.placeholder = placeholder;
  if (type === 'select') field.options = ['Option one', 'Option two'];
  if (type === 'email') field.leadRole = 'email';
  if (type === 'phone') field.leadRole = 'phone';
  // A fresh textarea defaults to no leadRole — the default form's
  // service-picker dropdown (via `useServicesList`) carries the role; the
  // textarea is the "anything else?" freeform escape.
  return field;
}

/** A fresh service-picker `select` — the "use my services list" dropdown.
 *  Operator-friendly factory so call sites don't have to mutate the field
 *  after creation. */
export function defaultServicePickerField(): FormField {
  const field = defaultFormField('select');
  field.label = 'What service do you need?';
  field.placeholder = 'Pick a service…';
  field.required = true;
  field.useServicesList = true;
  field.leadRole = 'service';
  // The per-field `options` is unused when `useServicesList` is set —
  // clear it so a stale stub list doesn't ship in the snapshot.
  field.options = undefined;
  return field;
}

/** A fresh form — name + email + phone + service picker + details.
 *
 *  Five fields in canonical order:
 *    1. name           (text,    required, leadRole='name')
 *    2. email          (email,   required, leadRole='email') — the
 *       primary channel; every default automation prefers email.
 *    3. phone          (phone,   optional, leadRole='phone') — gates
 *       the SMS-fallback path when no email is on file.
 *    4. service picker (select + useServicesList, required,
 *       leadRole='service') — a standard dropdown flagged "use my
 *       services list", options resolved live from `brand.services` at
 *       render time. The submitted value is the picked option's string
 *       (a snapshot, not a foreign key — historical leads stay readable
 *       when the services list later changes).
 *    5. textarea       (textarea, optional, no leadRole)  — the
 *       "anything else we should know?" freeform escape. Not tagged as
 *       service because the dropdown above is the canonical answer.
 *
 *  Fail-graceful: when `brand.services` is empty (a freshly-onboarded
 *  client mid-wizard or a never-onboarded edge case), `FormBlock` renders
 *  the dropdown as a placeholder-only state + the textarea picks up the
 *  freeform answer. */
export function defaultFormConfig(): FormConfig {
  const name = defaultFormField('text');
  name.label = 'Your name';
  name.leadRole = 'name';

  const email = defaultFormField('email');
  email.required = true;

  const phone = defaultFormField('phone');
  phone.required = false;

  const servicePick = defaultServicePickerField();

  const details = defaultFormField('textarea');
  details.label = 'Anything else we should know?';

  return {
    title: 'Get in touch',
    showTitle: true,
    submitLabel: 'Send',
    fields: [name, email, phone, servicePick, details],
    afterSubmit: {
      kind: 'message',
      heading: 'Thanks!',
      body: "We've got your details and will be in touch shortly.",
    },
    colors: {},
  };
}

/** Back-fills missing keys so an old draft or a partially-AI-generated form
 *  renders safely. Same defence as each section module's `withDefaults`. */
export function withFormDefaults(form: Partial<FormConfig> | undefined): FormConfig {
  const base = defaultFormConfig();
  if (!form) return base;
  return {
    title: form.title ?? base.title,
    showTitle: form.showTitle ?? base.showTitle,
    submitLabel: form.submitLabel ?? base.submitLabel,
    fields: Array.isArray(form.fields) && form.fields.length > 0 ? form.fields : base.fields,
    afterSubmit: form.afterSubmit ?? base.afterSubmit,
    colors: form.colors ?? base.colors,
  };
}
