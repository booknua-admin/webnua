import { cn } from '@/lib/utils';

type NotificationChannel = 'sms' | 'email' | 'push';

type NotificationRowProps = {
  label: string;
  sub?: string;
  channels: NotificationChannel[];
  active: NotificationChannel[];
  className?: string;
};

const channelLabel: Record<NotificationChannel, string> = {
  sms: 'SMS',
  email: 'Email',
  push: 'Push',
};

function NotificationRow({ label, sub, channels, active, className }: NotificationRowProps) {
  return (
    <div
      data-slot="notification-row"
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-6 border-b border-dotted border-rule-soft py-3 last:border-b-0',
        className,
      )}
    >
      <div className="text-[13px] font-semibold text-ink">
        {label}
        {sub ? (
          <span className="mt-0.5 block text-[11px] font-medium text-ink-quiet">{sub}</span>
        ) : null}
      </div>
      <div className="flex gap-4 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
        {channels.map((ch) => {
          const on = active.includes(ch);
          return (
            <span
              key={ch}
              data-slot="notification-channel"
              data-on={on || undefined}
              className={cn(
                'flex items-center gap-1.5 cursor-pointer',
                on ? 'text-good' : 'text-ink-quiet',
              )}
            >
              <span
                aria-hidden
                className={cn('h-2 w-2 rounded-full', on ? 'bg-good' : 'bg-rule')}
              />
              {channelLabel[ch]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export { NotificationRow };
export type { NotificationChannel };
