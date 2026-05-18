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
import { useRouter } from 'next/navigation';

import { useCan, useUser } from '@/lib/auth/user-stub';
import { publishFunnelDraft } from '@/lib/funnel/mutations';
import type { Funnel, FunnelStep } from '@/lib/funnel/types';
import type { DraftSlot } from '@/lib/website/content-drafts';
import { defaultFormConfig } from '@/lib/website/form-config';
import { useBrandForClient } from '@/lib/website/queries';
import { getSectionDefinition } from '@/lib/website/sections';
import type {
  ContainerKind,
  Page,
  Section,
  SectionType,
  Website,
} from '@/lib/website/types';
import { useAutosave } from '@/lib/website/use-autosave';
import { useBrandStyle } from '@/lib/website/use-brand-style';
import { useUndoableState } from '@/lib/website/use-undoable-state';
import { useUserPendingSubmission } from '@/lib/website/use-publish-state';

import { AddSectionDialog } from './AddSectionDialog';
import { WebsiteEditorPendingBanner } from './WebsiteEditorPendingBanner';

import {
  EditorToolbar,
  type EditorToolbarTab,
} from './EditorToolbar';
import { ForcePublishMenu } from './ForcePublishMenu';
import { PagePreviewPane, type DevicePreview } from './PagePreviewPane';
import { SectionFieldsPanel } from './SectionFieldsPanel';
import { SiteFontsMenu } from './SiteFontsMenu';

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

/** The container new sections are added into. Singleton mode has no add. */
function containerForMode(mode: SectionEditorMode): ContainerKind {
  return mode.kind === 'funnelStep' ? 'funnelStep' : 'page';
}

