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

export type FormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'image';

/** Maps a field's submitted value onto a lead identity column. One field per
 *  role; a field with no role only lands in the lead_event payload. */
export type FormFieldLeadRole = 'name' | 'email' | 'phone';

export type FormField = {
  /** Stable id — also the element-inspector `selectedElement` id. */
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  /** `select` only — the dropdown options. */
  options?: string[];
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
  /** Human label of the form's origin, e.g. "Form · Hero". */
  sourceLabel: string;
};

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
  textarea: 'Message',
  select: 'Choose an option',
  checkbox: 'I agree',
  image: 'Upload a photo',
};

const FIELD_TYPE_PLACEHOLDER: Record<FormFieldType, string> = {
  text: 'Your name',
  email: 'you@example.com',
  phone: '0400 000 000',
  textarea: 'How can we help?',
  select: '',
  checkbox: '',
  image: '',
};

/** A fresh field of the given type, with a sensible label, placeholder, and
 *  an auto-assigned leadRole for the contact types. */
export function defaultFormField(type: FormFieldType): FormField {
  const field: FormField = {
    id: makeFieldId(),
    type,
    label: FIELD_TYPE_LABEL[type],
    required: type === 'email' || type === 'phone',
  };
  const placeholder = FIELD_TYPE_PLACEHOLDER[type];
  if (placeholder) field.placeholder = placeholder;
  if (type === 'select') field.options = ['Option one', 'Option two'];
  if (type === 'email') field.leadRole = 'email';
  if (type === 'phone') field.leadRole = 'phone';
  return field;
}

/** A fresh form — a name + email + message, message thank-you after submit. */
export function defaultFormConfig(): FormConfig {
  const name = defaultFormField('text');
  name.label = 'Your name';
  name.leadRole = 'name';
  return {
    title: 'Get in touch',
    showTitle: true,
    submitLabel: 'Send',
    fields: [name, defaultFormField('email'), defaultFormField('textarea')],
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
