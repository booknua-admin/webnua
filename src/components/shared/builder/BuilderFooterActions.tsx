import { cn } from '@/lib/utils';

type BuilderFooterActionsProps = {
  progress: React.ReactNode;
  actions: React.ReactNode;
  className?: string;
  /**
   * If false, the footer renders without the top border + spacing.
   * Use when it sits outside a form panel.
   */
  bordered?: boolean;
};

function BuilderFooterActions({
  progress,
  actions,
  className,
  bordered = true,
}: BuilderFooterActionsProps) {
  return (
    <div
      data-slot="builder-footer-actions"
      className={cn(
        'flex items-center justify-between',
        bordered && 'mt-9 border-t border-rule pt-5',
        className,
      )}
    >
      <div className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet [&_strong]:text-ink">
        {progress}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

export { BuilderFooterActions };
