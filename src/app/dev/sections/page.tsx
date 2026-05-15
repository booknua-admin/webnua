'use client';

// =============================================================================
// DEV ONLY — section registry verification matrix. Off-nav. Lives under
// app/dev/ per the convention (stub-era only, gated/wiped with the rest of
// the stub layer when real auth ships).
//
// For each registered section type, renders the Fields component (left
// column, live-editable) alongside the Preview component (right column,
// re-renders on every edit). Implemented and placeholder types are
// segmented. A brand picker at the top swaps the BrandObject driving every
// preview, so it's obvious whether brand props are wired through.
//
// This is the equivalent of /dev/capabilities for the section registry —
// reviewable in isolation before any editor surface lands in Session 3.
// =============================================================================

import { useState, type ReactNode } from 'react';

import { DevRoleSwitcher } from '@/components/shared/DevRoleSwitcher';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PREVIEW_BRAND,
  getBrandForClient,
} from '@/lib/website/data-stub';
import type { SectionTypeDefinition } from '@/lib/website/registry';
import {
  getImplementedSections,
  getPlaceholderSections,
} from '@/lib/website/sections';
import type { BrandObject } from '@/lib/website/types';

const BRAND_OPTIONS: { label: string; brand: BrandObject }[] = [
  { label: 'Voltline (default)', brand: getBrandForClient('voltline') ?? DEFAULT_PREVIEW_BRAND },
  { label: 'FreshHome', brand: getBrandForClient('freshhome') ?? DEFAULT_PREVIEW_BRAND },
  { label: 'KeyHero', brand: getBrandForClient('keyhero') ?? DEFAULT_PREVIEW_BRAND },
];

export default function SectionRegistryDevPage() {
  const [brandIndex, setBrandIndex] = useState(0);
  const brand = BRAND_OPTIONS[brandIndex]?.brand ?? DEFAULT_PREVIEW_BRAND;
  const implemented = getImplementedSections();
  const placeholders = getPlaceholderSections();

  return (
    <div className="min-h-svh bg-paper px-10 py-10">
      <DevRoleSwitcher />
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// DEV · SECTION REGISTRY'}
          </p>
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            <em className="font-extrabold not-italic text-rust">
              {implemented.length}
            </em>
            {' / '}
            {implemented.length + placeholders.length} section types implemented
          </h1>
          <p className="mt-2 max-w-[700px] text-[13px] leading-relaxed text-ink-mid">
            Each row below is one registered section type. Fields render on
            the left, Preview on the right. Edits in Fields propagate to
            Preview live. Brand picker controls the <code>brand</code> prop
            passed to every Preview — useful for confirming accent-colour
            and voice props are plumbed end-to-end.
          </p>
        </div>

        <div className="mb-7 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// BRAND'}
          </span>
          {BRAND_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setBrandIndex(i)}
              className={
                'rounded-pill border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ' +
                (brandIndex === i
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule bg-card text-ink-quiet hover:border-ink hover:text-ink')
              }
            >
              {opt.label}
            </button>
          ))}
          <span
            aria-hidden
            className="ml-2 inline-block h-4 w-4 rounded-full border border-rule"
            style={{ backgroundColor: brand.accentColor }}
            title={`accentColor: ${brand.accentColor}`}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {brand.accentColor}
          </span>
        </div>

        <Header>{'// IMPLEMENTED'}</Header>
        <div className="mb-10 flex flex-col gap-5">
          {implemented.map((def) => (
            <SectionRow key={def.type} definition={def} brand={brand} />
          ))}
        </div>

        <Header>{'// PLACEHOLDERS'}</Header>
        <div className="flex flex-col gap-5">
          {placeholders.map((def) => (
            <SectionRow
              key={def.type}
              definition={def}
              brand={brand}
              isPlaceholder
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-rust">
      {children}
    </h2>
  );
}

function SectionRow({
  definition,
  brand,
  isPlaceholder = false,
}: {
  definition: SectionTypeDefinition;
  brand: BrandObject;
  isPlaceholder?: boolean;
}) {
  const [data, setData] = useState(() => definition.defaultData());

  const handleReset = () => setData(definition.defaultData());

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-rule bg-paper-2 px-5 py-3">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {definition.label}
          </p>
          <p className="mt-0.5 text-[13.5px] text-ink">
            {definition.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPlaceholder ? (
            <span className="rounded-pill border border-rust/30 bg-rust-soft px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-rust">
              Placeholder
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset data
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[360px_1fr] gap-0 divide-x divide-rule">
        <div className="bg-paper p-4">
          <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            Fields
          </p>
          <definition.Fields data={data} onChange={setData} />
        </div>
        <div className="bg-paper p-4">
          <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            Preview
          </p>
          <definition.Preview data={data} brand={brand} />
        </div>
      </div>
    </div>
  );
}
