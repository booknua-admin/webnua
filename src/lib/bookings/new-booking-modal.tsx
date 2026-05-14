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
  /** Optional summary banner at top of body. Admin uses it to show which client
   *  the booking is for; client view typically omits (single-business context). */
  summary?: {
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
    headline: <strong>Booking for FreshHome</strong>,
    detail: (
      <>
        {' '}
        · to book for a different client, switch from the sidebar dropdown.
      </>
    ),
  },
  customer: {
    value: 'Emma Petrov · 0410 384 192 · emma.petrov@gmail.com',
    hint: 'Matched: existing customer · Inglewood, Perth · 2 prior bookings',
  },
  date: 'Thursday, May 14, 2026',
  time: '13:00 — 16:00',
  services: [
    { id: 'standard', label: 'Standard' },
    { id: 'quick', label: 'Quick visit' },
    { id: 'quote', label: 'Quote required' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'recurring', label: 'Recurring' },
    { id: 'one_off', label: 'One-off' },
    { id: 'custom', label: 'Custom' },
  ],
  defaultServiceId: 'standard',
  quotedPrice: '$285',
  estimatedDuration: '3 hours',
  jobNotes:
    "Standard visit. Park on the street — key under the doormat if no one's home. Customer prefers the same staff member each visit (Tania). Add any access notes, materials needed, or special requirements here.",
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

const voltlineNewBooking: NewBookingModalData = {
  tag: 'NEW BOOKING',
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
  customer: {
    value: 'Liam Reilly · 0412 884 273 · liam.reilly@gmail.com',
    hint: 'Matched: existing customer · Highgate, Perth · 1 prior booking',
  },
  date: 'Friday, May 15, 2026',
  time: '09:00 — 11:00',
  services: [
    { id: 'standard', label: 'Standard' },
    { id: 'quick', label: 'Quick visit' },
    { id: 'quote', label: 'Quote required' },
    { id: 'emergency', label: 'Emergency' },
    { id: 'recurring', label: 'Recurring' },
    { id: 'one_off', label: 'One-off' },
    { id: 'custom', label: 'Custom' },
  ],
  defaultServiceId: 'quote',
  quotedPrice: '$220',
  estimatedDuration: '2 hours',
  jobNotes:
    "New booking from a call-back. Add access notes, parts needed, or anything the customer mentioned. Front door key under the pot plant if no one's home.",
  assignedTo: 'Mark (me)',
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
      A confirmation SMS will be sent immediately.{' '}
      <strong>You'll get a notification 1 hour before the job.</strong>
    </>
  ),
};

export { freshhomeNewBooking, voltlineNewBooking };
export type {
  NewBookingModalData,
  NewBookingServiceOption,
  NewBookingToggleField,
};
