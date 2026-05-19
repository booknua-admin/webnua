'use client';

// =============================================================================
// SectionFormControls — the form editor inside the section fields panel.
//
// Two jobs, dispatched on the selected element:
//   - section level (no form element selected): the form manager — attach /
//     remove a form, the field list (reorder / select / add), quick links to
//     the title / submit / settings inspectors.
//   - a form element selected: that element's inspector — a field, the title,
//     the submit button, or the form settings (after-submit + colours).
//
// Every mutation goes through `onSetForm`. Form editing is gated on the
// `editForms` capability.
// =============================================================================

import { useState } from 'react';

import {
  BuilderField,
  BuilderInput,
  BuilderTextarea,
} from '@/components/shared/builder/BuilderField';
import { useCan } from '@/lib/auth/user-stub';
import {
  defaultFormConfig,
  defaultFormField,
  type FormAfterSubmit,
  type FormConfig,
  type FormField,
  type FormFieldType,
} from '@/lib/website/form-config';
import { ColorField } from '@/lib/website/sections/_shared/ThemeField';
import { ToggleField } from '@/lib/website/sections/_shared/ToggleField';
import { VariantField } from '@/lib/website/sections/_shared/VariantField';

import {
  FORM_SETTINGS_ELEMENT,
  FORM_SUBMIT_ELEMENT,
  FORM_TITLE_ELEMENT,
} from './FormBlock';
import { FORM_FIELD_TYPE_LABEL, FormFieldTypePicker } from './FormFieldTypePicker';

export type SectionFormControlsProps = {
  form: FormConfig | undefined;
  onSetForm: (form: FormConfig | undefined) => void;
  selectedElement: string | null;
  onSelectElement: (id: string | null) => void;
  /** True in funnel-step mode — enables the "next step" after-submit action. */
  isFunnel: boolean;
};

/** True when the selected element belongs to the form (not the section). */
export function isFormElement(
  form: FormConfig | undefined,
  selectedElement: string | null,
): boolean {
  if (!form || !selectedElement) return false;
  return (
    selectedElement === FORM_TITLE_ELEMENT ||
    selectedElement === FORM_SUBMIT_ELEMENT ||
    selectedElement === FORM_SETTINGS_ELEMENT ||
    form.fields.some((f) => f.id === selectedElement)
  );
}

/** Human label for a form element id — feeds the fields-panel header. */
export function formElementLabel(
  form: FormConfig | undefined,
  selectedElement: string,
): string {
  if (selectedElement === FORM_TITLE_ELEMENT) return 'Form title';
  if (selectedElement === FORM_SUBMIT_ELEMENT) return 'Submit button';
  if (selectedElement === FORM_SETTINGS_ELEMENT) return 'Form settings';
  const field = form?.fields.find((f) => f.id === selectedElement);
  return field ? field.label || 'Form field' : 'Form field';
}

// -- field-type helpers -------------------------------------------------------

/** Re-type a field, preserving label / required, dropping type-specific keys. */
function retypeField(field: FormField, type: FormFieldType): FormField {
  const next: FormField = {
    id: field.id,
    type,
    label: field.label,
    required: field.required,
  };
  if (field.placeholder) next.placeholder = field.placeholder;
  if (type === 'select') {
    next.options = field.options ?? ['Option one', 'Option two'];
  }
  if (type === 'email') next.leadRole = 'email';
  else if (type === 'phone') next.leadRole = 'phone';
  else if (field.leadRole && (type === 'text')) next.leadRole = field.leadRole;
  return next;
}

const PLACEHOLDER_TYPES: readonly FormFieldType[] = [
  'text',
  'email',
  'phone',
  'textarea',
  'select',
];
const LEAD_ROLE_TYPES: readonly FormFieldType[] = ['text', 'email', 'phone'];

// =============================================================================

