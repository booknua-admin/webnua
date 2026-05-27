// =============================================================================
// Anchor 05 — Simplicity-led handyman (Dave Connolly, South Dublin)
//
// Buying motivation: SIMPLICITY. Customer wants two shelves and a curtain
// rail. The page wins by getting out of their way. 4 sections, no
// headlineAccent on any section, smallest review count (2), single-column
// plain features list. Whole page should read in 90 seconds. Teaches the
// model that a finished site can be the smallest section count that does
// the brand's job — restraint is a brand choice.
// =============================================================================

import type { Section } from '../types';
import type { HeroData } from '../sections/hero';
import type { FeaturesData } from '../sections/features';
import type { ReviewsData } from '../sections/reviews';
import type { ContactData } from '../sections/contact';
import type { Anchor } from './types';

const hero: Partial<HeroData> = {
  layout: 'split',
  imageSide: 'right',
  contentAlign: 'left',
  headlineSize: 'm',
  eyebrow: '// HANDYMAN · SOUTH DUBLIN',
  headline: 'Small jobs. Fair prices. Same day if I can.',
  headlineAccent: '',
  sub: "I'm Dave. I do the small jobs you've been meaning to get round to. €40 an hour, no minimum visit, no quote process. Text me what you need.",
  ctaPrimaryLabel: 'Text Dave',
  ctaPrimaryHref: 'sms:+353875550144',
  ctaPrimaryVisible: true,
  ctaSecondaryLabel: '',
  ctaSecondaryHref: '',
  ctaSecondaryVisible: false,
  heroImageUrl: '',
};

const features: Partial<FeaturesData> = {
  layout: 'plain',
  columns: 1,
  mediaStyle: 'icon',
  iconStyle: 'bare',
  headerAlign: 'left',
  eyebrow: '// WHAT I DO',
  headline: 'Mostly these.',
  headlineAccent: '',
  items: [
    { id: 'feat-shelves', icon: 'hammer', imageUrl: '', title: 'Shelves, mirrors, curtain rails', description: 'Brought up flush, hung straight, holes filled if I drill anything wrong.', linkLabel: '', linkHref: '' },
    { id: 'feat-flatpack', icon: 'package', imageUrl: '', title: 'Flat-pack', description: 'Ikea, Habitat, the cheap stuff off Amazon. I bring the right screwdrivers.', linkLabel: '', linkHref: '' },
    { id: 'feat-doors', icon: 'key', imageUrl: '', title: 'Doors, locks, hinges', description: "Doors that won't close, locks that won't turn, the bathroom door that drops on its hinges.", linkLabel: '', linkHref: '' },
    { id: 'feat-rest', icon: 'wrench', imageUrl: '', title: 'The rest', description: "If you can describe it in a text, I can probably do it. If I can't, I'll tell you who can.", linkLabel: '', linkHref: '' },
  ],
};

const reviews: Partial<ReviewsData> = {
  layout: 'grid',
  columns: 2,
  headerAlign: 'left',
  eyebrow: '',
  headline: 'What people text afterwards.',
  headlineAccent: '',
  items: [
    { id: 'rev-ruth', quote: 'Two shelves and a curtain rail in an hour. Charged me €60. Done.', authorName: 'Ruth', authorRole: 'Rathmines', avatarUrl: '', rating: 5 },
    { id: 'rev-mark', quote: "Dave's done four jobs for us this year. Always texts back, always shows up.", authorName: 'Mark', authorRole: "Harold's Cross", avatarUrl: '', rating: 5 },
  ],
};

