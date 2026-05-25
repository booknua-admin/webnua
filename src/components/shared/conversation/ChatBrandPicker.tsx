'use client';

// =============================================================================
// ChatBrandPicker — turn-3 brand-pick UI for the conversational signup.
//
// Visual language matches the GenerationBlueprint: the whole picker mounts
// inside a `SpecSheet` ("// COLOUR + LOGO") so it reads as a labelled
// section on the architect's drawing rather than a card floating in the
// chat stream. Internal surfaces (colour swatch, logo upload tile) use
// the same paper/40 + border-ink/20 vocabulary.
//
// Three optional inputs:
//   - Primary colour (native <input type="color"> + hex text, mirrors
//     Step4Brand's ColorField pattern from the wizard)
//   - Secondary colour (auto-derived from primary; the customer can pin
//     a custom one by editing the field — heuristic: if it equals the
//     derived value, treat as auto-derived and re-derive on primary change)
//   - Logo upload (Supabase Storage `section-media` bucket via
//     `uploadSectionImage` — same helper Step4Brand uses)
//
// Submit / Skip — submit hands back `ConversationBrandFacts`; skip hands
// back `null` (shell records skipped state, falls back to industry defaults
// at brief-derive time).
//
// Mobile-first: hex pickers stack above the secondary on small viewports;
// logo upload uses the OS file picker (no drag-and-drop on mobile).
// 44px tap targets throughout.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  deriveSecondaryColor,
  INDUSTRY_PRIMARY_COLORS,
} from '@/lib/onboarding/industry-colors';
import type { ConversationBrandFacts } from '@/lib/onboarding/conversation-types';
import type { IndustryKey } from '@/lib/website/industry-templates';
import { cn } from '@/lib/utils';

import { SpecSheet } from './SpecSheet';

export type ChatBrandPickerProps = {
  /** Industry-derived primary-colour seed. Drives the default value of
   *  the primary input the customer can override. */
  industryKey: IndustryKey;
  /** Optional resume value — used when re-rendering after a state save. */
  initial?: ConversationBrandFacts | null;
  onSubmit: (brand: ConversationBrandFacts) => void;
  onSkip: () => void;
  /** Disable everything (e.g. while persisting). */
  disabled?: boolean;
};

export function ChatBrandPicker({
  industryKey,
  initial,
  onSubmit,
  onSkip,
  disabled,
}: ChatBrandPickerProps) {
  const defaultPrimary =
    INDUSTRY_PRIMARY_COLORS[industryKey] ?? INDUSTRY_PRIMARY_COLORS.generic;
  const [primaryColor, setPrimaryColor] = useState(
    initial?.primaryColor ?? defaultPrimary,
  );
  const [secondaryColor, setSecondaryColor] = useState(
    initial?.secondaryColor ?? deriveSecondaryColor(defaultPrimary),
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handlePrimaryChange(next: string) {
    setPrimaryColor(next);
    // Re-derive secondary unless the customer has pinned a custom one
    // (heuristic: secondary === derived-from-current-primary means the
    // customer hasn't touched it). Same trick as Step4Brand.
    if (secondaryColor === deriveSecondaryColor(primaryColor)) {
      setSecondaryColor(deriveSecondaryColor(next));
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const { uploadSectionImage } = await import('@/lib/website/upload-image');
      const result = await uploadSectionImage(file);
      if (!result.ok) {
        setUploadError(result.error.message ?? 'Upload failed');
      } else {
        setLogoUrl(result.data.url);
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    onSubmit({
      primaryColor,
      secondaryColor,
      logoUrl,
    });
  }

  return (
    <SpecSheet label="// COLOUR + LOGO" hint="brand.svg">
      <div className="flex flex-col gap-4">
        <p className="text-[12px] leading-[1.4] text-ink-mid">
          Pick your brand colour + drop a logo if you have one. Both optional —
          we&apos;ll use an industry-appropriate default.
        </p>

        {/* Colours — side-by-side on sm+, stacked on mobile */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ColorField
            label="// PRIMARY COLOUR"
            value={primaryColor}
            onChange={handlePrimaryChange}
            disabled={disabled}
          />
          <ColorField
            label="// SECONDARY COLOUR"
            value={secondaryColor}
            onChange={setSecondaryColor}
            disabled={disabled}
            sub="Auto-derived; override if you want."
          />
        </div>

        {/* Logo */}
        <div>
          <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// LOGO (OPTIONAL)'}
          </label>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <input
              id="chat-logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleLogoUpload(file);
              }}
              disabled={disabled || uploading}
              className="block w-full text-[13px] text-ink-quiet file:mr-3 file:rounded file:border-0 file:bg-ink file:px-3 file:py-2 file:font-mono file:text-[11px] file:font-bold file:uppercase file:tracking-[0.12em] file:text-paper file:hover:bg-rust"
            />
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-12 w-auto rounded border-2 border-ink/20 bg-paper/40 object-contain px-2 py-1"
              />
            ) : null}
          </div>
          {uploading ? (
            <p className="mt-1.5 font-mono text-[11px] text-ink-quiet">Uploading…</p>
          ) : null}
          {uploadError ? <p className="mt-1.5 text-[12px] text-warn">{uploadError}</p> : null}
        </div>

        {/* Submit / Skip */}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled || uploading}
            className="min-h-[44px] px-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet hover:text-ink disabled:opacity-50"
          >
            Skip for now
          </button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || uploading}
            className="min-h-[44px]"
          >
            {logoUrl ? 'Looks good →' : 'Continue →'}
          </Button>
        </div>
      </div>
    </SpecSheet>
  );
}

// ---------------------------------------------------------------------------

function ColorField({
  label,
  value,
  onChange,
  sub,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  sub?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label={`${label} colour picker`}
          className={cn(
            'h-11 w-12 cursor-pointer rounded-md border-2 border-ink/20 bg-paper/40 p-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="min-h-[44px] flex-1 font-mono text-base sm:text-[13px]"
        />
      </div>
      {sub ? (
        <p className="mt-1 text-[11px] leading-[1.4] text-ink-quiet">{sub}</p>
      ) : null}
    </div>
  );
}
