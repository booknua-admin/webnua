import { cn } from '@/lib/utils';

type NextStepCardProps = {
  num: string;
  title: string;
  description: string;
  className?: string;
};

function NextStepCard({ num, title, description, className }: NextStepCardProps) {
  return (
    <div
      data-slot="next-step-card"
      className={cn(
        'rounded-[10px] border border-rule bg-paper p-4.5',
        className,
      )}
    >
      <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
        {num}
      </div>
      <div className="mb-1.5 font-sans text-[15px] font-bold tracking-[-0.015em] text-ink">
        {title}
      </div>
      <div className="font-sans text-[13px] leading-[1.45] text-ink-quiet">
        {description}
      </div>
    </div>
  );
}

export { NextStepCard };
