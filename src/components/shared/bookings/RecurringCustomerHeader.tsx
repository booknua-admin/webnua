import { cn } from '@/lib/utils';

type RecurringCustomerHeaderProps = {
  initial: string;
  name: string;
  /** Two-line meta. `<strong>` segments render ink-bold. */
  meta: React.ReactNode;
  className?: string;
};

function RecurringCustomerHeader({
  initial,
  name,
  meta,
  className,
}: RecurringCustomerHeaderProps) {
  return (
    <div
      data-slot="recurring-customer-header"
      className={cn(
        'mb-5.5 grid grid-cols-[56px_1fr] items-center gap-4.5 border-b border-paper-2 pb-5',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-paper-2 text-[20px] font-extrabold text-ink">
        {initial}
      </div>
      <div>
        <div className="mb-1 text-[22px] font-extrabold tracking-[-0.025em] text-ink">
          {name}
        </div>
        <div className="text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
          {meta}
        </div>
      </div>
    </div>
  );
}

export { RecurringCustomerHeader };
export type { RecurringCustomerHeaderProps };
