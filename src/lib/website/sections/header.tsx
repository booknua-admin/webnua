'use client';

import { BuilderFormRow, BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';
import { MediaField } from './_shared/MediaField';

// =============================================================================
// Header — website-level singleton. Logo + (placeholder for nav) + optional
// global CTA. Wraps every page on the website.
//
// **Important:** nav data lives on Website.nav, NOT inside HeaderData.
// Session 4 doesn't wire nav editing inside the Header editor (would
// require extending the singleton editor's API to thread Website-level
// context into Fields — a deliberate punt). The preview shows nav as a
// labelled placeholder. Real nav editing surfaces on the website hub or
// in a future polish session.
// =============================================================================

export type HeaderData = {
  logoText: string;
  logoImageUrl: string;
  showCta: boolean;
  ctaLabel: string;
  ctaHref: string;
};

const DEFAULTS: HeaderData = {
  logoText: 'Voltline',
  logoImageUrl: '',
  showCta: true,
  ctaLabel: 'Call us',
  ctaHref: 'tel:0411222333',
};

function defaultData(): HeaderData {
  return { ...DEFAULTS };
}

function HeaderFields({ data, onChange }: SectionFieldsProps<HeaderData>) {
  const set = <K extends keyof HeaderData>(key: K, value: HeaderData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Logo text"
          value={data.logoText}
          originalValue={DEFAULTS.logoText}
          onChange={(v) => set('logoText', v)}
          helper="Shown when no logo image is set."
        />
        <MediaField
          label="Logo image URL"
          value={data.logoImageUrl}
          onChange={(v) => set('logoImageUrl', v)}
          helper="Optional. Falls back to logo text if blank."
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <CopyField
            label="Header CTA · label"
            value={data.ctaLabel}
            originalValue={DEFAULTS.ctaLabel}
            onChange={(v) => set('ctaLabel', v)}
          />
          <CopyField
            label="Header CTA · href"
            value={data.ctaHref}
            originalValue={DEFAULTS.ctaHref}
            onChange={(v) => set('ctaHref', v)}
          />
        </BuilderFormRow>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          Nav links live on the Website (capped at 6, design doc §2.5).
          Editable in a future session.
        </p>
      </BuilderFormSection>
    </>
  );
}

function HeaderPreview({ data, brand }: SectionPreviewProps<HeaderData>) {
  return (
    <header
      data-section-type="header"
      className="flex items-center justify-between gap-6 rounded-xl border border-rule bg-paper px-7 py-4 md:px-9"
    >
      <div className="flex items-center gap-2.5">
        {data.logoImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.logoImageUrl}
            alt={data.logoText}
            className="h-8 w-auto"
          />
        ) : (
          <span
            className="text-[18px] font-extrabold tracking-[-0.02em]"
            style={{ color: brand.accentColor }}
          >
            {data.logoText || 'Logo'}
          </span>
        )}
      </div>
      <nav
        aria-label="Site navigation"
        className="hidden items-center gap-5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet md:flex"
      >
        <span className="rounded border border-dashed border-rule px-2 py-0.5">
          [ site nav · from Website.nav ]
        </span>
      </nav>
      {data.showCta && data.ctaLabel ? (
        <span
          className="inline-flex items-center rounded-[7px] px-3.5 py-2 text-[12px] font-bold text-paper"
          style={{ backgroundColor: brand.accentColor }}
        >
          {data.ctaLabel}
        </span>
      ) : null}
    </header>
  );
}

export const headerSection = defineSection<HeaderData>({
  type: 'header',
  label: '// HEADER',
  description: 'Site header — logo + nav + optional global CTA. Wraps every page.',
  defaultData,
  Fields: HeaderFields,
  Preview: HeaderPreview,
  capabilityHints: {
    copyFields: ['logoText', 'ctaLabel', 'ctaHref'],
    mediaFields: ['logoImageUrl'],
  },
  allowedContainers: ['websiteHeader'],
  implemented: true,
});
