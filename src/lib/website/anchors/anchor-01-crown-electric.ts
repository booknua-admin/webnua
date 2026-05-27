// =============================================================================
// Anchor 01 — Speed-led emergency electrician (Crown Electric, Dublin)
//
// Buying motivation: SPEED. Customer in a failure state at 9pm. Two
// conversion paths competing for the same eye: a phone number that rings
// through to a human, OR a three-field form that gets a callback in five
// minutes. Page structure (9 sections, dense, above-the-fold heavy)
// reinforces the speed thesis at every step.
//
// Replaces Voltline as the speed-led example so non-Perth electricians stop
// inheriting "Mark / Cottesloe / EC10437 / Perth coastal suburbs" specifics.
// =============================================================================

import type { Section } from '../types';
import type { HeroData } from '../sections/hero';
import type { TrustData } from '../sections/trust';
import type { OfferData } from '../sections/offer';
import type { ReviewsData } from '../sections/reviews';
import type { FeaturesData } from '../sections/features';
import type { FAQData } from '../sections/faq';
import type { ContactData } from '../sections/contact';
import type { FormSectionData } from '../sections/form';
import type { CTAData } from '../sections/cta';
import type { Anchor } from './types';

const hero: Partial<HeroData> = {
  layout: 'overlay',
  overlayOpacity: 55,
  eyebrow: '// 24/7 EMERGENCY ELECTRICIAN · DUBLIN',
  headline: 'Power out. Sparks. Burning smell.',
  headlineAccent: "We're at your door within the hour.",
  sub: 'A real Dublin sparky picks up — not a call centre. On the doorstep inside 60 minutes or the call-out is free.',
  ctaPrimaryLabel: 'Call 01 555 0199',
  ctaPrimaryHref: 'tel:+35315550199',
  ctaPrimaryVisible: true,
  ctaSecondaryLabel: 'Or send your address',
  ctaSecondaryHref: '#sec-form',
  ctaSecondaryVisible: true,
  heroImageUrl: '',
};

const trust: Partial<TrustData> = {
  display: 'compact-icons',
  columns: 5,
  eyebrow: '',
  headline: '',
  headlineAccent: '',
  sub: '',
  items: [
    { id: 'ts-answered', icon: 'phone', value: '', label: 'Answered', rating: 0, imageUrl: '' },
    { id: 'ts-registered', icon: 'shield-check', value: '', label: 'Registered', rating: 0, imageUrl: '' },
    { id: 'ts-insured', icon: 'shield', value: '', label: 'Insured', rating: 0, imageUrl: '' },
    { id: 'ts-guaranteed', icon: 'circle-check', value: '', label: 'Guaranteed', rating: 0, imageUrl: '' },
    { id: 'ts-local', icon: 'map-pin', value: '', label: 'Dublin', rating: 0, imageUrl: '' },
  ],
};

const offer: Partial<OfferData> = {
  // `stack` layout because Crown's offer is a 3-step value-stack (we answer
  // / we arrive / we fix it), not a priced inclusions card.
  layout: 'stack',
  stackStyle: 'grid',
  columns: 3,
  showNumbers: true,
  tag: '// THE 60-MINUTE PROMISE',
  title: 'On the doorstep in under an hour.',
  titleAccent: 'Or the call-out is on us.',
  sub: "Phone us, or send your address. A qualified electrician will be with you inside 60 minutes anywhere in Dublin city and the inner suburbs. We make it safe, find the fault, get your power back on. Miss the hour and you don't pay for the call-out.",
  items: [
    { id: 'val-answer', icon: 'phone', title: 'We answer', description: 'Calls go to a real Dublin sparky, not a queue. Forms get a callback in 5 minutes.' },
    { id: 'val-arrive', icon: 'truck', title: 'We arrive', description: 'Inside the M50 in under an hour, or the call-out is free.' },
    { id: 'val-fix', icon: 'wrench', title: 'We fix it', description: "No-fix, no-fee. We don't leave until the lights are on." },
  ],
  ctaVisible: true,
  ctaLabel: 'Call now — 01 555 0199',
  ctaHref: 'tel:+35315550199',
};

