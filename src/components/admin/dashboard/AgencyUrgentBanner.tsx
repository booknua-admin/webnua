import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type AgencyUrgentBannerProps = {
  tag: string;
  title: ReactNode;
  description: ReactNode;
  cta: { label: string; href: string };
};

/**
 * The ink alert band atop the agency dashboard — surfaces the single most
 * pressing cross-client signal (a low review, a rush ticket). Rendered only
 * when there is something that genuinely needs the operator now.
 */
function AgencyUrgentBanner({
  tag,
  title,
  description,
  cta,
}: AgencyUrgentBannerProps) {
  return (
    <div className="flex items-center gap-6 rounded-2xl border-l-[3px] border-rust bg-ink px-8 py-7">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-rust-soft text-[26px] font-extrabold text-rust">
        !
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light">
          {tag}
        </div>
        <h2 className="mt-1.5 text-[22px] font-extrabold tracking-[-0.02em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-[1.6] text-paper/65 [&_strong]:font-semibold [&_strong]:text-paper">
          {description}
        </p>
      </div>
      <Button asChild className="shrink-0">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}

export { AgencyUrgentBanner };
