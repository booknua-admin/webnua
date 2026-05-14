import type {
  AdminLeadRow,
  LeadConversation,
  LeadDetail,
  LeadFilterChip,
  LeadTab,
} from '@/lib/leads/types';

export const adminLeadsHero = {
  eyebrow: '// Workspace · all leads',
  title: (
    <>
      Lead <em>inbox</em>.
    </>
  ),
  subtitle: (
    <>
      Every lead across your workspace.{' '}
      <strong>Filter to one client to drill in</strong>, or stay on the inbox to
      manage all together. Click a lead to open the full thread.
    </>
  ),
};

export const adminLeadsClientFilters: LeadFilterChip[] = [
  { id: 'all', label: 'All clients', count: 4 },
  { id: 'freshhome', label: 'FreshHome' },
  { id: 'keyhero', label: 'KeyHero' },
  { id: 'neatworks', label: 'NeatWorks' },
  { id: 'voltline', label: 'Voltline' },
];

export const adminLeadsTabs: LeadTab[] = [
  { id: 'new', label: 'New', count: 23 },
  { id: 'contacted', label: 'Contacted', count: 41 },
  { id: 'booked', label: 'Booked', count: 28 },
  { id: 'completed', label: 'Completed', count: 156 },
  { id: 'lost', label: 'Lost', count: 12 },
  { id: 'spam', label: 'Spam', count: 3 },
];

export const adminLeads: AdminLeadRow[] = [
  {
    id: 'sarah-davies',
    initial: 'SD',
    name: 'Sarah Davies',
    clientName: 'FreshHome',
    clientService: 'Cleaning',
    clientTone: 'freshhome',
    preview:
      '3-bed in Mt Hawthorn, prefers Fri afternoons. Says she saw your $99 first-clean offer on Instagram. Has a small dog.',
    status: 'new',
    age: '8m ago',
    meta: 'Auto-replied',
    metaTone: 'rust',
    unread: true,
    href: '/leads/sarah-davies',
  },
  {
    id: 'mark-kohli',
    initial: 'MK',
    name: 'Mark Kohli',
    clientName: 'FreshHome',
    clientService: 'Cleaning',
    clientTone: 'freshhome',
    preview:
      '2-bed apartment, Mt Lawley. Tenancy ending in 9 days, needs bond clean ASAP. Cash or card.',
    status: 'new',
    statusLabel: 'Urgent',
    age: '32m ago',
    meta: 'Auto-replied',
    metaTone: 'rust',
    unread: true,
    href: '/leads/mark-kohli',
  },
  {
    id: 'tom-mitchell',
    initial: 'TM',
    name: 'Tom Mitchell',
    clientName: 'KeyHero',
    clientService: 'Locksmith',
    clientTone: 'keyhero',
    preview:
      'Locked out at the back patio door. Front door access OK but needs a sparky after — RCD tripped.',
    status: 'contacted',
    age: '1h ago',
    meta: 'Called back',
    metaTone: 'quiet',
    unread: false,
    href: '/leads/tom-mitchell',
  },
  {
    id: 'emma-petrov',
    initial: 'EP',
    name: 'Emma Petrov',
    clientName: 'FreshHome',
    clientService: 'Cleaning',
    clientTone: 'freshhome',
    preview:
      '4-bed in Subiaco, looking for fortnightly. Wants same cleaner each time, pet-friendly products.',
    status: 'booked',
    age: '2h ago',
    meta: 'Tue 9am',
    metaTone: 'good',
    unread: false,
    href: '/leads/emma-petrov',
  },
  {
    id: 'julia-rivera',
    initial: 'JR',
    name: 'Julia Rivera',
    clientName: 'KeyHero',
    clientService: 'Locksmith',
    clientTone: 'keyhero',
    preview:
      'Wants a smart lock installed on her Airbnb. Asked for a quote on a Yale Assure 2 with bridge.',
    status: 'booked',
    age: '3h ago',
    meta: 'Tue 10:15am',
    metaTone: 'good',
    unread: false,
    href: '/leads/julia-rivera',
  },
  {
    id: 'jess-torres',
    initial: 'JT',
    name: 'Jess Torres',
    clientName: 'FreshHome',
    clientService: 'Cleaning',
    clientTone: 'freshhome',
    preview:
      'Quote request for a one-off deep clean. House for sale, agent walking through Sunday morning.',
    status: 'booked',
    age: '5h ago',
    meta: 'Wed 4pm',
    metaTone: 'good',
    unread: false,
    href: '/leads/jess-torres',
  },
  {
    id: 'aoife-conroy',
    initial: 'AC',
    name: 'Aoife Conroy',
    clientName: 'NeatWorks',
    clientService: 'Cleaning',
    clientTone: 'neatworks',
    preview:
      'End-of-tenancy in Phibsboro. Two cats. Asked about timing for landlord inspection on Friday.',
    status: 'contacted',
    age: 'Yesterday',
    meta: 'Waiting reply',
    metaTone: 'quiet',
    unread: false,
    href: '/leads/aoife-conroy',
  },
  {
    id: 'andrew-hawthorn',
    initial: 'AH',
    name: 'Andrew Hawthorn',
    clientName: 'FreshHome',
    clientService: 'Cleaning',
    clientTone: 'freshhome',
    preview:
      "Asked about pricing for office cleans. Doesn't fit FreshHome — auto-replied with referral to Trent at CleanPro.",
    status: 'lost',
    statusLabel: 'Referred',
    age: 'Yesterday',
    meta: 'Commercial',
    metaTone: 'quiet',
    unread: false,
    href: '/leads/andrew-hawthorn',
  },
];

