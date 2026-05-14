import type { ClientCalendar } from './types';

const TIME_SLOTS = [
  '7:00',
  '8:00',
  '9:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

const voltlineCalendar: ClientCalendar = {
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
  week: {
    cornerLabel: '// PERTH',
    periodLabel: (
      <>
        Week of <em>May 11</em> — May 16, 2026
      </>
    ),
    timeSlots: TIME_SLOTS,
    days: [
      {
        id: 'mon',
        name: 'MON',
        num: '11',
        bookings: [
          {
            id: 'mon-1',
            time: '9:00 — 10:30',
            title: 'RCD replacement',
            customer: 'Murphy · Subiaco',
            top: 100,
            height: 80,
          },
          {
            id: 'mon-2',
            time: '11:30 — 12:30',
            title: 'Powerpoint × 2',
            customer: 'Harris · Mt Lawley',
            top: 230,
            height: 60,
          },
          {
            id: 'mon-3',
            time: '14:30 — 17:00',
            title: 'Smart wiring · home office',
            customer: "O'Brien · Joondalup",
            top: 380,
            height: 130,
          },
        ],
      },
      {
        id: 'tue',
        name: 'TUE',
        num: '12',
        bookings: [
          {
            id: 'tue-1',
            time: '8:00 — 9:00',
            title: 'Light fittings × 3',
            customer: 'Kohli · Mt Lawley',
            top: 50,
            height: 60,
          },
          {
            id: 'tue-2',
            time: '9:30 — 11:00',
            title: 'Ceiling fan install',
            customer: 'Davies · Mt Hawthorn',
            top: 130,
            height: 90,
          },
          {
            id: 'tue-3',
            time: '12:30 — 14:30',
            title: 'Switchboard upgrade',
            customer: 'Riley · Subiaco',
            top: 280,
            height: 110,
          },
        ],
      },
      {
        id: 'wed',
        name: 'WED · TODAY',
        num: '13',
        isToday: true,
        nowTopPx: 178,
        nowLabel: 'NOW · 10:35',
        bookings: [
          {
            id: 'wed-1',
            time: '8:00 — 9:15',
            title: 'Switchboard inspection',
            customer: 'Cassidy · Mt Lawley',
            top: 50,
            height: 75,
          },
          {
            id: 'wed-2',
            time: '10:00 — 11:30',
            title: 'Powerpoints + USB upgrade',
            customer: 'Patel · Maylands',
            top: 150,
            height: 90,
          },
          {
            id: 'wed-3',
            time: '13:00 — 15:00',
            title: 'Ceiling fan + RCD',
            customer: 'Reilly · Highgate',
            top: 300,
            height: 100,
            href: '/bookings/wed-3',
          },
          {
            id: 'wed-4',
            time: '16:30 — 17:15',
            title: 'Smoke alarm × 4',
            customer: 'Hassan · Mt Hawthorn',
            top: 480,
            height: 45,
          },
        ],
      },
      {
        id: 'thu',
        name: 'THU',
        num: '14',
        bookings: [
          {
            id: 'thu-1',
            time: '8:30 — 9:45',
            title: 'Hot water isolator',
            customer: 'Stein · Highgate',
            top: 80,
            height: 70,
          },
          {
            id: 'thu-2',
            time: '11:00 — 13:00',
            title: 'Smart switch install × 6',
            customer: 'Banner · Nedlands',
            top: 200,
            height: 110,
          },
          {
            id: 'thu-3',
            time: '14:00 — 16:30',
            title: 'Solar inverter wiring',
            customer: 'Larsen · Bayswater',
            top: 350,
            height: 130,
          },
        ],
      },
      {
        id: 'fri',
        name: 'FRI',
        num: '15',
        bookings: [
          {
            id: 'fri-1',
            time: '9:00 — 11:00',
            title: 'RCD + safety check',
            customer: 'Torres · Inglewood',
            top: 100,
            height: 100,
          },
          {
            id: 'fri-2',
            time: '12:15 — 13:45',
            title: 'Powerpoint × 3',
            customer: 'Walsh · Mt Hawthorn',
            top: 260,
            height: 80,
          },
          {
            id: 'fri-3',
            time: '14:00 — 15:00',
            title: 'USB powerpoint upgrade',
            customer: 'Doyle · Inglewood',
            top: 360,
            height: 55,
          },
          {
            id: 'fri-4',
            time: '16:30 — 17:15',
            title: 'Smoke alarm hardwire × 4',
            customer: 'Hassan · Mt Hawthorn',
            top: 480,
            height: 45,
          },
        ],
      },
      {
        id: 'sat',
        name: 'SAT',
        num: '16',
        bookings: [
          {
            id: 'sat-1',
            time: '10:00 — 11:15',
            title: 'Emergency callout · power out',
            customer: 'Lee · Mt Lawley',
            top: 150,
            height: 75,
          },
        ],
      },
    ],
  },
};

export { voltlineCalendar };
