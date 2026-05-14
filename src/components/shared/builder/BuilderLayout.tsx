import { cn } from '@/lib/utils';

type BuilderLayoutProps = {
  form: React.ReactNode;
  preview?: React.ReactNode;
  className?: string;
};

function BuilderLayout({ form, preview, className }: BuilderLayoutProps) {
  if (!preview) {
    return (
      <div data-slot="builder-layout" className={cn('w-full', className)}>
        {form}
      </div>
    );
  }

  return (
    <div
      data-slot="builder-layout"
      className={cn(
        'grid grid-cols-[480px_1fr] items-start gap-8',
        className,
      )}
    >
      <div
        data-slot="builder-form-panel"
        className="rounded-xl border border-rule bg-card p-7"
      >
        {form}
      </div>
      <div
        data-slot="builder-preview-panel"
        className="sticky top-[88px] overflow-hidden rounded-xl border border-rule bg-card"
      >
        {preview}
      </div>
    </div>
  );
}

export { BuilderLayout };
