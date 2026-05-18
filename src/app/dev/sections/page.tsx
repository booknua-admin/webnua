'use client';

// =============================================================================
// /dev/sections — section-library review surface (Phase 6 · library uplift).
//
// Off-nav developer utility (the `app/dev/` convention — gated/wiped when
// real auth ships). Renders every implemented section's <Preview> full-bleed
// against a swappable brand, heading/body font, and surface override — the
// feedback loop for the section-by-section uplift program.
//
// Preview-only: it does NOT mount the Fields components, so it needs no
// capability / workspace / Supabase context. Field editing is exercised in
// the real editor.
// =============================================================================

import { useState } from 'react';

import { DEFAULT_PREVIEW_BRAND, getBrandForClient } from '@/lib/website/data-stub';
import { CURATED_FONTS } from '@/lib/website/google-fonts';
import {
  SECTION_SURFACES,
  type SectionSurface,
} from '@/lib/website/section-surface';
import { getImplementedSections } from '@/lib/website/sections';
import type { BrandObject } from '@/lib/website/types';

const BRAND_CLIENTS = [
  { id: 'voltline', label: 'Voltline · electrical' },
  { id: 'freshhome', label: 'FreshHome · cleaning' },
  { id: 'keyhero', label: 'KeyHero · locksmith' },
  { id: 'neatworks', label: 'NeatWorks · commercial' },
] as const;

// Extra preview cases beyond a section's defaultData(). Dev-only — grow this
// as sections gain layout variants through the uplift program.
const EXTRA_CASES: Record<string, { label: string; data: Record<string, unknown> }[]> = {
  hero: [{ label: 'overlay', data: { layout: 'overlay' } }],
};

export default function DevSectionsPage() {
  const [clientId, setClientId] = useState<string>('voltline');
  const [headingFont, setHeadingFont] = useState('inter-tight');
  const [bodyFont, setBodyFont] = useState('inter-tight');
  const [surfaceOverride, setSurfaceOverride] = useState<SectionSurface | ''>('');

  const baseBrand = getBrandForClient(clientId) ?? DEFAULT_PREVIEW_BRAND;
  const brand: BrandObject = { ...baseBrand, headingFont, bodyFont };

  const sections = getImplementedSections();

  return (
    <div className="min-h-svh bg-paper">
      <header className="sticky top-0 z-50 border-b border-rule bg-ink px-6 py-3">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-rust-light">
            {'// DEV · SECTION LIBRARY'}
          </p>
          <Control label="Brand">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded border border-white/15 bg-ink-soft px-2 py-1 text-[12px] text-paper"
            >
              {BRAND_CLIENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Control>
          <Control label="Heading font">
            <FontSelect value={headingFont} onChange={setHeadingFont} />
          </Control>
          <Control label="Body font">
            <FontSelect value={bodyFont} onChange={setBodyFont} />
          </Control>
          <Control label="Surface">
            <select
              value={surfaceOverride}
              onChange={(e) =>
                setSurfaceOverride(e.target.value as SectionSurface | '')
              }
              className="rounded border border-white/15 bg-ink-soft px-2 py-1 text-[12px] text-paper"
            >
              <option value="">(section default)</option>
              {SECTION_SURFACES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Control>
        </div>
      </header>

      <main>
        {sections.flatMap((def) => {
          const base = def.defaultData() as Record<string, unknown>;
          const hasSurface = 'surface' in base;
          const cases = [
            { label: 'default', data: {} as Record<string, unknown> },
            ...(EXTRA_CASES[def.type] ?? []),
          ];
          const Preview = def.Preview;
          return cases.map((c) => {
            const data = {
              ...base,
              ...c.data,
              ...(hasSurface && surfaceOverride
                ? { surface: surfaceOverride }
                : {}),
            };
            return (
              <section key={`${def.type}-${c.label}`}>
                <div className="border-y border-rule bg-paper-2 px-6 py-1.5">
                  <p className="mx-auto max-w-[1280px] font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-quiet">
                    {def.type} · {c.label}
                  </p>
                </div>
                <Preview data={data} brand={brand} />
              </section>
            );
          });
        })}
      </main>
    </div>
  );
}

function Control({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </span>
      {children}
    </label>
  );
}

function FontSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-white/15 bg-ink-soft px-2 py-1 text-[12px] text-paper"
    >
      {CURATED_FONTS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.family} · {f.category}
        </option>
      ))}
    </select>
  );
}
