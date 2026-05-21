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
import { SectionPopupControls } from '@/components/shared/website/SectionPopupControls';
import { POPUP_HREF } from '@/lib/website/popup-config';
import type { PageLink } from '@/lib/website/types';

import { useSectionFieldContext } from './field-context';
import { useSectionPopupEdit } from './section-popup-edit';

const CUSTOM = '__custom';
const POPUP = '__popup';

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
  const popupEdit = useSectionPopupEdit();
  const selectedPage = pageLinks.find((p) => p.href === value);
  const isPopup = value.trim() === POPUP_HREF;
  const isCustom = !selectedPage && !isPopup;
  const selectValue = selectedPage ? selectedPage.href : isPopup ? POPUP : CUSTOM;

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
          <select
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === CUSTOM) onChange('');
              else if (v === POPUP) onChange(POPUP_HREF);
              else onChange(v);
            }}
            className={SELECT_CLASS}
          >
            {pageLinks.map((p) => (
              <option key={p.href} value={p.href}>
                {p.label} ({p.href})
              </option>
            ))}
            <option value={CUSTOM}>Custom link…</option>
            <option value={POPUP}>Open a popup…</option>
          </select>
          {isCustom ? (
            <BuilderInput
              value={value}
              placeholder="https://…  ·  /path  ·  tel:…  ·  #section"
              onChange={(e) => onChange(e.target.value)}
            />
          ) : null}
        </div>
      </CapabilityGate>
      {/* "Open a popup" → the popup is configured right here, next to the
          button that opens it. Outside the editCopy gate above: choosing the
          link target is editCopy; the popup contents are editForms. */}
      {isPopup ? (
        popupEdit ? (
          <SectionPopupControls
            popup={popupEdit.popup}
            onSetPopup={popupEdit.onSetPopup}
            pageLinks={popupEdit.pageLinks}
            brand={popupEdit.brand}
          />
        ) : (
          <p className="mt-2 text-[12px] leading-[1.5] text-ink-quiet">
            This button opens a popup.
          </p>
        )
      ) : null}
    </BuilderField>
  );
}
