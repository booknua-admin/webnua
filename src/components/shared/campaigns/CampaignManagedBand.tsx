import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { CampaignManagedBandData } from '@/lib/campaigns/types';

type CampaignManagedBandProps = {
  data: CampaignManagedBandData;
  className?: string;
};

/**
 * Top ink-bg reassurance band on client `/campaigns`. Standalone — distinct
 * from `AutomationInfoBanner` (rust-soft info chip) and from `BillingPlanCard`
 * (plan-meta + headline). If a second ink-bg "managed by your operator" band
 * lands elsewhere on the client side, revisit extraction.
 */
function CampaignManagedBand({ data, className }: CampaignManagedBandProps) {
  return (
    <div
      data-slot="campaign-managed-band"
      className={cn(
        'grid grid-cols-[56px_1fr_auto] items-center gap-5 rounded-[14px] bg-ink px-7 py-5.5 text-paper',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-rust/15 text-[26px] font-extrabold text-rust-light">
        {data.icon}
      </div>
      <div className="min-w-0">
        <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust-light">
          {data.tag}
        </div>
        <div className="mb-1.5 text-[20px] font-extrabold leading-[1.2] tracking-[-0.02em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
          {data.title}
        </div>
        <p className="max-w-[540px] text-[13px] leading-[1.5] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
          {data.sub}
        </p>
      </div>
      <Link
        href={data.cta.href}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-paper/15 bg-paper/[0.08] px-4.5 py-2.5 text-[13px] font-bold text-paper transition-colors hover:bg-paper/15"
      >
        {data.cta.label}
      </Link>
    </div>
  );
}

export { CampaignManagedBand };
export type { CampaignManagedBandProps };
