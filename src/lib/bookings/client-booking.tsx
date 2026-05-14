import type { ClientBookingDetail } from './types';

const voltlineBooking: ClientBookingDetail = {
  tag: '// CALENDAR · WED MAY 13 · 13:00 — 15:00',
  title: (
    <>
      Ceiling fan + RCD <em>replacement</em>
    </>
  ),
  meta: {
    customer: 'Liam Reilly',
    suburb: 'Highgate',
    price: '$220 quoted',
    duration: '2 hours',
  },
  statusLabel: 'Scheduled · 2.5h away',
  customer: {
    initial: 'LR',
    name: 'Liam Reilly',
    contact: (
      <>
        <strong>0412 884 273</strong> · liam.reilly@gmail.com · Highgate, Perth ·
        second booking with Voltline
      </>
    ),
  },
  job: [
    { label: 'SERVICES', value: 'Ceiling fan install + RCD replace' },
    {
      label: 'PRICE',
      value: (
        <>
          <em>$220</em> · flat rate menu
        </>
      ),
    },
    { label: 'DURATION', value: '2 hours est.' },
    { label: 'PAYMENT', value: 'On completion · card' },
  ],
  notes: (
    <>
      <strong>
        Existing ceiling fan in master bedroom needs replacing
      </strong>{' '}
      — new unit already purchased, just needs the install. RCD on the main
      switchboard is old and tripping intermittently. Front door key under the
      pot plant. Dog is friendly but loud — give him a sec.
    </>
  ),
  history: [
    {
      date: '15 April 2026',
      body: <>Smoke alarm hardwire (4 units) · $145 · 5★ review</>,
    },
    {
      date: '22 March 2026',
      body: <>Switchboard inspection · $220 · 5★ review</>,
    },
  ],
  actions: [
    {
      heading: '// ON ARRIVAL',
      actions: [
        { icon: '✓', label: 'Mark job complete', tone: 'primary' },
        { icon: '☏', label: 'Call Liam' },
        { icon: '✉', label: 'Send "running late" SMS' },
      ],
    },
    {
      heading: '// MANAGE',
      actions: [
        { icon: '▤', label: 'Reschedule' },
        { icon: '✎', label: 'Edit job notes' },
        { icon: '×', label: 'Cancel booking', tone: 'danger' },
      ],
    },
  ],
  nextNote: (
    <>
      When you mark this job complete, the{' '}
      <strong>review request automation fires 2 hours later</strong> with a
      direct link to Voltline's Google review page.
    </>
  ),
};

export { voltlineBooking };
