'use client';

// =============================================================================
// SiteFontsMenu — the brand/site-level font editor (Phase 6 · font editor).
//
// A toolbar control opening a small popover with two pickers — heading and
// body font — drawn from the curated Google Fonts. Fonts are site-wide (one
// pair per business), so the menu writes to the brand-font overlay; every
// section preview re-renders with the new fonts.
//
// No Popover primitive exists — a fixed click-catcher dismisses, the same
// pattern as NotificationBell.
// =============================================================================

import { useState } from 'react';

import { setBrandStyleValue } from '@/lib/website/brand-style';
import { CURATED_FONTS, DEFAULT_FONT_ID } from '@/lib/website/google-fonts';
import { GoogleFontLoader } from '@/lib/website/sections/_shared/GoogleFontLoader';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

const ALL_FONT_IDS = CURATED_FONTS.map((f) => f.id);

export type SiteFontsMenuProps = {
  clientId: string;
  headingFont?: string;
  bodyFont?: string;
};

export function SiteFontsMenu({
  clientId,
  headingFont,
  bodyFont,
}: SiteFontsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-pill border border-rule bg-card px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet transition-colors hover:border-rust hover:text-rust"
      >
        Aa · Fonts
      </button>
      {open ? (
        <>
          {/* All curated fonts loaded so the picker previews each face. */}
          <GoogleFontLoader fontIds={ALL_FONT_IDS} />
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[270px] rounded-lg border border-rule bg-card p-3.5 shadow-card">
            <p className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              {'// SITE FONTS'}
            </p>
            <CapabilityGate
              capability="editTheme"
              mode="request"
              requestContext={{ fieldLabel: 'Site fonts' }}
            >
              <div className="space-y-2.5">
                <FontPicker
                  label="Headings"
                  value={headingFont}
                  onChange={(id) => setBrandStyleValue(clientId, 'headingFont', id)}
                />
                <FontPicker
                  label="Body"
                  value={bodyFont}
                  onChange={(id) => setBrandStyleValue(clientId, 'bodyFont', id)}
                />
              </div>
            </CapabilityGate>
            <p className="mt-3 text-[11px] leading-[1.45] text-ink-quiet">
              Fonts apply across the whole site.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (fontId: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </span>
      <select
        value={value ?? DEFAULT_FONT_ID}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-rule bg-paper px-2 py-1.5 text-[13px] text-ink"
      >
        {CURATED_FONTS.map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
            {font.family} · {font.category}
          </option>
        ))}
      </select>
    </label>
  );
}
