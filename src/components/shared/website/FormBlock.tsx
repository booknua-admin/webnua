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

import { useEffect, useRef, useState } from 'react';

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
import { useSectionFormSlot } from '@/lib/website/sections/_shared/section-form-slot';

/** Reserved selectable-element ids for the non-field parts of a form. */
/** The whole form card — selecting it opens the form manager. */
export const FORM_CONTAINER_ELEMENT = '__formContainer';
export const FORM_TITLE_ELEMENT = '__formTitle';
export const FORM_SUBMIT_ELEMENT = '__formSubmit';
export const FORM_SETTINGS_ELEMENT = '__formSettings';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Append `?lead=<id>` (or update it if already present) to a relative href.
 *  Threads the funnel step-1 lead id onto the step-2 URL so step 2's submit
 *  is linked back to the existing lead. */
function appendLeadParam(href: string, leadId: string): string {
  try {
    const url = new URL(href, window.location.origin);
    url.searchParams.set('lead', leadId);
    return url.pathname + url.search + url.hash;
  } catch {
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}lead=${encodeURIComponent(leadId)}`;
  }
}

/** Window surface exposed by `public/webnua-track.js`. Optional — the script
 *  is only present on PUBLISHED renders, never in the editor. */
type WebnuaTrackAPI = {
  formSubmitError?: (
    formEl: HTMLFormElement | null,
    info: { reason?: string; status?: number },
  ) => void;
};

/** Fire `form_submit_error` on the global tracker when an API rejection is
 *  caught. No-op when the script isn't present (editor / test renders). */
function reportSubmitError(formEl: HTMLFormElement | null, err: unknown): void {
  if (!formEl || typeof window === 'undefined') return;
  const api = (window as unknown as { webnuaTrack?: WebnuaTrackAPI })
    .webnuaTrack;
  if (!api?.formSubmitError) return;
  const reason =
    err instanceof Error && err.message ? err.message.slice(0, 200) : 'unknown';
  try {
    api.formSubmitError(formEl, { reason });
  } catch {
    // Tracker faults must never surface to the visitor.
  }
}

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
  // On a published site the slot carries a publicSubmit context — the form
  // then submits for real against /api/forms/submit. The editor test-submit
  // path (testSubmitCtx) takes precedence when both are somehow present.
  const slot = useSectionFormSlot();
  const publicSubmit = slot?.publicSubmit ?? null;
  const isPublic = !!publicSubmit && !testSubmitCtx;

  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'warn'; text: string } | null>(null);
  // Lead-correlation id (visitor-tracking-design §8). Generated after mount
  // and written imperatively to the <form> as `data-webnua-submission` — never
  // rendered as JSX, so the server HTML and the client agree (no hydration
  // mismatch). It is posted with the submission AND read off the attribute by
  // the tracking script's `form_submit` event, so the read layer can
  // reconcile the tracked count against the source-of-truth `leads` count.
  const submissionIdRef = useRef<string | null>(null);
  // Funnel cross-step linking (analytics-audit §2 fix). Step 1 puts the
  // created lead's id on the next-step redirect as `?lead=<uuid>`; step 2
  // reads it here and includes it in the submit so the route appends to the
  // existing lead instead of creating a new one. Stays null on the first
  // step / a direct-landing visitor — the route then takes its new-lead path.
  const existingLeadIdRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const id = crypto.randomUUID();
    submissionIdRef.current = id;
    formRef.current?.setAttribute('data-webnua-submission', id);
    try {
      const raw = new URLSearchParams(window.location.search).get('lead');
      if (raw && UUID_RE.test(raw)) existingLeadIdRef.current = raw;
    } catch {
      // window.location.search inaccessible — leave null.
    }
  }, []);

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
        surfaceKind: testSubmitCtx.surfaceKind,
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

  const handlePublicSubmit = async () => {
    if (!publicSubmit || busy) return;
    setNotice(null);
    if (!validate()) return;
    setBusy(true);
    try {
      // Image fields upload to the private bucket first; the returned path
      // rides along in the submit payload. A failed upload is best-effort —
      // the lead is still created, just without that attachment.
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
          const fd = new FormData();
          fd.append('file', file);
          fd.append('clientId', publicSubmit.clientId);
          try {
            const up = await fetch('/api/forms/upload', { method: 'POST', body: fd });
            if (up.ok) {
              const uploaded = (await up.json()) as { path?: string };
              if (uploaded.path) submitted.imagePath = uploaded.path;
            }
          } catch {
            // best-effort — fall through without the attachment
          }
        }
        assembled.push(submitted);
      }
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: publicSubmit.clientId,
          surfaceKind: publicSubmit.surfaceKind,
          funnelId: publicSubmit.funnelId ?? null,
          source: publicSubmit.sourceLabel,
          fields: assembled,
          submissionId: submissionIdRef.current,
          existingLeadId: existingLeadIdRef.current,
        }),
      });
      if (!res.ok) throw new Error('submit failed');
      const responseBody = (await res.json().catch(() => null)) as
        | { ok?: boolean; leadId?: string }
        | null;
      const createdLeadId =
        typeof responseBody?.leadId === 'string' ? responseBody.leadId : null;

      if (form.afterSubmit.kind === 'url') {
        window.location.href = form.afterSubmit.url || '/';
        return;
      }
      if (form.afterSubmit.kind === 'nextStep' && publicSubmit.nextStepHref) {
        // Thread the lead id forward so the next step's submission appends
        // to this lead rather than creating a new one (analytics-audit §2).
        window.location.href = createdLeadId
          ? appendLeadParam(publicSubmit.nextStepHref, createdLeadId)
          : publicSubmit.nextStepHref;
        return;
      }
      setDone(true);
    } catch (err) {
      // analytics-audit §5.2 gap #1: the tracker's capture-phase form_submit
      // already fired ("submit attempted"). Fire form_submit_error so the
      // operator can read successful = submit − error.
      reportSubmitError(formRef.current, err);
      setNotice({
        tone: 'warn',
        text: 'Something went wrong — please try again.',
      });
      setBusy(false);
    }
  };

  const cardStyle = {
    backgroundColor: colors.background,
    borderColor: colors.fieldBorder,
  };

  if (done) {
    const heading = form.afterSubmit.kind === 'message' ? form.afterSubmit.heading : 'Thanks!';
    const bodyText =
      form.afterSubmit.kind === 'message'
        ? form.afterSubmit.body
        : "We've received your details and will be in touch shortly.";
    return (
      <div className="w-full rounded-xl border p-7 text-center" style={cardStyle}>
        <p className="text-[20px] font-bold tracking-[-0.01em]" style={{ color: colors.label }}>
          {heading}
        </p>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-mid">{bodyText}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <SelectableElement
        id={FORM_CONTAINER_ELEMENT}
        selected={selectedElement === FORM_CONTAINER_ELEMENT}
        onSelect={onSelectElement}
      >
        <div className="w-full rounded-xl border p-6" style={cardStyle}>
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              if (isPublic) void handlePublicSubmit();
            }}
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
                    uploadEnabled={!!testSubmitCtx || isPublic}
                    onChange={(v) => setValue(field.id, v)}
                    onFile={(f) => setFile(field.id, f)}
                  />
                </SelectableElement>
              ))
            )}

            {isPublic ? (
              <button
                type="submit"
                disabled={busy}
                className="block w-full rounded-lg py-3 text-center text-[14px] font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{
                  backgroundColor: colors.buttonBackground,
                  color: colors.buttonText,
                }}
              >
                {busy ? 'Sending…' : form.submitLabel}
              </button>
            ) : (
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
            )}
          </form>
        </div>
      </SelectableElement>

      {isPublic && notice ? (
        <p className={'mt-2 text-[13px] ' + (notice.tone === 'good' ? 'text-good' : 'text-warn')}>
          {notice.text}
        </p>
      ) : null}

      {testSubmitCtx ? (
        <div className="mt-3 rounded-md border border-dashed border-rust/40 bg-rust-soft/40 px-3.5 py-3">
          <p className="mb-2 text-[12px] leading-[1.5] text-ink-mid">
            <strong className="font-semibold text-ink">Preview</strong> — a test submit creates a
            real lead in the inbox.
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
      ) : field.type === 'date' ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
