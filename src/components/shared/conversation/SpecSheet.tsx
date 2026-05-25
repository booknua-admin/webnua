// =============================================================================
// SpecSheet — bordered "blueprint section" wrapper for any rich content in
// the conversational onboarding chat.
//
// Visual language mirrors GenerationBlueprint's BlueprintSheet: rounded
// border-2 ink/20 on a faint paper/40 surface, a mono `// LABEL` eyebrow
// in the top-left, an optional filename-style hint in the top-right
// (e.g. `step-3 / brand.svg`). The whole chat reads as one architect's
// drawing — message bubbles flow as spec lines, rich slots (pickers, the
// offer card, the verify-code grid) sit as labelled sheets on the same
// drawing.
//
// Pure visual chrome. Pass children; SpecSheet only owns the surface,
// border, label, and the subtle animate-in fade. Interactive logic stays
// in the consumer.
// =============================================================================

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type SpecSheetProps = {
  /** Mono uppercase corner label, e.g. `// VERIFY YOUR EMAIL`. The leading
   *  `//` is included verbatim — pass the full string. */
  label: string;
  /** Optional right-aligned mono hint, e.g. `verify.json`. */
  hint?: string;
  /** Sheet body. */
  children: ReactNode;
  /** Optional className override on the outer wrapper. */
  className?: string;
};

export function SpecSheet({ label, hint, children, className }: SpecSheetProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-lg border-2 border-ink/20 bg-paper/40 px-4 py-4 sm:px-5 sm:py-5',
        'animate-in fade-in slide-in-from-bottom-1 duration-300',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
          {label}
        </span>
        {hint ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet/60">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
