import type { ReactNode } from 'react';

// =============================================================================
// Job completion flow stub (client Screen 11). Reached from the booking
// detail "Mark job complete" action. Confirming completes the job, records
// payment, and arms the review-request automation.
// =============================================================================

export type JobCompletionSummaryRow = {
  label: string;
  value: ReactNode;
  /** Renders the value in rust — used for the final total. */
  accent?: boolean;
};

export type JobCompletionPaymentOption = {
  id: string;
  label: string;
};

export type JobCompletion = {
  tag: string;
  title: ReactNode;
  subtitle: ReactNode;
  hero: { icon: string; headline: ReactNode; body: ReactNode };
  summary: JobCompletionSummaryRow[];
  payment: {
    options: JobCompletionPaymentOption[];
    defaultId: string;
    note: ReactNode;
  };
  reviewTrigger: {
    heading: string;
    description: ReactNode;
    preview: string;
    meta: ReactNode;
  };
};

export const voltlineJobCompletion: JobCompletion = {
  tag: '// JOB COMPLETION · Liam Reilly',
  title: (
    <>
      Mark this <em>complete</em>?
    </>
  ),
  subtitle: (
    <>
      Confirms the job is done, captures payment, and{' '}
      <strong>arms the review request automation</strong> to fire in 2 hours.
    </>
  ),
  hero: {
    icon: '✓',
    headline: (
      <>
        Ceiling fan + RCD · <em>$220</em>
      </>
    ),
    body: (
      <>
        <strong>Liam Reilly · Highgate.</strong> Marking this complete saves the
        job, queues the invoice, and triggers your review request automation.
        The customer gets a Google review link 2 hours from now.
      </>
    ),
  },
  summary: [
    { label: 'Service', value: 'Ceiling fan install + RCD replacement' },
    { label: 'Time on site', value: '1 hr 52 min' },
    { label: 'Materials', value: 'RCD (supplied) · fan unit (customer)' },
    { label: 'Quoted price', value: '$220 flat rate' },
    { label: 'Adjustments', value: 'None' },
    { label: 'Final total', value: '$220', accent: true },
  ],
  payment: {
    options: [
      { id: 'card', label: 'Paid on site · card' },
      { id: 'cash', label: 'Paid on site · cash' },
      { id: 'invoice-7', label: 'Invoice (Net 7)' },
      { id: 'invoice-14', label: 'Invoice (Net 14)' },
    ],
    defaultId: 'card',
    note: (
      <>
        Card payment of <strong>$220</strong> recorded via Square reader ·
        receipt sent to liam.reilly@gmail.com.
      </>
    ),
  },
  reviewTrigger: {
    heading: 'Review request will fire in 2 hours',
    description: (
      <>
        When you confirm completion, the{' '}
        <strong>review request automation</strong> arms. Liam gets a friendly
        SMS asking for a Google review at 4:32 PM today. One follow-up 5 days
        later if no response.
      </>
    ),
    preview:
      '"Thanks for getting Voltline in today, Liam! If we did right by you, would you mind dropping us a quick Google review? Takes 30 secs and helps us a lot: g.page/voltline/review"',
    meta: (
      <>
        ⤿ <strong>AUTO 03 · REPUTATION LOOP</strong> · Liam is a 2nd-time
        customer with prior 5★ — high probability of review
      </>
    ),
  },
};
