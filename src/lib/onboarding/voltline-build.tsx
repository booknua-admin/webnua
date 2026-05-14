import type {
  Automation,
  BusinessBasics,
  FunnelPreviewState,
  JobsMenuItem,
  NextStep,
  OfferDetails,
  ReframeOption,
  TrustSignal,
} from './types';

const VOLTLINE_LOGO = (
  <>
    Volt<em>line</em>
  </>
);

const VOLTLINE_PHONE = '☏ 0411 567 234';

export const voltlineBasics: BusinessBasics = {
  trade: 'Electrical · Residential',
  businessName: 'Voltline',
  ownerName: 'Mark Cassidy',
  ownerPhone: '0411 567 234',
  serviceArea: 'Perth metro · north of river',
  website: 'voltline.com.au',
  websiteHelper:
    "We'll pull existing copy, photos, and trust signals from this URL.",
  responsePromise: 'On site in 90 minutes — guaranteed',
  licence: 'EC Lic 47829 · $20M public liability',
};

export const voltlineReframes: ReframeOption[] = [
  {
    id: 'certainty',
    tag: '// Option 01 · The certainty angle',
    text: (
      <>
        You&apos;re not selling sparky hours. You&apos;re selling{' '}
        <em>certainty</em>.
      </>
    ),
    reason:
      'Most calm. Cerebral. Works if your target is risk-averse homeowners who hate "I\'ll get back to you" trades.',
  },
  {
    id: 'time',
    tag: '// Option 02 · The time angle',
    text: (
      <>
        You&apos;re not selling sparky hours. You&apos;re selling{' '}
        <em>your Tuesday back</em>.
      </>
    ),
    reason:
      'Most emotional. Names the resentment of waiting on a tradesman who never shows. Pairs with the 90-min promise on the funnel.',
  },
  {
    id: 'trust',
    tag: '// Option 03 · The trust angle',
    text: (
      <>
        You&apos;re not selling sparky hours. You&apos;re selling{' '}
        <em>a job that won&apos;t come back</em>.
      </>
    ),
    reason:
      'Most rational. Works if your edge is compliance and craftsmanship over speed. Less punchy as a hook.',
  },
];

export const voltlineSelectedReframeId = 'time';

export const voltlineOffer: OfferDetails = {
  anchor: '90 minutes — or $50 off the call-out',
  subHeadline:
    '24/7 emergency sparky. Same-day for everything else. Licensed, insured, fixed-rate menu published.',
  normalRate: '$95 call-out',
  afterHoursRate: '$165 call-out',
  primaryCta: "Book a sparky · today's slots",
  secondaryCta: '☏ 0411 567 234 · 24/7',
  guarantee:
    "If we don't arrive within 90 minutes of confirming your booking, you get $50 off the call-out fee. No questions, no quibbling. Excludes scheduled bookings outside emergency hours.",
};

export const voltlineTrust: TrustSignal[] = [
  { label: 'Jobs completed', value: '1,840+', previewLabel: 'Jobs completed' },
  { label: 'Years operating', value: '11 yrs', previewLabel: 'Servicing Perth' },
  { label: 'Google rating', value: '4.9 ★', previewLabel: '184 reviews' },
  { label: 'Reviews count', value: '184', previewLabel: 'Licensed' },
];

export const voltlineJobs: JobsMenuItem[] = [
  { id: 'powerpoint', name: 'Powerpoint install', price: '$85', type: 'flat' },
  { id: 'smoke', name: 'Smoke alarm hardwire', price: '$145', type: 'flat' },
  { id: 'light', name: 'Light fitting replacement', price: '$95', type: 'flat' },
  { id: 'fan', name: 'Ceiling fan install', price: '$220', type: 'flat' },
  { id: 'switchboard', name: 'Switchboard inspection', price: '$220', type: 'flat' },
  { id: 'rcd', name: 'RCD replacement', price: '$185', type: 'flat' },
  { id: 'hotwater', name: 'Hot water isolator', price: '$165', type: 'flat' },
  { id: 'usb', name: 'USB powerpoint upgrade', price: '$135', type: 'flat' },
  { id: 'rewire', name: 'Full house rewire', price: '—', type: 'quote' },
  { id: 'solar', name: 'Solar inverter install', price: '—', type: 'quote' },
];

