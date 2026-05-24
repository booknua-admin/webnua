'use client';

// =============================================================================
// PlatformTemplateEditor — one editable card per platform_email_templates row.
//
// Phase 8 · Session 3. Subject + body editors, click-to-insert variable
// chips (via lib/editor/insert-at-cursor), variable catalog hint, and a
// preview pane rendering the template with sample data.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { applyInsertToField } from '@/lib/editor/insert-at-cursor';
import {
  renderTemplatePreview,
  useUpdatePlatformTemplate,
  variablesForTemplate,
  type PlatformEmailTemplate,
  type PlatformTemplateKey,
} from '@/lib/email/platform-templates-queries';
import { normalizeError } from '@/lib/errors';

const TEMPLATE_META: Record<
  PlatformTemplateKey,
  { title: string; description: string }
> = {
  lead_notification: {
    title: 'New-lead notification',
    description:
      'Sent to every operator on the client when a new lead arrives. Used for both the immediate fire AND for the test-send button.',
  },
  lead_digest: {
    title: 'Hourly lead digest',
    description:
      'Sent to operators who are configured for the "hourly" digest frequency. Batches every lead captured in the digest window into one summary.',
  },
};

type PlatformTemplateEditorProps = {
  template: PlatformEmailTemplate;
};

function PlatformTemplateEditor({ template }: PlatformTemplateEditorProps) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyText, setBodyText] = useState(template.bodyText);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const update = useUpdatePlatformTemplate();

  // Re-sync local state when the underlying row changes from elsewhere.
  useEffect(() => {
    setSubject(template.subject);
    setBodyText(template.bodyText);
  }, [template.templateKey, template.subject, template.bodyText]);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const focusedField = useRef<'subject' | 'body'>('body');

  const variables = variablesForTemplate(template.templateKey);
  const meta = TEMPLATE_META[template.templateKey];

  const insertVariable = (code: string) => {
    if (focusedField.current === 'subject') {
      applyInsertToField(subjectRef.current, setSubject, code);
    } else {
      applyInsertToField(bodyRef.current, setBodyText, code);
    }
  };

  const dirty = subject !== template.subject || bodyText !== template.bodyText;

  const handleSave = () => {
    setStatusMessage(null);
    update.mutate(
      {
        templateKey: template.templateKey,
        subject,
        bodyText,
      },
      {
        onSuccess: () => setStatusMessage('Saved.'),
        onError: (err) =>
          setStatusMessage(`Save failed — ${normalizeError(err).message}`),
      },
    );
  };

  const handleReset = () => {
    setSubject(template.subject);
    setBodyText(template.bodyText);
    setStatusMessage(null);
  };

  return (
    <div
      data-slot="platform-template-editor"
      className="rounded-xl border border-rule bg-card p-6"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-sans text-[18px] font-bold text-ink">{meta.title}</h3>
          <p className="mt-1 max-w-2xl font-sans text-[13px] text-ink-soft">
            {meta.description}
          </p>
        </div>
        <code className="rounded-md bg-paper px-2 py-1 font-mono text-[11px] text-ink-quiet">
          {template.templateKey}
        </code>
      </div>

      <label className="mb-3 block">
        <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          Subject
        </span>
        <Input
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onFocus={() => {
            focusedField.current = 'subject';
          }}
          className="rounded-md border-rule bg-paper font-sans text-[14px]"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          Body (plain text — HTML version is reflowed on save)
        </span>
        <Textarea
          ref={bodyRef}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          onFocus={() => {
            focusedField.current = 'body';
          }}
          rows={10}
          className="block min-h-44 w-full resize-y whitespace-pre-wrap rounded-md border border-rule bg-paper px-4 py-3.5 font-sans text-[14px] leading-[1.55] text-ink"
        />
      </label>

      <div className="mb-4">
        <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          Insert variable:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {variables.map((v) => (
            <button
              key={v.code}
              type="button"
              onClick={() => insertVariable(v.code)}
              title={v.description}
              className="inline-flex items-center rounded-[4px] bg-rust/12 px-2 py-0.5 font-mono text-[11px] font-bold text-rust transition-colors hover:bg-rust hover:text-paper"
            >
              {v.code}
            </button>
          ))}
        </div>
      </div>

      <details className="mb-4 rounded-md border border-rule bg-paper px-4 py-3">
        <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          Preview with sample data
        </summary>
        <div className="mt-3 border-t border-rule pt-3">
          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
            Subject
          </p>
          <p className="mb-3 font-sans text-[14px] font-bold text-ink">
            {renderTemplatePreview(subject)}
          </p>
          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
            Body
          </p>
          <pre className="whitespace-pre-wrap rounded-md bg-card p-3 font-sans text-[13px] leading-[1.5] text-ink-soft">
            {renderTemplatePreview(bodyText)}
          </pre>
        </div>
      </details>

      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          {statusMessage ? (
            <strong className="text-ink">{statusMessage}</strong>
          ) : template.lastEditedAt ? (
            `Last edited ${new Date(template.lastEditedAt).toLocaleString()}`
          ) : (
            'Never edited — using seed copy'
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={!dirty || update.isPending}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            disabled={!dirty || update.isPending}
            onClick={handleSave}
          >
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { PlatformTemplateEditor };
