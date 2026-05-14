import { cn } from '@/lib/utils';

type SettingsSectionProps = {
  heading?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function SettingsSection({ heading, description, children, className }: SettingsSectionProps) {
  return (
    <section
      data-slot="settings-section"
      className={cn(
        'border-b border-paper-2 pb-7 mb-7 last:mb-0 last:border-b-0 last:pb-0',
        className,
      )}
    >
      {heading ? (
        <h2
          data-slot="settings-section-heading"
          className="mb-1 text-[17px] font-extrabold tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust [&_em]:font-extrabold"
        >
          {heading}
        </h2>
      ) : null}
      {description ? (
        <p
          data-slot="settings-section-desc"
          className="mb-4 text-[13px] leading-[1.45] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink"
        >
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}

export { SettingsSection };