export const freshhomeLeadDetail: LeadDetail = {
  id: 'sarah-davies',
  backHref: '/leads',
  backLabel: 'Back to lead inbox',
  tag: '// Lead detail · client: FreshHome',
  title: (
    <>
      Sarah <em>Davies</em>.
    </>
  ),
  subtitle: (
    <>
      Full history.{' '}
      <strong>Every lead touchpoint in one view</strong> &mdash; form submit,
      automated SMS, manual reply, status changes, all in chronological order.
      The single most-used screen in the platform.
    </>
  ),
  avatar: 'SD',
  name: 'Sarah Davies',
  metaParts: [
    <strong key="phone">0408 712 449</strong>,
    'sarah.davies@gmail.com',
    'Mt Hawthorn, Perth',
  ],
  clientPillLabel: 'FreshHome',
  status: 'new',
  timeline: {
    eventCount: 5,
    events: [
      {
        id: 'auto-reply',
        dot: 'sms-out',
        auto: true,
        meta: (
          <>
            <span>SMS · OUTGOING · automated</span>
            <span>·</span>
            <span>6 min ago</span>
          </>
        ),
        body: (
          <>
            Auto-reply <em>delivered</em> via the instant-confirm automation.
          </>
        ),
        snippet:
          '"Hey Sarah, Lisa from FreshHome here. Got your enquiry — I’ll call you back within 15 mins to lock in a slot..."',
        rightTime: (
          <>
            2m later
            <br />
            <strong>8:34 AM</strong>
          </>
        ),
      },
      {
        id: 'form-submit',
        dot: 'form',
        meta: (
          <>
            <span>FORM SUBMIT · freshhome.com.au</span>
            <span>·</span>
            <span>8 min ago</span>
          </>
        ),
        snippet: (
          <>
            <strong>Service:</strong> Fortnightly clean
            <br />
            <strong>Bedrooms:</strong> 3
            <br />
            <strong>Notes:</strong> &ldquo;Looking for someone reliable. Have a
            small dog (poodle). Prefer Fri afternoons. Saw your $99 first-clean
            offer on Insta.&rdquo;
            <br />
            <strong>Source:</strong> Meta ad · &ldquo;Saturday back&rdquo;
            creative
          </>
        ),
        rightTime: (
          <>
            8m ago
            <br />
            <strong>8:32 AM</strong>
          </>
        ),
      },
      {
        id: 'sched-1',
        dot: 'scheduled-sms',
        pending: true,
        meta: <span>24h follow-up · scheduled</span>,
        body: (
          <>
            Step 1 of the 24-hour follow-up sequence will send tomorrow at 8:32
            AM if status is still &ldquo;New&rdquo;.
          </>
        ),
        rightTime: (
          <>
            in 23h
            <br />
            <strong>Tomorrow</strong>
          </>
        ),
      },
      {
        id: 'sched-2',
        dot: 'scheduled-email',
        pending: true,
        meta: <span>24h follow-up · email step</span>,
        body: (
          <>
            Step 2 will fire 48h later. Subject: &ldquo;Still need a cleaner,
            Sarah?&rdquo;
          </>
        ),
        rightTime: <>in 3 days</>,
      },
      {
        id: 'sched-3',
        dot: 'scheduled-sms',
        pending: true,
        meta: <span>24h follow-up · final SMS</span>,
        body: 'Last automated touch before the lead drops to "Lost".',
        rightTime: <>in 8 days</>,
      },
    ],
  },
  quickActions: [
    {
      icon: '✉',
      label: 'Open conversation',
      primary: true,
      href: '/leads/sarah-davies/conversation',
    },
    { icon: '☏', label: 'Click to call' },
    { icon: '▤', label: 'Book a job' },
    { icon: '✎', label: 'Add note' },
  ],
  rail: [
    {
      heading: '// LEAD SOURCE',
      rows: [
        { label: 'Source', value: 'Meta ad', accent: true },
        { label: 'Campaign', value: '$99 first clean' },
        { label: 'Creative', value: '"Saturday back"' },
        { label: 'Landing page', value: 'freshhome.com.au' },
        { label: 'Time on page', value: '2 min 18s' },
      ],
    },
    {
      heading: '// AUTOMATIONS',
      rows: [
        { label: 'Instant confirm', value: '✓ Sent', tone: 'good' },
        { label: '24h follow-up', value: 'Scheduled' },
        {
          label: 'Review request',
          value: 'Awaiting completion',
          tone: 'quiet',
        },
      ],
    },
    {
      heading: '// LEAD VALUE',
      rows: [
        { label: 'Est. first job', value: '$99 (first clean)' },
        { label: 'If recurring', value: '$185 × 26/yr', accent: true },
        { label: 'Lifetime est.', value: '~$4,810', accent: true },
      ],
    },
  ],
  conversationHref: '/leads/sarah-davies/conversation',
};

