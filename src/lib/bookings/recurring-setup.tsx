type RecurringFrequencyOption = {
  id: 'weekly' | 'fortnightly' | 'monthly' | 'custom';
  name: string;
  meta: string;
};

type RecurringDayOption = {
  id: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  label: string;
};

type RecurringPreviewRow = {
  /** "Thu 14 May" — mono short label */
  date: string;
  /** "10:00 AM — 12:00 PM" */
  time: string;
  /** "first booking" / "2nd visit" / etc. — mono sub-label */
  visit: string;
  /** "$180" */
  price: string;
};

type RecurringSetupCustomer = {
  initial: string;
  name: string;
  /** Two-line meta — first line carries the contact bits, second line carries
   *  the previous-booking note. `<strong>` segments render ink-bold. */
  meta: React.ReactNode;
};

type RecurringSetup = {
  hero: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle: React.ReactNode;
  };
  customer: RecurringSetupCustomer;
  frequencies: RecurringFrequencyOption[];
  defaultFrequencyId: RecurringFrequencyOption['id'];
  days: RecurringDayOption[];
  defaultDayId: RecurringDayOption['id'];
  time: {
    start: string;
    duration: string;
  };
  job: {
    service: string;
    pricePerVisit: string;
  };
  preview: RecurringPreviewRow[];
  /** "Fortnightly · Thursdays · 10am-12pm" — `<strong>` = paper-bold */
  summary: React.ReactNode;
  /** "26 visits per year" — small grey */
  summaryDetail: string;
  /** "$4,680 / year recurring revenue" — large rust-light */
  totalLabel: string;
  ctaLabel: string;
  /** Bottom-of-page footnote */
  note: React.ReactNode;
};

const voltlineRecurring: RecurringSetup = {
  hero: {
    eyebrow: 'Calendar · new recurring booking',
    title: (
      <>
        Set up <em>recurring</em>.
      </>
    ),
    subtitle: (
      <>
        Set up a repeating booking for a customer who wants regular service.{' '}
        <strong>
          Webnua handles all the reminders, confirmations, and review requests
        </strong>{' '}
        — you just show up.
      </>
    ),
  },
  customer: {
    initial: 'EP',
    name: 'Emma Petrov',
    meta: (
      <>
        <strong>0410 384 192</strong> · emma.petrov@gmail.com · Inglewood, Perth
        <br />
        Previous booking:{' '}
        <strong>Ceiling fan + light fittings ($420)</strong> · 4 weeks ago · 5★
        review left
      </>
    ),
  },
  frequencies: [
    { id: 'weekly', name: 'Weekly', meta: 'Every 7 days' },
    { id: 'fortnightly', name: 'Fortnightly', meta: 'Every 14 days' },
    { id: 'monthly', name: 'Monthly', meta: 'Every 28 days' },
    { id: 'custom', name: 'Custom', meta: 'Set interval' },
  ],
  defaultFrequencyId: 'fortnightly',
  days: [
    { id: 'mon', label: 'Mon' },
    { id: 'tue', label: 'Tue' },
    { id: 'wed', label: 'Wed' },
    { id: 'thu', label: 'Thu' },
    { id: 'fri', label: 'Fri' },
    { id: 'sat', label: 'Sat' },
    { id: 'sun', label: 'Sun' },
  ],
  defaultDayId: 'thu',
  time: {
    start: '10:00 AM',
    duration: '2 hours',
  },
  job: {
    service: 'Building inspection · electrical',
    pricePerVisit: '$180',
  },
  preview: [
    {
      date: 'Thu 14 May',
      time: '10:00 AM — 12:00 PM',
      visit: 'first booking',
      price: '$180',
    },
    {
      date: 'Thu 28 May',
      time: '10:00 AM — 12:00 PM',
      visit: '2nd visit',
      price: '$180',
    },
    {
      date: 'Thu 11 Jun',
      time: '10:00 AM — 12:00 PM',
      visit: '3rd visit',
      price: '$180',
    },
    {
      date: 'Thu 25 Jun',
      time: '10:00 AM — 12:00 PM',
      visit: '4th visit',
      price: '$180',
    },
  ],
  summary: <strong>Fortnightly · Thursdays · 10am-12pm</strong>,
  summaryDetail: '26 visits per year',
  totalLabel: '$4,680 / year recurring revenue',
  ctaLabel: 'Save + check conflicts →',
  note: (
    <>
      <strong>Note:</strong> Recurring bookings can be paused or stopped any
      time. Emma can also cancel from her side via SMS — Webnua will text you
      both to confirm any change.
    </>
  ),
};

export { voltlineRecurring };
export type {
  RecurringDayOption,
  RecurringFrequencyOption,
  RecurringPreviewRow,
  RecurringSetup,
  RecurringSetupCustomer,
};
