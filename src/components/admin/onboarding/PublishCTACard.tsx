import Link from 'next/link';

import { cn } from '@/lib/utils';

type PublishCTACardProps = {
  title: React.ReactNode;
  description: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
  className?: string;
};

function PublishCTACard({
  title,
  description,
  ctaLabel,
  ctaHref,
  className,
}: PublishCTACardProps) {
  return (
    <div
      data-slot="publish-cta-card"
      className={cn(
        'mt-3 grid grid-cols-[1fr_auto] items-center gap-7 rounded-[14px] bg-ink px-10 py-9 text-paper',
        className,
      )}
    >
      <div>
        <div className="mb-2 font-sans text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
          {title}
        </div>
        <div className="max-w-[540px] font-sans text-[15px] leading-[1.45] text-paper/75 [&_strong]:font-bold [&_strong]:text-paper">
          {description}
        </div>
      </div>
      <Link
        href={ctaHref}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[10px] bg-rust px-7 py-4.5 font-sans text-[17px] font-extrabold tracking-[-0.01em] text-paper shadow-glow transition-colors hover:bg-rust-deep"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

export { PublishCTACard };
