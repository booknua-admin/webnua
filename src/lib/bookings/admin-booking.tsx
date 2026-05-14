import type { AdminBookingDetail } from './types';

const freshhomeBooking: AdminBookingDetail = {
  hero: {
    eyebrow: 'Calendar · Wednesday May 13 · 9:00 AM',
    title: (
      <>
        Today's <em>booking</em>.
      </>
    ),
    subtitle: (
      <>
        Full detail for one booked job.{' '}
        <strong>Job notes, customer details, lead history</strong>, and the
        actions you'd take (reschedule, mark complete, contact). Reachable from
        clicking any block on the calendar.
      </>
    ),
  },
  tone: 'freshhome',
  timeRow: (
    <>
      Wed May 13 · <strong>9:00 — 11:00 AM</strong> · 2 hours
    </>
  ),
  jobTitle: 'Fortnightly clean · 3-bed',
  customer: {
    name: 'Anna Larsen',
    phone: '0451 887 224',
    suburb: 'Subiaco',
    clientPill: 'FreshHome',
  },
  details: [
    { label: '// SERVICE TYPE', value: 'Fortnightly recurring' },
    { label: '// PRICE', value: '$185' },
    { label: '// BEDROOMS', value: '3' },
    { label: '// BATHROOMS', value: '2' },
    { label: '// ESTIMATED TIME', value: '2 hours' },
    { label: '// PAYMENT', value: 'Card · auto-bill on completion' },
    { label: '// ASSIGNED CLEANER', value: 'Lisa (owner)' },
    { label: '// PRODUCTS', value: 'Pet-friendly · client request' },
  ],
  notes: (
    <>
      Has a small terrier (Bonnie). Prefers eco-friendly products — Anna brings
      them out. Key under the third pot plant. Two kids' rooms upstairs, please
      leave the playroom alone unless it's a mess. Bin day Wednesday — bins to
      the kerb when leaving.
    </>
  ),
  historyHeading: '// JOB HISTORY · 6 PREVIOUS',
  history: [
    {
      date: 'Apr 29',
      title: 'Fortnightly clean · 3-bed',
      price: '$185',
      status: 'done',
    },
    {
      date: 'Apr 15',
      title: 'Fortnightly clean · 3-bed',
      price: '$185',
      status: 'done',
    },
    {
      date: 'Apr 1',
      title: 'Fortnightly clean · 3-bed',
      price: '$185',
      status: 'done',
    },
    {
      date: 'Mar 18',
      title: 'Fortnightly clean · 3-bed',
      price: '$185',
      status: 'done',
      statusLabel: '✓ Done · ★★★★★',
    },
  ],
  customerValue: [
    { label: 'Lifetime spend', value: '$1,295', accent: true },
    { label: 'Jobs done', value: '7' },
    { label: 'Avg rating', value: '★★★★★' },
    { label: 'Customer since', value: 'Feb 2026' },
  ],
  location: {
    address: '12 Wellington St · Subiaco',
  },
  automations: [
    {
      label: 'SMS reminder · 6pm Tue',
      value: <span className="text-good">✓ Sent</span>,
    },
    {
      label: 'Review request',
      value: <span className="text-ink-quiet">After complete</span>,
    },
  ],
};

export { freshhomeBooking };
