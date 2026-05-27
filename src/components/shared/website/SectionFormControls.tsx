'use client';

// =============================================================================
// SectionFormControls — the form editor inside the section fields panel.
//
// Dispatched on the selected element:
//   - section level (no form element selected): no form → the attach button;
//     a form exists → a pointer that opens the manager (the form itself is
//     clickable in the preview, the same as a field).
//   - the form container selected: the form manager — remove the form, the
//     field list (reorder / select / add), quick links to the title / submit
//     / settings inspectors.
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
  type FormPageLink,
} from '@/lib/website/form-config';
import { ColorField } from '@/lib/website/sections/_shared/ThemeField';
import { ToggleField } from '@/lib/website/sections/_shared/ToggleField';
import { VariantField } from '@/lib/website/sections/_shared/VariantField';

import {
  FORM_CONTAINER_ELEMENT,
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
  /** The site's pages — the after-submit redirect picks from these. */
  pageLinks: FormPageLink[];
  /** When false the form-manager "Remove form" action is hidden. Default
   *  true. Set false where the form is intrinsic to its host (a popup whose
   *  content IS the form — removing it is done by removing the popup). */
  allowRemove?: boolean;
};

/** True when the selected element belongs to the form (not the section). */
export function isFormElement(
  form: FormConfig | undefined,
  selectedElement: string | null,
): boolean {
  if (!form || !selectedElement) return false;
  return (
    selectedElement === FORM_CONTAINER_ELEMENT ||
    selectedElement === FORM_TITLE_ELEMENT ||
    selectedElement === FORM_SUBMIT_ELEMENT ||
    selectedElement === FORM_SETTINGS_ELEMENT ||
    form.fields.some((f) => f.id === selectedElement)
  );
}

/** Human label for a form element id — feeds the fields-panel header. */
export function formElementLabel(form: FormConfig | undefined, selectedElement: string): string {
  if (selectedElement === FORM_CONTAINER_ELEMENT) return 'Lead form';
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
  // Re-typing AWAY from `select` clears the services-list flag (it's
  // type-specific) — re-typing TO `select` preserves it if the prior
  // field already had it set.
  if (type === 'select' && field.useServicesList) {
    next.useServicesList = true;
  }
  if (type === 'email') next.leadRole = 'email';
  else if (type === 'phone') next.leadRole = 'phone';
  else if (field.leadRole && (type === 'text' || type === 'textarea' || type === 'select')) {
    next.leadRole = field.leadRole;
  }
  return next;
}

const PLACEHOLDER_TYPES: readonly FormFieldType[] = [
  'text',
  'email',
  'phone',
  'textarea',
  'select',
];
const LEAD_ROLE_TYPES: readonly FormFieldType[] = ['text', 'email', 'phone', 'textarea'];

// =============================================================================

export function SectionFormControls({
  form,
  onSetForm,
  selectedElement,
  onSelectElement,
  isFunnel,
  pageLinks,
  allowRemove = true,
}: SectionFormControlsProps) {
  const canEdit = useCan('editForms');

  // -- a form element is selected --
  if (form && selectedElement && isFormElement(form, selectedElement)) {
    // The form container → the manager (field list, quick links, remove).
    if (selectedElement === FORM_CONTAINER_ELEMENT) {
      return (
        <FormManager
          form={form}
          onSetForm={onSetForm}
          onSelectElement={onSelectElement}
          canEdit={canEdit}
          allowRemove={allowRemove}
        />
      );
    }
    // A specific form element → its inspector.
    return (
      <FormElementInspector
        form={form}
        onSetForm={onSetForm}
        onSelectElement={onSelectElement}
        element={selectedElement}
        isFunnel={isFunnel}
        canEdit={canEdit}
        pageLinks={pageLinks}
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
          Add a form to capture enquiries from this section straight into the leads inbox.
        </p>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => {
            onSetForm(defaultFormConfig());
            onSelectElement(FORM_CONTAINER_ELEMENT);
          }}
          className="w-full rounded-md border border-dashed border-rule bg-card py-2.5 text-[13px] font-bold text-ink-mid transition-colors hover:border-rust hover:text-rust disabled:cursor-not-allowed disabled:opacity-55"
        >
          + Add a form to this section
        </button>
        {!canEdit ? <LockNote /> : null}
      </div>
    );
  }

  // -- section level: a form exists → a pointer into the manager. The full
  //    manager opens by selecting the form itself (in the preview, or here).
  return (
    <div className="mt-1 border-t border-paper-2 pt-4">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Lead form'}
      </p>
      <p className="mb-3 text-[13px] leading-[1.5] text-ink-mid">
        This section has a lead form ({form.fields.length}{' '}
        {form.fields.length === 1 ? 'field' : 'fields'}). Click the form in the preview — or the
        button below — to edit its fields, submit button, and after-submit settings.
      </p>
      <button
        type="button"
        onClick={() => onSelectElement(FORM_CONTAINER_ELEMENT)}
        className="w-full rounded-md border border-rust bg-rust-soft/50 py-2.5 text-[13px] font-bold text-rust transition-colors hover:bg-rust-soft"
      >
        Manage form →
      </button>
    </div>
  );
}

