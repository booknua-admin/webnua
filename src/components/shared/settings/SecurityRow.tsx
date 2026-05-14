import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SecurityRowStatus = { tone: 'verified'; label?: string } | { tone: 'warn'; label: string };

type SecurityRowProps = {
  heading: string;
  status?: SecurityRowStatus;
  description: React.ReactNode;
  action: {
    label: string;
    variant?: 'default' | 'outline';
  };
  className?: string;
};

function SecurityRow({ heading, status, description, action, className }: SecurityRowProps) {
  return (
    <div
      data-slot="security-row"
      className={cn(
        'mb-3 grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border border-rule bg-paper px-5 py-4',
        className,
      )}
    >
      <div>
        <div className="mb-1 flex items-center gap-2.5 text-[15px] font-bold text-ink">
          {heading}
          {status ? (
            <span
              data-slot="security-row-status"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
                status.tone === 'verified' ? 'bg-good-soft text-good' : 'bg-rust-soft text-rust',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'h-1 w-1 rounded-full',
                  status.tone === 'verified' ? 'bg-good' : 'bg-rust',
                )}
              />
              {status.label ?? (status.tone === 'verified' ? 'Verified' : 'Recommended')}
            </span>
          ) : null}
        </div>
        <div className="text-[13px] leading-[1.5] text-ink-quiet">{description}</div>
      </div>
      <Button variant={action.variant ?? 'outline'} size="sm">
        {action.label}
      </Button>
    </div>
  );
}

export { SecurityRow };
export type { SecurityRowStatus };
