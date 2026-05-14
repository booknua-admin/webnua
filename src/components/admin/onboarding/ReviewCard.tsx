import Link from 'next/link';

import { cn } from '@/lib/utils';

type ReviewCardProps = {
  heading: string;
  editHref: string;
  details: { label: string; value: React.ReactNode }[];
  className?: string;
  children?: React.ReactNode;
};

function ReviewCard({
  heading,
  editHref,
  details,
  children,
  className,
}: ReviewCardProps) {
  return (
    <div
      data-slot="review-card"
      className={cn(
        'rounded-[10px] border border-rule bg-card px-6 py-5.5',
        className,
      )}
    >
      <div className="mb-3.5 flex items-center justify-between border-b border-paper-2 pb-3.5">
        <div className="font-sans text-[16px] font-extrabold tracking-[-0.02em] text-ink">
          {heading}
        </div>
        <Link
          href={editHref}
          className="font-sans text-[12px] font-bold text-rust hover:underline"
        >
          Edit ✎
        </Link>
      </div>
      {details.map((d, idx) => (
        <div key={idx} data-slot="review-detail" className="mb-2.5 last:mb-0">
          <div className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {d.label}
          </div>
          <div className="font-sans text-[14px] font-semibold text-ink [&_em]:font-bold [&_em]:not-italic [&_em]:text-rust">
            {d.value}
          </div>
        </div>
      ))}
      {children}
    </div>
  );
}

export { ReviewCard };
