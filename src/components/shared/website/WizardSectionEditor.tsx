'use client';

// =============================================================================
// WizardSectionEditor — the editor's wizard-frame mode (design doc §5.2).
//
// The onboarding wizard's draft-walk step (Step 5) mounts this. It walks the
// generated funnel's sections one at a time — flattened across every funnel
// step, in step order — letting the operator polish copy / media before the
// review step. Differences from the standard SectionEditor:
//   - no EditorToolbar, no section rail (the wizard pre-determines structure)
//   - capabilities locked to { editCopy, editMedia, useAI } via
//     <CapabilityOverrideProvider>, whoever launched onboarding
//   - a BuilderFooterActions footer drives the walk (Back / Continue)
//   - height-contained — it sits inside the wizard page chrome, not h-svh
//
// Autosave persists to the same per-funnel-step DraftSlot the funnel editor
// uses, so the wizard's edits and later funnel-editor edits share one draft.
//
// Structure: an outer component owns the flattened walk + footer; an inner
// `WizardStepPane`, keyed by step id, owns one step's editable sections. The
// key makes a step boundary a remount — fresh section state, no effect.
//
// Realised as a sibling component rather than a fourth `SectionEditor` mode
// discriminator: the three existing modes share helper functions keyed on a
// `{ website }` / `{ funnel }` shape that the per-step walk doesn't fit, and
// keeping the working 3-mode editor untouched avoids regression risk.
// =============================================================================

import { useMemo, useState } from 'react';

import type { Capability } from '@/lib/auth/capabilities';
import { CapabilityOverrideProvider } from '@/lib/auth/user-stub';
import type { Funnel, FunnelStep } from '@/lib/funnel/types';
import { getBrandForClient } from '@/lib/website/data-stub';
import { type DraftSlot, loadDraftSections } from '@/lib/website/draft-stub';
import type { BrandObject, Section } from '@/lib/website/types';
import { useAutosave } from '@/lib/website/use-autosave';

import { BuilderFooterActions } from '@/components/shared/builder/BuilderFooterActions';
import { Button } from '@/components/ui/button';

import { PagePreviewPane } from './PagePreviewPane';
import { SectionFieldsPanel } from './SectionFieldsPanel';

// The wizard's flow is its own UX contract — it locks to copy / media / AI
// editing regardless of who launched onboarding (design doc §5.2).
const WIZARD_CAPS: readonly Capability[] = ['editCopy', 'editMedia', 'useAI'];

export type WizardSectionEditorProps = {
  funnel: Funnel;
  steps: FunnelStep[];
  /** Continue pressed on the final section — advances to the next wizard step. */
  onExitForward: () => void;
  /** Back pressed on the first section — returns to the previous wizard step. */
  onExitBack: () => void;
};

type WalkEntry = {
  step: FunnelStep;
  /** Index of the section within its step's `sections` array. */
  sectionIndex: number;
};

function stepSlot(funnelId: string, stepId: string): DraftSlot {
  return { kind: 'funnelStep', funnelId, stepId };
}

function loadStepSections(step: FunnelStep, slot: DraftSlot): Section[] {
  if (typeof window !== 'undefined') {
    const saved = loadDraftSections(slot);
    if (saved) return saved;
  }
  return step.sections;
}

export function WizardSectionEditor({
  funnel,
  steps,
  onExitForward,
  onExitBack,
}: WizardSectionEditorProps) {
  const brand = getBrandForClient(funnel.clientId);

  // Flattened walk — every section of every step, in step order.
  const walk = useMemo<WalkEntry[]>(
    () =>
      steps.flatMap((step) =>
        step.sections.map((_, sectionIndex) => ({ step, sectionIndex })),
      ),
    [steps],
  );

  const total = walk.length;
  const [walkIndex, setWalkIndex] = useState(0);
  const clampedIndex = Math.min(walkIndex, Math.max(total - 1, 0));
  const current = walk[clampedIndex] as WalkEntry | undefined;

  if (!brand) {
    return (
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn">
        {'// No brand registered for this client.'}
      </p>
    );
  }

  if (!current || total === 0) {
    return (
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// This funnel has no sections to walk through.'}
      </p>
    );
  }

  const isFirst = clampedIndex === 0;
  const isLast = clampedIndex === total - 1;

  const handleBack = () => {
    if (isFirst) onExitBack();
    else setWalkIndex(clampedIndex - 1);
  };

  const handleContinue = () => {
    if (isLast) onExitForward();
    else setWalkIndex(clampedIndex + 1);
  };

  return (
    <CapabilityOverrideProvider capabilities={WIZARD_CAPS}>
      <div data-slot="wizard-section-editor" className="flex flex-col">
        <WizardStepPane
          // A step boundary is a remount — fresh section state, no effect.
          key={current.step.id}
          funnel={funnel}
          step={current.step}
          brand={brand}
          sectionIndex={current.sectionIndex}
        />
        <BuilderFooterActions
          progress={
            <>
              Section <strong>{clampedIndex + 1}</strong> of {total} ·{' '}
              {current.step.title}
            </>
          }
          actions={
            <>
              <Button variant="ghost" onClick={handleBack}>
                ← Back
              </Button>
              <Button onClick={handleContinue}>
                {isLast ? 'Continue to automations →' : 'Continue →'}
              </Button>
            </>
          }
        />
      </div>
    </CapabilityOverrideProvider>
  );
}

// -----------------------------------------------------------------------------
// WizardStepPane — one funnel step's editable sections. Keyed by step id by
// the parent, so crossing a step boundary remounts it: `sections` re-seeds
// from the step's draft slot via the useState initializer, no effect needed.
// -----------------------------------------------------------------------------

type WizardStepPaneProps = {
  funnel: Funnel;
  step: FunnelStep;
  brand: BrandObject;
  /** Which section of this step the walk currently sits on. */
  sectionIndex: number;
};

function WizardStepPane({
  funnel,
  step,
  brand,
  sectionIndex,
}: WizardStepPaneProps) {
  const slot = useMemo(() => stepSlot(funnel.id, step.id), [funnel.id, step.id]);
  const [sections, setSections] = useState<Section[]>(() =>
    loadStepSections(step, slot),
  );

  useAutosave({ slot, sections });

  const selectedSection = sections[sectionIndex] ?? null;

  const handleSectionDataChange = (nextData: Record<string, unknown>) => {
    setSections((cur) =>
      cur.map((s, i) => (i === sectionIndex ? { ...s, data: nextData } : s)),
    );
  };

  return (
    <div className="grid grid-cols-[1fr_400px] grid-rows-[640px] overflow-hidden rounded-xl border border-rule bg-card">
      <div className="min-w-0 overflow-hidden border-r border-rule">
        <PagePreviewPane
          sections={sections}
          brand={brand}
          selectedSectionId={selectedSection?.id ?? null}
        />
      </div>
      <div className="min-w-0 overflow-hidden">
        {selectedSection ? (
          <SectionFieldsPanel
            // Force a fresh Fields instance when the walk moves on, so
            // per-field state (e.g. CopyField's AI-variant index) resets.
            key={selectedSection.id}
            section={selectedSection}
            onChange={handleSectionDataChange}
            onClose={() => {}}
            hideClose
          />
        ) : null}
      </div>
    </div>
  );
}
