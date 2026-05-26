'use client';

// =============================================================================
// PublicSiteRenderer — renders a published website page or funnel step.
//
// Maps a published snapshot's sections through the section registry's
// `Preview` components (the same components the editor renders — "one render
// implementation"). Rendered with no editor callbacks, the Previews are
// inert: no selection rings, no hover toolbars.
//
// A section that carries an attached lead-capture form is wrapped in a
// `SectionFormSlotProvider` whose `publicSubmit` context makes the form
// submit for real (FormBlock → /api/forms/submit → a live lead).
//
// Disabled sections (`enabled === false`) are hidden — the editor dims them,
// a published page omits them.
// =============================================================================

import type { ReactNode } from 'react';

import type { FunnelStep } from '@/lib/funnel/types';
import { PageTypeProvider } from '@/lib/website/page-type-context';
import { getSectionDefinition } from '@/lib/website/sections';
import { LiveSurfaceProvider } from '@/lib/website/sections/_shared/live-surface';
import { SectionFormSlotProvider } from '@/lib/website/sections/_shared/section-form-slot';
import { SectionPopupSlotProvider } from '@/lib/website/sections/_shared/section-popup-slot';
import {
  WebsiteNavProvider,
  resolveNavLinks,
} from '@/lib/website/sections/_shared/website-nav-slot';
import type { BrandObject, NavLink, Page, Section } from '@/lib/website/types';

import { FunnelStepIndicator } from './FunnelStepIndicator';
import { PopupHost } from './PopupHost';
import { PreviewBanner } from './PreviewBanner';

/** APP_HOST is server-side env; we read NEXT_PUBLIC_ vars at client mount.
 *  The renderer is `'use client'`, but it RUNS server-side first (RSC). Both
 *  the env and process.env work in either context for NEXT_PUBLIC_ keys. */
function dashboardHref(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    (typeof process !== 'undefined' && process.env.APP_BASE_URL) ??
    null;
  if (base) return `${base.replace(/\/+$/, '')}/dashboard`;
  const appHost = process.env.NEXT_PUBLIC_APP_HOST ?? 'app.webnua.com';
  return `https://${appHost}/dashboard`;
}

type Props =
  | {
      kind: 'website';
      clientId: string;
      brand: BrandObject;
      header: Section;
      footer: Section;
      nav: NavLink[];
      pages: Page[];
      page: Page;
      /** Pattern B preview gating — when true, mounts the preview banner +
       *  disables form submission (the form slot's `publicSubmit.isPreview`
       *  flag carries it to FormBlock). Resolver-set. */
      isPreview: boolean;
    }
  | {
      kind: 'funnel';
      clientId: string;
      funnelId: string;
      brand: BrandObject;
      step: FunnelStep;
      nextStepHref: string | null;
      /** Zero-based step index — resolver-set. Drives the step indicator
       *  (FIX F); the landing step (0) hides it. */
      stepIndex: number;
      /** Total step count — a single-step funnel hides the indicator. */
      stepCount: number;
      isPreview: boolean;
    };

function RenderedSection({
  section,
  brand,
  clientId,
  surfaceKind,
  funnelId,
  nextStepHref,
  isPreview,
}: {
  section: Section;
  brand: BrandObject;
  clientId: string;
  surfaceKind: 'website' | 'funnel';
  funnelId?: string | null;
  nextStepHref?: string | null;
  isPreview: boolean;
}) {
  if (section.enabled === false) return null;
  const def = getSectionDefinition(section.type);
  if (!def) return null;
  const Preview = def.Preview;
  let node: ReactNode = <Preview data={section.data} brand={brand} />;

  // Attached form → provide the slot so SectionShell / the hero render
  // FormBlock, wired to submit against the public endpoint. `isPreview`
  // rides the publicSubmit context so FormBlock can disable submission +
  // render a "preview mode — publish to capture leads" notice without a
  // separate prop chain.
  if (section.form) {
    const label = def.label.replace(/^\/\/\s*/, '').toLowerCase();
    node = (
      <SectionFormSlotProvider
        value={{
          form: section.form,
          brand,
          publicSubmit: {
            clientId,
            surfaceKind,
            funnelId: surfaceKind === 'funnel' ? funnelId ?? null : null,
            sourceLabel: `Form · ${label}`,
            nextStepHref,
            isPreview,
          },
        }}
      >
        {node}
      </SectionFormSlotProvider>
    );
  }

  // Attached popup → provide the section-popup slot so a SurfaceLink inside
  // this section (set to the POPUP_HREF sentinel) can open the modal.
  if (section.popup) {
    node = (
      <SectionPopupSlotProvider value={section.popup}>{node}</SectionPopupSlotProvider>
    );
  }

  return node;
}

