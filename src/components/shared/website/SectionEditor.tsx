'use client';

// =============================================================================
// SectionEditor — the editor shell. Three columns:
//
//   [ section rail | preview pane | fields panel (when selected) ]
//
// Three modes (design doc §2.6 + Session 7 funnel-step mode):
//
//   { kind: 'page', website, pages, page }
//     → page tabs in toolbar, multi-row rail, preview pane stacks every
//       enabled section. Fields panel appears on section-select; closing
//       returns to rail+preview.
//
//   { kind: 'singleton', website, section, label }
//     → breadcrumb in toolbar, single-row rail (no drag/toggle/add),
//       preview pane renders just the one section. Fields panel auto-opens
//       (the singleton is always the selected section — no other choice).
//
//   { kind: 'funnelStep', funnel, steps, step }
//     → Session 7. Step tabs in toolbar ("01 · Landing", "02 · Schedule",
//       "03 · Thanks"), multi-row rail driven by step.sections. Autosave
//       writes to a funnel-keyed draft slot. Publish/Submit buttons hide —
//       funnel publish lands in a later session. Pending-submission lock
//       (Lane B) doesn't apply to funnels yet either.
//
// Brand comes from the client — websites resolve via `website.clientId`;
// funnels resolve via `funnel.clientId`. Same `getBrandForClient` either way
// (design doc §2.3 — brand lives on the Client).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

import { useUser } from '@/lib/auth/user-stub';
import type { Funnel, FunnelStep } from '@/lib/funnel/types';
import { getBrandForClient } from '@/lib/website/data-stub';
import {
  type DraftSlot,
  loadDraftSections,
} from '@/lib/website/draft-stub';
import type { Page, Section, Website } from '@/lib/website/types';
import { useAutosave } from '@/lib/website/use-autosave';
import { useUserPendingSubmission } from '@/lib/website/use-publish-state';

import { WebsiteEditorPendingBanner } from './WebsiteEditorPendingBanner';

import {
  EditorToolbar,
  type EditorToolbarTab,
} from './EditorToolbar';
import { ForcePublishMenu } from './ForcePublishMenu';
import { PagePreviewPane } from './PagePreviewPane';
import { SectionFieldsPanel } from './SectionFieldsPanel';
import { SectionListRail } from './SectionListRail';

export type SectionEditorMode =
  | {
      kind: 'page';
      website: Website;
      pages: Page[];
      page: Page;
    }
  | {
      kind: 'singleton';
      website: Website;
      section: Section;
      label: string;
    }
  | {
      kind: 'funnelStep';
      funnel: Funnel;
      steps: FunnelStep[];
      step: FunnelStep;
    };

export type SectionEditorProps = {
  mode: SectionEditorMode;
};

function slotForMode(mode: SectionEditorMode): DraftSlot {
  switch (mode.kind) {
    case 'page':
      return { kind: 'page', websiteId: mode.website.id, pageId: mode.page.id };
    case 'singleton':
      return mode.section.type === 'header'
        ? { kind: 'header', websiteId: mode.website.id }
        : { kind: 'footer', websiteId: mode.website.id };
    case 'funnelStep':
      return {
        kind: 'funnelStep',
        funnelId: mode.funnel.id,
        stepId: mode.step.id,
      };
  }
}

function seedSectionsForMode(mode: SectionEditorMode): Section[] {
  switch (mode.kind) {
    case 'page':
      return mode.page.sections;
    case 'singleton':
      return [mode.section];
    case 'funnelStep':
      return mode.step.sections;
  }
}

function clientIdForMode(mode: SectionEditorMode): string {
  return mode.kind === 'funnelStep' ? mode.funnel.clientId : mode.website.clientId;
}

function domainForMode(mode: SectionEditorMode): string {
  return mode.kind === 'funnelStep'
    ? mode.funnel.domain.primary
    : mode.website.domain.primary;
}

