type RescheduleCompareSide = {
  tag: string;
  /** "13:30 — 15:30" */
  time: string;
  /** "Wed, May 13 · 2 hrs" */
  day: string;
};

type RescheduleReasonOption = {
  id: string;
  label: string;
};

/** SMS preview is a sequence of plain strings and `var` tokens that render with
 *  the rust-tinted variable highlight. Keeping it as an array lets each token
 *  carry its current resolved value while remaining clearly identifiable in the
 *  preview. */
type ReschedulePreviewToken =
  | { type: 'text'; value: string }
  | { type: 'var'; value: string };

type RescheduleToggleField = {
  id: string;
  label: string;
  defaultOn: boolean;
};

type RescheduleModalData = {
  tag: string;
  /** "Reschedule <em>Petrov fortnightly</em>" */
  title: React.ReactNode;
  subtitle: React.ReactNode;
  was: RescheduleCompareSide;
  now: RescheduleCompareSide;
  reasons: RescheduleReasonOption[];
  defaultReasonId: string;
  smsPreview: ReschedulePreviewToken[];
  toggles: RescheduleToggleField[];
  /** Footer info — `<strong>` = ink-bold */
  footerInfo: React.ReactNode;
  saveLabel: string;
};

const freshhomeReschedule: RescheduleModalData = {
  tag: '// RESCHEDULE BOOKING · FreshHome',
  title: (
    <>
      Reschedule <em>Petrov fortnightly</em>
    </>
  ),
  subtitle: (
    <>
      Drag-detected change. Confirm the new time, review the customer SMS, and
      we'll notify Emma. Bond-clean and emergency bookings need 6+ hours'
      notice.
    </>
  ),
  was: {
    tag: '// WAS BOOKED',
    time: '13:30 — 15:30',
    day: 'Wed, May 13 · 2 hrs',
  },
  now: {
    tag: '// NEW TIME',
    time: '10:00 — 12:00',
    day: 'Thu, May 14 · 2 hrs',
  },
  reasons: [
    { id: 'equipment', label: 'Equipment issue' },
    { id: 'conflict', label: 'Scheduling conflict' },
    { id: 'customer', label: 'Customer request' },
    { id: 'sick', label: 'Sick day' },
    { id: 'weather', label: 'Weather' },
    { id: 'custom', label: 'Custom message' },
  ],
  defaultReasonId: 'conflict',
  smsPreview: [
    { type: 'text', value: 'Hi ' },
    { type: 'var', value: 'Emma' },
    { type: 'text', value: ', Lisa from ' },
    { type: 'var', value: 'FreshHome' },
    {
      type: 'text',
      value:
        " here. Quick heads-up — I need to move tomorrow's clean from ",
    },
    { type: 'var', value: '13:30 Wed' },
    { type: 'text', value: ' to ' },
    { type: 'var', value: '10:00 Thu' },
    {
      type: 'text',
      value:
        ' due to a scheduling conflict. Let me know if that works or text back to find another time. — Lisa',
    },
  ],
  toggles: [
    { id: 'send_sms', label: 'Send SMS to Emma', defaultOn: true },
    {
      id: 'pause_review',
      label: 'Pause review-request automation',
      defaultOn: true,
    },
  ],
  footerInfo: (
    <>
      <strong>22-hour notice</strong> — within healthy range. Emma's last
      reschedule was 4 months ago.
    </>
  ),
  saveLabel: 'Confirm + notify Emma →',
};

const voltlineReschedule: RescheduleModalData = {
  tag: '// RESCHEDULE BOOKING',
  title: (
    <>
      Reschedule <em>Liam Reilly</em>
    </>
  ),
  subtitle: (
    <>
      Confirm the new time, review the customer SMS, and we'll let Liam know.
      Same-day reschedules need at least 2 hours' notice.
    </>
  ),
  was: {
    tag: '// WAS BOOKED',
    time: '13:00 — 15:00',
    day: 'Wed, May 13 · 2 hrs',
  },
  now: {
    tag: '// NEW TIME',
    time: '15:30 — 17:30',
    day: 'Wed, May 13 · 2 hrs',
  },
  reasons: [
    { id: 'running_late', label: 'Running late' },
    { id: 'earlier_job_overran', label: 'Earlier job overran' },
    { id: 'customer', label: 'Customer request' },
    { id: 'parts', label: 'Waiting on parts' },
    { id: 'weather', label: 'Weather' },
    { id: 'custom', label: 'Custom message' },
  ],
  defaultReasonId: 'earlier_job_overran',
  smsPreview: [
    { type: 'text', value: 'Hi ' },
    { type: 'var', value: 'Liam' },
    { type: 'text', value: ", it's Mark from " },
    { type: 'var', value: 'Voltline' },
    {
      type: 'text',
      value:
        " — quick heads-up, this morning's job is running long. I'd like to bump our ",
    },
    { type: 'var', value: '13:00 Wed' },
    { type: 'text', value: ' visit to ' },
    { type: 'var', value: '15:30 Wed' },
    {
      type: 'text',
      value:
        ". Reply OK or text back if another time suits better. Cheers — Mark",
    },
  ],
  toggles: [
    { id: 'send_sms', label: 'Send SMS to Liam', defaultOn: true },
    {
      id: 'pause_review',
      label: 'Pause review-request automation',
      defaultOn: true,
    },
  ],
  footerInfo: (
    <>
      <strong>2.5-hour notice</strong> — within healthy range. Liam's first
      reschedule this booking.
    </>
  ),
  saveLabel: 'Confirm + notify Liam →',
};

export { freshhomeReschedule, voltlineReschedule };
export type {
  RescheduleCompareSide,
  RescheduleModalData,
  ReschedulePreviewToken,
  RescheduleReasonOption,
  RescheduleToggleField,
};
