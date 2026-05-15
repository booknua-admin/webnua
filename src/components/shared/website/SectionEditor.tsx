'use client';

// =============================================================================
// SectionEditor — the editor shell. Toolbar at top, section rail on the
// left, preview pane on the right. Composes the three pieces and owns the
// local UI state (which section is selected, which sections are enabled).
//
// Session 3 scope:
//   - Renders the shell with all capability gates active.
//   - Section enable toggles work locally (visual only — no save yet).
//   - "Add section" click is a no-op (Session 4 wires the picker).
//   - Selected section is highlighted in rail + outlined in preview.
//   - Clicking a section in the preview pane selects it; clicking in the
//     rail does the same. Editing the section's fields lands in Session 4.
//
// Future sessions extend this:
//   - Session 4: per-section field editor opens on selection.
//   - Session 5: real autosave + the three publish lanes wired.
//   - Session 8: preflight + publish UI.
// =============================================================================

import { useEffect, useState } from 'react';

import type { Page, Section, Website } from '@/lib/website/types';

import { EditorToolbar } from './EditorToolbar';
import { PagePreviewPane } from './PagePreviewPane';
import { SectionListRail } from './SectionListRail';

export type SectionEditorProps = {
  website: Website;
  /** All pages on the website (drives the toolbar's page tabs). */
  pages: Page[];
  /** The page currently being edited (from the URL [pageId]). */
  page: Page;
};

export function SectionEditor({ website, pages, page }: SectionEditorProps) {
  const [sections, setSections] = useState<Section[]>(page.sections);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Reset local state when the page changes (toolbar tabs swap pages).
  useEffect(() => {
    setSections(page.sections);
    setSelectedSectionId(null);
  }, [page.id, page.sections]);

  const handleToggleSectionEnabled = (id: string, enabled: boolean) => {
    setSections((current) =>
      current.map((s) => (s.id === id ? { ...s, enabled } : s)),
    );
  };

  return (
    <div className="flex h-svh flex-col bg-paper">
      <EditorToolbar website={website} pages={pages} activePageId={page.id} />
      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] overflow-hidden">
        <SectionListRail
          pageTitle={page.title}
          sections={sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
          onToggleSectionEnabled={handleToggleSectionEnabled}
        />
        <PagePreviewPane
          sections={sections}
          brand={website.brand}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
        />
      </div>
    </div>
  );
}
