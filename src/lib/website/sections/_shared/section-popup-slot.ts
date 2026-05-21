'use client';

// =============================================================================
// Popup contexts — two contexts that, together, let a section's button open a
// popup on the published site. Mirrors the live-surface / section-form-slot
// patterns.
//
//   SectionPopupSlot  — the PopupConfig of the section currently being
//                       rendered (or null). PublicSiteRenderer wraps a
//                       section that carries `section.popup` in this; a
//                       SurfaceLink inside the section reads it to know
//                       there is a popup to open.
//
//   PopupRuntime      — the page-level controller. `openPopup(config)` shows
//                       the modal. PopupHost provides this and renders the
//                       modal itself.
//
// Both contexts are absent in the editor preview (no provider), so a
// popup-target button there renders inert — a click selects the element for
// editing instead of opening a modal.
// =============================================================================

import { createContext, useContext } from 'react';

import type { PopupConfig } from '@/lib/website/popup-config';

// -- per-section popup config -------------------------------------------------

const SectionPopupSlotContext = createContext<PopupConfig | null>(null);

export const SectionPopupSlotProvider = SectionPopupSlotContext.Provider;

/** The popup attached to the section currently being rendered, or null. */
export function useSectionPopupSlot(): PopupConfig | null {
  return useContext(SectionPopupSlotContext);
}

// -- page-level popup controller ----------------------------------------------

export type PopupRuntime = {
  /** Open the modal with the given popup configuration. */
  openPopup: (popup: PopupConfig) => void;
};

const PopupRuntimeContext = createContext<PopupRuntime | null>(null);

export const PopupRuntimeProvider = PopupRuntimeContext.Provider;

/** The popup controller, or null when not on a live popup-capable surface. */
export function usePopupRuntime(): PopupRuntime | null {
  return useContext(PopupRuntimeContext);
}
