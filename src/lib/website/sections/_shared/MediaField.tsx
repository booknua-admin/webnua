'use client';

// =============================================================================
// MediaField — image upload field with `editMedia` gating. Sibling to
// CopyField (Phase 6 · section-library uplift · image upload).
//
// Click-or-drag to upload an image to Supabase Storage; the resulting public
// URL is stored as the field value (the section data shape stays a URL
// string). A populated field shows a thumbnail with replace / remove.
// =============================================================================

import { useRef, useState, type ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { uploadSectionImage } from '@/lib/website/upload-image';
import { cn } from '@/lib/utils';

import { useSectionFieldContext } from './field-context';

export type MediaFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  helper?: ReactNode;
};

export function MediaField({ label, value, onChange, helper }: MediaFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          fieldLabel: typeof label === 'string' ? label : undefined,
          currentValue: value || undefined,
        }}
      >
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
          <div className="overflow-hidden rounded-md border border-rule">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-32 w-full bg-paper-2 object-cover" />
            <div className="flex items-center gap-3 border-t border-rule bg-card px-3 py-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust transition-colors hover:text-rust-deep disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Replace'}
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet transition-colors hover:text-warn"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
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
        )}
        {error ? (
          <p className="mt-1.5 text-[12px] text-warn">{error}</p>
        ) : null}
      </CapabilityGate>
    </BuilderField>
  );
}
