'use client';

// =============================================================================
// SectionPopupEdit — editor context exposing the section's popup envelope
// (`Section.popup`) to the LinkField inside the section's element inspector.
//
// A popup is *triggered* by a button, so it is *configured* next to that
// button: when a button's link target is set to "Open a popup", LinkField
// reads this context and renders the popup controls right there — rather than
// the popup living at section level, away from the button that opens it.
//
// SectionFieldsPanel provides it (it owns `section.popup` + `onSetPopup`).
// Absent when a section's Fields render outside the editor panel (e.g. a dev
// surface) — LinkField then shows a plain hint instead.
// =============================================================================

import { createContext, useContext } from 'react';

import type { FormPageLink } from '@/lib/website/form-config';
import type { PopupConfig } from '@/lib/website/popup-config';
import type { BrandObject } from '@/lib/website/types';

export type SectionPopupEdit = {
  popup: PopupConfig | undefined;
  onSetPopup: (popup: PopupConfig | undefined) => void;
  /** The site's pages — fed to the popup form's after-submit redirect picker. */
  pageLinks: FormPageLink[];
  brand: BrandObject;
};

const SectionPopupEditContext = createContext<SectionPopupEdit | null>(null);

export const SectionPopupEditProvider = SectionPopupEditContext.Provider;

/** The section's popup envelope + setter, or null outside the editor panel. */
export function useSectionPopupEdit(): SectionPopupEdit | null {
  return useContext(SectionPopupEditContext);
}
