type NewBookingServiceOption = {
  id: string;
  label: string;
};

type NewBookingToggleField = {
  id: 'send_sms' | 'add_to_invoice';
  label: string;
  defaultOn: boolean;
  /** Description shown next to the toggle, changes by state */
  onText: string;
  offText: string;
};

type NewBookingModalData = {
  tag: string;
  /** "Add a <em>booking</em>" — `<em>` = rust */
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** Summary banner at top of body */
  summary: {
    /** Single-letter logo (e.g. "F" for FreshHome) */
    initial: string;
    /** "Booking for FreshHome Cleaning" — `<strong>` = ink-bold */
    headline: React.ReactNode;
    /** Trailing muted clarification */
    detail: React.ReactNode;
  };
  customer: {
    value: string;
    hint: string;
  };
  date: string;
  time: string;
  services: NewBookingServiceOption[];
  defaultServiceId: string;
  quotedPrice: string;
  estimatedDuration: string;
  jobNotes: string;
  assignedTo: string;
  toggles: NewBookingToggleField[];
  /** Footer info — `<strong>` = ink-bold */
  footerInfo: React.ReactNode;
};

const freshhomeNewBooking: NewBookingModalData = {
  tag: 'NEW BOOKING · FRESHHOME',
  title: (
    <>
      Add a <em>booking</em>
    </>
  ),
  subtitle: (
    <>
      Manual booking — for jobs that didn't come through the funnel. Existing
      customer in the system? Search by name to pull their details.
    </>
  ),
  summary: {
    initial: 'F',
    headline: <strong>Booking for FreshHome Cleaning</strong>,
    detail: (
      <>
        {' '}
        · all client booking — for KeyHero or another client, switch from the
        sidebar dropdown.
      </>
    ),
  },
  customer: {
    value: 'Emma Petrov · 0410 384 192 · emma.petrov@gmail.com',
    hint: 'Matched: existing customer · 4-bed Subiaco · 2 prior bookings',
  },
  date: 'Thursday, May 14, 2026',
  time: '13:00 — 16:00',
  services: [
    { id: 'fortnightly', label: 'Fortnightly' },
    { id: 'deep_clean', label: 'Deep clean' },
    { id: 'bond_clean', label: 'Bond clean' },
    { id: 'move_in', label: 'Move-in' },
    { id: 'move_out', label: 'Move-out' },
    { id: 'one_off', label: 'One-off' },
    { id: 'custom', label: 'Custom' },
  ],
  defaultServiceId: 'deep_clean',
  quotedPrice: '$285',
  estimatedDuration: '3 hours',
  jobNotes:
    '4-bed in Subiaco. Pet-friendly products only — they have a cat. Park on street, key under doormat. Customer prefers same cleaner each visit (Tania).',
  assignedTo: 'Tania (preferred)',
  toggles: [
    {
      id: 'send_sms',
      label: 'Send SMS confirmation',
      defaultOn: true,
      onText: 'On — sends now',
      offText: 'Off — no confirmation',
    },
    {
      id: 'add_to_invoice',
      label: 'Add to invoice',
      defaultOn: false,
      onText: 'On — added now',
      offText: 'Off — invoice after completion',
    },
  ],
  footerInfo: (
    <>
      A confirmation SMS will be sent to Emma immediately.{' '}
      <strong>You'll get a notification 1 hour before the job.</strong>
    </>
  ),
};

export { freshhomeNewBooking };
export type {
  NewBookingModalData,
  NewBookingServiceOption,
  NewBookingToggleField,
};
