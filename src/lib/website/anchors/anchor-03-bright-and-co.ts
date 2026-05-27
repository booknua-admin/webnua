// =============================================================================
// Anchor 03 — Proximity-led suburban cleaner (Bright & Co., West Dublin)
//
// Buying motivation: PROXIMITY. Customer isn't shopping a service, they're
// choosing a person who'll be in their house every Tuesday for the next
// five years. Reviews at position 2 because "your neighbours use us" is
// the entire conversion thesis. Contact section carries the inline form
// (contact.showInlineForm = true) — Crown's separate form section pattern
// would be redundant for a 3-field quote.
// =============================================================================

import type { Section } from '../types';
import type { HeroData } from '../sections/hero';
import type { ReviewsData } from '../sections/reviews';
import type { FeaturesData } from '../sections/features';
import type { GalleryData } from '../sections/gallery';
import type { AboutData } from '../sections/about';
import type { ContactData } from '../sections/contact';
import type { CTAData } from '../sections/cta';
import type { Anchor } from './types';

const hero: Partial<HeroData> = {
  layout: 'split',
  imageSide: 'right',
  contentAlign: 'left',
  eyebrow: '// WEEKLY CLEANING · WEST DUBLIN',
  headline: 'A clean home every Tuesday.',
  headlineAccent: 'By the same person. For €18 an hour.',
  sub: 'Bright & Co. cleans 94 homes a week across Castleknock, Carpenterstown and Clonsilla. Same cleaner every visit. Published hourly rate. No quotes, no minimum visit length, no revolving door.',
  ctaPrimaryLabel: 'Get a quote in 60 seconds',
  ctaPrimaryHref: '#sec-contact',
  ctaPrimaryVisible: true,
  ctaSecondaryLabel: "See what's included",
  ctaSecondaryHref: '#sec-features',
  ctaSecondaryVisible: true,
  heroImageUrl: '',
};

const reviews: Partial<ReviewsData> = {
  layout: 'grid',
  columns: 2,
  headerAlign: 'left',
  eyebrow: '// YOUR NEIGHBOURS',
  headline: 'We already clean 47 homes in Castleknock,',
  headlineAccent: 'and 31 in Carpenterstown.',
  sub: "These are the people who'll tell you whether to ring us.",
  items: [
    { id: 'rev-niamh', quote: "We've had Aisling every Tuesday for four years. She knows where the hoover lives, knows the dog by name, knows we like the kitchen done before the rest. That's the bit you can't get from an app.", authorName: 'Niamh & Paul', authorRole: 'Castleknock', avatarUrl: '', rating: 5 },
    { id: 'rev-tom', quote: "Three previous cleaning companies sent three different people in three months. Bright & Co. sent the same lady every time from week one. That's all I was asking for.", authorName: 'Tom', authorRole: 'Carpenterstown', avatarUrl: '', rating: 5 },
    { id: 'rev-aoife', quote: "Asked for the kitchen and bathrooms only. They didn't try to upsell me into a deep-clean package. Booked the next Tuesday, arrived exactly when they said, done in two hours. Easy.", authorName: 'Aoife', authorRole: 'Clonsilla', avatarUrl: '', rating: 5 },
    { id: 'rev-murphys', quote: "Honestly the most consistent service we've ever had. We've recommended them to four neighbours. They all use them now.", authorName: 'The Murphys', authorRole: 'Castleknock Green', avatarUrl: '', rating: 5 },
  ],
};

const features: Partial<FeaturesData> = {
  layout: 'cards',
  columns: 2,
  mediaStyle: 'icon',
  iconStyle: 'soft',
  headerAlign: 'left',
  eyebrow: '// WHAT A STANDARD VISIT INCLUDES',
  headline: "Here's exactly what you get.",
  headlineAccent: 'Same list, every Tuesday.',
  sub: "No 'we'll quote on the day'. The list is the list. If you need something extra (oven, windows, inside the fridge), add it to your visit when you book — we'll tell you what it adds in time, not money.",
  items: [
    { id: 'feat-kitchen', icon: 'house', imageUrl: '', title: 'Kitchen', description: 'Worktops wiped, hob cleaned, sink scrubbed, splashbacks done, floor washed. Bins out, recycling sorted, tea towels swapped for clean ones from your drawer.', linkLabel: '', linkHref: '' },
    { id: 'feat-bathrooms', icon: 'droplet', imageUrl: '', title: 'Bathrooms', description: "Bath, basin, toilet, taps and shower screen scrubbed. Floor mopped, mirrors clear, towels folded or swapped if you've left fresh ones out.", linkLabel: '', linkHref: '' },
    { id: 'feat-living', icon: 'heart', imageUrl: '', title: 'Living areas', description: 'Surfaces dusted, sofas and rugs hoovered, throws folded, cushions plumped, floor mopped or hoovered as appropriate. Coasters back where they belong.', linkLabel: '', linkHref: '' },
    { id: 'feat-bedrooms', icon: 'leaf', imageUrl: '', title: 'Bedrooms', description: "Beds made or sheets changed (if you've left clean ones out), surfaces dusted, floors hoovered, wardrobe doors closed. Kids' rooms tidied to whatever level you've agreed.", linkLabel: '', linkHref: '' },
  ],
};

