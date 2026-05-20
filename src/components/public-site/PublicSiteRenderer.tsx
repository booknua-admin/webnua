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

import type { FunnelStep } from '@/lib/funnel/types';
import { getSectionDefinition } from '@/lib/website/sections';
import { SectionFormSlotProvider } from '@/lib/website/sections/_shared/section-form-slot';
import {
  WebsiteNavProvider,
  type ResolvedNavLink,
} from '@/lib/website/sections/_shared/website-nav-slot';
import type {
  BrandObject,
  NavLink,
  NavLinkTarget,
  Page,
  Section,
} from '@/lib/website/types';

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
    }
  | {
      kind: 'funnel';
      clientId: string;
      funnelId: string;
      brand: BrandObject;
      step: FunnelStep;
      nextStepHref: string | null;
    };

function RenderedSection({
  section,
  brand,
  clientId,
  surfaceKind,
  funnelId,
  nextStepHref,
}: {
  section: Section;
  brand: BrandObject;
  clientId: string;
  surfaceKind: 'website' | 'funnel';
  funnelId?: string | null;
  nextStepHref?: string | null;
}) {
  if (section.enabled === false) return null;
  const def = getSectionDefinition(section.type);
  if (!def) return null;
  const Preview = def.Preview;
  const node = <Preview data={section.data} brand={brand} />;

  // No attached form → render the section as-is.
  if (!section.form) return node;

  // Attached form → provide the slot so SectionShell / the hero render
  // FormBlock, wired to submit against the public endpoint.
  const label = def.label.replace(/^\/\/\s*/, '').toLowerCase();
  return (
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
        },
      }}
    >
      {node}
    </SectionFormSlotProvider>
  );
}

function navHref(target: NavLinkTarget, pages: Page[]): string {
  if (target.kind === 'href') return target.href || '#';
  const page = pages.find((p) => p.id === target.pageId);
  if (!page) return '#';
  return page.slug === 'home' ? '/' : `/${page.slug}`;
}

export function PublicSiteRenderer(props: Props) {
  if (props.kind === 'funnel') {
    return (
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
          />
        ))}
      </main>
    );
  }

  const { brand, clientId, header, footer, nav, pages, page } = props;
  // Resolve Website.nav into real links and hand them to the header section
  // through the nav slot — the header renders the site's one navigation bar.
  const navLinks: ResolvedNavLink[] = nav.map((link) => ({
    label: link.label,
    href: navHref(link.target, pages),
  }));
  return (
    <WebsiteNavProvider links={navLinks}>
      <RenderedSection
        section={header}
        brand={brand}
        clientId={clientId}
        surfaceKind="website"
      />
      <main>
        {page.sections.map((section) => (
          <RenderedSection
            key={section.id}
            section={section}
            brand={brand}
            clientId={clientId}
            surfaceKind="website"
          />
        ))}
      </main>
      <RenderedSection
        section={footer}
        brand={brand}
        clientId={clientId}
        surfaceKind="website"
      />
    </WebsiteNavProvider>
  );
}
