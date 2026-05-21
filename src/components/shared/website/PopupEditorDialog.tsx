'use client';

// =============================================================================
// PopupEditorDialog — configures a section's popup.
//
// V1 edits the `form` content kind: a popup heading + the lead form, the
// latter built with the SAME form builder a section-attached form uses
// (FormBlock preview + SectionFormControls), so there is no second form
// editor. Element selection is dialog-local — it never collides with the
// section's own element-inspector state. `allowRemove={false}` hides the
// form-manager's "Remove form" (the popup is removed from SectionPopupControls
// instead). The `section` content kind is forward-declared in the data model
// but not editable here yet.
//
// Gated on `editForms` (SectionFormControls self-gates; the heading input is
// disabled when the capability is absent).
// =============================================================================

import { useState } from 'react';

import { BuilderField, BuilderInput } from '@/components/shared/builder/BuilderField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCan } from '@/lib/auth/user-stub';
import type { FormConfig, FormPageLink } from '@/lib/website/form-config';
import type { PopupConfig } from '@/lib/website/popup-config';
import { SectionFieldContextProvider } from '@/lib/website/sections/_shared/field-context';
import { ToggleField } from '@/lib/website/sections/_shared/ToggleField';
import type { BrandObject } from '@/lib/website/types';

import { FORM_CONTAINER_ELEMENT, FormBlock } from './FormBlock';
import { SectionFormControls } from './SectionFormControls';

export type PopupEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popup: PopupConfig;
  onSetPopup: (popup: PopupConfig) => void;
  /** The site's pages — fed to the form's after-submit redirect picker. */
  pageLinks: FormPageLink[];
  brand: BrandObject;
};

export function PopupEditorDialog({
  open,
  onOpenChange,
  popup,
  onSetPopup,
  pageLinks,
  brand,
}: PopupEditorDialogProps) {
  const canEdit = useCan('editForms');
  // Element selection is local to this dialog — the popup's form is edited
  // here, never via the page's element-inspector, so the ids cannot clash
  // with the section's own selection. Selection never goes null: a cleared
  // selection lands back on the form manager.
  const [selectedElement, setSelectedElement] = useState<string>(FORM_CONTAINER_ELEMENT);
  const selectElement = (id: string | null) => setSelectedElement(id ?? FORM_CONTAINER_ELEMENT);

  const content = popup.content;
  const setForm = (form: FormConfig | undefined) => {
    // The popup IS its form — removing it is done by removing the popup.
    if (!form) return;
    onSetPopup({ ...popup, content: { kind: 'form', form } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[calc(100vh-3rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit popup</DialogTitle>
          <DialogDescription>
            A button in this section opens this popup instead of navigating away.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <BuilderField label="Popup heading">
            <BuilderInput
              value={popup.title}
              disabled={!canEdit}
              onChange={(e) => onSetPopup({ ...popup, title: e.target.value })}
            />
          </BuilderField>
          <ToggleField
            label="Show heading"
            value={popup.showTitle}
            capability="editForms"
            onChange={(v) => onSetPopup({ ...popup, showTitle: v })}
          />
        </div>

        {content.kind === 'form' ? (
          <SectionFieldContextProvider sectionLabel="Popup">
            <div className="grid gap-5 sm:grid-cols-[1fr_300px]">
              <div className="rounded-lg border border-rule bg-paper-2 p-4">
                <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// Preview'}
                </p>
                <FormBlock
                  form={content.form}
                  brand={brand}
                  selectedElement={selectedElement}
                  onSelectElement={selectElement}
                />
              </div>
              <div>
                <SectionFormControls
                  form={content.form}
                  onSetForm={setForm}
                  selectedElement={selectedElement}
                  onSelectElement={selectElement}
                  isFunnel={false}
                  pageLinks={pageLinks}
                  allowRemove={false}
                />
              </div>
            </div>
          </SectionFieldContextProvider>
        ) : (
          <p className="rounded-lg border border-dashed border-rule bg-paper-2 px-4 py-6 text-center text-[13px] text-ink-mid">
            This popup shows section content. Editing section-content popups
            isn&apos;t available yet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
