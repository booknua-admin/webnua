import { cn } from '@/lib/utils';

type StatTone = 'good' | 'warn' | 'bad' | 'neutral';

type MatrixHeroStat = {
  num: React.ReactNode;
  label: string;
  tone?: StatTone;
};

type IntegrationMatrixHeroProps = {
  tag: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  stats: MatrixHeroStat[];
  className?: string;
};

const numToneClass: Record<StatTone, string> = {
  good: '[&_em]:text-good',
  warn: '[&_em]:text-rust',
  bad: '[&_em]:text-warn',
  neutral: '[&_em]:text-paper',
};

function IntegrationMatrixHero({
  tag,
  title,
  subtitle,
  stats,
  className,
}: IntegrationMatrixHeroProps) {
  return (
    <div
      data-slot="integration-matrix-hero"
      className={cn(
        'mb-6 grid items-center gap-6 rounded-3xl bg-ink px-[30px] py-[26px] text-paper',
        'grid-cols-[1fr_repeat(var(--stat-count),auto)]',
        className,
      )}
      style={{ ['--stat-count' as string]: stats.length }}
    >
      <div>
        <span className="mb-2.5 inline-block rounded-full border border-rust/40 bg-rust/[0.15] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-rust-light">
          {tag}
        </span>
        <div className="mb-1.5 text-[28px] font-semibold leading-tight tracking-[-0.02em] [&_em]:not-italic [&_em]:font-medium [&_em]:text-rust">
          {title}
        </div>
        {subtitle ? (
          <p className="max-w-[540px] text-[13px] leading-[1.5] text-paper/65 [&_strong]:font-semibold [&_strong]:text-paper">
            {subtitle}
          </p>
        ) : null}
      </div>

      {stats.map((stat, i) => (
        <div key={i} data-slot="integration-matrix-hero-stat" className="shrink-0 text-center">
          <div
            className={cn(
              'font-mono text-[28px] font-semibold leading-none text-paper [&_em]:not-italic',
              numToneClass[stat.tone ?? 'neutral'],
            )}
          >
            {stat.num}
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/50">
            {`// ${stat.label}`}
          </div>
        </div>
      ))}
    </div>
  );
}

export { IntegrationMatrixHero };
export type { MatrixHeroStat, StatTone };
