import type { ClientReviewsPage } from './types';

const voltlineClientReviews: ClientReviewsPage = {
  hero: {
    eyebrow: '// Voltline · Google reviews',
    title: (
      <>
        Your <em>reviews</em>.
      </>
    ),
    subtitle: (
      <>
        7 new Google reviews collected in your first 14 days, all 5-star.{' '}
        <strong>The review request automation is doing the heavy lifting</strong>{' '}
        — keep marking jobs as &ldquo;Completed&rdquo; in the inbox and the
        requests fire automatically.
      </>
    ),
  },
  summary: {
    rating: (
      <>
        4.9 <em>★</em>
      </>
    ),
    starsLabel: '★ ★ ★ ★ ★',
    meta: '7 REVIEWS · 14 DAYS',
  },
  distribution: [
    { stars: 5, count: 7, pct: 100 },
    { stars: 4, count: 0, pct: 0 },
    { stars: 3, count: 0, pct: 0 },
    { stars: 2, count: 0, pct: 0 },
    { stars: 1, count: 0, pct: 0 },
  ],
  callout: {
    headline: (
      <>
        Asked, not <em>begged</em>.
      </>
    ),
    sub: 'The automation handles every review request automatically — just keep marking jobs "Completed."',
    link: { label: 'View on Google ↗', href: '#' },
  },
  listHeader: (
    <>
      {'// '}
      <strong>7 reviews</strong> · newest first
    </>
  ),
  listAside: 'Auto-collected via Webnua',
  reviews: [
    {
      id: 'mh',
      authorName: 'Marcus Hayward',
      authorInitials: 'MH',
      job: 'switchboard inspection',
      text: '"Mark was punctual, professional, and gave me a clear written quote before starting. Spotted two issues with my switchboard I didn\'t know about — fixed both on the spot. Will definitely call again."',
      stars: 5,
      age: '14m',
    },
    {
      id: 'jt',
      authorName: 'Jenny Thornton',
      authorInitials: 'JT',
      job: 'ceiling fan install',
      text: '"Booked through Voltline\'s website, Mark called back within an hour. Installed two ceiling fans the next day, cleaned up after himself, fixed price exactly as quoted. Highly recommend."',
      stars: 5,
      age: '2d',
    },
    {
      id: 'rp',
      authorName: 'Raj Patel',
      authorInitials: 'RP',
      job: 'powerpoint install',
      text: '"Honest pricing, on the page, no haggling. Mark explained everything as he went and showed me the certificate when he finished. Refreshing experience for a sparky."',
      stars: 5,
      age: '4d',
    },
    {
      id: 'el',
      authorName: 'Emma Liu',
      authorInitials: 'EL',
      job: 'smoke alarm hardwire',
      text: '"Quick response, fair price, and Mark even spotted that one of our old alarms had expired and replaced it as part of the job. Genuinely helpful."',
      stars: 5,
      age: '6d',
    },
    {
      id: 'tb',
      authorName: 'Tom Banner',
      authorInitials: 'TB',
      job: 'RCD replacement',
      text: '"Came out same day for an emergency RCD replacement. Mark was calm, explained what had failed, and got us back up in under an hour. Will be using Voltline for everything from now on."',
      stars: 5,
      age: '9d',
    },
    {
      id: 'sw',
      authorName: 'Sophie Wallace',
      authorInitials: 'SW',
      job: 'kitchen power circuit',
      text: '"Booked Mark for a new dedicated circuit for a benchtop oven. Quoted on the day, done the next morning. Tidy work, certificate emailed straight after."',
      stars: 5,
      age: '11d',
    },
    {
      id: 'ck',
      authorName: 'Chris Kowalski',
      authorInitials: 'CK',
      job: 'safety switch + test',
      text: '"Asked Mark to test our switchboard after we moved in. He found one safety switch that wasn\'t tripping, replaced it on the spot, and gave us a written report. Peace of mind."',
      stars: 5,
      age: '13d',
    },
  ],
};

export { voltlineClientReviews };
