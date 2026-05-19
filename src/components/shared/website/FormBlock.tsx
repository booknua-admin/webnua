'use client';

// =============================================================================
// FormBlock — the generic renderer for a lead-capture form (FormConfig).
//
// It renders as a self-contained CARD — it is placed INSIDE a section (the
// hero's form column, or a section's band via the SectionShell form slot),
// never as a separate block stacked underneath. The host constrains the
// width; FormBlock fills it.
//
// It is a REAL form — local field state, required + email/phone validation.
// In the editor a `testSubmitCtx` enables an explicit "Test submit" affordance
// that creates a genuine lead (useCreateLead). Each field / the title / the
// submit button is a SelectableElement so clicking it opens its inspector.
// =============================================================================

import { useState } from 'react';

import { useCreateLead } from '@/lib/leads/queries';
import { uploadLeadAttachment } from '@/lib/leads/upload-attachment';
import type {
  FormConfig,
  FormField,
  FormTestSubmitContext,
  SubmittedFormField,
} from '@/lib/website/form-config';
import type { BrandObject } from '@/lib/website/types';

import { SelectableElement } from '@/lib/website/sections/_shared/SelectableElement';

/** Reserved selectable-element ids for the non-field parts of a form. */
export const FORM_TITLE_ELEMENT = '__formTitle';
export const FORM_SUBMIT_ELEMENT = '__formSubmit';
export const FORM_SETTINGS_ELEMENT = '__formSettings';

export type { SubmittedFormField, FormTestSubmitContext };

export type FormBlockProps = {
  form: FormConfig;
  brand: BrandObject;
  /** Editor element-inspector wiring — omit for a non-editor render. */
  selectedElement?: string | null;
  onSelectElement?: (id: string) => void;
  /** When set, the editor "Test submit" affordance creates a real lead. */
  testSubmitCtx?: FormTestSubmitContext;
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
  testSubmitCtx,
}: FormBlockProps) {
  const colors = resolveFormColors(form, brand);
  const createLead = useCreateLead();

  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'warn'; text: string } | null>(
    null,
  );

  const setValue = (id: string, value: string) => {
    setValues((v) => ({ ...v, [id]: value }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: '' }));
  };

  const setFile = (id: string, file: File | null) => {
    setFiles((f) => {
      const next = { ...f };
      if (file) next[id] = file;
      else delete next[id];
      return next;
    });
    setValue(id, file ? file.name : '');
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

  const handleTestSubmit = async () => {
    if (!testSubmitCtx || busy) return;
    setNotice(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const assembled: SubmittedFormField[] = [];
      for (const field of form.fields) {
        const submitted: SubmittedFormField = {
          fieldId: field.id,
          label: field.label,
          type: field.type,
          value: values[field.id] ?? '',
          leadRole: field.leadRole,
        };
        const file = files[field.id];
        if (field.type === 'image' && file) {
          const result = await uploadLeadAttachment(file, testSubmitCtx.clientId);
          if (!result.ok) {
            setNotice({ tone: 'warn', text: result.error.message });
            setBusy(false);
            return;
          }
          submitted.imagePath = result.data.path;
        }
        assembled.push(submitted);
      }

      await createLead.mutateAsync({
        clientId: testSubmitCtx.clientId,
        source: testSubmitCtx.sourceLabel,
        fields: assembled,
      });

      if (form.afterSubmit.kind === 'message') {
        setDone(true);
      } else if (form.afterSubmit.kind === 'url') {
        setNotice({
          tone: 'good',
          text: `Lead created. A live form would redirect to ${form.afterSubmit.url || '(no link set)'}.`,
        });
      } else {
        setNotice({
          tone: 'good',
          text: 'Lead created. A live form would advance to the next funnel step.',
        });
      }
    } catch (e) {
      setNotice({
        tone: 'warn',
        text: e instanceof Error ? e.message : 'Could not create the lead.',
      });
    } finally {
      setBusy(false);
    }
  };

  const cardStyle = {
    backgroundColor: colors.background,
    borderColor: colors.fieldBorder,
  };

  if (done && form.afterSubmit.kind === 'message') {
    return (
      <div className="w-full rounded-xl border p-7 text-center" style={cardStyle}>
        <p className="text-[20px] font-bold tracking-[-0.01em]" style={{ color: colors.label }}>
          {form.afterSubmit.heading}
        </p>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-mid">
          {form.afterSubmit.body}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full rounded-xl border p-6" style={cardStyle}>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex w-full flex-col gap-4"
          noValidate
        >
          {form.showTitle ? (
            <SelectableElement
              id={FORM_TITLE_ELEMENT}
              selected={selectedElement === FORM_TITLE_ELEMENT}
              onSelect={onSelectElement}
            >
              <p
                className="text-[18px] font-bold tracking-[-0.01em]"
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
                  uploadEnabled={!!testSubmitCtx}
                  onChange={(v) => setValue(field.id, v)}
                  onFile={(f) => setFile(field.id, f)}
                />
              </SelectableElement>
            ))
          )}

          <SelectableElement
            id={FORM_SUBMIT_ELEMENT}
            selected={selectedElement === FORM_SUBMIT_ELEMENT}
            onSelect={onSelectElement}
          >
            <span
              className="block w-full rounded-lg py-3 text-center text-[14px] font-bold"
              style={{
                backgroundColor: colors.buttonBackground,
                color: colors.buttonText,
              }}
            >
              {form.submitLabel}
            </span>
          </SelectableElement>
        </form>
      </div>

      {testSubmitCtx ? (
        <div className="mt-3 rounded-md border border-dashed border-rust/40 bg-rust-soft/40 px-3.5 py-3">
          <p className="mb-2 text-[12px] leading-[1.5] text-ink-mid">
            <strong className="font-semibold text-ink">Preview</strong> — a test
            submit creates a real lead in the inbox.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={handleTestSubmit}
            className="rounded-md bg-rust px-3.5 py-2 text-[13px] font-bold text-paper transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Test submit →'}
          </button>
          {notice ? (
            <p
              className={
                'mt-2 text-[12px] leading-[1.5] ' +
                (notice.tone === 'good' ? 'text-good' : 'text-warn')
              }
            >
              {notice.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// -- single field render ------------------------------------------------------

function FieldInput({
  field,
  value,
  error,
  colors,
  uploadEnabled,
  onChange,
  onFile,
}: {
  field: FormField;
  value: string;
  error?: string;
  colors: ResolvedFormColors;
  uploadEnabled: boolean;
  onChange: (value: string) => void;
  onFile: (file: File | null) => void;
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
          disabled={!uploadEnabled}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className={inputClass}
          style={inputStyle}
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
