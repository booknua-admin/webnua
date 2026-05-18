'use client';

import { useState } from 'react';
import Link from 'next/link';

import type { NotificationItem, NotificationTabId } from '@/lib/notifications/types';
import { cn } from '@/lib/utils';

import { NotificationItemRow } from './NotificationItemRow';

type NotificationPanelProps = {
  items: NotificationItem[];
  /** Live read-state — ids the user has marked read this session. */
  readIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
};

const TABS: { id: NotificationTabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'lead', label: 'Leads' },
  { id: 'booking', label: 'Bookings' },
  { id: 'review', label: 'Reviews' },
];

function NotificationPanel({
  items,
  readIds,
  onMarkRead,
  onMarkAllRead,
}: NotificationPanelProps) {
  const [activeTab, setActiveTab] = useState<NotificationTabId>('all');

  const isRead = (item: NotificationItem) => item.read || readIds.has(item.id);
  const unreadCount = items.filter((item) => !isRead(item)).length;

  const visible = items.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !isRead(item);
    return item.kind === activeTab;
  });

  return (
    <div className="overflow-hidden rounded-[14px] border border-rule bg-card shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
      <div className="flex items-center justify-between bg-ink px-5.5 py-4">
        <p className="text-base font-extrabold tracking-[-0.02em] text-paper">
          Notifications
        </p>
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em]">
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="text-rust-light enabled:hover:text-rust disabled:text-paper/30"
          >
            Mark all read
          </button>
          <span className="text-paper/40">·</span>
          <Link
            href="/settings/notifications"
            className="text-rust-light hover:text-rust"
            aria-label="Notification settings"
          >
            ⚙
          </Link>
        </div>
      </div>

      <div className="flex border-b border-paper-2 bg-paper px-5.5">
        {TABS.map((tab) => {
          const count =
            tab.id === 'all'
              ? items.length
              : tab.id === 'unread'
                ? unreadCount
                : null;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                '-mb-px border-b-2 px-3.5 pb-2.5 pt-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em]',
                active
                  ? 'border-rust text-rust'
                  : 'border-transparent text-ink-quiet hover:text-ink',
              )}
            >
              {tab.label}
              {count !== null ? (
                <span className="ml-1.5 text-rust">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="max-h-[460px] overflow-y-auto">
        {visible.length > 0 ? (
          visible.map((item) => (
            <NotificationItemRow
              key={item.id}
              item={item}
              read={isRead(item)}
              onMarkRead={onMarkRead}
            />
          ))
        ) : (
          <p className="px-5.5 py-10 text-center text-[13px] text-ink-quiet">
            Nothing here right now.
          </p>
        )}
      </div>

      <div className="border-t border-paper-2 bg-paper px-5.5 py-3.5 text-center">
        <span className="text-[13px] font-medium text-ink-quiet">
          You&rsquo;re all caught up to the last 30 days.
        </span>
      </div>
    </div>
  );
}

export { NotificationPanel };
