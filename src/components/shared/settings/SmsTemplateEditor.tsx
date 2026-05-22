'use client';

// =============================================================================
// SmsTemplateEditor — one editable SMS template on the /settings/sms surface.
//
// Phase 7 Twilio SMS session. Operator-facing. The editor for a single
// template body, with everything an operator needs to author an SMS that does
// not silently cost double:
//   • a textarea + live character / segment / encoding readout,
//   • the typical-data and worst-case length/segment/cost estimates (the
//     template's {{variables}} render to real values first),
//   • warning banners for non-GSM characters, with a one-click fix,
//   • a hard 320-character (2 GSM segment) save limit,
//   • a preview pane showing the rendered output with sample data,
//   • a variable picker that inserts {{variables}} at the cursor.
// =============================================================================

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fixSmartCharacters,
  hasFixableSmartCharacters,
  validateTemplate,
} from '@/lib/sms/character-validator';
import {
  MAX_TEMPLATE_LENGTH,
  SMS_TEMPLATE_META,
  type SmsTemplateKey,
} from '@/lib/sms/default-templates';
import { formatSmsCost } from '@/lib/sms/pricing';
import { estimateCost, estimateWorstCase } from '@/lib/sms/template-cost-estimator';
import { render } from '@/lib/sms/template-renderer';
import { buildSampleContext, TEMPLATE_VARIABLES } from '@/lib/sms/template-variables';
import { useSaveSmsTemplate } from '@/lib/integrations/twilio/use-sms';

type SmsTemplateEditorProps = {
  clientId: string | null;
  templateKey: SmsTemplateKey;
  /** The saved template body — the editor's starting + reset value. */
  body: string;
  isDefault: boolean;
  lastEditedAt: string | null;
};

