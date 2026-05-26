// The default-automations seed consumed by the agency policy resolver
// (`lib/agency/agency-policy-stub.ts` → `automationDefaults` policy key).
// Each entry's `defaultOn` boolean is what flows through; `name` +
// `description` are docs for the V2 editor surface.
//
// The previous `adminDefaultsBranding` + `adminDefaultsPricing` display
// stubs (hardcoded fonts / accent / "AUD ($)" / "15% buffer") were deleted
// in the pre-launch UI polish session — the editor surface that rendered
// them (`/settings/defaults`) is now a "coming online when the agency plan
// launches" placeholder. The wired `brandDefaults` + `pricingDefaults`
// policy keys live in `PolicyValueMap` (`lib/agency/types.ts`); the seed
// for them lives directly in `agency-policy-stub.ts`.
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
