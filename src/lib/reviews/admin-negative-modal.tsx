import type { NegativeReviewModalData } from './types';

const keyheroNegativeReview: NegativeReviewModalData = {
  triggerLabel: 'Show 2★ alert',
  tag: '// REVIEW ALERT · 2★ · KEYHERO',
  title: (
    <>
      Negative review <em>incoming</em>
    </>
  ),
  subtitle: (
    <>
      A customer just rated KeyHero 2 stars on Google.{' '}
      <strong>You have a short window before it&apos;s fully public.</strong>{' '}
      Pre-review intercept available for first-time low ratings.
    </>
  ),
  quote: {
    starsLabel: '★★ ☆ ☆ ☆ · 2 stars',
    text: 'Locksmith took over an hour to arrive after the 30-minute promise. Did a fine job once on-site but I felt like the response time was misleading. Wouldn\'t call again.',
    meta: (
      <>
        — <strong>Jamie K.</strong> · KeyHero · job #4821 · received{' '}
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
      sub: 'AI-drafted response acknowledging the issue and the 30-min promise gap. Review before posting.',
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
      title: 'Flag to Webnua for ad messaging review',
      sub: 'If 30-min promise is causing repeated friction, the ad copy or response SLA may need adjusting.',
    },
  ],
  footerInfo: (
    <>
      <strong>First negative review in 84 days</strong> for KeyHero — not a
      pattern yet.
    </>
  ),
  dismissLabel: 'Dismiss for now',
  callLabel: '☏ Call Jamie now',
};

export { keyheroNegativeReview };
