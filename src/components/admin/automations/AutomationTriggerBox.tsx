import type { AutomationEditorTrigger } from '@/lib/automations/types';
import { cn } from '@/lib/utils';

type AutomationTriggerBoxProps = {
  trigger: AutomationEditorTrigger;
  className?: string;
};

/**
 * Read-only summary of the automation's trigger. The trigger type is fixed —
 * to change it, clone the automation (operator-only) and pick a different
 * trigger on the clone. The former "Change trigger →" affordance was inert and
 * has been removed.
 */
function AutomationTriggerBox({
  trigger,
  className,
}: AutomationTriggerBoxProps) {
  return (
    <div
      data-slot="automation-trigger-box"
      className={cn(
        'grid grid-cols-[38px_1fr] items-center gap-3.5 rounded-[10px] bg-ink px-5 py-4 text-paper',
        className,
      )}
    >
      <div
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full bg-rust font-sans text-[16px] font-extrabold text-paper"
      >
        ⚡
      </div>
      <div className="min-w-0">
        <div className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/50">
          {trigger.label}
        </div>
        <div className="font-sans text-[15px] font-bold text-paper">
          {trigger.name}
        </div>
      </div>
    </div>
  );
}

export { AutomationTriggerBox };
export type { AutomationTriggerBoxProps };
