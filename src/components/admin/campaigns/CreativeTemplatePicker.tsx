'use client';

// =============================================================================
// CreativeTemplatePicker — per-image template picker + overlay editor.
//
// Phase 7.5 · Session 1.4b.1. Mounted in the launch wizard's step 4
// below the IMAGES grid, keyed off the currently-previewed image. Lets
// the operator:
//
//   1. Pick a template (Plain / Banner / Offer Card / Quote Drop / Split).
//   2. Edit that template's overlay text + structural choices (position,
//      corner, accent phrases, etc.).
//   3. Upload an optional secondary base image (Quote Drop's inset photo,
//      Split's second base).
//
// State is owned by the wizard — this is a controlled component. Changes
// fire `onChange` for the picker/overlay axis and `onSecondaryUpload` for
// the secondary-image axis (the wizard owns the Storage upload so it can
// share the same `useUploadAdImage` hook the primary-image path uses).
//
// Live preview is the wizard's responsibility — every overlay edit
// debounce-re-renders the canvas and updates the image's `previewUrl`.
// =============================================================================

import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CREATIVE_TEMPLATE_REGISTRY,
  type AuthorPosition,
  type BannerBg,
  type BannerHeight,
  type BannerPosition,
  type CreativeTemplateId,
  type CreativeTemplateOverlay,
  type GradientIntensity,
  type OfferCardCorner,
  type OfferCardSize,
  type OfferCardSurface,
  type QuoteMarkStyle,
  type SplitDividerBg,
  type SplitRatio,
  type TextAlign,
  listCreativeTemplates,
  validateOverlay,
} from '@/lib/integrations/meta-ads/creative-templates';

// --- props ------------------------------------------------------------------

export type CreativeTemplatePickerProps = {
  templateId: CreativeTemplateId;
  overlay: CreativeTemplateOverlay;
  /** Current secondary base image URL (Quote Drop inset, Split second
   *  base). Null when none has been uploaded. */
  secondaryUrl: string | null;
  /** Operator picks a new template. The wizard coerces the existing
   *  overlay onto the new template's shape (see coerceOverlayTo) and
   *  triggers a re-render. */
  onPickTemplate: (id: CreativeTemplateId) => void;
  /** Operator edits the active template's overlay. */
  onChangeOverlay: (next: CreativeTemplateOverlay) => void;
  /** Operator picked a file for the secondary upload. The wizard runs
   *  the actual Storage upload + updates the image's secondaryUrl. */
  onPickSecondary: (file: File) => void;
  /** Operator cleared the secondary image. */
  onClearSecondary: () => void;
  /** Optional upload-in-flight indicator the wizard surfaces from its
   *  uploadMutation. */
  secondaryUploadPending?: boolean;
  /** Optional upload error from the wizard's uploadMutation. */
  secondaryUploadError?: unknown;
};

// ---------------------------------------------------------------------------

