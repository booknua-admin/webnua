// =============================================================================
// Popup config — the shape of a popup/modal a section's button can open
// instead of navigating.
//
// A PopupConfig lives on the Section ENVELOPE (`Section.popup?`), not in a
// section's `data` — the same placement as `Section.form` (see types.ts and
// form-config.ts for the rationale). One popup per section; any button in the
// section whose link target is the `POPUP_HREF` sentinel opens it.
//
// The content is a discriminated union:
//   - `form`    — a lead-capture form. Reuses FormConfig / FormBlock verbatim;
//                 no new form model.
//   - `section` — a section's content (any registered section type).
//
// V1 builds the `form` case end-to-end. The `section` case is kept in the
// type union (the data model is forward-compatible) and the published
// renderer handles it, but the editor does not yet offer it — a clean
// follow-up. No nested popups: a popup's inner section is rendered without a
// popup slot, so its own popup-target buttons stay inert.
//
// Sections persist as free-form JSON (autosave → content_drafts, publish →
// versions.snapshot jsonb), so this optional envelope field needs no DB
// migration; old drafts read it as `undefined`.
// =============================================================================

import { defaultFormConfig, withFormDefaults, type FormConfig } from './form-config';
import type { Section } from './types';

/** Sentinel button link target meaning "open this section's popup". A button
 *  whose stored href is this value renders as a popup trigger, not a link. */
export const POPUP_HREF = '#popup';

export type PopupContent =
  | { kind: 'form'; form: FormConfig }
  | { kind: 'section'; section: Section };

export type PopupConfig = {
  /** Heading shown in the modal chrome. */
  title: string;
  showTitle: boolean;
  content: PopupContent;
};

/** A fresh popup — a lead form, with its own title shown by the modal chrome
 *  (so the form's in-card title is off by default to avoid a double heading). */
export function defaultPopupConfig(): PopupConfig {
  const form = defaultFormConfig();
  form.showTitle = false;
  return {
    title: 'Get in touch',
    showTitle: true,
    content: { kind: 'form', form },
  };
}

/** Back-fills missing keys so an old draft or partially-generated popup
 *  renders safely — the same defence as `withFormDefaults` / each section
 *  module's `withDefaults`. */
export function withPopupDefaults(popup: PopupConfig | undefined): PopupConfig {
  const base = defaultPopupConfig();
  if (!popup) return base;
  const content: PopupContent =
    popup.content?.kind === 'section'
      ? popup.content
      : {
          kind: 'form',
          form: withFormDefaults(
            popup.content?.kind === 'form' ? popup.content.form : undefined,
          ),
        };
  return {
    title: popup.title ?? base.title,
    showTitle: popup.showTitle ?? base.showTitle,
    content,
  };
}
