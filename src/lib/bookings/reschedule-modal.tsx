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

export { freshhomeReschedule };
export type {
  RescheduleCompareSide,
  RescheduleModalData,
  ReschedulePreviewToken,
  RescheduleReasonOption,
  RescheduleToggleField,
};