export function SmsTemplateEditor({
  clientId,
  templateKey,
  body,
  isDefault,
  lastEditedAt,
}: SmsTemplateEditorProps) {
  const meta = SMS_TEMPLATE_META[templateKey];
  const save = useSaveSmsTemplate(clientId);

  const [value, setValue] = useState(body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // Restore the caret after a variable insertion (the value change re-renders
  // the textarea, dropping the native caret position).
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && textareaRef.current) {
      const pos = pendingCaret.current;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  });

  const validation = useMemo(() => validateTemplate(value), [value]);
  const typical = useMemo(() => estimateCost(value), [value]);
  const worst = useMemo(() => estimateWorstCase(value), [value]);
  const preview = useMemo(() => render(value, buildSampleContext('typical')).text, [value]);

  const dirty = value !== body;
  const overLimit = validation.length > MAX_TEMPLATE_LENGTH;
  const empty = value.trim().length === 0;
  const canSave = dirty && !overLimit && !empty && clientId != null && !save.isPending;

  // Smart-character warnings (curly quotes, dashes, …) — the multi-segment
  // note is informational and shown separately.
  const charWarnings = validation.warnings.filter((w) => w.code !== 'multi_segment');
  const multiSegment = validation.warnings.find((w) => w.code === 'multi_segment');
  const fixable = hasFixableSmartCharacters(value);

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const el = textareaRef.current;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    pendingCaret.current = start + token.length;
    setValue(next);
  }

  function handleSave() {
    if (!canSave) return;
    save.mutate({ templateKey, body: value });
  }

  return (
    <div className="rounded-xl border border-rule bg-card px-6 py-5">
      {/* --- header --- */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-ink">{meta.label}</h3>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-ink-quiet">{meta.description}</p>
        </div>
        <span
          className={
            'shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ' +
            (isDefault ? 'bg-ink/[0.06] text-ink-quiet' : 'bg-rust/12 text-rust')
          }
        >
          {isDefault ? 'Default' : 'Customised'}
        </span>
      </div>

      {/* --- textarea --- */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="font-sans text-[13px]"
        aria-invalid={overLimit}
      />

      {/* --- live count --- */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em]">
        <span className={overLimit ? 'font-bold text-warn' : 'text-ink-quiet'}>
          {validation.length}/{MAX_TEMPLATE_LENGTH} chars
        </span>
        <span className="text-ink-quiet">·</span>
        <span className="text-ink-quiet">
          {validation.segments} segment{validation.segments === 1 ? '' : 's'}
        </span>
        <span className="text-ink-quiet">·</span>
        <span className={validation.segmentEncoding === 'gsm' ? 'text-good' : 'text-warn'}>
          {validation.segmentEncoding === 'gsm' ? 'GSM-7' : 'UCS-2'}
        </span>
      </div>

      {/* --- estimates --- */}
      <div className="mt-3 flex flex-col gap-1 rounded-lg bg-paper px-3.5 py-2.5 text-[12px] text-ink-soft">
        <EstimateLine label="Typical data" estimate={typical} />
        <EstimateLine label="Worst case" estimate={worst} />
        {typical.missingVariables.length > 0 ? (
          <p className="mt-0.5 text-[11px] text-warn">
            Unknown variable{typical.missingVariables.length === 1 ? '' : 's'}:{' '}
            {typical.missingVariables.map((v) => `{{${v}}}`).join(', ')} — check the spelling.
          </p>
        ) : null}
      </div>

      {/* --- warnings --- */}
      {charWarnings.length > 0 ? (
        <div className="mt-3 rounded-lg bg-warn/[0.08] px-3.5 py-2.5">
          <ul className="flex flex-col gap-1">
            {charWarnings.map((w) => (
              <li key={w.code} className="text-[12px] leading-[1.45] text-warn">
                {w.message}
              </li>
            ))}
          </ul>
          {fixable ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setValue(fixSmartCharacters(value))}
            >
              Fix curly quotes &amp; dashes
            </Button>
          ) : null}
        </div>
      ) : null}
      {multiSegment ? (
        <p className="mt-2 text-[11px] leading-[1.45] text-ink-quiet">{multiSegment.message}</p>
      ) : null}

      {/* --- variable picker --- */}
      <div className="mt-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          Insert a variable
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.description}
              onClick={() => insertVariable(v.key)}
              className="rounded border border-rule bg-paper px-2 py-1 font-mono text-[10px] text-ink-soft transition-colors hover:border-rust hover:text-rust"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
      </div>

      {/* --- preview --- */}
      <div className="mt-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          Preview · sample data
        </span>
        <div className="mt-1.5 rounded-lg border border-rule bg-paper px-3.5 py-2.5 text-[13px] leading-[1.5] text-ink">
          {preview || <span className="text-ink-quiet">Nothing to preview yet.</span>}
        </div>
      </div>

      {/* --- footer --- */}
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" disabled={!canSave} onClick={handleSave}>
          {save.isPending ? 'Saving…' : 'Save template'}
        </Button>
        {dirty && !save.isPending ? (
          <Button variant="ghost" size="sm" onClick={() => setValue(body)}>
            Discard changes
          </Button>
        ) : null}
        {overLimit ? (
          <span className="text-[12px] text-warn">
            Over the {MAX_TEMPLATE_LENGTH}-character limit — shorten it to save.
          </span>
        ) : empty ? (
          <span className="text-[12px] text-ink-quiet">The template cannot be empty.</span>
        ) : !dirty && lastEditedAt && !isDefault ? (
          <span className="text-[12px] text-ink-quiet">
            Last edited {formatDate(lastEditedAt)}.
          </span>
        ) : null}
      </div>
      {save.isError ? (
        <p className="mt-2 text-[12px] text-warn">
          {save.error instanceof Error ? save.error.message : 'Could not save the template.'}
        </p>
      ) : null}
      {save.isSuccess && !dirty ? <p className="mt-2 text-[12px] text-good">Saved.</p> : null}
    </div>
  );
}

// --- estimate line -----------------------------------------------------------

function EstimateLine({
  label,
  estimate,
}: {
  label: string;
  estimate: ReturnType<typeof estimateCost>;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
        {label}
      </span>
      <span>
        {estimate.length} chars, {estimate.segments} segment
        {estimate.segments === 1 ? '' : 's'} ({estimate.encoding === 'gsm' ? 'GSM-7' : 'UCS-2'}),{' '}
        {formatSmsCost(estimate.costEur)}/send
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
