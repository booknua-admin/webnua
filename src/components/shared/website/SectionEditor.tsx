'use client';

// =============================================================================
// SectionEditor — the editor shell. Three columns:
//
//   [ section rail | preview pane | fields panel (when selected) ]
//
// Two modes (design doc §2.6):
//
//   { kind: 'page', page, pages }
//     → page tabs in toolbar, multi-row rail, preview pane stacks every
//       enabled section. Fields panel appears on section-select; closing
//       returns to rail+preview.
//
//   { kind: 'singleton', section, label }
//     → breadcrumb in toolbar, single-row rail (no drag/toggle/add),
//       preview pane renders just the one section. Fields panel auto-opens
//       (the singleton is always the selected section — no other choice).
//
// Brand comes from the client (via `website.clientId` → `getBrandForClient`).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

import { getBrandForClient } from '@/lib/website/data-stub';
import type { Page, Section, Website } from '@/lib/website/types';

import {
  EditorToolbar,
  type EditorToolbarTab,
} from './EditorToolbar';
import { PagePreviewPane } from './PagePreviewPane';
import { SectionFieldsPanel } from './SectionFieldsPanel';
import { SectionListRail } from './SectionListRail';

export type SectionEditorMode =
  | {
      kind: 'page';
      pages: Page[];
      page: Page;
    }
  | {
      kind: 'singleton';
      section: Section;
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
  // In singleton mode the only section is auto-selected. In page mode the
  // user picks (rail click or preview click).
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    () => (mode.kind === 'singleton' ? mode.section.id : null),
  );

  // Reset local state when the source content changes.
  useEffect(() => {
    if (mode.kind === 'page') {
      setSections(mode.page.sections);
      setSelectedSectionId(null);
    } else {
      setSections([mode.section]);
      setSelectedSectionId(mode.section.id);
    }
  }, [mode]);

  const selectedSection = useMemo(
    () => (selectedSectionId ? sections.find((s) => s.id === selectedSectionId) : null) ?? null,
    [sections, selectedSectionId],
  );

  const handleToggleSectionEnabled = (id: string, enabled: boolean) => {
    setSections((current) =>
      current.map((s) => (s.id === id ? { ...s, enabled } : s)),
    );
  };

  const handleSectionDataChange = (
    id: string,
    nextData: Record<string, unknown>,
  ) => {
    setSections((current) =>
      current.map((s) => (s.id === id ? { ...s, data: nextData } : s)),
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

  // Three-column grid when a section is selected; two-column otherwise.
  const isSingleton = mode.kind === 'singleton';
  const gridCols = selectedSection
    ? 'grid-cols-[300px_1fr_400px]'
    : 'grid-cols-[340px_1fr]';

  return (
    <div className="flex h-svh flex-col bg-paper">
      <EditorToolbar
        website={website}
        mode={toolbarMode}
        activePageId={mode.kind === 'page' ? mode.page.id : undefined}
      />
      <div className={`grid min-h-0 flex-1 overflow-hidden ${gridCols}`}>
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
        {selectedSection ? (
          <SectionFieldsPanel
            // Force remount when the selected section changes so the Fields
            // component gets a fresh internal state (e.g. CopyField's AI
            // variant index).
            key={selectedSection.id}
            section={selectedSection}
            onChange={(nextData) =>
              handleSectionDataChange(selectedSection.id, nextData)
            }
            onClose={() => setSelectedSectionId(null)}
            hideClose={isSingleton}
          />
        ) : null}
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
