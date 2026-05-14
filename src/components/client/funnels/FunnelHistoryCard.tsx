import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FunnelVersion } from '@/lib/funnels/types';

type FunnelHistoryCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  items: FunnelVersion[];
  ctaLabel: string;
  ctaHref: string;
  className?: string;
};

function FunnelHistoryCard({
  title,
  subtitle,
  items,
  ctaLabel,
  ctaHref,
  className,
}: FunnelHistoryCardProps) {
  return (
    <div
      data-slot="funnel-history-card"
      className={cn(
        'relative overflow-hidden rounded-[14px] bg-ink px-6 py-5 text-paper',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 size-[220px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(232, 116, 59, 0.13) 0%, transparent 70%)',
        }}
      />
      <div className="relative">
        <h3 className="mb-1 text-[15px] font-extrabold tracking-[-0.015em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
          {title}
        </h3>
        {subtitle ? (
          <p className="mb-4 text-[12px] leading-[1.45] text-paper/60">
            {subtitle}
          </p>
        ) : null}

        <div>
          {items.map((item) => (
            <FunnelHistoryItem key={item.id} item={item} />
          ))}
        </div>

        <Button asChild className="mt-3.5 w-full shadow-glow">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

type FunnelHistoryItemProps = {
  item: FunnelVersion;
};

function FunnelHistoryItem({ item }: FunnelHistoryItemProps) {
  return (
    <div
      data-slot="funnel-history-item"
      className="grid grid-cols-[38px_1fr_auto] items-center gap-3 border-b border-dotted border-paper/10 py-2.5 last:border-b-0"
    >
      <span
        className={cn(
          'rounded-md py-1 text-center font-mono text-[10px] font-extrabold uppercase tracking-[0.06em]',
          item.current
            ? 'bg-rust text-paper'
            : 'bg-rust/[0.18] text-rust-light',
        )}
      >
        {item.label}
      </span>
      <div>
        <div className="text-[12.5px] leading-[1.4] text-paper">
          {item.body}
        </div>
        <div className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-paper/50">
          {item.meta}
        </div>
      </div>
      <span className="whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-paper/50">
        {item.when}
      </span>
    </div>
  );
}

export { FunnelHistoryCard, FunnelHistoryItem };
export type { FunnelHistoryCardProps, FunnelHistoryItemProps };
