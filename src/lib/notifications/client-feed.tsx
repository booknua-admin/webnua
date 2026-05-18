import type { NotificationItem } from './types';

/**
 * Voltline's notification feed — client Screen 10 (9 items, 6 unread).
 * Reshape into Supabase reads when the backend lands.
 */
export const voltlineNotifications: NotificationItem[] = [
  {
    id: 'ntf-1',
    kind: 'lead',
    title: (
      <>
        <strong>New lead</strong> — Sarah Davies submitted the funnel · powerpoint
        install + light fittings · Mt Hawthorn
      </>
    ),
    actions: [
      { label: 'Open lead', href: '/leads/sarah-davies' },
      { label: 'Mark read', secondary: true },
    ],
    time: '32m',
    read: false,
  },
  {
    id: 'ntf-2',
    kind: 'review',
    title: (
      <>
        <strong>New 5-star review</strong> — Marcus Hayward on Google. &ldquo;Mark
        was punctual, professional...&rdquo;
      </>
    ),
    actions: [
      { label: 'View review', href: '/reviews' },
      { label: 'Share' },
    ],
    time: '14m',
    read: false,
  },
  {
    id: 'ntf-3',
    kind: 'auto',
    title: (
      <>
        Auto-replied to <strong>Sarah Davies</strong> · &ldquo;Will call you back
        within 90 mins...&rdquo;
      </>
    ),
    actions: [{ label: 'Mark read', secondary: true }],
    time: '32m',
    read: false,
  },
  {
    id: 'ntf-4',
    kind: 'booking',
    title: (
      <>
        <strong>Booking confirmed</strong> — Liam Reilly · Wed 1pm — ceiling fan +
        RCD replacement · $220
      </>
    ),
    actions: [{ label: 'Open booking', href: '/bookings/liam-reilly' }],
    time: '2h',
    read: false,
  },
  {
    id: 'ntf-5',
    kind: 'lead',
    title: (
      <>
        <strong>New lead</strong> — Mark Kohli submitted the funnel · switchboard
        tripping · Subiaco · marked &ldquo;today&rdquo;
      </>
    ),
    actions: [
      { label: 'Open lead', href: '/leads/mark-kohli' },
      { label: 'Mark read', secondary: true },
    ],
    time: '2h',
    read: false,
  },
  {
    id: 'ntf-6',
    kind: 'alert',
    title: (
      <>
        <strong>Reschedule pending</strong> — Emma Petrov hasn&rsquo;t confirmed the
        move from Wed 13:30 to Thu 10:00
      </>
    ),
    actions: [{ label: 'Resend SMS' }, { label: 'Call Emma' }],
    time: '4h',
    read: false,
  },
  {
    id: 'ntf-7',
    kind: 'review',
    title: (
      <>
        Review request sent to <strong>Tom Banner</strong> · 5-day follow-up
        scheduled
      </>
    ),
    actions: [],
    time: 'Yesterday',
    read: true,
  },
  {
    id: 'ntf-8',
    kind: 'booking',
    title: (
      <>
        <strong>Job complete</strong> — Raj Patel · powerpoints + USB upgrade · $135
        · review request armed
      </>
    ),
    actions: [],
    time: 'Yesterday',
    read: true,
  },
  {
    id: 'ntf-9',
    kind: 'review',
    title: (
      <>
        New 5-star review · <strong>Jenny Thornton</strong> on Google. &ldquo;Booked
        through Voltline&rsquo;s website...&rdquo;
      </>
    ),
    actions: [],
    time: '2d',
    read: true,
  },
];
