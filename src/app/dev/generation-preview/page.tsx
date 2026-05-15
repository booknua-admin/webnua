'use client';

// =============================================================================
// DEV ONLY — form-to-page generation preview. Off-nav. Same lifecycle as
// /dev/capabilities + /dev/sections (stub-era only; gated or deleted when
// real auth + real model wiring land).
//
// Lets you twiddle a GenerationContext (page type, intent, audience) and
// see (a) the constructed prompt blocks side-by-side with (b) the stub's
// validated output + validation log. The prompt-construction layer is the
// piece of Session 6 that graduates to the real backend; this surface
// lets you validate that layer in isolation from the stub's deterministic
// recipes.
// =============================================================================

import { useMemo, useState } from 'react';

import { DevRoleSwitcher } from '@/components/shared/DevRoleSwitcher';
import { ChipSelector } from '@/components/shared/ChipSelector';
import {
  AUDIENCE_CHIPS,
  PAGE_TYPE_CHIPS,
  PRIMARY_INTENT_CHIPS,
  type Audience,
  type GenerationContext,
  type PrimaryIntent,
} from '@/lib/website/generation-context';
import { DEFAULT_PREVIEW_BRAND } from '@/lib/website/data-stub';
import { buildPromptBlocks, composePrompt } from '@/lib/website/generation-prompt';
import { generateSync } from '@/lib/website/generation-stub';
import type { PageType } from '@/lib/website/types';

