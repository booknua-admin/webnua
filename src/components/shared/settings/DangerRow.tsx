import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DangerRowProps = {
  heading: string;
  description: React.ReactNode;
  action: {
    label: string;
    solid?: boolean;
    /** Neutral = ink-bordered (e.g. export, transfer); destructive = warn-bordered. */
    tone?: 'neutral' | 'destructive';
  };
  className?: string;
};

function DangerRow({ heading, description, action, className }: DangerRowProps) {
  const tone = action.tone ?? 'destructive';
  return (
    <div
      data-slot="danger-row"
      className={cn(
        'mb-3 grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border bg-warn-soft px-[22px] py-4',
        'border-warn',
        className,
      )}
    >
      <div>
        <div className="mb-1 text-[15px] font-extrabold text-warn">{heading}</div>
        <div className="max-w-[480px] text-[13px] leading-[1.45] text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">
          {description}
        </div>
      </div>
      {action.solid ? (
        <Button variant="destructive" size="sm">
          {action.label}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            tone === 'destructive'
              ? 'border-warn text-warn hover:bg-warn hover:text-paper'
              : 'border-ink text-ink hover:bg-ink hover:text-paper',
          )}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { DangerRow };
