'use client';

// =============================================================================
// ImageDisplayControls — the per-image fit / aspect / focal-point controls.
//
// Rendered by MediaField below an image's thumbnail (inside MediaField's own
// `editMedia` CapabilityGate, so it inherits the same gating). Sibling to
// VariantField / ThemeField — it edits the `ImageDisplay` companion object.
// =============================================================================

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import {
  IMAGE_ASPECT_OPTIONS,
  IMAGE_FIT_OPTIONS,
  type ImageDisplay,
  type ImageFocal,
} from './image-display';

export type ImageDisplayControl = 'fit' | 'aspect' | 'focal';

const ALL_CONTROLS: readonly ImageDisplayControl[] = ['fit', 'aspect', 'focal'];

export type ImageDisplayControlsProps = {
  value: ImageDisplay;
  onChange: (next: ImageDisplay) => void;
  /** Which controls to show. Default: all three. A section whose slot shape
   *  is fixed (gallery cells, review avatars) passes `['fit', 'focal']`. */
  controls?: readonly ImageDisplayControl[];
};

// The focal-point picker, row-major (top row first).
const FOCAL_GRID: readonly ImageFocal[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

export function ImageDisplayControls({
  value,
  onChange,
  controls = ALL_CONTROLS,
}: ImageDisplayControlsProps) {
  const show = (c: ImageDisplayControl) => controls.includes(c);
  // At its natural ratio there's no slot to fit into and nothing to crop, so
  // the fit + focus controls have no effect.
  const inert = value.aspect === 'original';

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-md border border-rule bg-paper px-3 py-2.5">
      {show('aspect') ? (
        <ControlRow label="Shape">
          <Segmented
            options={IMAGE_ASPECT_OPTIONS}
            value={value.aspect}
            onChange={(aspect) => onChange({ ...value, aspect })}
          />
        </ControlRow>
      ) : null}

      {show('fit') ? (
        <ControlRow label="Fit" dim={inert}>
          <Segmented
            options={IMAGE_FIT_OPTIONS}
            value={value.fit}
            onChange={(fit) => onChange({ ...value, fit })}
          />
        </ControlRow>
      ) : null}

      {show('focal') ? (
        <ControlRow label="Focus" dim={inert}>
          <FocalGrid
            value={value.focal}
            onChange={(focal) => onChange({ ...value, focal })}
          />
        </ControlRow>
      ) : null}

      {inert ? (
        <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
          Original ratio — fit &amp; focus don&apos;t apply.
        </p>
      ) : null}
    </div>
  );
}

function ControlRow({
  label,
  dim,
  children,
}: {
  label: string;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        dim && 'opacity-45',
      )}
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded border border-rule">
      {options.map((opt, i) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'px-2 py-1 text-[11px] font-semibold transition-colors',
            i > 0 && 'border-l border-rule',
            value === opt.id
              ? 'bg-rust text-paper'
              : 'bg-card text-ink-quiet hover:bg-paper-2 hover:text-ink',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FocalGrid({
  value,
  onChange,
}: {
  value: ImageFocal;
  onChange: (next: ImageFocal) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-rule">
      {FOCAL_GRID.map((focal) => {
        const active = value === focal;
        return (
          <button
            key={focal}
            type="button"
            aria-label={`Focus ${focal.replace('-', ' ')}`}
            aria-pressed={active}
            onClick={() => onChange(focal)}
            className={cn(
              'flex h-[18px] w-[18px] items-center justify-center transition-colors',
              active ? 'bg-rust' : 'bg-card hover:bg-rust-soft',
            )}
          >
            <span
              className={cn(
                'block h-1.5 w-1.5 rounded-full',
                active ? 'bg-paper' : 'bg-rule',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
