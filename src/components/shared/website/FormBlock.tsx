'use client';

// =============================================================================
// FormBlock — the generic renderer for a lead-capture form (FormConfig).
//
// One component renders every form on the platform: the dedicated `form`
// section, and any section that has a `section.form` attached. It is mounted
// by PagePreviewPane beneath a section's own Preview whenever `section.form`
// is set.
//
// It is a REAL form — it holds local field state and validates on submit.
// The actual lead-creating submit is wired in a later phase via the optional
// `onSubmit` prop; without it the submit button is an inert preview.
//
// In the editor each field / the title / the submit button is a
// SelectableElement so clicking it opens that element's inspector. Outside
// the editor (no `onSelectElement`) it renders as a plain working form — the
// shape the future public renderer reuses verbatim.
// =============================================================================

import { useState } from 'react';

import type { FormConfig, FormField } from '@/lib/website/form-config';
import type { BrandObject } from '@/lib/website/types';

import { SelectableElement } from '@/lib/website/sections/_shared/SelectableElement';

/** Reserved selectable-element ids for the non-field parts of a form. */
export const FORM_TITLE_ELEMENT = '__formTitle';
export const FORM_SUBMIT_ELEMENT = '__formSubmit';
export const FORM_SETTINGS_ELEMENT = '__formSettings';

/** A submitted field value, assembled on submit and handed to `onSubmit`. */
export type SubmittedFormField = {
  fieldId: string;
  label: string;
  type: FormField['type'];
  value: string;
  imageUrl?: string;
};

export type FormBlockProps = {
  form: FormConfig;
  brand: BrandObject;
  /** Editor element-inspector wiring — omit for a non-editor render. */
  selectedElement?: string | null;
  onSelectElement?: (id: string) => void;
  /** When provided the form submits for real; absent = inert preview. */
  onSubmit?: (fields: SubmittedFormField[]) => Promise<void> | void;
};

type ResolvedFormColors = {
  background: string;
  fieldBackground: string;
  fieldBorder: string;
  label: string;
  buttonBackground: string;
  buttonText: string;
};

function resolveFormColors(form: FormConfig, brand: BrandObject): ResolvedFormColors {
  const c = form.colors;
  const accent = brand.accentColor || '#d24317';
  return {
    background: c.background || '#ffffff',
    fieldBackground: c.fieldBackground || '#ffffff',
    fieldBorder: c.fieldBorder || '#d8d4ca',
    label: c.label || '#0f1115',
    buttonBackground: c.buttonBackground || accent,
    buttonText: c.buttonText || '#ffffff',
  };
}

export function FormBlock({
  form,
  brand,
  selectedElement,
  onSelectElement,
  onSubmit,
}: FormBlockProps) {
  const colors = resolveFormColors(form, brand);
  const editing = !!onSelectElement;

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const setValue = (id: string, value: string) => {
    setValues((v) => ({ ...v, [id]: value }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    for (const field of form.fields) {
      const raw = (values[field.id] ?? '').trim();
      if (field.required && !raw) {
        next[field.id] = `${field.label} is required.`;
        continue;
      }
      if (raw && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        next[field.id] = 'Enter a valid email address.';
      }
      if (raw && field.type === 'phone' && raw.replace(/[^0-9]/g, '').length < 6) {
        next[field.id] = 'Enter a valid phone number.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmit || submitting) return;
    if (!validate()) return;
    const assembled: SubmittedFormField[] = form.fields.map((field) => ({
      fieldId: field.id,
      label: field.label,
      type: field.type,
      value: values[field.id] ?? '',
    }));
    setSubmitting(true);
    try {
      await onSubmit(assembled);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done && form.afterSubmit.kind === 'message') {
    return (
      <div
        className="@container w-full px-8 py-12 @2xl:px-12"
        style={{ backgroundColor: colors.background }}
      >
        <div className="mx-auto max-w-[520px] text-center">
          <p className="text-[22px] font-bold tracking-[-0.01em]" style={{ color: colors.label }}>
            {form.afterSubmit.heading}
          </p>
          <p className="mt-2 text-[14px] leading-[1.6] text-ink-mid">
            {form.afterSubmit.body}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="@container w-full px-8 py-12 @2xl:px-12"
      style={{ backgroundColor: colors.background }}
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-[520px] flex-col gap-4"
        noValidate
      >
        {form.showTitle ? (
          <SelectableElement
            id={FORM_TITLE_ELEMENT}
            selected={selectedElement === FORM_TITLE_ELEMENT}
            onSelect={onSelectElement}
          >
            <p
              className="text-[22px] font-bold tracking-[-0.01em]"
              style={{ color: colors.label }}
            >
              {form.title}
            </p>
          </SelectableElement>
        ) : null}

        {form.fields.length === 0 ? (
          <p className="rounded-md border border-dashed border-rule px-3 py-6 text-center text-[13px] text-ink-quiet">
            No fields yet — add one in the form editor.
          </p>
        ) : (
          form.fields.map((field) => (
            <SelectableElement
              key={field.id}
              id={field.id}
              selected={selectedElement === field.id}
              onSelect={onSelectElement}
            >
              <FieldInput
                field={field}
                value={values[field.id] ?? ''}
                error={errors[field.id]}
                colors={colors}
                onChange={(v) => setValue(field.id, v)}
              />
            </SelectableElement>
          ))
        )}

        <SelectableElement
          id={FORM_SUBMIT_ELEMENT}
          selected={selectedElement === FORM_SUBMIT_ELEMENT}
          onSelect={onSelectElement}
        >
          <button
            type="submit"
            disabled={submitting || (!onSubmit && !editing)}
            className="w-full rounded-lg py-3 text-[14px] font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{
              backgroundColor: colors.buttonBackground,
              color: colors.buttonText,
            }}
          >
            {submitting ? 'Sending…' : form.submitLabel}
          </button>
        </SelectableElement>
      </form>
    </div>
  );
}

// -- single field render ------------------------------------------------------

function FieldInput({
  field,
  value,
  error,
  colors,
  onChange,
}: {
  field: FormField;
  value: string;
  error?: string;
  colors: ResolvedFormColors;
  onChange: (value: string) => void;
}) {
  const inputStyle = {
    backgroundColor: colors.fieldBackground,
    borderColor: error ? '#c44444' : colors.fieldBorder,
  };
  const inputClass =
    'w-full rounded-md border px-3 py-2.5 text-[14px] text-ink outline-none focus:border-rust';

  const label = (
    <span
      className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.1em]"
      style={{ color: colors.label }}
    >
      {field.label}
      {field.required ? <span style={{ color: '#c44444' }}> *</span> : null}
    </span>
  );

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-2.5 text-[14px]" style={{ color: colors.label }}>
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          {field.label}
          {field.required ? <span style={{ color: '#c44444' }}> *</span> : null}
        </span>
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={inputClass}
          style={inputStyle}
        />
      ) : field.type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="">{field.placeholder || 'Select…'}</option>
          {(field.options ?? []).map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : field.type === 'image' ? (
        <input
          type="file"
          accept="image/*"
          className={inputClass}
          style={inputStyle}
          // Upload wiring lands in the test-submit phase.
          disabled
        />
      ) : (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
          style={inputStyle}
        />
      )}
      {error ? (
        <span className="mt-1 block text-[12px]" style={{ color: '#c44444' }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
