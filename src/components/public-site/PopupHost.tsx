'use client';

// =============================================================================
// PopupHost — the published-site popup runtime.
//
// Wraps the rendered page/funnel. Provides the `PopupRuntime` context so a
// SurfaceLink set to the POPUP_HREF sentinel can open a modal, and renders the
// modal itself (portalled to <body>) when one is open.
//
// A form popup wraps FormBlock in a SectionFormSlotProvider carrying a
// `publicSubmit` context — so the form submits for real against
// /api/forms/submit, exactly like a section-attached form. A section popup
// renders the inner section's registry Preview (inert — no popup slot, so no
// nested popups).
//
// Flat scope: one popup open at a time; opening another replaces it.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// `createPortal` targets document.body. It is only reached when `active` is
// non-null — which happens solely via a user click, i.e. always client-side
// after hydration — so no SSR / mounted guard is needed.

import { FormBlock } from '@/components/shared/website/FormBlock';
import { withPopupDefaults, type PopupConfig } from '@/lib/website/popup-config';
import { getSectionDefinition } from '@/lib/website/sections';
import { SectionFormSlotProvider } from '@/lib/website/sections/_shared/section-form-slot';
import { PopupRuntimeProvider } from '@/lib/website/sections/_shared/section-popup-slot';
import type { BrandObject } from '@/lib/website/types';

/** The surface a popup form submits a lead against — clientId + attribution. */
export type PopupSurface = {
  clientId: string;
  surfaceKind: 'website' | 'funnel';
  funnelId?: string | null;
};

export function PopupHost({
  children,
  brand,
  surface,
}: {
  children: ReactNode;
  brand: BrandObject;
  surface: PopupSurface;
}) {
  const [active, setActive] = useState<PopupConfig | null>(null);

  const openPopup = useCallback((popup: PopupConfig) => {
    setActive(withPopupDefaults(popup));
  }, []);
  const close = useCallback(() => setActive(null), []);

  return (
    <PopupRuntimeProvider value={{ openPopup }}>
      {children}
      {active
        ? createPortal(
            <PopupModal popup={active} brand={brand} surface={surface} onClose={close} />,
            document.body,
          )
        : null}
    </PopupRuntimeProvider>
  );
}

// -- the modal ----------------------------------------------------------------

function PopupModal({
  popup,
  brand,
  surface,
  onClose,
}: {
  popup: PopupConfig;
  brand: BrandObject;
  surface: PopupSurface;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escape closes; body scroll is locked while open; focus moves into the
    // modal and is restored to the trigger when it closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={popup.title || 'Popup'}
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center sm:p-6"
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative my-auto w-full max-w-[480px] rounded-2xl bg-white p-6 shadow-2xl outline-none sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[20px] leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          ×
        </button>
        {popup.showTitle && popup.title ? (
          <h2 className="mb-4 pr-8 text-[20px] font-bold tracking-[-0.01em] text-gray-900">
            {popup.title}
          </h2>
        ) : null}
        <PopupBody popup={popup} brand={brand} surface={surface} />
      </div>
    </div>
  );
}

function PopupBody({
  popup,
  brand,
  surface,
}: {
  popup: PopupConfig;
  brand: BrandObject;
  surface: PopupSurface;
}) {
  if (popup.content.kind === 'form') {
    return (
      <SectionFormSlotProvider
        value={{
          form: popup.content.form,
          brand,
          publicSubmit: {
            clientId: surface.clientId,
            surfaceKind: surface.surfaceKind,
            funnelId: surface.surfaceKind === 'funnel' ? surface.funnelId ?? null : null,
            sourceLabel: `Popup form · ${popup.title || 'untitled'}`,
          },
        }}
      >
        <FormBlock form={popup.content.form} brand={brand} />
      </SectionFormSlotProvider>
    );
  }

  // kind: 'section' — render the inner section's Preview. It is NOT wrapped in
  // a SectionPopupSlotProvider, so a popup-target button inside it stays inert
  // (the flat-scope "no nested popups" guarantee).
  const def = getSectionDefinition(popup.content.section.type);
  if (!def) return null;
  const Preview = def.Preview;
  return <Preview data={popup.content.section.data} brand={brand} />;
}
