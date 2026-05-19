// =============================================================================
// PublicSiteRenderer — renders a published website page or funnel step.
//
// Server component. It maps a published snapshot's sections through the
// section registry's `Preview` components (the same components the editor
// renders — "one render implementation", per builder-design.md). Rendered
// with no editor callbacks, the Previews are inert: no selection rings, no
// hover toolbars.
//
// Disabled sections (`enabled === false`) are hidden — the editor dims them,
// a published page omits them.
// =============================================================================

import type { FunnelStep } from '@/lib/funnel/types';
import { getSectionDefinition } from '@/lib/website/sections';
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
      brand: BrandObject;
      header: Section;
      footer: Section;
      nav: NavLink[];
      pages: Page[];
      page: Page;
    }
  | { kind: 'funnel'; brand: BrandObject; step: FunnelStep };

function RenderedSection({
  section,
  brand,
}: {
  section: Section;
  brand: BrandObject;
}) {
  if (section.enabled === false) return null;
  const def = getSectionDefinition(section.type);
  if (!def) return null;
  const Preview = def.Preview;
  return <Preview data={section.data} brand={brand} />;
}

function navHref(target: NavLinkTarget, pages: Page[]): string {
  if (target.kind === 'href') return target.href || '#';
  const page = pages.find((p) => p.id === target.pageId);
  if (!page) return '#';
  return page.slug === 'home' ? '/' : `/${page.slug}`;
}

/** Minimal cross-page nav. Rendered only for multi-page sites — the header
 *  section carries the brand chrome; this is just the page links. */
function PublicNav({
  nav,
  pages,
  brand,
}: {
  nav: NavLink[];
  pages: Page[];
  brand: BrandObject;
}) {
  return (
    <nav
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 24,
        padding: '12px 24px',
        background: '#ffffff',
        borderBottom: '1px solid #e4ded0',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {nav.map((link, i) => (
        <a
          key={`${link.label}-${i}`}
          href={navHref(link.target, pages)}
          style={{ color: brand.accentColor, textDecoration: 'none' }}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
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
          />
        ))}
      </main>
    );
  }

  const { brand, header, footer, nav, pages, page } = props;
  return (
    <>
      {nav.length > 1 ? (
        <PublicNav nav={nav} pages={pages} brand={brand} />
      ) : null}
      <RenderedSection section={header} brand={brand} />
      <main>
        {page.sections.map((section) => (
          <RenderedSection key={section.id} section={section} brand={brand} />
        ))}
      </main>
      <RenderedSection section={footer} brand={brand} />
    </>
  );
}