export function CreativeTemplatePicker({
  templateId,
  overlay,
  secondaryUrl,
  onPickTemplate,
  onChangeOverlay,
  onPickSecondary,
  onClearSecondary,
  secondaryUploadPending,
  secondaryUploadError,
}: CreativeTemplatePickerProps) {
  const templates = listCreativeTemplates();
  const validationError = validateOverlay(templateId, overlay, secondaryUrl);

  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-rule bg-card px-4 py-4">
      {/* Picker chip row */}
      <div className="flex flex-col gap-2">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// TEMPLATE'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => {
            const selected = t.id === templateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPickTemplate(t.id)}
                data-selected={selected ? 'true' : undefined}
                className="rounded-md border border-rule bg-paper px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:border-rust hover:text-ink data-[selected=true]:border-rust data-[selected=true]:bg-rust-soft data-[selected=true]:text-ink"
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-quiet">
          {CREATIVE_TEMPLATE_REGISTRY[templateId].blurb}
        </p>
      </div>

      {/* Per-template overlay editor */}
      {overlay.kind === 'plain' ? (
        <p className="rounded-md bg-paper-2 px-3 py-2 text-[11px] text-ink-quiet">
          No overlay — the photo goes straight through.
        </p>
      ) : null}

      {overlay.kind === 'banner' ? (
        <BannerEditor overlay={overlay} onChange={onChangeOverlay} />
      ) : null}

      {overlay.kind === 'offer_card' ? (
        <OfferCardEditor overlay={overlay} onChange={onChangeOverlay} />
      ) : null}

      {overlay.kind === 'quote_drop' ? (
        <QuoteDropEditor
          overlay={overlay}
          onChange={onChangeOverlay}
          secondaryUrl={secondaryUrl}
          onPickSecondary={onPickSecondary}
          onClearSecondary={onClearSecondary}
          secondaryUploadPending={secondaryUploadPending}
          secondaryUploadError={secondaryUploadError}
        />
      ) : null}

      {overlay.kind === 'split' ? (
        <SplitEditor
          overlay={overlay}
          onChange={onChangeOverlay}
          secondaryUrl={secondaryUrl}
          onPickSecondary={onPickSecondary}
          onClearSecondary={onClearSecondary}
          secondaryUploadPending={secondaryUploadPending}
          secondaryUploadError={secondaryUploadError}
        />
      ) : null}

      {validationError ? (
        <div className="rounded-md bg-warn-soft px-3 py-2 text-[11px] text-warn">
          {validationError}
        </div>
      ) : null}
    </div>
  );
}

// --- per-template editors ---------------------------------------------------

function BannerEditor({
  overlay,
  onChange,
}: {
  overlay: Extract<CreativeTemplateOverlay, { kind: 'banner' }>;
  onChange: (next: CreativeTemplateOverlay) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{'// Banner text'}</FieldLabel>
        <Textarea
          rows={2}
          value={overlay.text}
          onChange={(e) => onChange({ ...overlay, text: e.target.value })}
          placeholder="e.g. Same-day quotes · 2-hour response across Cottesloe"
        />
        <p className="text-[10px] text-ink-quiet">
          Keep it to one or two lines. Auto-shrinks if it overflows.
        </p>
      </div>
      <SegmentedField<BannerPosition>
        label="// Position"
        value={overlay.position}
        onChange={(position) => onChange({ ...overlay, position })}
        options={[
          { id: 'top', label: 'Top' },
          { id: 'bottom', label: 'Bottom' },
        ]}
      />
      <SegmentedField<BannerBg>
        label="// Background"
        value={overlay.bg}
        onChange={(bg) => onChange({ ...overlay, bg })}
        options={[
          { id: 'accent', label: 'Brand' },
          { id: 'dark', label: 'Dark' },
          { id: 'light', label: 'Light' },
        ]}
      />
      <SegmentedField<TextAlign>
        label="// Text align"
        value={overlay.textAlign}
        onChange={(textAlign) => onChange({ ...overlay, textAlign })}
        options={[
          { id: 'left', label: 'Left' },
          { id: 'center', label: 'Center' },
          { id: 'right', label: 'Right' },
        ]}
      />
      <SegmentedField<BannerHeight>
        label="// Strip height"
        value={overlay.height}
        onChange={(height) => onChange({ ...overlay, height })}
        options={[
          { id: 'standard', label: 'Standard' },
          { id: 'tall', label: 'Tall' },
        ]}
      />
    </div>
  );
}

