'use client';

import { useMemo, useState } from 'react';

import { voltlineNotifications } from '@/lib/notifications/client-feed';
import { cn } from '@/lib/utils';

import { NotificationPanel } from './NotificationPanel';

/**
 * Client notification bell + feed popover (client Screen 10).
 *
 * Read-state is session-local React state — there is no backend yet, so marking
 * a notification read does not persist across reloads. Wire to a real store
 * when notifications move to Supabase.
 */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const items = voltlineNotifications;

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read && !readIds.has(item.id)).length,
    [items, readIds],
  );

  const markRead = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  const markAllRead = () => {
    setReadIds(new Set(items.map((item) => item.id)));
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
        {/* U+FE0E forces text presentation — a monochrome glyph that
            inherits the button's text colour, matching the sidebar icons. */}
        <span aria-hidden className="text-base leading-none">
          {'\u{1F514}\u{FE0E}'}
        </span>
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
