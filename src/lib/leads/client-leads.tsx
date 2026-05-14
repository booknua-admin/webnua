import type {
  ClientLeadRow,
  LeadConversation,
  LeadDetail,
  LeadTab,
} from '@/lib/leads/types';

export const clientLeadsTabs: LeadTab[] = [
  { id: 'new', label: 'New', count: 5 },
  { id: 'contacted', label: 'Contacted', count: 4 },
  { id: 'booked', label: 'Booked', count: 12 },
  { id: 'lost', label: 'Lost', count: 2 },
  { id: 'all', label: 'All' },
];

export const clientLeadsHero = {
  eyebrow: '// Voltline · 23 leads total',
  title: (
    <>
      Lead <em>inbox</em>.
    </>
  ),
  subtitle: (
    <>
      Every lead from your funnel.{' '}
      <strong>5 new, 4 you&rsquo;ve contacted, 12 booked</strong>. Click a row
      to see the full conversation thread.
    </>
  ),
};

export const clientLeads: ClientLeadRow[] = [
  {
    id: 'sarah-davies',
    initial: 'SD',
    name: 'Sarah Davies',
    suburb: 'Mt Hawthorn',
    preview:
      'Powerpoint install + replacing a couple of fittings. Saw the 90-min promise.',
    status: 'new',
    urgency: 'asap',
    age: '32m',
    unread: true,
    href: '/leads/sarah-davies',
  },
  {
    id: 'mark-kohli',
    initial: 'MK',
    name: 'Mark Kohli',
    suburb: 'Subiaco',
    preview:
      'Switchboard tripping every time the dryer runs. Wants someone today.',
    status: 'new',
    urgency: 'today',
    age: '2h',
    unread: true,
    href: '/leads/mark-kohli',
  },
  {
    id: 'emma-petrov',
    initial: 'EP',
    name: 'Emma Petrov',
    suburb: 'Inglewood',
    preview:
      'Quote for 4 ceiling fans + 2 light fittings. Renovating, no rush.',
    status: 'new',
    age: '4h',
    unread: true,
    href: '/leads/emma-petrov',
  },
  {
    id: 'tom-reilly',
    initial: 'TR',
    name: 'Tom Reilly',
    suburb: 'Highgate',
    preview:
      'Heat pump install. Has the unit, just needs wiring + isolator.',
    status: 'new',
    age: 'Yesterday',
    unread: true,
    href: '/leads/tom-reilly',
  },
  {
    id: 'jess-torres',
    initial: 'JT',
    name: 'Jess Torres',
    suburb: 'Mt Lawley',
    preview:
      'Quote: full rewire on 1920s bungalow. Knob and tube, fingers crossed.',
    status: 'new',
    age: 'Yesterday',
    unread: true,
    href: '/leads/jess-torres',
  },
  {
    id: 'andrew-hassan',
    initial: 'AH',
    name: 'Andrew Hassan',
    suburb: 'Mt Hawthorn',
    preview:
      'Booked for Friday 4:30pm — smoke alarm hardwire × 4. Confirmed.',
    status: 'booked',
    age: '2d',
    unread: false,
    href: '/leads/andrew-hassan',
  },
  {
    id: 'liam-reilly',
    initial: 'LR',
    name: 'Liam Reilly',
    suburb: 'Highgate',
    preview:
      'Booked for today 1pm — ceiling fan install + RCD replacement.',
    status: 'booked',
    age: '3d',
    unread: false,
    href: '/leads/liam-reilly',
  },
  {
    id: 'raj-patel',
    initial: 'RP',
    name: 'Raj Patel',
    suburb: 'Maylands',
    preview:
      'Booked for today 10am — powerpoint × 4 with USB upgrade.',
    status: 'booked',
    age: '4d',
    unread: false,
    href: '/leads/raj-patel',
  },
];

