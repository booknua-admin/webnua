import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type TicketsHeroProps = {
  tag: string;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
};

function TicketsHero({
  tag,
  title,
  subtitle,
  right,
  className,
}: TicketsHeroProps) {
  return (
    <div
      data-slot="tickets-hero"
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-6 rounded-2xl bg-ink px-7 py-6 text-paper',
        className,
      )}
    >
      <div>
        <span
          data-slot="tickets-hero-tag"
          className="mb-2.5 inline-block rounded-full border border-rust/40 bg-rust/[0.18] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-rust-light"
        >
          {tag}
        </span>
        <h1 className="mb-2 text-[30px] font-semibold leading-tight tracking-[-0.02em] [&_em]:not-italic [&_em]:font-medium [&_em]:text-rust">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-[540px] text-[14px] leading-[1.5] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
            {subtitle}
          </p>
        ) : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-5">{right}</div> : null}
    </div>
  );
}

type TicketsHeroStatProps = {
  num: ReactNode;
  label: string;
  tone?: 'warn' | 'rust' | 'neutral';
};

function TicketsHeroStat({ num, label, tone = 'neutral' }: TicketsHeroStatProps) {
  return (
    <div data-slot="tickets-hero-stat" className="text-right">
      <div
        className={cn(
          'font-mono text-[28px] font-semibold leading-none [&_em]:not-italic',
          tone === 'warn' && '[&_em]:text-warn',
          tone === 'rust' && '[&_em]:text-rust-light',
          tone === 'neutral' && '[&_em]:text-rust-light',
        )}
      >
        {num}
      </div>
      <div className="mt-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-paper/55">
        {label}
      </div>
    </div>
  );
}

export { TicketsHero, TicketsHeroStat };
export type { TicketsHeroProps, TicketsHeroStatProps };
