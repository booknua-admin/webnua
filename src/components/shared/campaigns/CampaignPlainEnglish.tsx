import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type CampaignPlainEnglishProps = {
  children: ReactNode;
  className?: string;
};

/**
 * "In plain English" rust-soft tinted explainer card. Sits below the metric
 * grid inside the active-campaign hero. ReactNode children — `<em>` renders
 * rust, `<strong>` renders ink-bold.
 */
function CampaignPlainEnglish({
  children,
  className,
}: CampaignPlainEnglishProps) {
  return (
    <div
      data-slot="campaign-plain-english"
      className={cn(
        'grid grid-cols-[32px_1fr] items-start gap-3.5 rounded-[10px] bg-rust-soft px-5.5 py-4',
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rust text-[14px] font-extrabold text-paper">
        i
      </div>
      <p className="text-[14px] leading-[1.55] text-ink [&_em]:not-italic [&_em]:font-bold [&_em]:text-rust [&_strong]:font-bold">
        {children}
      </p>
    </div>
  );
}

export { CampaignPlainEnglish };
export type { CampaignPlainEnglishProps };