export function SectionFormControls({
  form,
  onSetForm,
  selectedElement,
  onSelectElement,
  isFunnel,
}: SectionFormControlsProps) {
  const canEdit = useCan('editForms');

  // -- a form element is selected → its inspector --
  if (form && selectedElement && isFormElement(form, selectedElement)) {
    return (
      <FormElementInspector
        form={form}
        onSetForm={onSetForm}
        onSelectElement={onSelectElement}
        element={selectedElement}
        isFunnel={isFunnel}
        canEdit={canEdit}
      />
    );
  }

  // -- section level: no form yet → the attach button --
  if (!form) {
    return (
      <div className="mt-1 border-t border-paper-2 pt-4">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Lead form'}
        </p>
        <p className="mb-3 text-[13px] leading-[1.5] text-ink-mid">
          Add a form to capture enquiries from this section straight into the
          leads inbox.
        </p>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => onSetForm(defaultFormConfig())}
          className="w-full rounded-md border border-dashed border-rule bg-card py-2.5 text-[13px] font-bold text-ink-mid transition-colors hover:border-rust hover:text-rust disabled:cursor-not-allowed disabled:opacity-55"
        >
          + Add a form to this section
        </button>
        {!canEdit ? <LockNote /> : null}
      </div>
    );
  }

  // -- section level: a form exists → the manager --
  return (
    <FormManager
      form={form}
      onSetForm={onSetForm}
      onSelectElement={onSelectElement}
      canEdit={canEdit}
    />
  );
}

// -- section-level manager ----------------------------------------------------