const reviews: Partial<ReviewsData> = {
  layout: 'grid',
  columns: 3,
  headerAlign: 'left',
  eyebrow: '// REAL CALLOUTS, REAL NIGHTS',
  headline: "Dublin homes we've kept the lights on in.",
  showRatingSummary: true,
  ratingStars: 5,
  ratingValue: '4.9',
  ratingCount: '120+ Google reviews',
  items: [
    {
      id: 'rev-aoife',
      quote: 'Called at 11pm with no power upstairs and two kids in bed. Conor was at the door in 40 minutes. Found the fault, sorted it, gone by 1am. Saved the night.',
      authorName: 'Aoife M.',
      authorRole: 'Clontarf',
      avatarUrl: '',
      rating: 5,
    },
    {
      id: 'rev-brendan',
      quote: 'Smelled burning behind the kitchen socket on a Sunday morning. Phoned five places — Crown was the only one that picked up. Showed up in an hour, made it safe, came back Monday to finish properly.',
      authorName: 'Brendan O.',
      authorRole: 'Rathmines',
      avatarUrl: '',
      rating: 5,
    },
    {
      id: 'rev-mary',
      quote: 'Tenant rang me in a panic — fuse box smoking. Crown took the call directly from her, kept me posted by text, had it isolated before I had left the house.',
      authorName: 'Mary K.',
      authorRole: 'Dún Laoghaire',
      avatarUrl: '',
      rating: 5,
    },
  ],
};

const features: Partial<FeaturesData> = {
  layout: 'numbered',
  columns: 4,
  eyebrow: '// WHAT WE GET CALLED FOR',
  headline: "If it's electrical and it can't wait,",
  headlineAccent: "it's what we do.",
  items: [
    { id: 'feat-power-out', icon: 'zap', imageUrl: '', title: 'Total power failure', description: "Whole house dark. Tripped main breaker that won't reset. We isolate the fault and restore safely.", linkLabel: '', linkHref: '' },
    { id: 'feat-sparks', icon: 'flame', imageUrl: '', title: 'Sparks or burning smell', description: "A burning plastic smell behind a socket is a real emergency. Stop using it, ring us, we'll make it safe.", linkLabel: '', linkHref: '' },
    { id: 'feat-storm', icon: 'wind', imageUrl: '', title: 'Storm damage', description: 'Lightning surge, downed line, board cooked. We assess, isolate, and report to the ESB if needed.', linkLabel: '', linkHref: '' },
    { id: 'feat-smoke-alarm', icon: 'flag', imageUrl: '', title: 'Smoke alarms chirping', description: "Interconnected alarms going off in a tenanted property. We're on-site the same evening, every time.", linkLabel: '', linkHref: '' },
  ],
};

const faq: Partial<FAQData> = {
  // `grid` + columns: 2 = the prototype's "two-col" intent (mapped to a real enum value).
  layout: 'grid',
  columns: 2,
  eyebrow: '// BEFORE YOU CALL',
  headline: 'The questions people ask us at 9pm.',
  items: [
    { id: 'faq-how-fast', question: 'How fast can you actually get here?', answer: 'Under 60 minutes anywhere in Dublin city and the inner suburbs. Last quarter our average was 38 minutes. If we miss the hour, the call-out is on us.' },
    { id: 'faq-real-person', question: 'Will a real person pick up?', answer: "Yes. Calls go to a qualified electrician on call, not a call centre. If we're under a floor with no signal, you'll get a call back within 5 minutes." },
    { id: 'faq-form-vs-call', question: 'Is the form faster or the phone?', answer: "The phone is faster if you can talk. The form is better if you're a landlord forwarding the job, or it's the middle of the night. Either way you'll hear from us in 5 minutes." },
    { id: 'faq-how-much', question: 'How much is the call-out?', answer: "Standard call-out is €120 weekday daytime, €180 evenings, €220 overnight or Sunday. If we don't fix it, you don't pay it. We agree any further work with you before we start." },
    { id: 'faq-safe-to-wait', question: 'Should I turn the power off and wait, or call now?', answer: "If there's any burning smell, smoke, or sparks — switch the main breaker off and call us now. If a single trip switch keeps resetting fine, you can probably wait until morning, but ring us and we'll tell you straight." },
    { id: 'faq-areas', question: 'What areas do you cover?', answer: "Dublin city centre, all inner suburbs, plus Howth, Malahide, Swords, Lucan, Tallaght, Dún Laoghaire, Bray. Anywhere inside the M50 we'll be there in under an hour." },
  ],
};

