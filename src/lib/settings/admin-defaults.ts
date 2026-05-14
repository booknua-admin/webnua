export const adminDefaultsAutomations = [
  {
    id: 'instant-confirm',
    name: 'Instant confirm SMS',
    description: 'Fires immediately when a lead submits the funnel form. Highest ROI automation.',
    defaultOn: true,
  },
  {
    id: '24h-followup',
    name: '24-hour follow-up sequence',
    description: '3-step SMS/email/SMS sequence if a lead is still "new" after 24 hours.',
    defaultOn: true,
  },
  {
    id: 'review-loop',
    name: 'Review request loop',
    description:
      'Asks for a Google review 2 hours after job completion. Single follow-up at day 5.',
    defaultOn: true,
  },
  {
    id: 'no-show-recovery',
    name: 'No-show recovery',
    description:
      'Rebooking link after a customer misses a booked job. Off by default — clients enable once they have data on their no-show rate.',
    defaultOn: false,
  },
];

export const adminDefaultsBranding = [
  { label: 'Primary font', value: 'Inter Tight', editable: true },
  { label: 'Mono font', value: 'JetBrains Mono', editable: true },
  {
    label: 'Default accent color',
    value: '#d24317 (Webnua rust)',
    swatch: true,
    editable: true,
  },
];

export const adminDefaultsPricing = [
  { label: 'Plan currency', value: 'AUD ($)', editable: false },
  {
    label: 'Flat-rate buffer %',
    sub: 'Applied to suggested job prices',
    value: '15%',
    editable: true,
  },
];