const gallery: Partial<GalleryData> = {
  layout: 'grid',
  columns: 3,
  aspect: 'landscape',
  headerAlign: 'left',
  showFilters: false,
  eyebrow: '// HOMES WE KEEP CLEAN',
  headline: 'Kitchens you might recognise.',
  sub: 'Real Tuesday-morning kitchens in real houses on your road. Permission given, taken on a phone, no styling.',
  items: [
    { id: 'gal-castleknock-1', imageUrl: '', caption: 'Castleknock', category: '' },
    { id: 'gal-carpenterstown-1', imageUrl: '', caption: 'Carpenterstown', category: '' },
    { id: 'gal-clonsilla-1', imageUrl: '', caption: 'Clonsilla', category: '' },
    { id: 'gal-castleknock-2', imageUrl: '', caption: 'Castleknock', category: '' },
    { id: 'gal-carpenterstown-2', imageUrl: '', caption: 'Carpenterstown', category: '' },
    { id: 'gal-clonsilla-2', imageUrl: '', caption: 'Clonsilla', category: '' },
  ],
  ctaVisible: false,
  ctaLabel: '',
  ctaHref: '',
};

const about: Partial<AboutData> = {
  layout: 'split',
  extra: 'stats',
  imageSide: 'left',
  eyebrow: '// WHO WE ARE',
  headline: 'Bright & Co. is a small local team.',
  headlineAccent: "You'll recognise the van.",
  sub: "Bright & Co. was started by Aisling Doyle in 2017, who still cleans regular Tuesday rounds in Castleknock and trains every new team member personally. The team is six people now. Everyone is vetted, insured, paid the living wage, and known to the families they work for. The same cleaner comes back to your home every visit — that's not a promise, it's how the rota is built.",
  imageUrl: '',
  stats: [
    { id: 'stat-homes', icon: 'house', value: '94', label: 'regular weekly homes' },
    { id: 'stat-postcodes', icon: 'map-pin', value: '5', label: 'postcodes we cover' },
    { id: 'stat-since', icon: 'calendar', value: '2017', label: 'cleaning your roads since' },
  ],
};

const contact: Partial<ContactData> = {
  layout: 'details',
  showInlineForm: true,
  eyebrow: '// GET A QUOTE',
  headline: "Three fields and you're booked in.",
  sub: "Tell us your postcode and the size of the home. We'll text you back the same day with your cleaner's name, the next available Tuesday, and the exact cost — usually within the hour.",
  items: [
    { id: 'con-phone', icon: 'phone', label: 'Phone', value: '01 555 0188', sub: 'Weekdays 9am – 5pm' },
    { id: 'con-email', icon: 'mail', label: 'Email', value: 'hello@brightandco.ie', sub: '' },
    { id: 'con-office', icon: 'clock', label: 'Office', value: 'Weekdays 9am – 5pm', sub: '' },
    { id: 'con-cleaning', icon: 'sparkles', label: 'Cleaning visits', value: 'Tuesday – Saturday, 8am – 4pm', sub: '' },
    { id: 'con-area', icon: 'map-pin', label: 'We clean in', value: 'Castleknock, Carpenterstown, Clonsilla, Blanchardstown, Phoenix Park', sub: '' },
  ],
  formTitle: 'Get your quote',
  formButtonLabel: 'Send & get my quote',
  showPhoneField: true,
};

const cta: Partial<CTAData> = {
  layout: 'split',
  align: 'left',
  eyebrow: '',
  headline: 'Already cleaning the house two doors down.',
  headlineAccent: 'Why not yours?',
  sub: "Send your postcode. We'll text you back today with a real quote and the next Tuesday we can start.",
  primaryVisible: true,
  primaryLabel: 'Get a quote in 60 seconds',
  primaryHref: '#sec-contact',
  secondaryVisible: true,
  secondaryLabel: 'Or call 01 555 0188',
  secondaryHref: 'tel:+35315550188',
  showSignals: false,
};