function OfferCardEditor({
  overlay,
  onChange,
}: {
  overlay: Extract<CreativeTemplateOverlay, { kind: 'offer_card' }>;
  onChange: (next: CreativeTemplateOverlay) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{'// Headline'}</FieldLabel>
        <Input
          value={overlay.headline}
          onChange={(e) => onChange({ ...overlay, headline: e.target.value })}
          placeholder="e.g. $99 callout"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{'// Subline'}</FieldLabel>
        <Input
          value={overlay.subline}
          onChange={(e) => onChange({ ...overlay, subline: e.target.value })}
          placeholder="e.g. Same-day, fixed-price, no nasty invoice surprises."
        />
      </div>
      <SegmentedField<OfferCardCorner>
        label="// Corner"
        value={overlay.corner}
        onChange={(corner) => onChange({ ...overlay, corner })}
        options={[
          { id: 'tl', label: 'Top-left' },
          { id: 'tr', label: 'Top-right' },
          { id: 'bl', label: 'Bottom-left' },
          { id: 'br', label: 'Bottom-right' },
        ]}
      />
      <SegmentedField<OfferCardSurface>
        label="// Card surface"
        value={overlay.surface}
        onChange={(surface) => onChange({ ...overlay, surface })}
        options={[
          { id: 'paper', label: 'Paper' },
          { id: 'white', label: 'White' },
          { id: 'dark', label: 'Dark' },
        ]}
      />
      <SegmentedField<OfferCardSize>
        label="// Size"
        value={overlay.size}
        onChange={(size) => onChange({ ...overlay, size })}
        options={[
          { id: 'sm', label: 'Small' },
          { id: 'md', label: 'Medium' },
          { id: 'lg', label: 'Large' },
        ]}
      />
      <label className="flex items-start gap-2 text-[12px] text-ink">
        <input
          type="checkbox"
          checked={overlay.accentRail}
          onChange={(e) =>
            onChange({ ...overlay, accentRail: e.target.checked })
          }
          className="mt-0.5"
        />
        <span>
          Brand-accent left rail
          <span className="block text-[10px] text-ink-quiet">
            A thin coloured bar down the card&apos;s left edge. Adds brand
            identity without taking up text space.
          </span>
        </span>
      </label>
    </div>
  );
}