export function SectionEditor({ mode }: SectionEditorProps) {
  const clientId = clientIdForMode(mode);
  const brandQuery = useBrandForClient(clientId);
  // Brand-level style (fonts + colour defaults) is edited site-wide via the
  // font menu and the "apply to all" path; the overlay is merged over the
  // resolved brand so every section preview re-renders live.
  const brandStyleOverride = useBrandStyle(clientId);
  const brand = useMemo(
    () =>
      brandQuery.data
        ? { ...brandQuery.data, ...brandStyleOverride }
        : null,
    [brandQuery.data, brandStyleOverride],
  );
  const slot = useMemo(() => slotForMode(mode), [mode]);
  const user = useUser();
  const router = useRouter();
  const canPublish = useCan('publish');

  // Lane B lock applies only to websites. Funnel-step editing has no
  // approval queue yet (Session 7 is the shell; mechanics later).
  const websiteIdForLock = mode.kind === 'funnelStep' ? null : mode.website.id;
  const pendingForUser = useUserPendingSubmission(
    websiteIdForLock,
    user?.id ?? null,
  );
  const locked = pendingForUser != null;

  // Seed from the mode's sections. The page-level query already merges the
  // content_drafts autosave buffer into these before passing them down.
  // Undoable section state — in-memory bounded history (see useUndoableState).
  const {
    value: sections,
    set: setSections,
    reset: resetSections,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoableState<Section[]>(() => seedSectionsForMode(mode));

  // In singleton mode the only section is auto-selected. In page / funnel
  // step modes the user picks (rail click or preview click).
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    () => (mode.kind === 'singleton' ? mode.section.id : null),
  );

  const [addOpen, setAddOpen] = useState(false);

  // Element-inspector model: the element selected within the current section.
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [device, setDevice] = useState<DevicePreview>('desktop');

  // Reset local state when the source content changes (e.g. tab swap).
  useEffect(() => {
    resetSections(seedSectionsForMode(mode));
    setSelectedSectionId(mode.kind === 'singleton' ? mode.section.id : null);
    setSelectedElementId(null);
  }, [mode, slot, resetSections]);

  // Selecting a section resets the element selection.
  const handleSelectSection = (id: string | null) => {
    setSelectedSectionId(id);
    setSelectedElementId(null);
  };

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

  const handleAddSection = (type: SectionType) => {
    const definition = getSectionDefinition(type);
    if (!definition) return;
    const newSection: Section = {
      id: `sec-${Math.random().toString(36).slice(2, 9)}`,
      type,
      enabled: true,
      data: definition.defaultData() as Record<string, unknown>,
    };
    // The `form` section IS a form — it is born with a default form config
    // on the envelope. Every other section starts form-less; the operator
    // attaches a form via the fields panel.
    if (type === 'form') newSection.form = defaultFormConfig();
    setSections((current) => [...current, newSection]);
    setSelectedSectionId(newSection.id);
  };

  const handleRemoveSection = (id: string) => {
    setSections((current) => current.filter((s) => s.id !== id));
    if (id === selectedSectionId) {
      setSelectedSectionId(null);
      setSelectedElementId(null);
    }
  };

  const handleMoveSection = (id: string, direction: -1 | 1) => {
    setSections((current) => {
      const i = current.findIndex((s) => s.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= current.length) return current;
      const next = [...current];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleDuplicateSection = (id: string) => {
    setSections((current) => {
      const i = current.findIndex((s) => s.id === id);
      if (i < 0) return current;
      const copy: Section = {
        ...current[i],
        id: `sec-${Math.random().toString(36).slice(2, 9)}`,
        data: structuredClone(current[i].data),
      };
      return [...current.slice(0, i + 1), copy, ...current.slice(i + 1)];
    });
  };

  // Funnel publish (Lane A — funnels have no approval queue). The funnel
  // editor publishes directly; websites route through /website/review.
  const handleFunnelPublish = async () => {
    if (mode.kind !== 'funnelStep' || !user) return;
    const result = await publishFunnelDraft(mode.funnel.id, {
      id: user.id,
      displayName: user.displayName,
    });
    if (result) router.push(`/funnels/${mode.funnel.id}`);
  };

  if (brandQuery.isLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-paper px-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Loading editor…'}
        </p>
      </div>
    );
  }

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

  // The fields panel shows when a section is selected. Locked editors
  // (Lane B submitter waiting on review) hide it entirely.
  const isSingleton = mode.kind === 'singleton';
  const isFunnelStep = mode.kind === 'funnelStep';
  const showFields = !locked && selectedSection != null;
  // No left rail — section management is the per-section hover toolbar.
  const gridCols = showFields ? 'grid-cols-[1fr_400px]' : 'grid-cols-[1fr]';

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
        publishDisabled={isFunnelStep ? !canPublish : locked}
        // Website editing routes publish through the review surface
        // (preflight is the gate); the funnel editor publishes directly.
        reviewHref={isFunnelStep ? undefined : '/website/review'}
        onPublish={isFunnelStep ? handleFunnelPublish : undefined}
        publishMenu={
          mode.kind === 'funnelStep' ? null : (
            <ForcePublishMenu websiteId={mode.website.id} hidden={locked} />
          )
        }
        siteStyles={
          <SiteFontsMenu
            clientId={clientId}
            headingFont={brand.headingFont}
            bodyFont={brand.bodyFont}
          />
        }
        history={{ onUndo: undo, onRedo: redo, canUndo, canRedo }}
        device={{ value: device, onChange: setDevice }}
      />
      <div
        className={`grid min-h-0 flex-1 overflow-hidden grid-rows-[minmax(0,1fr)] ${gridCols} ${
          locked ? 'opacity-65 [&_*]:pointer-events-none' : ''
        }`}
      >
        <PagePreviewPane
          sections={sections}
          brand={brand}
          device={device}
          selectedSectionId={selectedSectionId}
          onSelectSection={handleSelectSection}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
          onToggleSectionEnabled={isSingleton ? undefined : handleToggleSectionEnabled}
          onRemoveSection={isSingleton ? undefined : handleRemoveSection}
          onMoveSection={isSingleton ? undefined : handleMoveSection}
          onDuplicateSection={isSingleton ? undefined : handleDuplicateSection}
          onRequestAddSection={isSingleton ? undefined : () => setAddOpen(true)}
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
            onClose={() => handleSelectSection(null)}
            hideClose={isSingleton}
            selectedElement={selectedElementId}
            onSelectElement={setSelectedElementId}
            clientId={clientId}
            brand={brand}
          />
        ) : null}
      </div>
      <AddSectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        container={containerForMode(mode)}
        onAdd={handleAddSection}
      />
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
