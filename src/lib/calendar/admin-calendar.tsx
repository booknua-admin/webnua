import type { AdminCalendar } from './types';

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

const adminCalendar: AdminCalendar = {
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
  filters: [
    { id: 'all', label: 'All clients', count: 4 },
    { id: 'freshhome', label: 'FreshHome' },
    { id: 'keyhero', label: 'KeyHero' },
    { id: 'neatworks', label: 'NeatWorks' },
    { id: 'voltline', label: 'Voltline' },
  ],
  legend: [
    { label: 'FreshHome', tone: 'freshhome' },
    { label: 'KeyHero', tone: 'keyhero' },
    { label: 'Voltline', tone: 'voltline' },
    { label: 'NeatWorks', tone: 'neatworks' },
  ],
  legendMeta: <>28 bookings this week · 11 today</>,
  week: {
    cornerLabel: '// LOCAL',
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
            tone: 'freshhome',
            time: '9:00 — 11:30',
            title: 'Fortnightly · 4-bed',
            customer: 'Petrov · Subiaco',
            top: 100,
            height: 130,
          },
          {
            id: 'mon-2',
            tone: 'keyhero',
            time: '12:30 — 13:30',
            title: 'Deadlock + key cut',
            customer: 'Harris · Mt Lawley',
            top: 280,
            height: 60,
          },
          {
            id: 'mon-3',
            tone: 'neatworks',
            time: '14:30 — 16:30',
            title: 'End-of-tenancy',
            customer: 'Murphy · Rathmines',
            top: 380,
            height: 100,
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
            tone: 'freshhome',
            time: '8:00 — 9:45',
            title: 'Bond clean',
            customer: 'Kohli · Mt Lawley',
            top: 50,
            height: 90,
          },
          {
            id: 'tue-2',
            tone: 'keyhero',
            time: '10:15 — 11:00',
            title: 'Smart lock install',
            customer: 'Rivera · Joondalup',
            top: 160,
            height: 50,
          },
          {
            id: 'tue-3',
            tone: 'freshhome',
            time: '12:30 — 15:00',
            title: 'Deep clean · 3-bed',
            customer: 'Davies · Mt Hawthorn',
            top: 270,
            height: 130,
          },
          {
            id: 'tue-4',
            tone: 'neatworks',
            time: '16:00 — 17:30',
            title: 'Fortnightly',
            customer: "O'Brien · Ranelagh",
            top: 460,
            height: 80,
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
            tone: 'freshhome',
            time: '9:00 — 11:00',
            title: 'Fortnightly · 3-bed',
            customer: 'Larsen · Subiaco',
            top: 100,
            height: 100,
            href: '/bookings/wed-1',
          },
          {
            id: 'wed-2',
            tone: 'keyhero',
            time: '11:25 — 12:15',
            title: 'Lockout · residential',
            customer: 'Stein · Mt Hawthorn',
            top: 220,
            height: 50,
          },
          {
            id: 'wed-3',
            tone: 'neatworks',
            time: '13:30 — 15:30',
            title: 'Deep clean',
            customer: 'Walsh · Stoneybatter',
            top: 320,
            height: 120,
          },
          {
            id: 'wed-4',
            tone: 'freshhome',
            time: '16:00 — 17:15',
            title: 'One-off · move-in',
            customer: 'Torres · Inglewood',
            top: 460,
            height: 70,
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
            tone: 'voltline',
            time: '8:00 — 9:15',
            title: 'Switchboard inspection',
            customer: 'Cassidy · Mt Lawley',
            top: 50,
            height: 70,
          },
          {
            id: 'thu-2',
            tone: 'keyhero',
            time: '9:45 — 10:30',
            title: 'Rekey · 4 locks',
            customer: 'Banner · Subiaco',
            top: 140,
            height: 50,
          },
          {
            id: 'thu-3',
            tone: 'freshhome',
            time: '11:30 — 13:30',
            title: 'Fortnightly · 5-bed',
            customer: 'Hawthorn · Nedlands',
            top: 220,
            height: 110,
          },
          {
            id: 'thu-4',
            tone: 'voltline',
            time: '14:00 — 16:00',
            title: 'Ceiling fan + RCD',
            customer: 'Reilly · Highgate',
            top: 350,
            height: 100,
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
            tone: 'freshhome',
            time: '8:30 — 10:30',
            title: 'Bond clean',
            customer: 'Patel · Maylands',
            top: 80,
            height: 110,
          },
          {
            id: 'fri-2',
            tone: 'keyhero',
            time: '11:30 — 12:15',
            title: 'Master key setup',
            customer: 'Office · Floreat',
            top: 220,
            height: 50,
          },
          {
            id: 'fri-3',
            tone: 'voltline',
            time: '12:45 — 14:15',
            title: 'Smoke alarm · 4 units',
            customer: 'Hassan · Mt Hawthorn',
            top: 290,
            height: 80,
          },
          {
            id: 'fri-4',
            tone: 'neatworks',
            time: '15:00 — 17:30',
            title: 'End-of-tenancy',
            customer: 'Doyle · Phibsboro',
            top: 410,
            height: 130,
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
            tone: 'keyhero',
            time: '9:00 — 9:45',
            title: 'Emergency lockout',
            customer: 'Lee · Mt Lawley',
            top: 100,
            height: 50,
          },
          {
            id: 'sat-2',
            tone: 'freshhome',
            time: '10:30 — 12:15',
            title: 'One-off · 3-bed',
            customer: 'McCarthy · Inglewood',
            top: 180,
            height: 90,
          },
        ],
      },
    ],
  },
  today: {
    heading: 'Today · Wednesday May 13',
    meta: (
      <>
        4 jobs · <strong>3 done</strong> · 1 pending
      </>
    ),
    jobs: [
      {
        id: 't-1',
        time: '9:00 — 11:00',
        logoInitial: 'F',
        title: 'Fortnightly · 3-bed',
        customer: 'Larsen · Subiaco',
        status: 'completed',
        tone: 'freshhome',
        href: '/bookings/wed-1',
      },
      {
        id: 't-2',
        time: '11:25 — 12:15',
        logoInitial: 'K',
        title: 'Lockout · residential',
        customer: 'Stein · Mt Hawthorn',
        status: 'in_progress',
        tone: 'keyhero',
      },
      {
        id: 't-3',
        time: '13:30 — 15:30',
        logoInitial: 'N',
        title: 'Deep clean',
        customer: 'Walsh · Stoneybatter',
        status: 'scheduled',
        tone: 'neatworks',
      },
      {
        id: 't-4',
        time: '16:00 — 17:15',
        logoInitial: 'F',
        title: 'One-off · move-in',
        customer: 'Torres · Inglewood',
        status: 'scheduled',
        tone: 'freshhome',
      },
    ],
  },
};

export { adminCalendar };
