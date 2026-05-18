type RecurringFrequencyOption = {
  id: 'weekly' | 'fortnightly' | 'monthly';
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
  /** "10:00 — 12:00" */
  time: string;
  /** "first booking" / "2nd visit" / etc. — mono sub-label */
  visit: string;
  /** "$180" */
  price: string;
};

type RecurringSetup = {
  hero: {
    eyebrow: string;
    title: React.ReactNode;
    subtitle: React.ReactNode;
  };
  frequencies: RecurringFrequencyOption[];
  defaultFrequencyId: RecurringFrequencyOption['id'];
  days: RecurringDayOption[];
  defaultDayId: RecurringDayOption['id'];
  /** Bottom-of-page footnote */
  note: React.ReactNode;
};

const recurringSetup: RecurringSetup = {
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
  frequencies: [
    { id: 'weekly', name: 'Weekly', meta: 'Every 7 days' },
    { id: 'fortnightly', name: 'Fortnightly', meta: 'Every 14 days' },
    { id: 'monthly', name: 'Monthly', meta: 'Every 4 weeks' },
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
  note: (
    <>
      <strong>Note:</strong> Recurring bookings can be paused or stopped any
      time. The first few visits are added to the calendar now; the schedule
      tops up automatically as visits are completed.
    </>
  ),
};

export { recurringSetup };
export type {
  RecurringDayOption,
  RecurringFrequencyOption,
  RecurringPreviewRow,
  RecurringSetup,
};
