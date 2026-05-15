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
import {
  type DraftSlot,
  loadDraftSections,
} from '@/lib/website/draft-stub';
import type { Page, Section, Website } from '@/lib/website/types';
import { useAutosave } from '@/lib/website/use-autosave';

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
  /** When true, autosave is suspended and the publish actions hide.
   *  Used when this user has submitted-for-review (Lane B) and is waiting
   *  on the operator (chunk D — WebsiteEditorPendingBanner sits above us). */
  locked?: boolean;
};

// Derive the draft slot from the editor mode. Page mode → `page` slot keyed
// by pageId; singleton mode → `header` / `footer` slot keyed by section type.
function slotForMode(mode: SectionEditorMode): DraftSlot {
  if (mode.kind === 'page') return { kind: 'page', pageId: mode.page.id };
  if (mode.section.type === 'header') return { kind: 'header' };
  return { kind: 'footer' };
}

function seedSectionsForMode(mode: SectionEditorMode): Section[] {
  return mode.kind === 'page' ? mode.page.sections : [mode.section];
}

export function SectionEditor({ website, mode, locked = false }: SectionEditorProps) {
  const brand = getBrandForClient(website.clientId);
  const slot = useMemo(() => slotForMode(mode), [mode]);

  // Hydrate: prefer any persisted autosave draft over the seed snapshot.
  // Falls back cleanly when localStorage is unavailable.
  const [sections, setSections] = useState<Section[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = loadDraftSections(website.id, slot);
      if (saved) return saved;
    }
    return seedSectionsForMode(mode);
  });

  // In singleton mode the only section is auto-selected. In page mode the
  // user picks (rail click or preview click).
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    () => (mode.kind === 'singleton' ? mode.section.id : null),
  );

  // Reset local state when the source content changes (e.g. tab swap).
  // Re-hydrate from the autosave draft for the new slot if present.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = loadDraftSections(website.id, slot);
      if (saved) {
        setSections(saved);
      } else {
        setSections(seedSectionsForMode(mode));
      }
    } else {
      setSections(seedSectionsForMode(mode));
    }
    setSelectedSectionId(mode.kind === 'singleton' ? mode.section.id : null);
  }, [mode, slot, website.id]);

  // Autosave wired off the live sections array. Disabled when the editor
  // is locked — submitters waiting on review mustn't keep writing.
  const autosave = useAutosave({
    websiteId: website.id,
    slot,
    sections,
    disabled: locked,
  });

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
        autosave={{
          status: autosave.status,
          lastSavedAt: autosave.lastSavedAt,
          onRetry: autosave.retry,
        }}
        publishDisabled={locked}
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