export const voltlineAutomations: Automation[] = [
  {
    id: 'instant-confirm',
    tag: '// AUTO 01 · LEAD CAPTURE',
    title: 'Instant confirm SMS',
    description: (
      <>
        Sends a confirmation SMS the moment a lead submits the funnel form.{' '}
        <strong>Single-step, fires once per lead.</strong> Best deliverability
        of any automation in the platform.
      </>
    ),
    enabled: true,
    trigger: 'New form submission on voltline.com.au',
    steps: [
      {
        number: 1,
        channel: 'sms',
        delay: (
          <>
            Delay: <strong>Instant</strong>
          </>
        ),
        body: (
          <>
            Hey <span data-slot="var">{'{first_name}'}</span>, Mark from{' '}
            <span data-slot="var">{'{business}'}</span> here. Got your enquiry —
            I&apos;ll call you back within{' '}
            <span data-slot="var">{'{response_minutes}'}</span> mins to lock in
            a slot. If urgent reply HELP and I&apos;ll bump you up. — Mark
          </>
        ),
        meta: [
          { label: 'Sent', value: '0' },
          { label: 'Delivered', value: '—' },
          { label: 'Reply rate', value: '—' },
        ],
      },
    ],
  },
  {
    id: 'follow-up',
    tag: '// AUTO 02 · LEAD NURTURE',
    title: '24-hour follow-up sequence',
    description: (
      <>
        Three-step sequence if a lead hasn&apos;t been booked within 24 hours.{' '}
        <strong>Pauses if Mark marks the lead &quot;contacted&quot;</strong> in
        the dashboard — no awkward duplicate outreach.
      </>
    ),
    enabled: true,
    trigger: 'Lead status = "new" for 24+ hours',
    steps: [
      {
        number: 1,
        channel: 'sms',
        delay: (
          <>
            Delay: <strong>24 hrs</strong>
          </>
        ),
        body: (
          <>
            Hi <span data-slot="var">{'{first_name}'}</span> — still chasing a
            sparky? I&apos;ve got a few slots free this week if you want me to
            come take a look at the{' '}
            <span data-slot="var">{'{job_type}'}</span>. Reply YES and I&apos;ll
            send a time. — Mark
          </>
        ),
      },
      {
        number: 2,
        channel: 'email',
        delay: (
          <>
            Delay: <strong>+48 hrs</strong>
          </>
        ),
        isEditing: true,
        body: (
          <>
            <strong>Subject:</strong> Still need a sparky,{' '}
            <span data-slot="var">{'{first_name}'}</span>?
            <br />
            <br />
            Just checking in. I had a chat with another customer last week with
            the same issue you described —{' '}
            <span data-slot="var">{'{job_type}'}</span> — and we sorted it out
            for under <span data-slot="var">{'{est_price}'}</span>.
            <br />
            <br />
            Happy to swing by this week if you&apos;re still looking. Just
            reply with a time that works and I&apos;ll be there.
            <br />
            <br />— Mark · Voltline · EC Lic 47829
          </>
        ),
      },
      {
        number: 3,
        channel: 'sms',
        delay: (
          <>
            Delay: <strong>+5 days</strong>
          </>
        ),
        body: (
          <>
            Last one from me — just checking you got sorted? If you went with
            someone else no worries, but if not I&apos;ve got Friday afternoon
            free. — Mark
          </>
        ),
      },
    ],
  },
  {
    id: 'review-request',
    tag: '// AUTO 03 · REPUTATION LOOP',
    title: 'Review request after job complete',
    description: (
      <>
        Asks for a Google review 2 hours after Mark marks the job
        &quot;completed&quot; in the dashboard.{' '}
        <strong>Direct link to your Google review page</strong> — no manual
        searching. One follow-up at day 5 if no review yet.
      </>
    ),
    enabled: true,
    trigger: 'Job status = "completed" in lead inbox',
    steps: [
      {
        number: 1,
        channel: 'sms',
        delay: (
          <>
            Delay: <strong>2 hrs after complete</strong>
          </>
        ),
        body: (
          <>
            Thanks for getting Voltline in today,{' '}
            <span data-slot="var">{'{first_name}'}</span>! If we did right by
            you, would you mind dropping us a quick Google review? Takes 30
            secs and helps us a lot:{' '}
            <span data-slot="var">{'{review_link}'}</span>
          </>
        ),
      },
      {
        number: 2,
        channel: 'sms',
        delay: (
          <>
            Delay: <strong>+5 days if no review</strong>
          </>
        ),
        body: (
          <>
            Hi <span data-slot="var">{'{first_name}'}</span> — just a quick
            nudge in case you missed the first message. A Google review really
            helps a small business like ours. Here&apos;s the link:{' '}
            <span data-slot="var">{'{review_link}'}</span> — Mark
          </>
        ),
      },
    ],
  },
  {
    id: 'no-show',
    tag: '// AUTO 04 · BOOKING RECOVERY',
    title: 'No-show recovery sequence',
    description: (
      <>
        If a booked customer doesn&apos;t answer the door on the day, this
        sends an apology SMS with a rebooking link and follows up the next
        morning. <strong>Off by default</strong> — turn on once you&apos;ve
        shipped 20+ jobs and have a feel for your no-show rate.
      </>
    ),
    enabled: false,
    trigger: 'Job marked "no-show" in lead inbox',
    steps: [
      {
        number: 1,
        channel: 'sms',
        delay: (
          <>
            Delay: <strong>Instant</strong>
          </>
        ),
        body: (
          <>
            Hi <span data-slot="var">{'{first_name}'}</span> — I tried to reach
            you at the booked time today and couldn&apos;t connect. No worries,
            here&apos;s a link to rebook a slot that suits:{' '}
            <span data-slot="var">{'{rebook_link}'}</span> — Mark
          </>
        ),
      },
    ],
  },
];

