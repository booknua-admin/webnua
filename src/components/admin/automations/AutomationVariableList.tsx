import type { AutomationVariable } from '@/lib/automations/types';
import { cn } from '@/lib/utils';

type AutomationVariableListProps = {
  heading: string;
  items: AutomationVariable[];
  className?: string;
};

function AutomationVariableList({
  heading,
  items,
  className,
}: AutomationVariableListProps) {
  return (
    <div
      data-slot="automation-variable-list"
      className={cn(
        'rounded-[10px] border border-rule bg-card px-5 py-4.5',
        className,
      )}
    >
      <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {heading}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <button
            key={item.code}
            type="button"
            className="flex items-center justify-between rounded-md bg-paper px-3 py-2 text-left transition-colors hover:bg-rust-soft/55"
          >
            <div>
              <div className="font-mono text-[11px] font-bold text-rust">
                {item.code}
              </div>
              <div className="font-sans text-[11px] text-ink-quiet">
                {item.description}
              </div>
            </div>
            <span className="font-sans text-[14px] font-bold text-rust">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { AutomationVariableList };
export type { AutomationVariableListProps };
