import type { NegativeReviewModalData } from './types';

const voltlineNegativeReview: NegativeReviewModalData = {
  triggerLabel: 'Show 2★ alert',
  tag: '// REVIEW ALERT · 2★ · VOLTLINE',
  title: (
    <>
      Negative review <em>incoming</em>
    </>
  ),
  subtitle: (
    <>
      A customer just rated your business 2 stars on Google.{' '}
      <strong>You have a short window before it&apos;s fully public.</strong>{' '}
      Pre-review intercept available for first-time low ratings.
    </>
  ),
  quote: {
    starsLabel: '★★ ☆ ☆ ☆ · 2 stars',
    text: 'Sparky was 90 minutes late after the "same-day" promise. Did fine work once on-site but I felt the response window was misleading. Wouldn\'t call again.',
    meta: (
      <>
        — <strong>Jamie K.</strong> · job #4821 · received{' '}
        <strong>4 minutes ago</strong>
      </>
    ),
  },
  actionsLabel: '// SUGGESTED ACTIONS · IN ORDER',
  actions: [
    {
      id: 'call',
      num: '1',
      title: 'Call Jamie immediately to apologise',
      sub: 'Most effective. 68% of 2-star reviewers update or remove after a personal call within 24h.',
      recommended: true,
    },
    {
      id: 'draft',
      num: '2',
      title: 'Draft a public reply on Google',
      sub: 'AI-drafted response acknowledging the issue and the same-day promise gap. Review before posting.',
    },
    {
      id: 'pause',
      num: '3',
      title: 'Pause review request automation for 7 days',
      sub: "Avoid soliciting more reviews until you've handled this one. Resumes automatically.",
    },
    {
      id: 'flag',
      num: '4',
      title: 'Flag to Craig at Webnua for ad messaging review',
      sub: 'If the same-day promise is causing repeated friction, the ad copy or response SLA may need adjusting.',
    },
  ],
  footerInfo: (
    <>
      <strong>First negative review in your first 14 days</strong> — not a
      pattern yet.
    </>
  ),
  dismissLabel: 'Dismiss for now',
  callLabel: '☏ Call Jamie now',
};

export { voltlineNegativeReview };
