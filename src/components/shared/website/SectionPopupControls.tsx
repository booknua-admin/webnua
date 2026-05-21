'use client';

// =============================================================================
// SectionPopupControls — the popup editor entry point. Rendered by LinkField,
// directly beneath a button whose link target is "Open a popup" — so the
// popup is configured next to the button that opens it.
//
//   no popup    → an "+ Add a popup" button.
//   popup set   → a summary + "Edit popup →" (opens PopupEditorDialog) and a
//                 "Remove popup" action.
//
// Gated on the `editForms` capability, the same as the lead-form builder.
// =============================================================================

import { useState } from 'react';

import { useCan } from '@/lib/auth/user-stub';
import type { FormPageLink } from '@/lib/website/form-config';
import { defaultPopupConfig, type PopupConfig } from '@/lib/website/popup-config';
import type { BrandObject } from '@/lib/website/types';

import { PopupEditorDialog } from './PopupEditorDialog';

export type SectionPopupControlsProps = {
  popup: PopupConfig | undefined;
  onSetPopup: (popup: PopupConfig | undefined) => void;
  /** The site's pages — fed to the popup form's after-submit redirect picker. */
  pageLinks: FormPageLink[];
  brand: BrandObject;
};

export function SectionPopupControls({
  popup,
  onSetPopup,
  pageLinks,
  brand,
}: SectionPopupControlsProps) {
  const canEdit = useCan('editForms');
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="mt-1 border-t border-paper-2 pt-4">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Popup'}
      </p>

      {!popup ? (
        <>
          <p className="mb-3 text-[13px] leading-[1.5] text-ink-mid">
            Add the popup this button opens — a lead form shown in a modal.
          </p>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              onSetPopup(defaultPopupConfig());
              setDialogOpen(true);
            }}
            className="w-full rounded-md border border-dashed border-rule bg-card py-2.5 text-[13px] font-bold text-ink-mid transition-colors hover:border-rust hover:text-rust disabled:cursor-not-allowed disabled:opacity-55"
          >
            + Add a popup
          </button>
          {!canEdit ? <LockNote /> : null}
        </>
      ) : (
        <>
          <p className="mb-3 text-[13px] leading-[1.5] text-ink-mid">{popupSummary(popup)}</p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="w-full rounded-md border border-rust bg-rust-soft/50 py-2.5 text-[13px] font-bold text-rust transition-colors hover:bg-rust-soft"
          >
            Edit popup →
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => onSetPopup(undefined)}
              className="mt-2 w-full text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet transition-colors hover:text-rust"
            >
              Remove popup
            </button>
          ) : null}
        </>
      )}

      {popup ? (
        <PopupEditorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          popup={popup}
          onSetPopup={onSetPopup}
          pageLinks={pageLinks}
          brand={brand}
        />
      ) : null}
    </div>
  );
}

function popupSummary(popup: PopupConfig): string {
  if (popup.content.kind === 'form') {
    const n = popup.content.form.fields.length;
    return `Opens a popup with a lead form (${n} ${n === 1 ? 'field' : 'fields'}).`;
  }
  return 'Opens a popup with section content.';
}

function LockNote() {
  return (
    <p className="mt-2 rounded-md border border-rule bg-paper-2 px-2.5 py-2 text-[12px] leading-[1.5] text-ink-quiet">
      Popups are managed by your operator.
    </p>
  );
}
