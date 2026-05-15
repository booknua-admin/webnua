'use client';

// =============================================================================
// SectionEditor — the editor shell. Toolbar at top, section rail on the left,
// preview pane on the right. Two modes (design doc §2.6):
//
//   { kind: 'page', page, pages }
//     → page tabs in toolbar, multi-row rail, preview pane stacks every
//       enabled section
//
//   { kind: 'singleton', section, label }
//     → breadcrumb in toolbar, single-row rail (no drag/toggle/add),
//       preview pane renders just the one section
//
// Brand comes from the client (via `website.clientId` → `getBrandForClient`).
// =============================================================================

import { useEffect, useState } from 'react';

import { getBrandForClient } from '@/lib/website/data-stub';
import type { Page, Section, Website } from '@/lib/website/types';

import {
  EditorToolbar,
  type EditorToolbarTab,
} from './EditorToolbar';
import { PagePreviewPane } from './PagePreviewPane';
import { SectionListRail } from './SectionListRail';

export type SectionEditorMode =
  | {
      kind: 'page';
      /** All pages on the website (drives the toolbar's page tabs). */
      pages: Page[];
      /** The page currently being edited. */
      page: Page;
    }
  | {
      kind: 'singleton';
      /** The website-level singleton section (header or footer). */
      section: Section;
      /** Display label, e.g. "Header" or "Footer". */
      label: string;
    };

export type SectionEditorProps = {
  website: Website;
  mode: SectionEditorMode;
};

export function SectionEditor({ website, mode }: SectionEditorProps) {
  const brand = getBrandForClient(website.clientId);
  const [sections, setSections] = useState<Section[]>(() =>
    mode.kind === 'page' ? mode.page.sections : [mode.section],
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Reset local state when the source content changes.
  useEffect(() => {
    if (mode.kind === 'page') {
      setSections(mode.page.sections);
    } else {
      setSections([mode.section]);
    }
    setSelectedSectionId(null);
  }, [mode]);

  const handleToggleSectionEnabled = (id: string, enabled: boolean) => {
    setSections((current) =>
      current.map((s) => (s.id === id ? { ...s, enabled } : s)),
    );
  };

  if (!brand) {
    return (
      <div className="flex h-svh items-center justify-center bg-paper px-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn">
          No brand registered for this client.
        </p>
      </div>
    );
  }

  const toolbarMode =
    mode.kind === 'page'
      ? {
          kind: 'tabs' as const,
          tabs: mode.pages.map(
            (p): EditorToolbarTab => ({
              id: p.id,
              label: pageLabel(p),
              href: `/website/${p.id}`,
            }),
          ),
          activeTabId: mode.page.id,
        }
      : {
          kind: 'breadcrumb' as const,
          label: `Website · ${mode.label}`,
        };

  const railMode =
    mode.kind === 'page'
      ? { kind: 'page' as const, title: mode.page.title }
      : { kind: 'singleton' as const, label: mode.label };

  return (
    <div className="flex h-svh flex-col bg-paper">
      <EditorToolbar
        website={website}
        mode={toolbarMode}
        activePageId={mode.kind === 'page' ? mode.page.id : undefined}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] overflow-hidden">
        <SectionListRail
          mode={railMode}
          sections={sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
          onToggleSectionEnabled={handleToggleSectionEnabled}
        />
        <PagePreviewPane
          sections={sections}
          brand={brand}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
        />
      </div>
    </div>
  );
}

function pageLabel(p: Page): string {
  switch (p.type) {
    case 'home':
      return 'Home';
    case 'about':
      return 'About';
    case 'services':
      return 'Services';
    case 'contact':
      return 'Contact';
    case 'generic':
    default:
      return p.slug;
  }
}