export const freshhomeConversation: LeadConversation = {
  id: 'sarah-davies',
  backHref: '/leads/sarah-davies',
  backLabel: 'Back to Sarah Davies',
  tag: '// Lead · Sarah Davies',
  title: (
    <>
      <em>Conversation</em>.
    </>
  ),
  subtitle: (
    <>
      Two-way SMS and email thread with the lead.{' '}
      <strong>Automation sends appear with an accent tag</strong> so you always
      know what was you vs the system. Send replies from here directly &mdash;
      no flipping to your personal phone.
    </>
  ),
  avatar: 'SD',
  name: 'Sarah Davies',
  headerMeta: <>0408 712 449 · sarah.davies@gmail.com</>,
  channelTabs: [
    { id: 'all', label: 'All' },
    { id: 'sms', label: 'SMS' },
    { id: 'email', label: 'Email' },
  ],
  days: [
    {
      id: 'today',
      label: 'Today · May 13',
      messages: [
        {
          id: 'm-system-1',
          kind: 'system',
          body: '▽ Lead submitted via freshhome.com.au · 3-bed fortnightly',
        },
        {
          id: 'm1',
          kind: 'auto',
          body: 'Hey Sarah, Lisa from FreshHome here. Got your enquiry — I’ll call you back within 15 mins to lock in a slot. If urgent reply HELP and I’ll bump you up. — Lisa',
          autoLabel: 'AUTO',
          channel: 'SMS',
          delivered: true,
          time: '8:34 AM',
        },
        {
          id: 'm2',
          kind: 'incoming',
          body: 'Hi Lisa! No rush, just enquiring. Fortnightly works for us. Do you do Fridays?',
          metaPrefix: 'SARAH',
          channel: 'SMS',
          time: '8:41 AM',
        },
        {
          id: 'm3',
          kind: 'outgoing',
          body: 'Fridays are perfect! I’ve got 2pm or 4pm slots open this Fri (May 16). The $99 first-clean is yours — fortnightly after that goes back to $185. Which time suits?',
          metaPrefix: 'LISA',
          channel: 'SMS',
          delivered: true,
          time: '9:12 AM',
        },
        {
          id: 'm4',
          kind: 'incoming',
          body: '2pm please. House is 3-bed in Mt Hawthorn — I’ll text the address closer to the date. Cash on the day OK?',
          metaPrefix: 'SARAH',
          channel: 'SMS',
          time: '9:18 AM',
        },
        {
          id: 'm5',
          kind: 'outgoing',
          body: 'Cash is great. You’re locked in for Fri May 16 · 2pm. I’ll send a confirmation now and a reminder Thursday evening. Looking forward!',
          metaPrefix: 'LISA',
          channel: 'SMS',
          delivered: true,
          time: '9:21 AM',
        },
        {
          id: 'm-system-2',
          kind: 'system',
          body: '✓ Status changed → BOOKED · Fri May 16 · 2:00 PM · $99 first-clean',
        },
      ],
    },
  ],
  composer: {
    channelToggle: 'SMS ↕',
    placeholder: 'Reply to Sarah…',
    helpers: [],
  },
  quickReplies: [
    { icon: '📅', label: 'Send booking confirmation' },
    { icon: '⏰', label: 'Send 24h reminder' },
    { icon: '💰', label: 'Send payment request' },
    { icon: '⭐', label: 'Request review' },
  ],
  rail: [
    {
      heading: '// LEAD STATUS',
      rows: [
        { label: 'Current', value: '● Booked', tone: 'good' },
        { label: 'Service', value: 'First clean · $99' },
        {
          label: 'Scheduled',
          value: 'Fri May 16 · 2:00 PM',
          accent: true,
        },
        { label: 'Address', value: 'Awaiting' },
      ],
    },
    {
      heading: '// CONVERSATION META',
      rows: [
        { label: 'Started', value: 'Today, 8:32 AM' },
        { label: 'Messages', value: '7 total' },
        { label: 'Response time', value: '2 min avg', accent: true },
        { label: 'Channel', value: 'SMS only' },
      ],
    },
  ],
};
