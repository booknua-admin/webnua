import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { FunnelAggCard } from '@/components/client/funnels/FunnelAggCard';
import { cn } from '@/lib/utils';
import type {
  FunnelAggBottom,
  FunnelAggMetric,
  FunnelHeroMeta,
} from '@/lib/funnels/types';

type FunnelHeroProps = {
  back: { label: string; href: string };
  tag: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: FunnelHeroMeta[];
  versionLabel?: string;
  actions: {
    viewLiveLabel: string;
    viewLiveHref: string;
    requestChangeLabel: string;
    requestChangeHref: string;
    /** Session 7 — operator-facing "Edit funnel →" CTA. Caller decides
     *  whether to show it (cap-gated upstream); when omitted the third
     *  button is suppressed. */
    editFunnelLabel?: string;
    editFunnelHref?: string;
  };
  agg: {
    label: string;
    live?: boolean;
    metrics: [FunnelAggMetric, FunnelAggMetric];
    bottom?: FunnelAggBottom;
  };
  className?: string;
};

function FunnelHero({
  back,
  tag,
  title,
  subtitle,
  meta,
  versionLabel,
  actions,
  agg,
  className,
}: FunnelHeroProps) {
  return (
    <div
      data-slot="funnel-hero"
      className={cn(
        'relative overflow-hidden rounded-2xl bg-ink px-[30px] py-7 text-paper',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[40%] -right-[8%] size-[380px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(232, 116, 59, 0.16) 0%, transparent 70%)',
        }}
      />

      <div className="relative grid grid-cols-[1.4fr_1fr] gap-8">
        <div>
          <Link
            href={back.href}
            className="mb-2.5 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/50 transition-colors hover:text-paper"
          >
            ← {back.label}
          </Link>

          <span className="mb-3 inline-flex items-center gap-2 rounded-pill bg-rust/[0.18] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust-light">
            <span aria-hidden className="text-[9px]">
              🔒
            </span>
            {tag}
          </span>

          <h1 className="mb-2.5 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
            {title}
          </h1>

          {subtitle ? (
            <p className="mb-4 max-w-[480px] text-[13px] leading-[1.55] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
              {subtitle}
            </p>
          ) : null}

          {meta || versionLabel ? (
            <div className="flex flex-wrap items-center gap-5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-paper/55">
              {meta?.map((row) => (
                <span key={row.label}>
                  {row.label.toUpperCase()}{' '}
                  <strong className="font-bold text-paper">{row.value}</strong>
                </span>
              ))}
              {versionLabel ? (
                <span className="rounded-pill bg-rust/15 px-2 py-0.5 text-rust-light">
                  {versionLabel.toUpperCase()}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm" className="border border-paper/15 bg-paper/[0.08] text-paper hover:bg-paper/15 hover:text-paper">
              <a
                href={actions.viewLiveHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {actions.viewLiveLabel}
              </a>
            </Button>
            <Button asChild size="sm" className="shadow-glow">
              <Link href={actions.requestChangeHref}>
                {actions.requestChangeLabel}
              </Link>
            </Button>
            {actions.editFunnelLabel && actions.editFunnelHref ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="border border-rust-light/40 bg-rust/[0.18] text-rust-light hover:bg-rust/30 hover:text-paper"
              >
                <Link href={actions.editFunnelHref}>
                  {actions.editFunnelLabel}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <FunnelAggCard
          label={agg.label}
          live={agg.live}
          metrics={agg.metrics}
          bottom={agg.bottom}
        />
      </div>
    </div>
  );
}

export { FunnelHero };
export type { FunnelHeroProps };
