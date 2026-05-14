import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AutomationInfoBannerProps = {
  children: ReactNode;
  className?: string;
};

function AutomationInfoBanner({
  children,
  className,
}: AutomationInfoBannerProps) {
  return (
    <div
      data-slot="automation-info-banner"
      className={cn(
        'flex items-start gap-3.5 rounded-xl border border-rust/25 bg-rust-soft/55 px-5 py-4',
        className,
      )}
    >
      <div
        aria-hidden
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-rust font-sans text-[12px] font-extrabold leading-none text-paper"
      >
        i
      </div>
      <div className="font-sans text-[13px] leading-[1.55] text-ink [&_strong]:font-bold [&_strong]:text-ink">
        {children}
      </div>
    </div>
  );
}

export { AutomationInfoBanner };
export type { AutomationInfoBannerProps };
