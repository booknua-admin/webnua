import type { ReactNode } from 'react';

/** Visual + filter category for a feed notification. */
export type NotificationKind = 'lead' | 'review' | 'auto' | 'booking' | 'alert';

/** Which feed tab a notification surfaces under (besides All / Unread). */
export type NotificationTabId = 'all' | 'unread' | 'lead' | 'booking' | 'review';

/** One inline action chip on a notification row. */
export type NotificationAction = {
  label: string;
  /** When set the chip is a `next/link`; otherwise it is an inert stub. */
  href?: string;
  /** Muted styling — used by "Mark read" and other low-emphasis actions. */
  secondary?: boolean;
};

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  /** ReactNode so the stub can carry inline `<strong>` emphasis. */
  title: ReactNode;
  actions: NotificationAction[];
  /** Relative age label, e.g. `32m`, `2h`, `Yesterday`. */
  time: string;
  /** Seed read-state; live read-state is tracked by `NotificationBell`. */
  read: boolean;
};
