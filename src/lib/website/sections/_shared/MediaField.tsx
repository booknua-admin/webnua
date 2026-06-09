'use client';

// =============================================================================
// MediaField — image upload field with `editMedia` gating. Sibling to
// CopyField (Phase 6 · section-library uplift · image upload).
//
// Click-or-drag uploads still go to Supabase Storage. This pass also adds an
// Unsplash picker for stock photography, searched via local route handlers so
// the access key never reaches the browser.
// =============================================================================

import { useRef, useState, type ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { useCan } from '@/lib/auth/user-stub';
import { uploadSectionImage } from '@/lib/website/upload-image';
import { cn } from '@/lib/utils';

import { useSectionFieldContext } from './field-context';
import { coerceImageDisplay, imageBoxClasses, type ImageDisplay } from './image-display';
import { ImageDisplayControls, type ImageDisplayControl } from './ImageDisplayControls';
import { UnsplashPickerDialog } from './UnsplashPickerDialog';

export type MediaFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  helper?: ReactNode;
  /** Optional per-image display controls (fit / aspect / focal point). When
   *  both `display` and `onDisplayChange` are passed, the controls render
   *  under the thumbnail — inside the same `editMedia` gate as the field. */
  display?: ImageDisplay;
  onDisplayChange?: (next: ImageDisplay) => void;
  /** Which display controls to show. Default: all three. */
  displayControls?: readonly ImageDisplayControl[];
};

export function MediaField({
  label,
  value,
  onChange,
  helper,
  display,
  onDisplayChange,
  displayControls,
}: MediaFieldProps) {
  const canUseAI = useCan('useAI');
  const { sectionLabel, aiContext } = useSectionFieldContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsplashOpen, setUnsplashOpen] = useState(false);

  const fieldLabel = typeof label === 'string' ? label : '';
  const allowUnsplash = !/\b(logo|icon)\b/i.test(fieldLabel);
  const unsplashContext = {
    ...(sectionLabel ? { sectionLabel } : {}),
    ...(fieldLabel ? { fieldLabel } : {}),
    ...(aiContext?.industry ? { industry: aiContext.industry } : {}),
    ...(aiContext?.audienceLine ? { audienceLine: aiContext.audienceLine } : {}),
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    const result = await uploadSectionImage(file);
    setUploading(false);
    if (result.ok) {
      onChange(result.data.url);
    } else {
      setError(result.error.message);
    }
  };

  return (
    <BuilderField label={label} helper={helper}>
      <CapabilityGate
        capability="editMedia"
        mode="request"
        requestContext={{
          sectionLabel: sectionLabel ?? undefined,
          fieldLabel: fieldLabel || undefined,
          currentValue: value || undefined,
        }}
      >
        <UnsplashPickerDialog
          open={unsplashOpen}
          onOpenChange={setUnsplashOpen}
          context={unsplashContext}
          onSelectImage={(url) => {
            setError(null);
            onChange(url);
          }}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {value ? (
          <>
            <div className="overflow-hidden rounded-md border border-rule">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt=""
                className={cn(
                  'h-32 w-full bg-paper-2',
                  display ? imageBoxClasses(display).fitClass : 'object-cover',
                )}
              />
              <div className="flex items-center gap-3 border-t border-rule bg-card px-3 py-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust transition-colors hover:text-rust-deep disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Replace'}
                </button>
                {allowUnsplash ? (
                  <button
                    type="button"
                    onClick={() => setUnsplashOpen(true)}
                    disabled={uploading}
                    title={
                      canUseAI
                        ? 'Search Unsplash. Blank search uses AI/context for a starting query.'
                        : 'Search Unsplash for a replacement image.'
                    }
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust transition-colors hover:text-rust-deep disabled:opacity-50"
                  >
                    {canUseAI ? '✦ Unsplash' : 'Unsplash'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onChange('')}
                  // Status-colour refit (Bundle C2b-1). See footer.tsx
                  // for the same arbitrary-property hover pattern.
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet transition-colors hover:[color:var(--status-warn,var(--color-warn))]"
                >
                  Remove
                </button>
              </div>
            </div>
            {display && onDisplayChange ? (
              <ImageDisplayControls
                value={coerceImageDisplay(display)}
                onChange={onDisplayChange}
                controls={displayControls}
              />
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 py-6 text-center transition-colors',
                dragging
                  ? 'border-rust bg-rust-soft/40'
                  : 'border-rule bg-paper hover:border-rust/60',
              )}
            >
              <span className="text-[13px] font-semibold text-ink">
                {uploading ? 'Uploading…' : '⊕ Upload an image'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
                Click or drag · JPG, PNG, WebP
              </span>
            </button>
            {allowUnsplash ? (
              <button
                type="button"
                onClick={() => setUnsplashOpen(true)}
                className="mt-2 w-full rounded-md border border-rule bg-card px-3 py-2 text-[12px] font-semibold text-ink-mid transition-colors hover:border-rust/60 hover:text-ink"
                title={
                  canUseAI
                    ? 'Search Unsplash. Blank search uses AI/context for a starting query.'
                    : 'Search Unsplash for a stock image.'
                }
              >
                {canUseAI ? '✦ Find on Unsplash' : 'Find on Unsplash'}
              </button>
            ) : null}
          </>
        )}
        {error ? (
          // Status-colour refit (Bundle C2b-1) — see FormBlock for the
          // same brand-tinted pattern with global fallback.
          <p
            className="mt-1.5 text-[12px]"
            style={{ color: 'var(--status-warn, var(--color-warn))' }}
          >
            {error}
          </p>
        ) : null}
      </CapabilityGate>
    </BuilderField>
  );
}
