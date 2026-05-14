import { cn } from '@/lib/utils';

type BillingPlanCardProps = {
  tag: string;
  name: React.ReactNode;
  meta: React.ReactNode;
  action: React.ReactNode;
  className?: string;
};

function BillingPlanCard({ tag, name, meta, action, className }: BillingPlanCardProps) {
  return (
    <div
      data-slot="billing-plan-card"
      className={cn(
        'mb-2 grid grid-cols-[1fr_auto] items-center gap-6 rounded-xl bg-ink px-7 py-6 text-paper',
        className,
      )}
    >
      <div>
        <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust-light">
          {tag}
        </div>
        <div className="mb-1.5 text-[26px] font-extrabold leading-[1.05] tracking-[-0.03em] [&_em]:not-italic [&_em]:text-rust-light">
          {name}
        </div>
        <div className="text-[13px] leading-[1.5] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
          {meta}
        </div>
      </div>
      {action}
    </div>
  );
}

export { BillingPlanCard };