export const voltlineNextSteps: NextStep[] = [
  {
    num: '// 01 · NEXT 24 HOURS',
    title: 'Mark gets his dashboard link',
    description:
      'Magic-link SMS just sent to 0411 567 234. One tap and he\'s logged in — leads will start flowing into his inbox the moment the funnel goes live.',
  },
  {
    num: '// 02 · WEEK 1',
    title: 'Launch the Meta ad set',
    description:
      "You'll spin up the ad campaign from the Webnua Meta dashboard. $40/day to start. Targets Perth north-of-river postcodes.",
  },
  {
    num: '// 03 · DAY 30',
    title: 'Check-in + first iteration',
    description:
      'Auto-scheduled review meeting on day 30. Look at conversion, CPL, top-performing job rows, and decide what to A/B test next.',
  },
];

// Progressive preview-state builders — each step adds another section.
// The preview pane reads the slug for the current step and renders only
// what should be visible by then.

const baseHeader = {
  logo: VOLTLINE_LOGO,
  phone: VOLTLINE_PHONE,
};

const baseDomain = 'voltline.com.au';

export const previewAfterBasics: FunnelPreviewState = {
  domain: baseDomain,
  header: baseHeader,
};

export const previewAfterIdea: FunnelPreviewState = {
  domain: baseDomain,
  header: baseHeader,
  eyebrow: { text: 'Sparkies on call · Perth metro' },
  headline: {
    text: (
      <>
        You&apos;re not selling sparky hours.
        <br />
        You&apos;re selling <em>your Tuesday back</em>.
      </>
    ),
  },
};

export const previewAfterOffer: FunnelPreviewState = {
  ...previewAfterIdea,
  sub: {
    text: (
      <>
        24/7 emergency sparky. Same-day for everything else.{' '}
        <strong>Licensed, insured, fixed-rate menu published.</strong>
      </>
    ),
  },
  offerCard: {
    num: <em>90 min</em>,
    headline: '— or $50 off the call-out',
    sub: 'Skin in the game. EC Lic 47829 · $20M PL.',
  },
  cta: {
    primary: "Book a sparky · today's slots →",
    secondary: '☏ 0411 567 234',
  },
};

export const previewAfterTrust: FunnelPreviewState = {
  ...previewAfterOffer,
  trust: {
    items: [
      { num: '1,840+', label: 'Jobs completed' },
      { num: '11 yrs', label: 'Servicing Perth' },
      { num: '4.9 ★', label: '184 reviews' },
      { num: 'EC 47829', label: 'Licensed' },
    ],
  },
  jobs: {
    title: '// Common jobs · prices on the page',
    rows: [
      { name: 'Powerpoint install', price: '$85' },
      { name: 'Smoke alarm hardwire', price: '$145' },
      { name: 'Light fitting', price: '$95' },
      { name: 'Ceiling fan install', price: '$220' },
      { name: 'Switchboard check', price: '$220' },
      { name: 'RCD replacement', price: '$185' },
    ],
  },
};
