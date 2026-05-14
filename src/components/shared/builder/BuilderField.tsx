import { cn } from '@/lib/utils';

type BuilderFieldProps = {
  label: React.ReactNode;
  /** Optional small hint shown right-aligned on the same line as the label. */
  hint?: React.ReactNode;
  /** Input element. Pass `<BuilderInput .../>` or `<BuilderTextarea .../>`. */
  children: React.ReactNode;
  /** Helper text shown below the input. */
  helper?: React.ReactNode;
  className?: string;
};

function BuilderField({
  label,
  hint,
  children,
  helper,
  className,
}: BuilderFieldProps) {
  return (
    <div data-slot="builder-field" className={cn('mb-3.5', className)}>
      <label
        data-slot="builder-field-label"
        className={cn(
          'mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet',
          hint && 'flex items-baseline justify-between',
        )}
      >
        <span className="inline-flex items-center gap-1.5">{label}</span>
        {hint ? (
          <span className="font-semibold text-rule">{hint}</span>
        ) : null}
      </label>
      {children}
      {helper ? (
        <div
          data-slot="builder-field-helper"
          className="mt-[-2px] mb-3.5 text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink"
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

type BuilderInputProps = React.ComponentProps<'input'> & {
  variant?: 'default' | 'ai';
};

function BuilderInput({
  className,
  variant = 'default',
  ...props
}: BuilderInputProps) {
  return (
    <input
      data-slot="builder-input"
      className={cn(
        'block w-full rounded-[7px] border bg-card px-3.5 py-[11px] font-sans text-[14px] text-ink transition-colors focus:border-rust focus:outline-none focus:ring-[3px] focus:ring-rust/12',
        variant === 'ai'
          ? 'border-rust bg-rust-soft/60 font-medium'
          : 'border-rule',
        className,
      )}
      {...props}
    />
  );
}

type BuilderTextareaProps = React.ComponentProps<'textarea'> & {
  variant?: 'default' | 'ai';
};

function BuilderTextarea({
  className,
  variant = 'default',
  rows = 3,
  ...props
}: BuilderTextareaProps) {
  return (
    <textarea
      rows={rows}
      data-slot="builder-textarea"
      className={cn(
        'block w-full resize-none rounded-[7px] border bg-card px-3.5 py-[11px] font-sans text-[14px] leading-[1.45] text-ink transition-colors focus:border-rust focus:outline-none focus:ring-[3px] focus:ring-rust/12',
        variant === 'ai'
          ? 'border-rust bg-rust-soft/60 font-medium'
          : 'border-rule',
        className,
      )}
      {...props}
    />
  );
}

type BuilderFormSectionProps = {
  children: React.ReactNode;
  className?: string;
};

function BuilderFormSection({ children, className }: BuilderFormSectionProps) {
  return (
    <div
      data-slot="builder-form-section"
      className={cn(
        'mb-5 border-b border-paper-2 pb-5 last:mb-0 last:border-b-0 last:pb-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

type BuilderFormRowProps = {
  children: React.ReactNode;
  className?: string;
};

function BuilderFormRow({ children, className }: BuilderFormRowProps) {
  return (
    <div
      data-slot="builder-form-row"
      className={cn('grid grid-cols-2 gap-3', className)}
    >
      {children}
    </div>
  );
}

export {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
  BuilderInput,
  BuilderTextarea,
};
