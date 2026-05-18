import Link from 'next/link';

import type { NotificationItem, NotificationKind } from '@/lib/notifications/types';
import { cn } from '@/lib/utils';

type NotificationItemRowProps = {
  item: NotificationItem;
  read: boolean;
  onMarkRead: (id: string) => void;
};

const KIND_ICON: Record<NotificationKind, { glyph: string; tint: string }> = {
  lead: { glyph: '✉', tint: 'bg-rust-soft text-rust' },
  review: { glyph: '★', tint: 'bg-amber/15 text-amber' },
  auto: { glyph: '⤿', tint: 'bg-info-soft text-info' },
  booking: { glyph: '▤', tint: 'bg-good-soft text-good' },
  alert: { glyph: '!', tint: 'bg-warn-soft text-warn' },
};

function NotificationItemRow({ item, read, onMarkRead }: NotificationItemRowProps) {
  const icon = KIND_ICON[item.kind];

  return (
    <div
      className={cn(
        'relative grid grid-cols-[36px_1fr_70px] items-start gap-3.5 border-b border-paper-2 px-5.5 py-3.5 last:border-b-0',
        read ? 'hover:bg-paper' : 'bg-rust-soft',
      )}
    >
      {!read ? (
        <span className="absolute left-2 top-[22px] size-1.5 rounded-full bg-rust" />
      ) : null}

      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-full font-mono text-sm font-bold',
          icon.tint,
        )}
        aria-hidden
      >
        {icon.glyph}
      </span>

      <div className="min-w-0">
        <p className="text-[13px] leading-[1.4] text-ink [&_strong]:font-bold">
          {item.title}
        </p>
        {item.actions.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {item.actions.map((action) => {
              const chipClass = cn(
                'font-mono text-[10px] font-bold uppercase tracking-[0.06em]',
                action.secondary
                  ? 'text-ink-quiet hover:text-ink'
                  : 'text-rust hover:text-rust-deep',
              );

              if (action.label === 'Mark read') {
                return (
                  <button
                    key={action.label}
                    type="button"
                    className={chipClass}
                    onClick={() => onMarkRead(item.id)}
                  >
                    {action.label}
                  </button>
                );
              }

              if (action.href) {
                return (
                  <Link key={action.label} href={action.href} className={chipClass}>
                    {action.label}
                  </Link>
                );
              }

              return (
                <button key={action.label} type="button" className={chipClass}>
                  {action.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <span className="pt-1 text-right font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-quiet">
        {item.time}
      </span>
    </div>
  );
}

export { NotificationItemRow };
