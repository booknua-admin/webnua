import type { AdminCalendar } from './types';

export const adminCalendar: Pick<AdminCalendar, 'hero'> = {
  hero: {
    eyebrow: 'Workspace · this week',
    title: (
      <>
        The <em>calendar</em>.
      </>
    ),
    subtitle: (
      <>
        Every job booked across all clients this week.{' '}
        <strong>Operator view shows all clients colour-coded</strong>; client view
        shows only their own. Drag-to-reschedule and conflict detection live in the
        real build — this is the read-only preview.
      </>
    ),
  },
};