const contact: Partial<ContactData> = {
  layout: 'details',
  showInlineForm: false,
  eyebrow: '// HOW TO REACH US',
  headline: 'Two ways. Both are answered.',
  items: [
    { id: 'con-phone', icon: 'phone', label: 'Phone', value: '01 555 0199', sub: '24 hours, every day' },
    { id: 'con-email', icon: 'mail', label: 'Email', value: 'callouts@crownelectric.ie', sub: 'Replies within 5 minutes' },
    { id: 'con-hours', icon: 'clock', label: 'Office', value: 'Weekdays 8am – 6pm', sub: '' },
    { id: 'con-area', icon: 'map-pin', label: 'Service area', value: 'Inside the M50, plus Howth, Malahide, Swords, Lucan, Tallaght, Dún Laoghaire, Bray', sub: '' },
  ],
  ctaLabel: 'Send your address',
  ctaHref: '#sec-form',
};

const formBand: Partial<FormSectionData> = {
  eyebrow: '// SEND US YOUR ADDRESS',
  heading: "Type three fields. We'll call you back in 5 minutes.",
};

const cta: Partial<CTAData> = {
  layout: 'centered',
  align: 'center',
  eyebrow: '',
  headline: "If it's electrical and it can't wait,",
  headlineAccent: 'ring us now.',
  sub: '01 555 0199 · 24 hours, every day of the year.',
  primaryVisible: true,
  primaryLabel: 'Call 01 555 0199',
  primaryHref: 'tel:+35315550199',
  secondaryVisible: true,
  secondaryLabel: 'Or send your address',
  secondaryHref: '#sec-form',
  showSignals: false,
};

const sections: Section[] = [
  {
    id: 'sec-hero',
    type: 'hero',
    enabled: true,
    data: hero as Record<string, unknown>,
    // Section-level form envelope — Crown's hero offers a 3-field callback
    // form alongside the phone CTA so the visitor can convert above the
    // fold without leaving the hero.
    form: {
      title: 'Get a callback in 5 minutes',
      showTitle: true,
      submitLabel: 'Send & call me back',
      fields: [
        { id: 'name', label: 'Your name', type: 'text', required: true, leadRole: 'name' },
        { id: 'phone', label: 'Phone', type: 'phone', required: true, leadRole: 'phone' },
        { id: 'problem', label: "What's wrong?", type: 'text', required: true, placeholder: 'e.g. burning smell behind socket', leadRole: 'service' },
      ],
      afterSubmit: { kind: 'message', heading: "We've got it", body: "We'll call you in 5 minutes." },
      colors: {},
    },
  },
  { id: 'sec-trust', type: 'trust', enabled: true, data: trust as Record<string, unknown> },
  { id: 'sec-offer', type: 'offer', enabled: true, data: offer as Record<string, unknown> },
  { id: 'sec-reviews', type: 'reviews', enabled: true, data: reviews as Record<string, unknown> },
  { id: 'sec-features', type: 'features', enabled: true, data: features as Record<string, unknown> },
  { id: 'sec-faq', type: 'faq', enabled: true, data: faq as Record<string, unknown> },
  { id: 'sec-contact', type: 'contact', enabled: true, data: contact as Record<string, unknown> },
  {
    id: 'sec-form',
    type: 'form',
    enabled: true,
    data: formBand as Record<string, unknown>,
    form: {
      title: 'Send us your address',
      showTitle: false,
      submitLabel: 'Send & call me back',
      fields: [
        { id: 'name', label: 'Your name', type: 'text', required: true, leadRole: 'name' },
        { id: 'phone', label: 'Phone', type: 'phone', required: true, leadRole: 'phone' },
        { id: 'address', label: 'Address or postcode', type: 'text', required: true, leadRole: 'address' },
        { id: 'problem', label: "What's wrong?", type: 'textarea', required: true, placeholder: "e.g. no power upstairs, tripped breaker won't reset", leadRole: 'service' },
      ],
      afterSubmit: { kind: 'message', heading: 'Got it', body: "We'll call you in 5 minutes with a time." },
      colors: {},
    },
  },
  { id: 'sec-cta', type: 'cta', enabled: true, data: cta as Record<string, unknown> },
];