export default function GenerationPreviewPage() {
  const [pageType, setPageType] = useState<PageType>('generic');
  const [intentKind, setIntentKind] =
    useState<PrimaryIntent['kind']>('book');
  const [intentOther, setIntentOther] = useState('show our portfolio + DM us');
  const [audience, setAudience] = useState<Audience>('cold-ad');
  const [specifics, setSpecifics] = useState(
    'We are the only Perth sparkies guaranteeing under-1h response, written quote before work starts, fixed $99 callout.',
  );
  const [avoid, setAvoid] = useState(
    'Don’t say “cheapest” — we compete on quality, not price.',
  );

  const intent: PrimaryIntent = useMemo(
    () =>
      intentKind === 'other'
        ? { kind: 'other', text: intentOther }
        : ({ kind: intentKind } as PrimaryIntent),
    [intentKind, intentOther],
  );

  const ctx: GenerationContext = useMemo(
    () => ({
      flavour: 'new-page',
      pageType,
      primaryIntent: intent,
      audience,
      specifics: specifics.trim() || null,
      avoid: avoid.trim() || null,
      brand: DEFAULT_PREVIEW_BRAND,
      existingPages: [],
    }),
    [pageType, intent, audience, specifics, avoid],
  );

  const blocks = useMemo(() => buildPromptBlocks(ctx), [ctx]);
  const fullPrompt = useMemo(() => composePrompt(ctx), [ctx]);
  const generated = useMemo(() => generateSync(ctx), [ctx]);

  return (
    <div className="min-h-svh bg-paper px-8 py-10">
      <div className="mx-auto max-w-[1400px]">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-rust">
          {'// DEV · GENERATION PREVIEW'}
        </p>
        <h1 className="mb-2 text-[32px] font-extrabold leading-[1.05] tracking-[-0.025em] text-ink">
          Prompt construction & stub <em className="not-italic text-rust">output</em>.
        </h1>
        <p className="mb-8 max-w-[760px] text-[13px] leading-[1.55] text-ink-mid">
          Twiddle the inputs below. The middle column shows the prompt blocks
          built from the current <code>GenerationContext</code>; the right
          column shows the stub generator&rsquo;s validated output and
          validation log. <strong>This is the dev surface for validating the
          prompt-construction layer</strong> — the piece that graduates to the
          real backend when the model lands.
        </p>

        <div className="grid gap-5 lg:grid-cols-[300px_1fr_1fr] items-start">
          {/* ---- Inputs ---- */}
          <div className="space-y-5 rounded-xl border border-rule bg-card p-5">
            <Field label="Page type">
              <ChipSelector
                options={PAGE_TYPE_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
                value={pageType}
                onChange={(id) => setPageType(id)}
              />
            </Field>
            <Field label="Primary intent">
              <ChipSelector
                options={PRIMARY_INTENT_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
                value={intentKind}
                onChange={(id) => setIntentKind(id)}
              />
              {intentKind === 'other' && (
                <input
                  className="mt-2 block w-full rounded-md border border-rule bg-card px-3 py-2 font-sans text-[13px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/15"
                  value={intentOther}
                  onChange={(e) => setIntentOther(e.target.value)}
                  placeholder="e.g. show our portfolio + DM us"
                />
              )}
            </Field>
            <Field label="Audience">
              <ChipSelector
                options={AUDIENCE_CHIPS.map((c) => ({ id: c.id, label: c.label }))}
                value={audience}
                onChange={(id) => setAudience(id)}
              />
            </Field>
            <Field label="Specifics (Q4)">
              <textarea
                value={specifics}
                onChange={(e) => setSpecifics(e.target.value)}
                rows={4}
                className="block w-full rounded-md border border-rule bg-card px-3 py-2 font-sans text-[13px] leading-[1.45] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/15"
              />
            </Field>
            <Field label="Avoid (Q5)">
              <textarea
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                rows={3}
                className="block w-full rounded-md border border-rule bg-card px-3 py-2 font-sans text-[13px] leading-[1.45] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/15"
              />
            </Field>
            <div className="border-t border-paper-2 pt-3">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(fullPrompt)}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
              >
                Copy full prompt ⧉
              </button>
            </div>
          </div>

          {/* ---- Prompt blocks ---- */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-quiet">
              {'// PROMPT BLOCKS'}
            </p>
            {blocks.map((block) => (
              <details
                key={block.id}
                open
                className="overflow-hidden rounded-lg border border-rule bg-card"
              >
                <summary className="cursor-pointer border-b border-paper-2 bg-paper-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                  {block.heading}
                </summary>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[11.5px] leading-[1.55] text-ink">
                  {block.body}
                </pre>
              </details>
            ))}
          </div>

          {/* ---- Stub output + validation log ---- */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-quiet">
              {'// STUB OUTPUT'}
            </p>
            <details
              open
              className="overflow-hidden rounded-lg border border-rule bg-card"
            >
              <summary className="cursor-pointer border-b border-paper-2 bg-paper-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                Generated page · {generated.page.sections.length} sections
              </summary>
              <div className="px-4 py-3 text-[13px] leading-[1.55] text-ink">
                <p>
                  <strong>Title:</strong> {generated.page.title}
                </p>
                <p>
                  <strong>Slug:</strong> /{generated.page.slug}
                </p>
                <p className="mb-2">
                  <strong>Type:</strong> {generated.page.type}
                </p>
                <ul className="space-y-1.5">
                  {generated.page.sections.map((s) => (
                    <li key={s.id} className="font-mono text-[11px]">
                      <span className="text-rust">{s.type}</span>{' '}
                      <span className="text-ink-quiet">
                        · {s.ai?.draftedFields.length ?? 0} AI-drafted fields
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>

            <details className="overflow-hidden rounded-lg border border-rule bg-card">
              <summary className="cursor-pointer border-b border-paper-2 bg-paper-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                Validation log · {generated.fallbackLog.length} fallbacks · {generated.droppedSections.length} dropped
              </summary>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[11px] leading-[1.55] text-ink">
                {generated.fallbackLog.length === 0 &&
                generated.droppedSections.length === 0
                  ? '(clean — no fallbacks, no dropped sections)'
                  : JSON.stringify(
                      {
                        fallbacks: generated.fallbackLog,
                        dropped: generated.droppedSections,
                      },
                      null,
                      2,
                    )}
              </pre>
            </details>

            <details className="overflow-hidden rounded-lg border border-rule bg-card">
              <summary className="cursor-pointer border-b border-paper-2 bg-paper-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                Full Page JSON
              </summary>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[10.5px] leading-[1.5] text-ink">
                {JSON.stringify(generated.page, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
      <DevRoleSwitcher />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </p>
      {children}
    </div>
  );
}
