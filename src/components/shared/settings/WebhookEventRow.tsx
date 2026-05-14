import { cn } from '@/lib/utils';

type WebhookEventRowProps = {
  time: string;
  event: string;
  status: 'ok' | 'failed';
  statusLabel?: string;
  className?: string;
};

function WebhookEventRow({ time, event, status, statusLabel, className }: WebhookEventRowProps) {
  return (
    <div
      data-slot="webhook-event-row"
      className={cn(
        'grid grid-cols-[130px_1fr_90px] items-center gap-3 rounded-lg border border-rule bg-card px-3.5 py-2.5 font-mono text-[11px] text-ink',
        className,
      )}
    >
      <span className="text-ink-quiet">{time}</span>
      <span className="font-bold text-rust">{event}</span>
      <span
        className={cn(
          'text-right text-[10px] font-bold uppercase tracking-[0.08em]',
          status === 'ok' ? 'text-good' : 'text-warn',
        )}
      >
        {statusLabel ?? (status === 'ok' ? '✓ 200 OK' : '✗ Failed')}
      </span>
    </div>
  );
}

export { WebhookEventRow };
