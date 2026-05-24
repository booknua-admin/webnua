import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Two-column editor shell — `1fr 340px` per the admin-Screen-17 prototype.
 *
 * Architectural note — this is the 3rd `1fr + fixed-rail` detail layout in
 * the codebase (alongside `TicketDetailLayout` and the inline shape in
 * `LeadDetail*` content). The rail-width here is 340px (not 320px); the
 * canvas surface here is a white card (not the ticket detail's plain shell).
 * Kept separate for now; see CLAUDE.md parked decision on layout-shell
 * consolidation.
 */
type AutomationEditorLayoutProps = {
  /** The canvas column — trigger + steps + add-step go here. */
  canvas: ReactNode;
  /** The right rail — variable list / test-send / performance cards. */
  rail: ReactNode;
  className?: string;
};

function AutomationEditorLayout({
  canvas,
  rail,
  className,
}: AutomationEditorLayoutProps) {
  return (
    <div
      data-slot="automation-editor-layout"
      className={cn(
        // Mobile: rail stacks below canvas. Desktop (lg+): rail to the right.
        'grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]',
        className,
      )}
    >
      <div
        data-slot="automation-editor-canvas"
        className="rounded-xl border border-rule bg-card px-4 py-5 md:px-7 md:py-6.5"
      >
        {canvas}
      </div>
      <div
        data-slot="automation-editor-rail"
        className="flex flex-col gap-3.5 lg:sticky lg:top-[100px]"
      >
        {rail}
      </div>
    </div>
  );
}

export { AutomationEditorLayout };
export type { AutomationEditorLayoutProps };
