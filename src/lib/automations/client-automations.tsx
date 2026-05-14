import type { ClientAutomations } from './types';

const clientAutomations: ClientAutomations = {
  hero: {
    eyebrow: '// Voltline · 3 active flows',
    title: (
      <>
        Your <em>automations</em>.
      </>
    ),
    subtitle: (
      <>
        Webnua manages the copy and timing — you can pause anything that
        doesn&apos;t feel right.{' '}
        <strong>
          287 sends to your leads in the last 7 days, 96% delivered, 7 reviews
          collected.
        </strong>
      </>
    ),
  },
  banner: (
    <>
      <strong>Webnua writes and manages these automations for you.</strong> You
      can pause any flow with the toggle, but copy changes go through Craig —
      text him at 0411 234 567 or use the Webnua support button in the sidebar.
      Reply rates over the last 28 days are showing below each flow.
    </>
  ),
  cards: [
    {
      id: 'instant-confirm',
      tag: '// AUTO 01 · LEAD CAPTURE',
      title: 'Instant confirm SMS',
      description: (
        <>
          Fires the second a new lead submits the funnel form. Tells them you
          got their enquiry and you&apos;ll be back in 90 minutes.{' '}
          <strong>
            This is the highest-performing automation on the platform
          </strong>{' '}
          — keep it on unless you&apos;re going off-grid.
        </>
      ),
      enabled: true,
      stats: [
        { label: '// SENT 7D', value: '23' },
        { label: '// DELIVERED', value: '98%' },
        { label: '// REPLIED', value: <em>48%</em>, tone: 'accent' },
        { label: '// BOOKED FROM', value: '12' },
      ],
    },
    {
      id: 'follow-up-24h',
      tag: '// AUTO 02 · LEAD NURTURE',
      title: '24-hour follow-up sequence',
      description: (
        <>
          Three-step sequence (SMS → email → SMS) that fires if a lead is still
          &quot;new&quot; after 24 hours.{' '}
          <strong>
            Pauses if you mark the lead &quot;Contacted&quot; in the inbox
          </strong>{' '}
          — no awkward duplicate outreach. Reply rate has been solid for
          Voltline.
        </>
      ),
      enabled: true,
      stats: [
        { label: '// SENT 7D', value: '11' },
        { label: '// DELIVERED', value: '100%' },
        { label: '// REPLIED', value: <em>36%</em>, tone: 'accent' },
        { label: '// RECOVERED LEADS', value: '3' },
      ],
    },
    {
      id: 'review-request',
      tag: '// AUTO 03 · REPUTATION LOOP',
      title: 'Review request after job complete',
      description: (
        <>
          Sends a Google review request 2 hours after you mark a job
          &quot;Completed&quot; in the inbox.{' '}
          <strong>One follow-up at day 5</strong> if no review yet. Direct link
          to your Google review page — customers don&apos;t have to hunt.
        </>
      ),
      enabled: true,
      stats: [
        { label: '// SENT 7D', value: '10' },
        { label: '// DELIVERED', value: '100%' },
        { label: '// REVIEWS', value: <em>7</em>, tone: 'accent' },
        { label: '// 5-STAR', value: '100%' },
      ],
    },
    {
      id: 'no-show-recovery',
      tag: '// AUTO 04 · BOOKING RECOVERY',
      title: 'No-show recovery sequence',
      description: (
        <>
          If a booked customer doesn&apos;t answer the door on the day, this
          sends a polite apology SMS with a rebooking link.{' '}
          <strong>Off by default in your first 30 days</strong> — turn it on
          once you have a feel for your no-show rate. Ping Craig if you&apos;d
          like to enable it.
        </>
      ),
      enabled: false,
    },
  ],
};

export { clientAutomations };