const sections: Section[] = [
  { id: 'sec-hero', type: 'hero', enabled: true, data: hero as Record<string, unknown> },
  { id: 'sec-reviews', type: 'reviews', enabled: true, data: reviews as Record<string, unknown> },
  { id: 'sec-features', type: 'features', enabled: true, data: features as Record<string, unknown> },
  { id: 'sec-gallery', type: 'gallery', enabled: true, data: gallery as Record<string, unknown> },
  { id: 'sec-about', type: 'about', enabled: true, data: about as Record<string, unknown> },
  {
    id: 'sec-contact',
    type: 'contact',
    enabled: true,
    data: contact as Record<string, unknown>,
    // contact.showInlineForm = true — the form envelope provides the
    // 4-field quote form rendered inline alongside the details.
    form: {
      title: 'Get your quote',
      showTitle: false,
      submitLabel: 'Send & get my quote',
      fields: [
        { id: 'name', label: 'Your name', type: 'text', required: true, leadRole: 'name' },
        { id: 'phone', label: 'Phone', type: 'phone', required: true, leadRole: 'phone' },
        { id: 'postcode', label: 'Postcode', type: 'text', required: true, placeholder: 'D15 / D8 / D7', leadRole: 'address' },
        { id: 'size', label: 'Size of home', type: 'select', required: true, leadRole: 'service', options: ['1-bed apartment', '2-bed apartment', '3-bed house', '4-bed house', '5-bed or larger'] },
      ],
      afterSubmit: { kind: 'message', heading: 'Quote on the way', body: "We'll text you back today with the next Tuesday we can start." },
      colors: {},
    },
  },
  { id: 'sec-cta', type: 'cta', enabled: true, data: cta as Record<string, unknown> },
];

export const anchorBrightAndCo: Anchor = {
  meta: {
    anchorId: 'anchor-03-proximity-led-suburban-cleaner',
    buyingMotivation: 'proximity',
    industry: 'cleaning',
    urgencyMode: 'scheduled',
    voiceVisualNote:
      "Voice: warm, plain, conversational, occasional dry humour, never salesy. Refers to neighbourhoods by name. Talks about doing the work, not selling it. Visually should feel like: split hero with a lifestyle photograph (clean kitchen in daylight, not aspirational, recognisably suburban), warm sage green accent, recurring-service framing throughout. Reviews live near the top because the whole thesis is 'your neighbour uses us'. Inline contact form. Medium density — neither dense like Crown nor airy like Mara. Photo register: lifestyle, warm daylight, real homes that look like the customer's own.",
    whyThisWinsThisCustomer:
      "The customer is not shopping a service, they're choosing a person who'll be in their house every Tuesday for the next five years. The conversion question is not 'are you fast / skilled / cheap', it's 'are you the kind of person my neighbour would recommend'. The page proves: (1) we already work for your neighbours, named, (2) the same team comes back every week, (3) you can see exactly what's included before you ring.",
  },
  brief: {
    businessName: 'Bright & Co.',
    industry: 'cleaning',
    urgencyMode: 'scheduled',
    serviceArea: 'Castleknock, Carpenterstown, Clonsilla, Blanchardstown, Phoenix Park',
    services: [
      'Weekly home cleaning',
      'Fortnightly home cleaning',
      'End-of-tenancy cleans',
      'One-off deep cleans',
      'Holiday-home & Airbnb turnovers',
    ],
    targetCustomer:
      'Working homeowners and young families in the West Dublin suburbs — Castleknock, Carpenterstown, Clonsilla. Two earners, two kids, no time. Looking for a regular weekly clean by the same person, not a one-off. Want to know exactly what is included and who is coming through the door before they commit.',
    usp: 'The same cleaner every visit. Already in your neighbourhood every Tuesday. We tell you who is coming and what is included before you book — no quotes, no surprises.',
    offer: {
      headline: 'A clean home every Tuesday, by the same person, for €18 an hour',
      promise: 'Same cleaner every visit. No revolving door. No quoting back and forth — published hourly rate, no minimum visit length.',
      riskReversal: 'If we miss anything on your list, we come back the next morning and finish it. No quibble.',
      ctaLabel: 'Get a quote in 60 seconds',
    },
    voiceTone: { formality: 3, urgency: 2, technicality: 2 },
    brandColors: { primary: '#5C7A5E', ink: '#2A2823' },
    testimonials: [
      { author: 'Niamh & Paul, Castleknock', text: "We've had Aisling every Tuesday for four years. She knows where the hoover lives, knows the dog by name, knows we like the kitchen done before the rest. That's the bit you can't get from an app." },
      { author: 'Tom, Carpenterstown', text: "Three previous cleaning companies sent three different people in three months. Bright & Co. sent the same lady every time from week one. That's all I was asking for." },
      { author: 'Aoife, Clonsilla', text: "Asked for the kitchen and bathrooms only. They didn't try to upsell me into a deep-clean package. Booked the next Tuesday, arrived exactly when they said, done in two hours. Easy." },
      { author: 'The Murphys, Castleknock Green', text: "Honestly the most consistent service we've ever had. We've recommended them to four neighbours. They all use them now." },
    ],
  },
  page: {
    id: 'home',
    slug: 'home',
    title: 'Home',
    type: 'home',
    seo: {
      title: 'Weekly Home Cleaning · Castleknock, Carpenterstown, Clonsilla — Bright & Co.',
      description: 'The same cleaner every Tuesday. €18 an hour, published rate, no minimum visit. Already cleaning homes in your neighbourhood — see who and where.',
    },
    sections,
  },
};
