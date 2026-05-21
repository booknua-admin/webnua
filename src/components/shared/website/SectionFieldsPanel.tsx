'use client';

// =============================================================================
// SectionFieldsPanel — the editor's inspector column. Mounts the section
// type's `Fields` component (from the registry) with live-updating state.
//
// Element-inspector model: when an element is selected in the preview the
// panel titles itself with that element and the Fields component renders
// only that element's settings; with no element selected it shows the
// section-level settings. A back affordance returns to section level.
//
// Per-field capability gating happens INSIDE the Fields component.
// =============================================================================

import type { FormConfig, FormPageLink } from '@/lib/website/form-config';
import type { PopupConfig } from '@/lib/website/popup-config';
import type { BrandObject, Section } from '@/lib/website/types';
import { getSectionDefinition } from '@/lib/website/sections';
import { SectionFieldContextProvider } from '@/lib/website/sections/_shared/field-context';

import { SectionFormControls, formElementLabel, isFormElement } from './SectionFormControls';
import { SectionPopupControls } from './SectionPopupControls';

export type SectionFieldsPanelProps = {
  section: Section;
  /** Called with the new section data on every Fields edit. */
  onChange: (nextData: Record<string, unknown>) => void;
  /** Sets / clears the section's attached form. */
  onSetForm: (form: FormConfig | undefined) => void;
  /** Sets / clears the section's attached popup. */
  onSetPopup: (popup: PopupConfig | undefined) => void;
  /** Closes the panel (clears section selection). */
  onClose: () => void;
  /** Suppresses the close button — used in singleton mode. */
  hideClose?: boolean;
  /** The element selected within the section, or null for section level. */
  selectedElement: string | null;
  /** Select / deselect an element (null returns to section level). */
  onSelectElement: (id: string | null) => void;
  /** True in funnel-step mode — enables form "next step" actions. */
  isFunnel?: boolean;
  /** The site's pages — fed to the form's after-submit redirect picker. */
  pageLinks?: FormPageLink[];
  /** The client + resolved brand — threaded to the Fields component for the
   *  brand-style-defaults ("apply to all") path. */
  clientId?: string;
  brand?: BrandObject;
};

export function SectionFieldsPanel({
  section,
  onChange,
  onSetForm,
  onSetPopup,
  onClose,
  hideClose = false,
  selectedElement,
  onSelectElement,
  isFunnel = false,
  pageLinks = [],
  clientId,
  brand,
}: SectionFieldsPanelProps) {
  const def = getSectionDefinition(section.type);
  if (!def) {
    return (
      <aside className="border-l border-rule bg-paper-2 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
          Unknown section type: {section.type}
        </p>
      </aside>
    );
  }

  const Fields = def.Fields;
  const sectionName = def.label.replace(/^\/\/\s*/, '');
  // A form element (a field / title / submit / settings) is selected when its
  // id belongs to the section's form rather than the section's own elements.
  const formSelected = isFormElement(section.form, selectedElement);
  const elementLabel = selectedElement
    ? formSelected
      ? formElementLabel(section.form, selectedElement)
      : (def.elementLabels?.[selectedElement] ?? selectedElement)
    : null;

  return (
    <aside
      data-slot="section-fields-panel"
      className="flex h-full min-h-0 flex-col border-l border-rule bg-paper"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        {elementLabel ? (
          <>
            <button
              type="button"
              onClick={() => onSelectElement(null)}
              className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet transition-colors hover:text-rust"
            >
              {`‹ ${sectionName}`}
            </button>
            <p className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
              {elementLabel}
            </p>
          </>
        ) : (
          <>
            <p className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
              {def.label}
            </p>
            {hideClose ? null : (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close fields panel"
                className="shrink-0 rounded font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet transition-colors hover:text-ink"
              >
                Close ×
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 [&_[data-slot=builder-form-section]]:mb-3.5 [&_[data-slot=builder-form-section]]:border-b [&_[data-slot=builder-form-section]]:border-paper-2 [&_[data-slot=builder-form-section]]:pb-3.5 [&_[data-slot=builder-form-section]:last-child]:mb-0 [&_[data-slot=builder-form-section]:last-child]:border-b-0 [&_[data-slot=builder-form-section]:last-child]:pb-0">
        {/* `as never` cast at the registry boundary — the Fields component
            is typed against its specific data shape; the registry stores
            them as unknown. defaultData() guarantees the shape on creation. */}
        <SectionFieldContextProvider sectionLabel={def.label}>
          {formSelected ? (
            <SectionFormControls
              form={section.form}
              onSetForm={onSetForm}
              selectedElement={selectedElement}
              onSelectElement={onSelectElement}
              isFunnel={isFunnel}
              pageLinks={pageLinks}
            />
          ) : (
            <>
              <Fields
                data={section.data as never}
                onChange={onChange as never}
                selectedElement={selectedElement}
                pageLinks={pageLinks}
                clientId={clientId}
                brand={brand}
              />
              {/* At section level the form + popup managers sit below the
                  section's own settings — attach a form / a popup. */}
              {selectedElement === null ? (
                <>
                  <SectionFormControls
                    form={section.form}
                    onSetForm={onSetForm}
                    selectedElement={null}
                    onSelectElement={onSelectElement}
                    isFunnel={isFunnel}
                    pageLinks={pageLinks}
                  />
                  {brand ? (
                    <SectionPopupControls
                      popup={section.popup}
                      onSetPopup={onSetPopup}
                      pageLinks={pageLinks}
                      brand={brand}
                    />
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </SectionFieldContextProvider>
      </div>

      {!def.implemented ? (
        <div className="border-t border-rule bg-paper-2 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            Placeholder · real fields land in a future session.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
