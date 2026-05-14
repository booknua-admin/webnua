import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';

type ContinueSetupHeroProps = {
  tag: string;
  title: React.ReactNode;
  description: string;
  meta: React.ReactNode[];
  ctaLabel: string;
  ctaHref: string;
};

function ContinueSetupHero({
  tag,
  title,
  description,
  meta,
  ctaLabel,
  ctaHref,
}: ContinueSetupHeroProps) {
  return (
    <div
      data-slot="continue-setup-hero"
      className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-3xl border border-rule bg-card px-10 py-9"
    >
      <div className="flex flex-col gap-2.5">
        <Eyebrow tone="rust" className="text-[11px]">
          {tag}
        </Eyebrow>
        <h2 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink [&_em]:not-italic [&_em]:text-rust">
          {title}
        </h2>
        <p className="max-w-[540px] text-[15px] leading-[1.5] text-ink-quiet">
          {description}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] tracking-[0.06em] text-ink-quiet [&_strong]:font-bold [&_strong]:text-ink">
          {meta.map((segment, idx) => (
            <span key={idx} className="flex items-center gap-4">
              {idx > 0 ? <span className="text-rule">·</span> : null}
              <span>{segment}</span>
            </span>
          ))}
        </div>
      </div>
      <Button asChild size="lg">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}

export { ContinueSetupHero };
