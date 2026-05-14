export const clientHelpFaqs: {
  id: string;
  question: string;
  answer?: React.ReactNode;
  defaultOpen?: boolean;
}[] = [
  {
    id: 'change-lead-status',
    question: "How do I change a lead's status?",
    answer:
      'Open the lead from your inbox, then tap one of the status buttons at the top: New, Contacted, Booked, Completed, or Lost. The status automation knows to pause if you mark someone "Contacted" — so no duplicate follow-ups.',
    defaultOpen: true,
  },
  { id: 'pause-automation', question: 'Can I pause an automation?' },
  {
    id: 'reschedule',
    question: 'A customer wants to reschedule — how do I do it?',
  },
  { id: 'reviews', question: 'How do reviews get collected automatically?' },
  {
    id: 'locked-page',
    question: 'Why is my landing page locked from editing?',
  },
  { id: 'export', question: 'Can I export my customer data?' },
  {
    id: 'cancel',
    question: 'What happens if I cancel my Webnua subscription?',
  },
];

export const clientHelpRecentSupport = [
  {
    id: 'automation-timing',
    title: 'Question about automation timing',
    when: 'YESTERDAY · RESOLVED',
    summary:
      '"Can we add a 2-hour delay to the review request?" → Craig adjusted, took effect immediately.',
  },
  {
    id: 'page-tweak',
    title: 'Landing page tweak — added smoke alarm service',
    when: '8 DAYS AGO · RESOLVED',
    summary: '"Lots of smoke alarm requests, want it on the jobs menu" → Added to v8 of the page.',
  },
];
