'use client';

import { useMemo, useState } from 'react';
import { Bell } from 'lucide-react';

import {
  useMarkNotificationsRead,
  useNotifications,
} from '@/lib/notifications/queries';
import { cn } from '@/lib/utils';

import { NotificationPanel } from './NotificationPanel';

/**
 * Client notification bell + feed popover (client Screen 10).
 *
 * Wired to live data (Phase 3): the feed reads `notifications` and read-state
 * is the `notification_reads` join. Marking read persists via
 * `useMarkNotificationsRead`; `readIds` is kept as an optimistic overlay for
 * instant feedback ahead of the query invalidation.
 */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const { data: items = [] } = useNotifications();
  const markReadMutation = useMarkNotificationsRead();

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read && !readIds.has(item.id)).length,
    [items, readIds],
  );

  const markRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    markReadMutation.mutate([id]);
  };

  const markAllRead = () => {
    const unreadIds = items
      .filter((item) => !item.read && !readIds.has(item.id))
      .map((item) => item.id);
    setReadIds(new Set(items.map((item) => item.id)));
    if (unreadIds.length > 0) markReadMutation.mutate(unreadIds);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        className={cn(
          'relative flex size-9 items-center justify-center rounded-full text-sm transition-colors',
          open ? 'bg-ink text-paper' : 'bg-paper-2 text-ink hover:bg-paper-3',
        )}
      >
        <Bell aria-hidden className="size-4" strokeWidth={2} />
        {unreadCount > 0 ? (
          <span
            className={cn(
              'absolute right-2 top-1.5 size-2 rounded-full bg-rust',
              open ? 'border-2 border-ink' : 'border-2 border-paper-2',
            )}
          />
        ) : null}
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[420px]">
            <NotificationPanel
              items={items}
              readIds={readIds}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export { NotificationBell };