export function SectionEditor({ mode }: SectionEditorProps) {
  const brand = getBrandForClient(clientIdForMode(mode));
  const slot = useMemo(() => slotForMode(mode), [mode]);
  const user = useUser();

  // Lane B lock applies only to websites. Funnel-step editing has no
  // approval queue yet (Session 7 is the shell; mechanics later).
  const websiteIdForLock = mode.kind === 'funnelStep' ? null : mode.website.id;
  const pendingForUser = useUserPendingSubmission(
    websiteIdForLock,
    user?.id ?? null,
  );
  const locked = pendingForUser != null;

  // Hydrate: prefer any persisted autosave draft over the seed snapshot.
  // Falls back cleanly when localStorage is unavailable.
  const [sections, setSections] = useState<Section[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = loadDraftSections(slot);
      if (saved) return saved;
    }
    return seedSectionsForMode(mode);
  });

  // In singleton mode the only section is auto-selected. In page / funnel
  // step modes the user picks (rail click or preview click).
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    () => (mode.kind === 'singleton' ? mode.section.id : null),
  );

  // Reset local state when the source content changes (e.g. tab swap).
  // Re-hydrate from the autosave draft for the new slot if present.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = loadDraftSections(slot);
      if (saved) {
        setSections(saved);
      } else {
        setSections(seedSectionsForMode(mode));
      }
    } else {
      setSections(seedSectionsForMode(mode));
    }
    setSelectedSectionId(mode.kind === 'singleton' ? mode.section.id : null);
  }, [mode, slot]);

  const autosave = useAutosave({
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

  const toolbarMode = (() => {
    if (mode.kind === 'page') {
      return {
        kind: 'tabs' as const,
        backHref: '/website',
        tabs: mode.pages.map(
          (p): EditorToolbarTab => ({
            id: p.id,
            label: pageLabel(p),
            href: `/website/${p.id}`,
          }),
        ),
        activeTabId: mode.page.id,
      };
    }
    if (mode.kind === 'singleton') {
      return {
        kind: 'breadcrumb' as const,
        backHref: '/website',
        label: `Website · ${mode.label}`,
      };
    }
    // funnelStep
    return {
      kind: 'tabs' as const,
      backHref: `/funnels/${mode.funnel.id}`,
      tabs: mode.steps.map(
        (s, i): EditorToolbarTab => ({
          id: s.id,
          label: `${String(i + 1).padStart(2, '0')} · ${s.title}`,
          href: `/funnels/${mode.funnel.id}/edit/${s.id}`,
        }),
      ),
      activeTabId: mode.step.id,
    };
  })();

  const railMode =
    mode.kind === 'page'
      ? { kind: 'page' as const, title: mode.page.title }
      : mode.kind === 'singleton'
        ? { kind: 'singleton' as const, label: mode.label }
        : { kind: 'page' as const, title: mode.step.title };

  // Three-column grid when a section is selected; two-column otherwise.
  // Locked editors (Lane B submitter waiting on review) hide the fields
  // panel entirely — the dimmed rail + preview show *what* was submitted
  // but you can't edit until the operator acts.
  const isSingleton = mode.kind === 'singleton';
  const isFunnelStep = mode.kind === 'funnelStep';
  const showFields = !locked && selectedSection != null;
  const gridCols = showFields
    ? 'grid-cols-[300px_1fr_400px]'
    : 'grid-cols-[340px_1fr]';

  return (
    <div className="flex h-svh flex-col bg-paper">
      {pendingForUser ? (
        <WebsiteEditorPendingBanner submission={pendingForUser} />
      ) : null}
      <EditorToolbar
        domain={domainForMode(mode)}
        mode={toolbarMode}
        activePageId={mode.kind === 'page' ? mode.page.id : undefined}
        autosave={{
          status: autosave.status,
          lastSavedAt: autosave.lastSavedAt,
          onRetry: autosave.retry,
        }}
        publishDisabled={locked || isFunnelStep}
        // Session 8 — website editing routes publish through the review
        // surface (preflight is the gate). Funnel mode has no publish yet.
        reviewHref={isFunnelStep ? undefined : '/website/review'}
        publishMenu={
          mode.kind === 'funnelStep' ? null : (
            <ForcePublishMenu websiteId={mode.website.id} hidden={locked} />
          )
        }
      />
      <div
        className={`grid min-h-0 flex-1 overflow-hidden grid-rows-[minmax(0,1fr)] ${gridCols} ${
          locked ? 'opacity-65 [&_*]:pointer-events-none' : ''
        }`}
      >
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
        {showFields && selectedSection ? (
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
