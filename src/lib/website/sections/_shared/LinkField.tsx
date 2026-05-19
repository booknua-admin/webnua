'use client';

// =============================================================================
// LinkField — a CTA destination field. Picks from the site's pages, with a
// custom-link escape hatch (a full URL, a `/path`, a `tel:` / `mailto:` link,
// or a `#anchor`). Falls back to a plain input when no page list is available
// (e.g. a funnel-step editor). Gated on `editCopy`, the same as CopyField.
// =============================================================================

import type { ReactNode } from 'react';

import { BuilderField, BuilderInput } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import type { PageLink } from '@/lib/website/types';

import { useSectionFieldContext } from './field-context';

const CUSTOM = '__custom';

const SELECT_CLASS =
  'block w-full rounded-[7px] border border-rule bg-card px-3.5 py-[11px] ' +
  'font-sans text-[14px] text-ink transition-colors focus:border-rust ' +
  'focus:outline-none focus:ring-[3px] focus:ring-rust/12';

export type LinkFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  /** The site's pages — the destination is picked from these. */
  pageLinks?: readonly PageLink[];
  helper?: ReactNode;
};

export function LinkField({ label, value, onChange, pageLinks = [], helper }: LinkFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  const selectedPage = pageLinks.find((p) => p.href === value);
  const isCustom = !selectedPage;

  return (
    <BuilderField label={label} helper={helper}>
      <CapabilityGate
        capability="editCopy"
        mode="request"
        requestContext={{
          sectionLabel: sectionLabel ?? undefined,
          fieldLabel: typeof label === 'string' ? label : undefined,
          currentValue: value || undefined,
        }}
      >
        <div className="flex flex-col gap-2">
          {pageLinks.length > 0 ? (
            <select
              value={selectedPage ? selectedPage.href : CUSTOM}
              onChange={(e) => onChange(e.target.value === CUSTOM ? '' : e.target.value)}
              className={SELECT_CLASS}
            >
              {pageLinks.map((p) => (
                <option key={p.href} value={p.href}>
                  {p.label} ({p.href})
                </option>
              ))}
              <option value={CUSTOM}>Custom link…</option>
            </select>
          ) : null}
          {isCustom || pageLinks.length === 0 ? (
            <BuilderInput
              value={value}
              placeholder="https://…  ·  /path  ·  tel:…  ·  #section"
              onChange={(e) => onChange(e.target.value)}
            />
          ) : null}
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}
