import type { ClientCalendar } from './types';

export const voltlineCalendar: Pick<ClientCalendar, 'hero'> = {
  hero: {
    eyebrow: 'Voltline · this week',
    title: (
      <>
        Your <em>calendar</em>.
      </>
    ),
    subtitle: (
      <>
        12 jobs booked this week, 4 today.{' '}
        <strong>Drag-to-reschedule and conflict warnings live in the real build</strong> —
        this view shows the visual structure.
      </>
    ),
  },
};