function QuoteDropEditor({
  overlay,
  onChange,
  secondaryUrl,
  onPickSecondary,
  onClearSecondary,
  secondaryUploadPending,
  secondaryUploadError,
}: {
  overlay: Extract<CreativeTemplateOverlay, { kind: 'quote_drop' }>;
  onChange: (next: CreativeTemplateOverlay) => void;
  secondaryUrl: string | null;
  onPickSecondary: (file: File) => void;
  onClearSecondary: () => void;
  secondaryUploadPending?: boolean;
  secondaryUploadError?: unknown;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{'// Quote / headline'}</FieldLabel>
        <Textarea
          rows={3}
          value={overlay.quote}
          onChange={(e) => onChange({ ...overlay, quote: e.target.value })}
          placeholder='e.g. "Mark fixed our switchboard the same morning we called. Saved us $400 from another sparkie."'
        />
        <p className="text-[10px] text-ink-quiet">
          Bold headline that drops over the bottom of the photo. Keep it to 4
          lines or fewer — auto-shrinks if longer.
        </p>
      </div>
      <AccentPhrasesEditor
        quote={overlay.quote}
        phrases={overlay.accentPhrases}
        onChange={(accentPhrases) => onChange({ ...overlay, accentPhrases })}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{'// Author'}</FieldLabel>
          <Input
            value={overlay.author}
            onChange={(e) => onChange({ ...overlay, author: e.target.value })}
            placeholder="e.g. Sarah K."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{'// Subtitle (optional)'}</FieldLabel>
          <Input
            value={overlay.subtitle}
            onChange={(e) => onChange({ ...overlay, subtitle: e.target.value })}
            placeholder="e.g. Cottesloe"
          />
        </div>
      </div>
      <label className="flex items-start gap-2 text-[12px] text-ink">
        <input
          type="checkbox"
          checked={overlay.useInset}
          onChange={(e) => onChange({ ...overlay, useInset: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          Circular inset photo (top-right)
          <span className="block text-[10px] text-ink-quiet">
            A small portrait of the customer or your team. Optional — works
            great as a face-to-face signal.
          </span>
        </span>
      </label>
      {overlay.useInset ? (
        <SecondaryImagePicker
          label="Inset photo"
          secondaryUrl={secondaryUrl}
          onPick={onPickSecondary}
          onClear={onClearSecondary}
          pending={secondaryUploadPending}
          error={secondaryUploadError}
        />
      ) : null}
      <SegmentedField<QuoteMarkStyle>
        label="// Quote mark"
        value={overlay.quoteMarkStyle}
        onChange={(quoteMarkStyle) => onChange({ ...overlay, quoteMarkStyle })}
        options={[
          { id: 'rust', label: 'Brand' },
          { id: 'subtle', label: 'Subtle' },
          { id: 'none', label: 'None' },
        ]}
      />
      <SegmentedField<GradientIntensity>
        label="// Dark gradient"
        value={overlay.gradientIntensity}
        onChange={(gradientIntensity) =>
          onChange({ ...overlay, gradientIntensity })
        }
        options={[
          { id: 'standard', label: 'Standard' },
          { id: 'strong', label: 'Strong' },
          { id: 'none', label: 'None' },
        ]}
      />
      <SegmentedField<AuthorPosition>
        label="// Author anchor"
        value={overlay.authorPosition}
        onChange={(authorPosition) =>
          onChange({ ...overlay, authorPosition })
        }
        options={[
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
        ]}
      />
    </div>
  );
}

function SplitEditor({
  overlay,
  onChange,
  secondaryUrl,
  onPickSecondary,
  onClearSecondary,
  secondaryUploadPending,
  secondaryUploadError,
}: {
  overlay: Extract<CreativeTemplateOverlay, { kind: 'split' }>;
  onChange: (next: CreativeTemplateOverlay) => void;
  secondaryUrl: string | null;
  onPickSecondary: (file: File) => void;
  onClearSecondary: () => void;
  secondaryUploadPending?: boolean;
  secondaryUploadError?: unknown;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <SecondaryImagePicker
        label="Second image (required)"
        secondaryUrl={secondaryUrl}
        onPick={onPickSecondary}
        onClear={onClearSecondary}
        pending={secondaryUploadPending}
        error={secondaryUploadError}
      />
      <div className="flex flex-col gap-1.5">
        <FieldLabel>{'// Divider text (optional)'}</FieldLabel>
        <Input
          value={overlay.dividerText}
          onChange={(e) =>
            onChange({ ...overlay, dividerText: e.target.value })
          }
          placeholder="e.g. Before · After"
        />
        <p className="text-[10px] text-ink-quiet">
          A short label between the two photos. Leave blank to butt the
          images flush together.
        </p>
      </div>
      <SegmentedField<SplitRatio>
        label="// Split ratio"
        value={overlay.ratio}
        onChange={(ratio) => onChange({ ...overlay, ratio })}
        options={[
          { id: '50-50', label: 'Even' },
          { id: '60-40', label: 'Top dominant' },
          { id: '40-60', label: 'Bottom dominant' },
        ]}
      />
      <SegmentedField<SplitDividerBg>
        label="// Divider background"
        value={overlay.dividerBg}
        onChange={(dividerBg) => onChange({ ...overlay, dividerBg })}
        options={[
          { id: 'accent', label: 'Brand' },
          { id: 'dark', label: 'Dark' },
          { id: 'light', label: 'Light' },
        ]}
      />
      <label className="flex items-start gap-2 text-[12px] text-ink">
        <input
          type="checkbox"
          checked={overlay.swap}
          onChange={(e) => onChange({ ...overlay, swap: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          Swap order (secondary on top)
          <span className="block text-[10px] text-ink-quiet">
            By default the primary photo sits on top. Flip for an
            &quot;after / before&quot; framing without re-uploading.
          </span>
        </span>
      </label>
    </div>
  );
}

// --- helpers ----------------------------------------------------------------

function AccentPhrasesEditor({
  quote,
  phrases,
  onChange,
}: {
  quote: string;
  phrases: string[];
  onChange: (next: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const next = raw.trim();
    if (next.length === 0) return;
    if (phrases.some((p) => p.toLowerCase() === next.toLowerCase())) return;
    onChange([...phrases, next]);
  }

  function remove(idx: number) {
    onChange(phrases.filter((_, i) => i !== idx));
  }

  // Show a small picker of word-shaped substrings from the quote so the
  // operator can add accent phrases without retyping. Capped at 12
  // suggestions; sorted by length descending (longer phrases tend to be
  // more meaningful highlights).
  const suggestions = quoteWordSuggestions(quote).filter(
    (s) => !phrases.some((p) => p.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{'// Accent phrases (highlight inside the quote)'}</FieldLabel>
      <p className="text-[10px] text-ink-quiet">
        Substrings inside the quote that render in your brand accent colour.
        E.g. a key dollar amount, an outcome word.
      </p>
      {phrases.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {phrases.map((p, i) => (
            <span
              key={`${p}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-rust bg-rust-soft px-2 py-1 text-[11px] font-semibold text-ink"
            >
              {p}
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-[14px] leading-none text-ink-quiet transition-colors hover:text-warn"
                aria-label={`Remove accent ${p}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          placeholder="Type a word or phrase, press Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const target = e.currentTarget;
              add(target.value);
              target.value = '';
            }
          }}
          className="max-w-[260px]"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-9"
          onClick={() => {
            const el = inputRef.current;
            if (!el) return;
            add(el.value);
            el.value = '';
          }}
        >
          + Add
        </Button>
      </div>
      {suggestions.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
            Suggested:
          </span>
          {suggestions.slice(0, 8).map((s, i) => (
            <button
              key={`${s}-${i}`}
              type="button"
              onClick={() => add(s)}
              className="rounded-md bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft transition-colors hover:bg-rust-soft hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Extract candidate accent phrases from the operator's quote — single
 *  meaningful words + leading dollar / percentage tokens. Avoids common
 *  short stop-words. */
function quoteWordSuggestions(quote: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
    'at', 'by', 'is', 'are', 'was', 'were', 'we', 'i', 'us', 'our', 'you',
    'your', 'they', 'them', 'their', 'this', 'that', 'it', 'its', 'so',
    'no', 'not', 'be', 'as', 'from', 'but', 'if', 'then', 'than',
  ]);
  // Tokenise — keep $-prefixed numbers + percent values intact.
  const tokens =
    quote.match(/\$\d[\d,.]*\w*|\d+%|[A-Za-z][A-Za-z'-]*/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim();
    if (t.length < 3) continue;
    if (stopwords.has(t.toLowerCase())) continue;
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  // Sort by length desc so the meatier highlights surface first.
  out.sort((a, b) => b.length - a.length);
  return out.slice(0, 12);
}

function SecondaryImagePicker({
  label,
  secondaryUrl,
  onPick,
  onClear,
  pending,
  error,
}: {
  label: string;
  secondaryUrl: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  pending?: boolean;
  error?: unknown;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{`// ${label}`}</FieldLabel>
      <div className="flex items-center gap-3">
        {secondaryUrl ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={secondaryUrl}
              alt=""
              className="h-14 w-14 rounded-md border border-rule object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              className="h-9"
              onClick={onClear}
            >
              Remove
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="h-9"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            {pending ? 'Uploading…' : '+ Upload'}
          </Button>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          JPG/PNG · 4 MB
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = '';
          }}
        />
      </div>
      {error ? (
        <div className="rounded-md bg-warn-soft px-3 py-2 text-[11px] text-warn">
          {(error as Error).message ?? 'Upload failed.'}
        </div>
      ) : null}
    </div>
  );
}

function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              data-selected={selected ? 'true' : undefined}
              className="rounded-md border border-rule bg-paper px-2.5 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors hover:border-rust hover:text-ink data-[selected=true]:border-rust data-[selected=true]:bg-rust-soft data-[selected=true]:text-ink"
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
      {children}
    </label>
  );
}
