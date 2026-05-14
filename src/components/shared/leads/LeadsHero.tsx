import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type LeadsHeroProps = {
  tag: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
};

function LeadsHero({
  tag,
  title,
  subtitle,
  right,
  className,
}: LeadsHeroProps) {
  return (
    <div
      data-slot="leads-hero"
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-6 rounded-2xl bg-ink px-7 py-6 text-paper',
        className,
      )}
    >
      <div>
        <span
          data-slot="leads-hero-tag"
          className="mb-2.5 inline-block rounded-full border border-rust/40 bg-rust/[0.18] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-rust-light"
        >
          {tag}
        </span>
        <h1 className="mb-2 text-[30px] font-semibold leading-tight tracking-[-0.02em] [&_em]:not-italic [&_em]:font-medium [&_em]:text-rust">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-[600px] text-[14px] leading-[1.5] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? (
        <div className="flex shrink-0 items-center gap-3">{right}</div>
      ) : null}
    </div>
  );
}

export { LeadsHero };
export type { LeadsHeroProps };
