'use client';

// =============================================================================
// Step 4: Brand. Skippable.
//
// Three discrete inputs:
//   - logo upload (Supabase Storage `section-media` bucket — same path the
//     brand editor uses)
//   - primary colour (seeded from INDUSTRY_PRIMARY_COLORS for the chosen
//     industry; the customer can override)
//   - tagline + tone preset
//
// CRITICAL: this step's commit handler is what triggers background site
// generation. The wizard's `triggerGeneration` fires the moment step 4
// commits — whether the customer entered data or skipped. So a customer
// who skips lands on step 5 with generation already in flight.
//
// Brand writes are best-effort here (the brand editor / brand-style.ts
// pattern is the production path). We update the `brands` row inline so
// the generator's brand-read sees the right colours; failures don't
// block advance.
// =============================================================================

import { useState } from 'react';

import {
  INDUSTRY_PRIMARY_COLORS,
  deriveSecondaryColor,
} from '@/lib/onboarding/industry-colors';
import type { Step4Data } from '@/lib/onboarding/types';
import { supabase } from '@/lib/supabase/client';
import type { IndustryKey } from '@/lib/website/industry-templates';

import { StepFrame } from './_step-frame';

type Step4Props = {
  initial: Step4Data | null;
  industryKey: IndustryKey;
  clientId: string;
  onContinue: (data: Step4Data) => void;
  onSkip: () => void;
  onBack: () => void;
};

const TONE_OPTIONS: { id: 'friendly' | 'professional' | 'casual'; label: string; sub: string }[] = [
  { id: 'friendly', label: 'Friendly', sub: 'Warm + welcoming; the default for most trades.' },
  { id: 'professional', label: 'Professional', sub: 'Crisp + measured; for higher-spec commercial work.' },
  { id: 'casual', label: 'Casual', sub: "Relaxed + plainspoken; 'no nonsense, on the tools'." },
];

export function Step4Brand({ initial, industryKey, clientId, onContinue, onSkip, onBack }: Step4Props) {
  const defaultPrimary = INDUSTRY_PRIMARY_COLORS[industryKey] ?? INDUSTRY_PRIMARY_COLORS.generic;
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  const [primaryColor, setPrimaryColor] = useState(initial?.primaryColor ?? defaultPrimary);
  const [secondaryColor, setSecondaryColor] = useState(
    initial?.secondaryColor ?? deriveSecondaryColor(defaultPrimary),
  );
  const [tagline, setTagline] = useState(initial?.tagline ?? '');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'casual'>(initial?.tone ?? 'friendly');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  function handlePrimaryChange(next: string) {
    setPrimaryColor(next);
    // Re-derive secondary when the customer hasn't pinned a custom one
    // (heuristic: if it equals the prior derived value, treat it as
    // auto-derived). Easy escape: edit the secondary input manually.
    if (secondaryColor === deriveSecondaryColor(primaryColor)) {
      setSecondaryColor(deriveSecondaryColor(next));
    }
  }

  function handleContinue() {
    const data: Step4Data = {
      logoUrl,
      primaryColor,
      secondaryColor,
      tagline: tagline.trim(),
      tone,
    };
    // Write through to the brands row so the generator picks up the
    // values immediately. Direct Supabase update — RLS allows the client
    // owner to update their brand row (migration 0088). Fire-and-forget;
    // failures land in console + the brand editor as the recovery path.
    void supabase
      .from('brands')
      .update({
        accent_color: primaryColor,
        brand_colors: [primaryColor, secondaryColor].filter(Boolean),
        ...(logoUrl ? { logo_url: logoUrl } : {}),
        ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
      } as never)
      .eq('client_id', clientId)
      .then(({ error }) => {
        if (error) console.warn('[wizard] brands write failed', error.message);
      });
    onContinue(data);
  }

  return (
    <StepFrame
      title={
        <>
          Make it look like <em>your</em> brand.
        </>
      }
      description={
        <>
          A logo, a colour, a tagline. <strong>Skip all of it</strong> and
          we&rsquo;ll use an industry-appropriate default; you can come back
          and refine any time.
        </>
      }
      onContinue={handleContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-6">
        {/* Logo */}
        <div>
          <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            Logo (optional)
          </label>
          <p className="mb-3 text-[12px] leading-[1.4] text-ink-quiet">
            PNG, JPG or SVG. We&rsquo;ll use it across your site + funnel header.
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <input
              id="wizard-logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleLogoUpload(file);
              }}
              className="block w-full text-[13px] text-ink-quiet file:mr-3 file:rounded file:border-0 file:bg-ink file:px-4 file:py-2 file:font-mono file:text-[11px] file:font-bold file:uppercase file:tracking-[0.12em] file:text-paper file:hover:bg-rust"
            />
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo preview"
                className="h-12 w-auto rounded border border-rule bg-paper px-2 py-1 object-contain"
              />
            ) : null}
          </div>
          {uploading ? (
            <p className="mt-2 font-mono text-[11px] text-ink-quiet">Uploading…</p>
          ) : null}
          {uploadError ? <p className="mt-2 text-[12px] text-warn">{uploadError}</p> : null}
        </div>

        {/* Colours */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <ColorField
            label="Primary brand colour"
            sub="The dominant accent on your site."
            value={primaryColor}
            onChange={handlePrimaryChange}
          />
          <ColorField
            label="Secondary brand colour"
            sub="Auto-derived from primary; override if you want."
            value={secondaryColor}
            onChange={setSecondaryColor}
          />
        </div>

        {/* Tagline */}
        <div>
          <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            Tagline (optional)
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Fixed-price callouts. Licensed, on the tools today."
            className="block w-full rounded-lg border border-rule bg-card px-4 py-3 text-[15px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2] md:text-[14px]"
          />
        </div>

        {/* Tone */}
        <div>
          <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            Voice / tone
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {TONE_OPTIONS.map((opt) => {
              const isOn = tone === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTone(opt.id)}
                  className={
                    'rounded-xl border px-4 py-3 text-left transition ' +
                    (isOn
                      ? 'border-rust bg-rust-soft'
                      : 'border-rule bg-card hover:border-ink')
                  }
                >
                  <div className="text-[14px] font-extrabold text-ink">{opt.label}</div>
                  <p className="mt-0.5 text-[12px] leading-[1.4] text-ink-quiet">{opt.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-rule bg-paper-2 px-4 py-3 text-[12.5px] leading-[1.5] text-ink-quiet">
          <strong className="text-ink">Heads up:</strong> as soon as you hit
          Continue, we start building your site in the background. By the time
          you finish the wizard it&rsquo;ll be ready to preview.
        </div>
      </div>
    </StepFrame>
  );
}

function ColorField({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-14 cursor-pointer rounded-lg border border-rule bg-card p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-rule bg-card px-3 py-2 font-mono text-[13px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2]"
        />
      </div>
      {sub ? <p className="mt-1.5 text-[12px] leading-[1.4] text-ink-quiet">{sub}</p> : null}
    </div>
  );
}