function FormManager({
  form,
  onSetForm,
  onSelectElement,
  canEdit,
}: {
  form: FormConfig;
  onSetForm: (form: FormConfig | undefined) => void;
  onSelectElement: (id: string | null) => void;
  canEdit: boolean;
}) {
  const [picking, setPicking] = useState(false);

  const addField = (type: FormFieldType) => {
    const field = defaultFormField(type);
    onSetForm({ ...form, fields: [...form.fields, field] });
    setPicking(false);
    onSelectElement(field.id);
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= form.fields.length) return;
    const fields = [...form.fields];
    [fields[index], fields[j]] = [fields[j], fields[index]];
    onSetForm({ ...form, fields });
  };

  return (
    <div className="mt-1 border-t border-paper-2 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Lead form'}
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => onSetForm(undefined)}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust transition-colors hover:text-rust-deep"
          >
            Remove form
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <ManagerRow label="Form title" onClick={() => onSelectElement(FORM_TITLE_ELEMENT)} />
        <ManagerRow label="Submit button" onClick={() => onSelectElement(FORM_SUBMIT_ELEMENT)} />
        <ManagerRow label="Form settings" onClick={() => onSelectElement(FORM_SETTINGS_ELEMENT)} />
      </div>

      <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        Fields
      </p>
      {form.fields.length === 0 ? (
        <p className="mb-2 text-[12px] text-ink-quiet">No fields yet.</p>
      ) : (
        <div className="mb-2 flex flex-col gap-1.5">
          {form.fields.map((field, i) => (
            <div
              key={field.id}
              className="flex items-center gap-1.5 rounded-md border border-rule bg-card px-2.5 py-2"
            >
              <button
                type="button"
                onClick={() => onSelectElement(field.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {field.label || 'Untitled field'}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  {FORM_FIELD_TYPE_LABEL[field.type]}
                  {field.required ? ' · required' : ''}
                </span>
              </button>
              {canEdit ? (
                <>
                  <ReorderButton
                    direction="up"
                    disabled={i === 0}
                    onClick={() => moveField(i, -1)}
                  />
                  <ReorderButton
                    direction="down"
                    disabled={i === form.fields.length - 1}
                    onClick={() => moveField(i, 1)}
                  />
                </>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canEdit ? (
        picking ? (
          <div className="rounded-md border border-rule bg-paper p-2.5">
            <FormFieldTypePicker onPick={addField} />
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="mt-2 w-full text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="w-full rounded-md border border-dashed border-rule bg-card py-2 text-[13px] font-bold text-ink-mid transition-colors hover:border-rust hover:text-rust"
          >
            + Add field
          </button>
        )
      ) : (
        <LockNote />
      )}
    </div>
  );
}

function ManagerRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-md border border-rule bg-card px-2.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-rust hover:text-rust"
    >
      {label}
      <span aria-hidden className="text-ink-quiet">
        ›
      </span>
    </button>
  );
}

function ReorderButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === 'up' ? 'Move up' : 'Move down'}
      className="rounded px-1.5 py-1 text-[13px] font-bold text-ink-quiet transition-colors hover:bg-rust-soft hover:text-rust disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-quiet"
    >
      {direction === 'up' ? '↑' : '↓'}
    </button>
  );
}

// -- per-element inspector ----------------------------------------------------

function FormElementInspector({
  form,
  onSetForm,
  onSelectElement,
  element,
  isFunnel,
  canEdit,
}: {
  form: FormConfig;
  onSetForm: (form: FormConfig | undefined) => void;
  onSelectElement: (id: string | null) => void;
  element: string;
  isFunnel: boolean;
  canEdit: boolean;
}) {
  if (element === FORM_TITLE_ELEMENT) {
    return (
      <div>
        {!canEdit ? <LockNote /> : null}
        <BuilderField label="Title">
          <BuilderInput
            value={form.title}
            disabled={!canEdit}
            onChange={(e) => onSetForm({ ...form, title: e.target.value })}
          />
        </BuilderField>
        <ToggleField
          label="Show title"
          value={form.showTitle}
          capability="editForms"
          onChange={(v) => onSetForm({ ...form, showTitle: v })}
        />
      </div>
    );
  }

  if (element === FORM_SUBMIT_ELEMENT) {
    return (
      <div>
        {!canEdit ? <LockNote /> : null}
        <BuilderField label="Button label">
          <BuilderInput
            value={form.submitLabel}
            disabled={!canEdit}
            onChange={(e) => onSetForm({ ...form, submitLabel: e.target.value })}
          />
        </BuilderField>
        <ColorField
          label="Button colour"
          value={form.colors.buttonBackground || '#d24317'}
          inherited={form.colors.buttonBackground === undefined}
          inheritedLabel="Brand accent"
          onChange={(v) => setColor(form, onSetForm, 'buttonBackground', v)}
          onReset={() => clearColor(form, onSetForm, 'buttonBackground')}
        />
        <ColorField
          label="Button text"
          value={form.colors.buttonText || '#ffffff'}
          inherited={form.colors.buttonText === undefined}
          onChange={(v) => setColor(form, onSetForm, 'buttonText', v)}
          onReset={() => clearColor(form, onSetForm, 'buttonText')}
        />
      </div>
    );
  }

  if (element === FORM_SETTINGS_ELEMENT) {
    return (
      <FormSettingsInspector
        form={form}
        onSetForm={onSetForm}
        isFunnel={isFunnel}
        canEdit={canEdit}
      />
    );
  }

  // a field
  const index = form.fields.findIndex((f) => f.id === element);
  if (index < 0) return null;
  return (
    <FieldInspector
      form={form}
      onSetForm={onSetForm}
      onSelectElement={onSelectElement}
      index={index}
      canEdit={canEdit}
    />
  );
}

function FormSettingsInspector({
  form,
  onSetForm,
  isFunnel,
  canEdit,
}: {
  form: FormConfig;
  onSetForm: (form: FormConfig | undefined) => void;
  isFunnel: boolean;
  canEdit: boolean;
}) {
  const after = form.afterSubmit;
  const kindOptions = [
    { id: 'message' as const, label: 'Thank-you message' },
    { id: 'url' as const, label: 'Redirect to a link' },
    ...(isFunnel ? [{ id: 'nextStep' as const, label: 'Next funnel step' }] : []),
  ];

  const setAfter = (next: FormAfterSubmit) => onSetForm({ ...form, afterSubmit: next });
  const setKind = (kind: FormAfterSubmit['kind']) => {
    if (kind === after.kind) return;
    if (kind === 'message')
      setAfter({ kind: 'message', heading: 'Thanks!', body: "We'll be in touch shortly." });
    else if (kind === 'url') setAfter({ kind: 'url', url: '' });
    else setAfter({ kind: 'nextStep' });
  };

  return (
    <div>
      {!canEdit ? <LockNote /> : null}
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        After submit
      </p>
      <VariantField
        label="When the form is sent"
        value={after.kind}
        options={kindOptions}
        capability="editForms"
        onChange={setKind}
      />
      {after.kind === 'message' ? (
        <>
          <BuilderField label="Heading">
            <BuilderInput
              value={after.heading}
              disabled={!canEdit}
              onChange={(e) => setAfter({ ...after, heading: e.target.value })}
            />
          </BuilderField>
          <BuilderField label="Message">
            <BuilderTextarea
              value={after.body}
              disabled={!canEdit}
              onChange={(e) => setAfter({ ...after, body: e.target.value })}
            />
          </BuilderField>
        </>
      ) : null}
      {after.kind === 'url' ? (
        <BuilderField
          label="Redirect link"
          helper={<>Where the visitor goes after submitting — a full URL.</>}
        >
          <BuilderInput
            value={after.url}
            placeholder="https://…"
            disabled={!canEdit}
            onChange={(e) => setAfter({ ...after, url: e.target.value })}
          />
        </BuilderField>
      ) : null}
      {after.kind === 'nextStep' ? (
        <p className="mb-3.5 text-[13px] leading-[1.5] text-ink-quiet">
          The visitor advances to the next step of this funnel. If this is the
          last step, the thank-you message shows instead.
        </p>
      ) : null}

      <p className="mb-2 mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        Form colours
      </p>
      <ColorField
        label="Background"
        value={form.colors.background || '#ffffff'}
        inherited={form.colors.background === undefined}
        onChange={(v) => setColor(form, onSetForm, 'background', v)}
        onReset={() => clearColor(form, onSetForm, 'background')}
      />
      <ColorField
        label="Field background"
        value={form.colors.fieldBackground || '#ffffff'}
        inherited={form.colors.fieldBackground === undefined}
        onChange={(v) => setColor(form, onSetForm, 'fieldBackground', v)}
        onReset={() => clearColor(form, onSetForm, 'fieldBackground')}
      />
      <ColorField
        label="Field border"
        value={form.colors.fieldBorder || '#d8d4ca'}
        inherited={form.colors.fieldBorder === undefined}
        onChange={(v) => setColor(form, onSetForm, 'fieldBorder', v)}
        onReset={() => clearColor(form, onSetForm, 'fieldBorder')}
      />
      <ColorField
        label="Label text"
        value={form.colors.label || '#0f1115'}
        inherited={form.colors.label === undefined}
        onChange={(v) => setColor(form, onSetForm, 'label', v)}
        onReset={() => clearColor(form, onSetForm, 'label')}
      />
    </div>
  );
}

function FieldInspector({
  form,
  onSetForm,
  onSelectElement,
  index,
  canEdit,
}: {
  form: FormConfig;
  onSetForm: (form: FormConfig | undefined) => void;
  onSelectElement: (id: string | null) => void;
  index: number;
  canEdit: boolean;
}) {
  const field = form.fields[index];
  const update = (patch: Partial<FormField>) => {
    const fields = [...form.fields];
    fields[index] = { ...field, ...patch };
    onSetForm({ ...form, fields });
  };
  const replace = (next: FormField) => {
    const fields = [...form.fields];
    fields[index] = next;
    onSetForm({ ...form, fields });
  };
  const remove = () => {
    onSetForm({ ...form, fields: form.fields.filter((f) => f.id !== field.id) });
    onSelectElement(null);
  };

  return (
    <div>
      {!canEdit ? <LockNote /> : null}
      <BuilderField label="Field type">
        <FormFieldTypePicker
          value={field.type}
          disabled={!canEdit}
          onPick={(type) => replace(retypeField(field, type))}
        />
      </BuilderField>

      <BuilderField label="Label">
        <BuilderInput
          value={field.label}
          disabled={!canEdit}
          onChange={(e) => update({ label: e.target.value })}
        />
      </BuilderField>

      {PLACEHOLDER_TYPES.includes(field.type) ? (
        <BuilderField label="Placeholder">
          <BuilderInput
            value={field.placeholder ?? ''}
            disabled={!canEdit}
            onChange={(e) => update({ placeholder: e.target.value })}
          />
        </BuilderField>
      ) : null}

      <ToggleField
        label="Required"
        value={field.required}
        capability="editForms"
        onChange={(v) => update({ required: v })}
      />

      {LEAD_ROLE_TYPES.includes(field.type) ? (
        <VariantField
          label="Lead detail"
          value={field.leadRole ?? 'none'}
          options={[
            { id: 'none', label: 'Not a contact detail' },
            { id: 'name', label: 'Customer name' },
            { id: 'email', label: 'Customer email' },
            { id: 'phone', label: 'Customer phone' },
          ]}
          capability="editForms"
          helper={<>Maps this answer onto the lead record.</>}
          onChange={(v) =>
            update({ leadRole: v === 'none' ? undefined : v })
          }
        />
      ) : null}

      {field.type === 'select' ? (
        <OptionsEditor
          options={field.options ?? []}
          canEdit={canEdit}
          onChange={(options) => update({ options })}
        />
      ) : null}

      {canEdit ? (
        <button
          type="button"
          onClick={remove}
          className="mt-2 w-full rounded-md border border-warn/40 bg-warn/5 py-2 text-[13px] font-bold text-warn transition-colors hover:bg-warn/10"
        >
          Remove field
        </button>
      ) : null}
    </div>
  );
}

function OptionsEditor({
  options,
  canEdit,
  onChange,
}: {
  options: string[];
  canEdit: boolean;
  onChange: (options: string[]) => void;
}) {
  return (
    <BuilderField label="Dropdown options">
      <div className="flex flex-col gap-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <BuilderInput
              value={opt}
              disabled={!canEdit}
              onChange={(e) =>
                onChange(options.map((o, idx) => (idx === i ? e.target.value : o)))
              }
            />
            {canEdit ? (
              <button
                type="button"
                onClick={() => onChange(options.filter((_, idx) => idx !== i))}
                aria-label="Remove option"
                className="shrink-0 px-1.5 font-mono text-[12px] font-bold text-rust hover:text-rust-deep"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {canEdit ? (
          <button
            type="button"
            onClick={() => onChange([...options, `Option ${options.length + 1}`])}
            className="w-fit rounded-md border border-dashed border-rule bg-card px-3 py-1.5 text-[12px] font-bold text-ink-mid transition-colors hover:border-rust hover:text-rust"
          >
            + Add option
          </button>
        ) : null}
      </div>
    </BuilderField>
  );
}

function LockNote() {
  return (
    <p className="mt-2 rounded-md border border-rule bg-paper-2 px-2.5 py-2 text-[12px] leading-[1.5] text-ink-quiet">
      Lead-capture forms are managed by your operator.
    </p>
  );
}

// -- colour helpers -----------------------------------------------------------

function setColor(
  form: FormConfig,
  onSetForm: (form: FormConfig) => void,
  key: keyof FormConfig['colors'],
  value: string,
) {
  onSetForm({ ...form, colors: { ...form.colors, [key]: value } });
}

function clearColor(
  form: FormConfig,
  onSetForm: (form: FormConfig) => void,
  key: keyof FormConfig['colors'],
) {
  const colors = { ...form.colors };
  delete colors[key];
  onSetForm({ ...form, colors });
}