export const anchorCrownElectric: Anchor = {
  meta: {
    anchorId: 'anchor-01-speed-led-emergency-electrician',
    buyingMotivation: 'speed',
    industry: 'electrician',
    urgencyMode: 'emergency',
    voiceVisualNote:
      "Voice: urgent, direct, no fluff, every line either reassures or pushes to act. Visually should feel like: overlay hero with a real photograph (hand at fuse box, evening light, action not portrait), single dominant red accent, dense above-the-fold, dual conversion paths (call + form) competing for the same eye. Minimal padding. No magazine layout. The whole page exists to capture the 9pm-no-power customer whether they're a caller or a typer.",
    whyThisWinsThisCustomer:
      "The buyer is in a failure state. They want one of two things: dial a number that rings through to a human, or type three fields and have someone call them back. The hero gives them both, side-by-side, on top of an image that signals 'someone real, hands-on, ready'. Everything below the fold either reinforces speed or removes the last objection.",
  },
  brief: {
    businessName: 'Crown Electric',
    industry: 'electrician',
    urgencyMode: 'emergency',
    serviceArea: 'Dublin and surrounding counties',
    services: [
      '24/7 emergency callouts',
      'Power failures & tripping fuses',
      'Burning smells & sparks',
      'Storm damage',
      'Smoke alarms not working',
    ],
    targetCustomer:
      'Homeowners and landlords in Dublin who have an electrical problem right now and need someone on-site within the hour. Not shopping around. Not getting three quotes. Calling the first number that looks legitimate and rings through to a human — or typing three fields if they are a landlord forwarding the problem.',
    usp: 'A real Dublin sparky picks up the phone, 24/7, no call centre. On-site within the hour or the call-out is free.',
    offer: {
      headline: 'An electrician at your door within the hour',
      promise: "Call or send your address — we'll be there inside 60 minutes or the call-out is on us.",
      riskReversal: "No-fix, no-fee. We don't leave until your power is back on.",
      ctaLabel: 'Call 01 555 0199',
    },
    voiceTone: { formality: 2, urgency: 5, technicality: 3 },
    brandColors: { primary: '#D33A2C', ink: '#0A0A0A' },
    testimonials: [
      { author: 'Aoife M., Clontarf', text: 'Called at 11pm with no power upstairs and two kids in bed. Conor was at the door in 40 minutes. Found the fault, sorted it, gone by 1am. Saved the night.' },
      { author: 'Brendan O., Rathmines', text: 'Smelled burning behind the kitchen socket on a Sunday morning. Phoned five places — Crown was the only one that picked up. Showed up in an hour, made it safe, came back Monday to finish properly.' },
      { author: 'Mary K., Dún Laoghaire (landlord)', text: 'Tenant rang me in a panic — fuse box smoking. Crown took the call directly from her, kept me posted by text, had it isolated before I had left the house.' },
    ],
  },
  page: {
    id: 'home',
    slug: 'home',
    title: 'Home',
    type: 'home',
    seo: {
      title: 'Emergency Electrician Dublin — At Your Door In Under An Hour | Crown Electric',
      description: 'Power out, sparks or burning smells? A qualified Dublin electrician is at your door in 60 minutes — or the call-out is free. 24/7, no call centre.',
    },
    sections,
  },
};
