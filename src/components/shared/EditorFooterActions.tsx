import { cn } from '@/lib/utils';

/**
 * Editor-mode footer actions bar. Sibling to `BuilderFooterActions` (the
 * wizard footer). Built separately because the interaction model differs:
 * editors carry an "auto-saved" indicator and a 3-button action set (Back /
 * Disable / Save) rather than the wizard's 2-button Back/Continue rhythm.
 *
 * Visual rhythm: no top border by default (the canvas above already has its
 * own card border); a centered `mt-7` gap separates it from the canvas. The
 * progress slot is left-aligned mono; actions are right-aligned.
 *
 * See CLAUDE.md parked decision — revisit a shared core if a third
 * footer-actions variant appears.
 */
type EditorFooterActionsProps = {
  progress: React.ReactNode;
  actions: React.ReactNode;
  className?: string;
};

function EditorFooterActions({
  progress,
  actions,
  className,
}: EditorFooterActionsProps) {
  return (
    <div
      data-slot="editor-footer-actions"
      className={cn(
        'mt-7 flex items-center justify-between gap-4',
        className,
      )}
    >
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet [&_strong]:text-ink">
        {progress}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

export { EditorFooterActions };
export type { EditorFooterActionsProps };
