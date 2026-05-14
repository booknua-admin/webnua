import { Eyebrow } from '@/components/ui/eyebrow';
import { cn } from '@/lib/utils';

type BuilderStepHeaderProps = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
};

function BuilderStepHeader({
  eyebrow,
  title,
  subtitle,
  className,
}: BuilderStepHeaderProps) {
  return (
    <div
      data-slot="builder-step-header"
      className={cn('mb-7 flex flex-col gap-2.5', className)}
    >
      <Eyebrow tone="rust" bullet className="text-[11px]">
        {eyebrow}
      </Eyebrow>
      <h1 className="text-[40px] leading-[1.04] font-extrabold tracking-[-0.035em] text-ink [&_em]:not-italic [&_em]:text-rust">
        {title}
      </h1>
      {subtitle ? (
        <p className="max-w-[760px] text-[17px] leading-[1.5] font-medium text-ink-quiet [&_strong]:font-bold [&_strong]:text-ink">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export { BuilderStepHeader };