export const voltlineLeadDetail: LeadDetail = {
  id: 'sarah-davies',
  backHref: '/leads',
  backLabel: 'Back to lead inbox',
  tag: '// Lead · Sarah Davies · Mt Hawthorn',
  title: (
    <>
      Sarah <em>Davies</em>.
    </>
  ),
  subtitle: (
    <>
      Submitted form 32 minutes ago.{' '}
      <strong>Auto-confirm SMS delivered, she replied &ldquo;yes please.&rdquo;</strong>{' '}
      Your move &mdash; call her back or hand off to the next-day follow-up
      automation.
    </>
  ),
  avatar: 'SD',
  name: 'Sarah Davies',
  metaParts: [
    <strong key="phone">0408 712 449</strong>,
    'sarah.davies@gmail.com',
    'Mt Hawthorn, Perth',
  ],
  status: 'new',
  timeline: {
    eventCount: 4,
    events: [
      {
        id: 'incoming-sms',
        dot: 'sms-in',
        meta: (
          <>
            <span>SMS · INCOMING · 0408 712 449</span>
            <span>·</span>
            <span>14 min ago</span>
          </>
        ),
        snippet:
          '"Yes please. Wednesday afternoon would be great if you can fit me in."',
      },
      {
        id: 'outgoing-sms',
        dot: 'sms-out',
        auto: true,
        meta: (
          <>
            <span>SMS · OUTGOING · automated</span>
            <span>32 min ago</span>
          </>
        ),
        snippet:
          '"Hey Sarah, Mark from Voltline here. Got your enquiry — I’ll call you back within 90 mins to lock in a slot. If urgent reply HELP and I’ll bump you up. — Mark"',
      },
      {
        id: 'status-created',
        dot: 'status',
        meta: (
          <>
            <span>STATUS · Lead created</span>
            <span>·</span>
            <span>32 min ago</span>
          </>
        ),
        body: 'Status set to "New" — pending first contact.',
      },
      {
        id: 'form-submit',
        dot: 'form',
        meta: (
          <>
            <span>FORM SUBMIT · voltline.com.au</span>
            <span>·</span>
            <span>32 min ago</span>
          </>
        ),
        snippet: (
          <>
            <strong>What do you need?</strong>
            <br />
            Powerpoint install + replacing a couple of light fittings in the
            dining room. Saw your 90-min promise on Instagram, hoping you can
            come this week.
            <br />
            <br />
            <strong>Property:</strong> 3-bed weatherboard, Mt Hawthorn
            <br />
            <strong>Best time to call:</strong> Weekday afternoons
            <br />
            <strong>Budget comfort:</strong> Has flat-rate menu on the funnel as
            reference
          </>
        ),
      },
    ],
  },
  quickActions: [
    { icon: '☏', label: 'Call Sarah back now', primary: true },
    {
      icon: '✉',
      label: 'Send SMS reply',
      href: '/leads/sarah-davies/conversation',
    },
    { icon: '▤', label: 'Book a job from this lead' },
    { icon: '⤿', label: 'Push to 24h follow-up' },
  ],
  rail: [
    {
      heading: '// LEAD DETAILS',
      rows: [
        { label: 'Source', value: 'Instagram Ads · voltline.com.au' },
        {
          label: 'Job type',
          value: 'Powerpoint install + light fittings',
        },
        { label: 'Estimate', value: '$120-180 (flat-rate menu)' },
        {
          label: 'First contact',
          value: 'Pending · 14 min ago she replied yes',
        },
      ],
    },
    {
      heading: '// AUTOMATIONS RUNNING',
      rows: [
        {
          label: 'Instant confirm',
          value: 'Sent 32m ago',
          tone: 'good',
        },
        {
          label: '24h follow-up',
          value: 'Armed · fires tomorrow if not contacted',
          tone: 'default',
        },
      ],
    },
  ],
  conversationHref: '/leads/sarah-davies/conversation',
};

export const voltlineConversation: LeadConversation = {
  id: 'sarah-davies',
  backHref: '/leads/sarah-davies',
  backLabel: 'Back to Sarah Davies',
  tag: '// CONVERSATION · Sarah Davies · lead',
  title: (
    <>
      Reply to <em>Sarah</em>.
    </>
  ),
  subtitle: (
    <>
      Two-way SMS thread with this lead.{' '}
      <strong>Automated messages are marked with the &ldquo;AUTO&rdquo; tag</strong>{' '}
      so you always know what was you vs the system. Send replies from here
      &mdash; no flipping to your personal phone.
    </>
  ),
  avatar: 'SD',
  name: 'Sarah Davies',
  headerMeta: (
    <>
      <strong>0408 712 449</strong> · Mt Hawthorn · lead · new this morning
    </>
  ),
  channelTabs: [
    { id: 'sms', label: 'SMS' },
    { id: 'email', label: 'Email' },
  ],
  headerActions: ['☏', '⌄', '⋯'],
  days: [
    {
      id: 'today',
      label: 'Today · 13 May 2026',
      messages: [
        {
          id: 'm1',
          kind: 'incoming',
          body: 'Hi, found you on Instagram. Need a sparky for some powerpoints and a couple of light fittings. Quick question — can you do Wednesday afternoons?',
          channel: 'Form',
          time: '10:03 AM',
        },
        {
          id: 'm2',
          kind: 'auto',
          body: 'Hey Sarah, Mark from Voltline here. Got your enquiry — I’ll call you back within 90 mins to lock in a slot. If urgent reply HELP and I’ll bump you up. — Mark',
          autoLabel: 'AUTO · INSTANT CONFIRM',
          delivered: true,
          time: '10:03 AM',
        },
        {
          id: 'm3',
          kind: 'incoming',
          body: 'Yes please. Wednesday afternoon would be great if you can fit me in.',
          channel: 'SMS',
          time: '10:21 AM',
        },
        {
          id: 'm4',
          kind: 'outgoing',
          body: 'Hi Sarah — yes can do Wed arvo. I’ve got a slot at 2pm or 4pm. Job sounds like ~$120-180 from your description (3 powerpoints + 2 fittings, flat rate). Which time works better?',
          metaPrefix: 'SMS · MARK',
          delivered: true,
          time: '10:34 AM',
        },
        {
          id: 'm5',
          kind: 'incoming',
          body: 'Perfect. 2pm works — kids get home at 3:30 so the earlier slot is better. Address is 14 Caversham Ave, Mt Hawthorn.',
          channel: 'SMS',
          time: '10:35 AM',
        },
      ],
    },
  ],
  composer: {
    channels: ['SMS', 'Email'],
    placeholder: 'Reply to Sarah…',
    defaultValue:
      'Booked you in for 2pm Wed 13 May. I’ll send a confirmation through. See you then. — Mark',
    helpers: ['+ Insert variable', '+ Booking link', '+ Quote template'],
  },
  rail: [
    {
      heading: '// LEAD DETAILS',
      rows: [
        { label: 'Phone', value: '0408 712 449' },
        { label: 'Suburb', value: 'Mt Hawthorn' },
        { label: 'Source', value: 'Instagram Ads' },
        { label: 'Estimate', value: '$120-180', accent: true },
      ],
    },
    {
      heading: '// CONVERSATION META',
      rows: [
        { label: 'Started', value: 'Today, 10:03 AM' },
        { label: 'Messages', value: '5 total' },
        { label: 'Response time', value: '13 min avg', accent: true },
        { label: 'Channel', value: 'SMS only' },
      ],
    },
  ],
};
