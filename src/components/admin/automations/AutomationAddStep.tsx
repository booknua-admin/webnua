import { cn } from '@/lib/utils';

type AutomationAddStepProps = {
  label: string;
  className?: string;
};

function AutomationAddStep({ label, className }: AutomationAddStepProps) {
  return (
    <button
      type="button"
      data-slot="automation-add-step"
      className={cn(
        'block w-full cursor-pointer rounded-[10px] border border-dashed border-rule bg-paper-2 px-4 py-3.5 text-center font-sans text-[13px] font-bold text-rust transition-colors hover:border-rust hover:bg-rust-soft/55',
        className,
      )}
    >
      {label}
    </button>
  );
}

export { AutomationAddStep };
export type { AutomationAddStepProps };
