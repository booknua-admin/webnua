import type { NotificationChannel } from '@/components/shared/settings/NotificationRow';

type NotificationGroup = {
  label: string;
  channels: NotificationChannel[];
  rows: {
    label: string;
    sub: string;
    active: NotificationChannel[];
  }[];
};

export const clientNotifications: NotificationGroup[] = [
  {
    label: 'Leads + conversations',
    channels: ['sms', 'email', 'push'],
    rows: [
      {
        label: 'New lead arrives',
        sub: 'The moment someone submits the funnel form',
        active: ['sms', 'email'],
      },
      {
        label: 'Lead replies to automation',
        sub: 'When a lead responds to one of your automated messages',
        active: ['sms'],
      },
      {
        label: 'Lead marked urgent',
        sub: 'Flagged by AI from form keywords like "today" or "emergency"',
        active: ['sms', 'email', 'push'],
      },
    ],
  },
  {
    label: 'Bookings + calendar',
    channels: ['sms', 'email', 'push'],
    rows: [
      {
        label: 'Booking confirmed',
        sub: 'When a lead converts to a booked job',
        active: ['email', 'push'],
      },
      {
        label: 'Customer reschedule',
        sub: 'When a booked customer requests a time change',
        active: ['sms', 'email'],
      },
      {
        label: '1-hour-before reminder',
        sub: 'Quick heads-up before your next job',
        active: ['sms', 'push'],
      },
    ],
  },
  {
    label: 'Reviews + reputation',
    channels: ['sms', 'email', 'push'],
    rows: [
      {
        label: 'New 5-star review',
        sub: 'Celebrate the wins',
        active: ['email'],
      },
      {
        label: 'Negative review (3★ or below)',
        sub: 'Critical — always SMS regardless',
        active: ['sms', 'email', 'push'],
      },
    ],
  },
  {
    label: 'Summary emails',
    channels: ['sms', 'email'],
    rows: [
      {
        label: 'Weekly summary',
        sub: 'Sunday evening · leads / jobs / revenue / reviews',
        active: ['email'],
      },
      {
        label: 'Monthly review from Webnua',
        sub: 'Performance digest + recommended optimisations',
        active: ['email'],
      },
    ],
  },
];

export const clientQuietHours = {
  enabled: true,
  window: '9:00 PM — 7:00 AM',
};