// -- section-level manager ----------------------------------------------------

function FormManager({
  form,
  onSetForm,
  onSelectElement,
  canEdit,
  allowRemove,
}: {
  form: FormConfig;
  onSetForm: (form: FormConfig | undefined) => void;
  onSelectElement: (id: string | null) => void;
  canEdit: boolean;
  allowRemove: boolean;
}) {
  const [picking, setPicking] = useState(false);

  const addField = (type: FormFieldType) => {
    onSetForm({ ...form, fields: [...form.fields, defaultFormField(type)] });
    // The picker stays open and the new field is NOT auto-selected — so as
    // many fields as wanted can be added in a row. Each appears in the list
    // above; click one to edit it, or "Done" to close the picker.
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= form.fields.length) return;
    const fields = [...form.fields];
    [fields[index], fields[j]] = [fields[j], fields[index]];
    onSetForm({ ...form, fields });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Lead form'}
        </p>
        {canEdit && allowRemove ? (
          <button
            type="button"
            onClick={() => {
              onSetForm(undefined);
              onSelectElement(null);
            }}
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
            <p className="mb-2 text-[12px] leading-[1.5] text-ink-quiet">
              Pick a type to add a field — add as many as you need, they stack in the list above.
            </p>
            <FormFieldTypePicker onPick={addField} />
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="mt-2 w-full text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet hover:text-ink"
            >
              Done
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
  pageLinks,
}: {
  form: FormConfig;
  onSetForm: (form: FormConfig | undefined) => void;
  onSelectElement: (id: string | null) => void;
  element: string;
  isFunnel: boolean;
  canEdit: boolean;
  pageLinks: FormPageLink[];
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
        pageLinks={pageLinks}
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
  pageLinks,
}: {
  form: FormConfig;
  onSetForm: (form: FormConfig | undefined) => void;
  isFunnel: boolean;
  canEdit: boolean;
  pageLinks: FormPageLink[];
}) {
  const after = form.afterSubmit;
  const kindOptions = [
    { id: 'message' as const, label: 'Show a message' },
    { id: 'url' as const, label: 'Redirect to a page' },
    ...(isFunnel ? [{ id: 'nextStep' as const, label: 'Next funnel step' }] : []),
  ];

  const setAfter = (next: FormAfterSubmit) => onSetForm({ ...form, afterSubmit: next });
  const setKind = (kind: FormAfterSubmit['kind']) => {
    if (kind === after.kind) return;
    if (kind === 'message')
      setAfter({ kind: 'message', heading: 'Thanks!', body: "We'll be in touch shortly." });
    else if (kind === 'url') setAfter({ kind: 'url', url: pageLinks[0]?.href ?? '' });
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
      {after.kind === 'message' ? (
        <p className="mb-3.5 -mt-1 text-[12px] leading-[1.5] text-ink-quiet">
          The visitor stays on the page and sees this message — the recommended option, since it
          lets a thank-you / conversion event fire for tracking.
        </p>
      ) : null}
      {after.kind === 'url' ? (
        <UrlRedirectField
          url={after.url}
          pageLinks={pageLinks}
          canEdit={canEdit}
          onChange={(url) => setAfter({ kind: 'url', url })}
        />
      ) : null}
      {after.kind === 'nextStep' ? (
        <p className="mb-3.5 text-[13px] leading-[1.5] text-ink-quiet">
          The visitor advances to the next step of this funnel. If this is the last step, the
          thank-you message shows instead.
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

/** The after-submit redirect target — a pick from the site's pages, with a
 *  "custom URL" escape hatch. Falls back to a plain URL input when the editor
 *  has no page list (e.g. a funnel step). */
function UrlRedirectField({
  url,
  pageLinks,
  canEdit,
  onChange,
}: {
  url: string;
  pageLinks: FormPageLink[];
  canEdit: boolean;
  onChange: (url: string) => void;
}) {
  const CUSTOM = '__custom';
  const selectedPage = pageLinks.find((p) => p.href === url);
  const isCustom = !selectedPage;
  const selectClass =
    'block w-full rounded-[7px] border border-rule bg-card px-3.5 py-[11px] ' +
    'font-sans text-[14px] text-ink transition-colors focus:border-rust ' +
    'focus:outline-none focus:ring-[3px] focus:ring-rust/12 ' +
    'disabled:cursor-not-allowed disabled:opacity-55';

  return (
    <BuilderField label="Redirect to" helper={<>Where the visitor goes after submitting.</>}>
      {pageLinks.length > 0 ? (
        <select
          value={selectedPage ? selectedPage.href : CUSTOM}
          disabled={!canEdit}
          onChange={(e) => onChange(e.target.value === CUSTOM ? '' : e.target.value)}
          className={selectClass}
        >
          {pageLinks.map((p) => (
            <option key={p.href} value={p.href}>
              {p.label} ({p.href})
            </option>
          ))}
          <option value={CUSTOM}>Custom URL…</option>
        </select>
      ) : null}
      {isCustom || pageLinks.length === 0 ? (
        <BuilderInput
          className={pageLinks.length > 0 ? 'mt-2' : undefined}
          value={url}
          placeholder="https://… or /path"
          disabled={!canEdit}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </BuilderField>
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
            { id: 'address', label: 'Service address' },
            { id: 'service', label: 'Service description' },
          ]}
          capability="editForms"
          helper={<>Maps this answer onto the lead record.</>}
          onChange={(v) => update({ leadRole: v === 'none' ? undefined : v })}
        />
      ) : null}

      {field.type === 'select' ? (
        <>
          <ToggleField
            label="Use my services list"
            helper={
              <>
                Pull options from the services you captured during onboarding.
                Tags this as the service field so automations pick the right
                value for <code>{'{{lead.service}}'}</code>.
              </>
            }
            value={!!field.useServicesList}
            capability="editForms"
            onChange={(v) =>
              // When ON: drop the per-field options[] (live from brand) +
              // force leadRole='service' so {{lead.service}} resolves.
              // When OFF: restore an editable options[] stub if the field
              // had none, and clear the auto-set service role (the
              // operator can pick a different role from the picker
              // above).
              update(
                v
                  ? {
                      useServicesList: true,
                      leadRole: 'service',
                      options: undefined,
                    }
                  : {
                      useServicesList: false,
                      leadRole:
                        field.leadRole === 'service' ? undefined : field.leadRole,
                      options:
                        field.options && field.options.length > 0
                          ? field.options
                          : ['Option one', 'Option two'],
                    },
              )
            }
          />
          {field.useServicesList ? (
            <div className="mb-3.5 rounded-md border border-rule bg-paper-2 px-3 py-2.5 text-[12px] leading-[1.5] text-ink-mid">
              <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                {'// Options'}
              </p>
              <p>
                Options come from <strong>your services list</strong> (captured
                during onboarding). The submitted value is the picked
                option&rsquo;s name (a snapshot), so a lead stays readable even
                if you later remove a service.
              </p>
            </div>
          ) : (
            <OptionsEditor
              options={field.options ?? []}
              canEdit={canEdit}
              onChange={(options) => update({ options })}
            />
          )}
        </>
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
              onChange={(e) => onChange(options.map((o, idx) => (idx === i ? e.target.value : o)))}
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
