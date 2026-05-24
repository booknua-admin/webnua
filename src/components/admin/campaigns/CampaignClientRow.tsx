import { CampaignSparkline } from '@/components/shared/campaigns/CampaignSparkline';
import { cn } from '@/lib/utils';
import type { AdminCampaignRow } from '@/lib/campaigns/types';

import { CampaignStatusPill } from './CampaignStatusPill';

type CampaignClientRowProps = {
  row: AdminCampaignRow;
  className?: string;
};

/**
 * Admin-only cross-client campaign row on `/campaigns`. 7-column grid:
 * 36px logo + name+meta + 110px status + 100px spend + 110px CPL + 100px
 * ROAS + 100px sparkline. The 3 mid metric cells are driven by
 * `row.cells[0..2]`. Dimmed state used for pre-launch entries.
 */
function CampaignClientRow({ row, className }: CampaignClientRowProps) {
  return (
    <div
      data-slot="campaign-client-row"
      className={cn(
        'rounded-[10px] border border-rule bg-card',
        row.dimmed && 'opacity-50',
        className,
      )}
    >
      {/* Mobile — stacked card */}
      <div className="flex flex-col gap-3 p-4 md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-[14px] font-extrabold text-rust-light">
            {row.logoInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-ink">{row.name}</div>
            <div className="line-clamp-2 text-[12px] leading-[1.3] text-ink-quiet [&_strong]:text-ink-soft">
              {row.meta}
            </div>
          </div>
          <CampaignStatusPill status={row.status} label={row.statusLabel} />
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-rule pt-3">
          {row.cells.map((cell, i) => (
            <div
              key={i}
              className="text-[14px] font-extrabold tracking-[-0.02em] text-ink"
            >
              {cell.value}
              <span className="mt-0.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-quiet">
                {cell.sub}
              </span>
            </div>
          ))}
        </div>
        <CampaignSparkline points={row.sparkPoints} />
      </div>
      {/* Desktop — original 7-col grid */}
      <div className="hidden items-center gap-4.5 px-5.5 py-4 md:grid md:grid-cols-[36px_1.4fr_110px_100px_110px_100px_100px]">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-[14px] font-extrabold text-rust-light">
          {row.logoInitial}
        </div>
        <div className="min-w-0">
          <div className="mb-0.5 text-[15px] font-bold text-ink">{row.name}</div>
          <div className="text-[12px] leading-[1.3] text-ink-quiet [&_strong]:text-ink-soft">
            {row.meta}
          </div>
        </div>
        <div>
          <CampaignStatusPill status={row.status} label={row.statusLabel} />
        </div>
        {row.cells.map((cell, i) => (
          <div
            key={i}
            className="text-[15px] font-extrabold tracking-[-0.02em] text-ink"
          >
            {cell.value}
            <span className="mt-0.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-quiet">
              {cell.sub}
            </span>
          </div>
        ))}
        <CampaignSparkline points={row.sparkPoints} />
      </div>
    </div>
  );
}

export { CampaignClientRow };
export type { CampaignClientRowProps };
