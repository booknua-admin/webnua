import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ActionItem = {
  id: string;
  clientInitial: string;
  clientTone?: string; // tailwind bg class fallback, e.g. 'bg-rust'
  text: React.ReactNode;
  cta: string;
};

type IntegrationMatrixActionCardProps = {
  heading: string;
  badge: { label: string; tone: 'warn' | 'info' };
  description: React.ReactNode;
  items: ActionItem[];
  tone?: 'neutral' | 'attention';
  className?: string;
};

function IntegrationMatrixActionCard({
  heading,
  badge,
  description,
  items,
  tone = 'neutral',
  className,
}: IntegrationMatrixActionCardProps) {
  return (
    <div
      data-slot="integration-matrix-action-card"
      data-tone={tone}
      className={cn(
        'rounded-xl border bg-paper px-[22px] py-5',
        tone === 'attention'
          ? 'border-warn/30 bg-gradient-to-r from-warn/[0.04] from-0% to-paper to-40%'
          : 'border-ink/[0.08]',
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-ink">
        {heading}
        <span
          className={cn(
            'rounded-full px-[7px] py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-paper',
            badge.tone === 'warn' ? 'bg-warn' : 'bg-rust',
          )}
        >
          {badge.label}
        </span>
      </div>
      <p className="mb-3.5 text-[12px] leading-[1.5] text-ink/55 [&_strong]:text-ink">
        {description}
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg bg-paper-2 px-3 py-2.5 text-[13px]"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-paper',
                  item.clientTone ?? 'bg-ink',
                )}
              >
                {item.clientInitial}
              </span>
              <span className="text-ink [&_em]:not-italic [&_em]:text-ink/55">{item.text}</span>
            </div>
            <Button variant="outline" size="sm">
              {item.cta}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export { IntegrationMatrixActionCard };
export type { ActionItem };