const contact: Partial<ContactData> = {
  layout: 'details',
  showInlineForm: true,
  eyebrow: '',
  headline: 'Text me what you need.',
  headlineAccent: '',
  sub: "I'll text back today with a time and a rough price.",
  items: [
    { id: 'con-phone', icon: 'phone', label: 'Phone', value: '087 555 0144', sub: 'Or text the same number' },
    { id: 'con-hours', icon: 'clock', label: 'Most days', value: 'Mornings booked, afternoons usually free', sub: '' },
    { id: 'con-area', icon: 'map-pin', label: 'Where I work', value: "Dublin 6, 6W, 8 and 12. Further on a Saturday if it's a proper job.", sub: '' },
  ],
  formTitle: '',
  formButtonLabel: 'Send',
  showPhoneField: true,
};

const sections: Section[] = [
  { id: 'sec-hero', type: 'hero', enabled: true, data: hero as Record<string, unknown> },
  { id: 'sec-features', type: 'features', enabled: true, data: features as Record<string, unknown> },
  { id: 'sec-reviews', type: 'reviews', enabled: true, data: reviews as Record<string, unknown> },
  {
    id: 'sec-contact',
    type: 'contact',
    enabled: true,
    data: contact as Record<string, unknown>,
    form: {
      title: '',
      showTitle: false,
      submitLabel: 'Send',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true, leadRole: 'name' },
        { id: 'phone', label: 'Phone', type: 'phone', required: true, leadRole: 'phone' },
        { id: 'job', label: 'What do you need?', type: 'textarea', required: true, placeholder: 'A few words is fine.', leadRole: 'service' },
      ],
      afterSubmit: { kind: 'message', heading: 'Got it', body: "I'll text back today with a time and a rough price." },
      colors: {},
    },
  },
];

export const anchorDaveConnolly: Anchor = {
  meta: {
    anchorId: 'anchor-05-simplicity-led-handyman',
    buyingMotivation: 'simplicity',
    industry: 'handyman',
    urgencyMode: 'scheduled',
    voiceVisualNote:
      'Voice: plain, first-person, short sentences, occasional dry humour, no marketing voice anywhere. Visually should feel like: minimal split hero, no accent colour beyond a barely-there work-van yellow used once, plain features list with no card chrome, two short reviews, three-field contact form. Four sections total — fewer than any other anchor. Whole page should read in 90 seconds.',
    whyThisWinsThisCustomer:
      'The buyer wants two shelves up and a curtain rail rehung. They are not commissioning a transformation, hiring a designer, or starting a relationship. They want to know what someone charges, that they show up, and that they have a number to text. The page wins by getting out of their way.',
  },
  brief: {
    businessName: 'Dave Connolly',
    industry: 'handyman',
    urgencyMode: 'scheduled',
    serviceArea: 'Dublin 6, 6W, 8 and 12',
    services: [
      'Small repairs and installs',
      'Shelves, mirrors, curtain rails',
      'Flat-pack assembly',
      'Doors, locks, hinges',
    ],
    targetCustomer:
      "Renters and homeowners in inner South Dublin who have a list of small jobs they keep meaning to get round to. Don't want a quote process. Don't want a deposit. Just want it done.",
    usp: 'One person, fair hourly rate, no minimum visit. Texts back the same day.',
    offer: {
      headline: 'Small jobs done well, by the same person, for €40 an hour',
      promise: "Text me what you need. I'll text back today with a time.",
      riskReversal: "I don't charge for the bit I don't fix.",
      ctaLabel: 'Text Dave',
    },
    voiceTone: { formality: 2, urgency: 3, technicality: 1 },
    brandColors: { primary: '#D4A437', ink: '#1A1A1A' },
    testimonials: [
      { author: 'Ruth, Rathmines', text: 'Two shelves and a curtain rail in an hour. Charged me €60. Done.' },
      { author: "Mark, Harold's Cross", text: "Dave's done four jobs for us this year. Always texts back, always shows up." },
    ],
  },
  page: {
    id: 'home',
    slug: 'home',
    title: 'Home',
    type: 'home',
    seo: {
      title: 'Dave Connolly — Handyman, South Dublin. €40 an hour, no minimum.',
      description: 'Small jobs done well. Shelves, doors, flat-pack, the rest. Text me what you need.',
    },
    sections,
  },
};
