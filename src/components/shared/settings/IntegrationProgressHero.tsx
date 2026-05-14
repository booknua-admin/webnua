import { cn } from '@/lib/utils';

type IntegrationProgressHeroProps = {
  tag: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  connected: number;
  total: number;
  remainingLabel?: React.ReactNode;
  className?: string;
};

function IntegrationProgressHero({
  tag,
  title,
  subtitle,
  connected,
  total,
  remainingLabel,
  className,
}: IntegrationProgressHeroProps) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.round((connected / safeTotal) * 100);

  return (
    <div
      data-slot="integration-progress-hero"
      className={cn('mb-6 rounded-2xl bg-ink px-7 py-6 text-paper', className)}
    >
      <span
        data-slot="integration-progress-hero-tag"
        className="mb-2.5 inline-block rounded-full border border-rust/40 bg-rust/[0.18] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-rust-light"
      >
        {tag}
      </span>
      <div className="mb-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] [&_em]:not-italic [&_em]:font-medium [&_em]:text-rust">
        {title}
      </div>
      {subtitle ? (
        <p className="max-w-[640px] text-[14px] leading-[1.55] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
          {subtitle}
        </p>
      ) : null}

      <div
        data-slot="integration-progress-hero-progress"
        className="mt-3.5 flex items-center gap-3.5 border-t border-paper/10 pt-3.5"
      >
        <div className="font-mono text-[32px] font-semibold leading-none">
          <em className="not-italic text-rust">{connected}</em>
          <span className="opacity-40">/{total}</span>
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rust to-rust-light"
            style={{ width: `${pct}%` }}
          />
        </div>
        {remainingLabel ? (
          <div className="text-[12px] leading-[1.5] text-paper/60 [&_strong]:text-paper">
            {remainingLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { IntegrationProgressHero };