export function PublicSiteRenderer(props: Props) {
  if (props.kind === 'funnel') {
    return (
      <LiveSurfaceProvider>
        <PopupHost
          brand={props.brand}
          surface={{
            clientId: props.clientId,
            surfaceKind: 'funnel',
            funnelId: props.funnelId,
          }}
        >
          <PageTypeProvider value="funnelStep">
            {/* Step indicator (FIX F) — sits above <main> so it reads as
                funnel-level chrome, not a section. Component self-gates: a
                landing step or a single-step funnel renders null. */}
            <FunnelStepIndicator
              brand={props.brand}
              stepIndex={props.stepIndex}
              stepCount={props.stepCount}
            />
            <main>
              {props.step.sections.map((section) => (
                <RenderedSection
                  key={section.id}
                  section={section}
                  brand={props.brand}
                  clientId={props.clientId}
                  surfaceKind="funnel"
                  funnelId={props.funnelId}
                  nextStepHref={props.nextStepHref}
                  isPreview={props.isPreview}
                />
              ))}
            </main>
          </PageTypeProvider>
          {props.isPreview ? <PreviewBanner dashboardHref={dashboardHref()} /> : null}
        </PopupHost>
      </LiveSurfaceProvider>
    );
  }

  const { brand, clientId, header, footer, nav, pages, page, isPreview } = props;
  // Resolve Website.nav into real links and hand them to the header section
  // through the nav slot — the header renders the site's one navigation bar.

  // Header placement (HeaderData.overlayHero / .sticky):
  //   overlay + sticky → fixed   (overlaps the hero AND pins on scroll)
  //   overlay only     → absolute (overlaps the hero, scrolls away)
  //   sticky only      → sticky  (solid bar, pins on scroll)
  //   neither          → normal flow
  const hd = header.data as { overlayHero?: boolean; sticky?: boolean };
  const overlay = hd.overlayHero === true;
  const sticky = hd.sticky === true;
  const headerWrapClass =
    overlay && sticky
      ? 'fixed inset-x-0 top-0 z-50'
      : overlay
        ? 'absolute inset-x-0 top-0 z-50'
        : sticky
          ? 'sticky top-0 z-50'
          : null;

  const headerNode = (
    <RenderedSection
      section={header}
      brand={brand}
      clientId={clientId}
      surfaceKind="website"
      isPreview={isPreview}
    />
  );
  const mainNode = (
    <PageTypeProvider value={page.type}>
      <main>
        {page.sections.map((section) => (
          <RenderedSection
            key={section.id}
            section={section}
            brand={brand}
            clientId={clientId}
            surfaceKind="website"
            isPreview={isPreview}
          />
        ))}
      </main>
    </PageTypeProvider>
  );
  const footerNode = (
    <RenderedSection
      section={footer}
      brand={brand}
      clientId={clientId}
      surfaceKind="website"
      isPreview={isPreview}
    />
  );

  return (
    <LiveSurfaceProvider>
      <PopupHost brand={brand} surface={{ clientId, surfaceKind: 'website' }}>
        <WebsiteNavProvider links={resolveNavLinks(nav, pages)}>
          {overlay && !sticky ? (
            // Absolute header needs a positioned ancestor; main sits inside it
            // so the header overlays the hero at the top.
            <div className="relative">
              <div className="absolute inset-x-0 top-0 z-50">{headerNode}</div>
              {mainNode}
            </div>
          ) : headerWrapClass ? (
            <>
              <div className={headerWrapClass}>{headerNode}</div>
              {mainNode}
            </>
          ) : (
            <>
              {headerNode}
              {mainNode}
            </>
          )}
          {footerNode}
        </WebsiteNavProvider>
        {isPreview ? <PreviewBanner dashboardHref={dashboardHref()} /> : null}
      </PopupHost>
    </LiveSurfaceProvider>
  );
}
