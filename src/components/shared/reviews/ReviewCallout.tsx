import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ReviewCalloutProps = {
  /** ReactNode — `<em>` renders rust-light on ink. */
  headline: ReactNode;
  sub: string;
  link: { label: string; href: string };
  className?: string;
};

function ReviewCallout({ headline, sub, link, className }: ReviewCalloutProps) {
  return (
    <div
      data-slot="review-callout"
      className={cn(
        'rounded-[10px] bg-ink px-5.5 py-4.5 text-left text-paper',
        className,
      )}
    >
      <div className="mb-1 text-[14px] font-extrabold leading-tight text-paper [&_em]:not-italic [&_em]:text-rust-light">
        {headline}
      </div>
      <p className="mb-2.5 text-[12px] leading-[1.4] text-paper/65">{sub}</p>
      <Link
        href={link.href}
        className="inline-flex font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-rust-light hover:text-paper"
      >
        {link.label}
      </Link>
    </div>
  );
}

export { ReviewCallout };
export type { ReviewCalloutProps };
