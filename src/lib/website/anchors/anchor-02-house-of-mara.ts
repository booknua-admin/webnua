// =============================================================================
// Anchor 02 — Craft-led premium bathroom fitter (House of Mara, London)
//
// Buying motivation: CRAFT. Customer has been thinking about this renovation
// for a year. They want a designer-builder whose taste they trust, not the
// cheapest fitter. 6 sections, magazine-style rhythm, generous padding,
// owner-led narrative via story-arc about section. No FAQ — this customer
// has a six-month conversation ahead of them, not transactional objections.
// =============================================================================

import type { Section } from '../types';
import type { HeroData } from '../sections/hero';
import type { AboutData } from '../sections/about';
import type { GalleryData } from '../sections/gallery';
import type { ReviewsData } from '../sections/reviews';
import type { FeaturesData } from '../sections/features';
import type { CTAData } from '../sections/cta';
import type { Anchor } from './types';

const hero: Partial<HeroData> = {
  layout: 'split',
  imageSide: 'left',
  contentAlign: 'left',
  headlineSize: 'l',
  eyebrow: '// BATHROOM RENOVATION · LONDON',
  headline: 'A considered bathroom.',
  headlineAccent: 'Finished by the hands that drew it.',
  sub: 'House of Mara is one designer-builder who takes on one project at a time. The same person who measures your floor on day one tiles it on day forty. Surveys are by appointment, usually within a fortnight.',
  ctaPrimaryLabel: 'Book a survey',
  ctaPrimaryHref: '/book-a-survey',
  ctaPrimaryVisible: true,
  ctaSecondaryLabel: '',
  ctaSecondaryHref: '',
  ctaSecondaryVisible: false,
  heroImageUrl: '',
};

const about: Partial<AboutData> = {
  layout: 'story-arc',
  extra: 'stats',
  imageSide: 'right',
  eyebrow: '// THE MAKER',
  headline: 'Mara Whitcombe.',
  headlineAccent: 'Twelve years, one bathroom at a time.',
  sub: 'Mara trained as a cabinet-maker in Suffolk before spending six years as a foreman on heritage refurbishments across Bloomsbury and Highgate. House of Mara is what came after — a deliberately small practice that does one thing properly and refuses to do it any other way.',
  imageUrl: '',
  chapters: [
    {
      id: 'ch-room',
      heading: 'We start in the room',
      body: 'Every project begins with a survey, on site, in person. I want to see how the light falls in the morning, where the radiator pipework actually runs, what the floor is sitting on under the lino. A bathroom drawn from a Zoom call is a bathroom that will need re-drawing in week three.',
    },
    {
      id: 'ch-drawings',
      heading: 'Drawings before demolition',
      body: 'You see the finished room in plan, elevation, and material samples before a single tile comes off the wall. Fixed price follows the drawings. Surprises after demolition — and there are always surprises with London period homes — are explained, costed, and approved in writing before the next thing happens.',
    },
    {
      id: 'ch-hands',
      heading: 'One pair of hands',
      body: 'I am not a project manager who sends a team. I do the work. Plumbers and electricians who I have worked with for years come in when their trade is needed. The same person who took your brief is the person who grouts the last tile.',
    },
  ],
  pullQuote: 'A bathroom is the smallest room in the house and the one you stand in most consciously. It deserves the attention.',
  stats: [
    { id: 'stat-projects', icon: 'check', value: '47', label: 'projects since 2014' },
    { id: 'stat-concurrent', icon: 'check', value: '1', label: 'project at a time' },
    { id: 'stat-survey', icon: 'calendar', value: '2 wks', label: 'typical wait for a survey' },
  ],
};

const gallery: Partial<GalleryData> = {
  layout: 'masonry',
  columns: 3,
  aspect: 'portrait',
  headerAlign: 'left',
  showFilters: false,
  eyebrow: '// SELECTED WORK',
  headline: 'Six recent rooms.',
  sub: 'A note: we do not photograph our work for portfolio reasons. These are the rooms our clients live in, captured once for permission. Material lists are available on request.',
  items: [
    { id: 'gal-stoke', imageUrl: '', caption: 'Stoke Newington · Victorian terrace · 8 weeks', category: '' },
    { id: 'gal-highgate', imageUrl: '', caption: 'Highgate · listed · 14 weeks', category: '' },
    { id: 'gal-clapham', imageUrl: '', caption: 'Clapham · wet room · 6 weeks', category: '' },
    { id: 'gal-islington', imageUrl: '', caption: 'Islington · en-suite · 5 weeks', category: '' },
    { id: 'gal-bloomsbury', imageUrl: '', caption: 'Bloomsbury · guest bath · 7 weeks', category: '' },
    { id: 'gal-notting', imageUrl: '', caption: 'Notting Hill · principal · 11 weeks', category: '' },
  ],
  ctaVisible: true,
  ctaStyle: 'outline',
  ctaLabel: 'Request material lists',
  ctaHref: '/book-a-survey',
};

const reviews: Partial<ReviewsData> = {
  // `spotlight` over `grid` — craft brands earn a featured testimonial
  // with breathing room rather than a row of three condensed cards.
  layout: 'spotlight',
  columns: 3,
  headerAlign: 'left',
  eyebrow: '// WHAT CLIENTS SAY AFTERWARDS',
  headline: 'Long after we have handed over the keys.',
  items: [
    { id: 'rev-helena', quote: 'We interviewed four firms. Mara was the only one who asked what we did in the bathroom in the morning before he asked about budget. The finished room is the first thing I notice every day. Worth every pound.', authorName: 'Helena W.', authorRole: 'Stoke Newington', avatarUrl: '', rating: 5 },
    { id: 'rev-richard', quote: "Listed building, awkward stairwell, six-month project. Mara warned us about every difficult decision before it arrived rather than after. We never had a 'where's the builder' moment in the whole build.", authorName: 'Richard & Anne F.', authorRole: 'Highgate', avatarUrl: '', rating: 5 },
    { id: 'rev-priya', quote: "I'd been collecting photos for three years. Mara walked the room, listened, then proposed something I hadn't considered. He was right. The finish is calmer than what I'd been planning and much more 'us'.", authorName: 'Priya S.', authorRole: 'Clapham Old Town', avatarUrl: '', rating: 5 },
  ],
};

const features: Partial<FeaturesData> = {
  layout: 'cards',
  columns: 3,
  mediaStyle: 'icon',
  iconStyle: 'bare',
  headerAlign: 'left',
  eyebrow: '// HOW A PROJECT RUNS',
  headline: 'Three phases.',
  headlineAccent: 'No surprises in any of them.',
  items: [
    { id: 'ph-survey', icon: 'ruler', imageUrl: '', title: 'Survey & drawings', description: 'A two-hour visit, then drawings and a material specification within a fortnight. Fixed price follows the drawings. Survey fee is credited against the project if you proceed.', linkLabel: '', linkHref: '' },
    { id: 'ph-build', icon: 'hammer', imageUrl: '', title: 'Build, on site', description: 'I work on one project at a time. Site is yours back at the end of each day — dust-sheeted, tools away. Photographs of every stage shared in a private folder you can show your partner, your architect, your insurer.', linkLabel: '', linkHref: '' },
    { id: 'ph-handover', icon: 'key', imageUrl: '', title: 'Handover & year', description: 'Final clean, working photographs, and a written care guide for every material. Twelve months of any-call follow-up: a tile lifts, a tap drips, a grout line opens — I come back.', linkLabel: '', linkHref: '' },
  ],
};

const cta: Partial<CTAData> = {
  layout: 'background',
  align: 'left',
  eyebrow: '',
  headline: "When you're ready to start the conversation,",
  headlineAccent: 'book a survey.',
  sub: 'Two hours on site, no obligation, drawings within a fortnight.',
  primaryVisible: true,
  primaryLabel: 'Book a survey',
  primaryHref: '/book-a-survey',
  secondaryVisible: false,
  secondaryLabel: '',
  secondaryHref: '',
  showSignals: false,
};

const sections: Section[] = [
  { id: 'sec-hero', type: 'hero', enabled: true, data: hero as Record<string, unknown> },
  { id: 'sec-about', type: 'about', enabled: true, data: about as Record<string, unknown> },
  { id: 'sec-gallery', type: 'gallery', enabled: true, data: gallery as Record<string, unknown> },
  { id: 'sec-reviews', type: 'reviews', enabled: true, data: reviews as Record<string, unknown> },
  { id: 'sec-features', type: 'features', enabled: true, data: features as Record<string, unknown> },
  { id: 'sec-cta', type: 'cta', enabled: true, data: cta as Record<string, unknown> },
];

export const anchorHouseOfMara: Anchor = {
  meta: {
    anchorId: 'anchor-02-craft-led-premium-bathroom-fitter',
    buyingMotivation: 'craft',
    industry: 'bathroom_renovation',
    urgencyMode: 'project',
    voiceVisualNote:
      'Voice: consultative, design-led, takes its time, references materials and craft, never urgent, never discount-driven. Visually should feel like: split hero with calm room photography on the left, generous padding, single CTA per screen, magazine-style about with owner\'s name and face, gallery as evidence not decoration, low-density layout. Heading is a serif display face in production; in this preview a strong sans approximates it. No form-on-hero, no compact-icons trust strip, no FAQ — this customer doesn\'t have transactional objections, they have a 6-month conversation ahead of them.',
    whyThisWinsThisCustomer:
      "The buyer has been thinking about this renovation for a year. They've saved 80 photos to Pinterest. They've read three magazines. They're not looking for the cheapest fitter; they're looking for the one whose taste they trust. The page has to prove: (1) the owner cares as much as they do, (2) the work is finished to the standard they'd want in their own home, (3) the process is calm and they won't be hassled. Everything else is noise.",
  },
  brief: {
    businessName: 'House of Mara',
    industry: 'bathroom_renovation',
    urgencyMode: 'project',
    serviceArea: 'London — Zones 1 through 4',
    services: [
      'Full bathroom renovation',
      'En-suite design & build',
      'Wet room conversion',
      'Listed-building work',
      'Material sourcing & specification',
    ],
    targetCustomer:
      'London homeowners — typically in their 40s, second or third home, refurbishing a period property or a recent purchase. Have a clear aesthetic and a real budget (£25k-£90k per bathroom). Tired of contractor sites that look like every other contractor site. Want to feel they are hiring a designer who also builds, not a builder who claims to design.',
    usp: 'Owner-led from first site visit to final snag. One project at a time. The same person who measures your floor on day one tiles it on day forty.',
    offer: {
      headline: "A considered bathroom, finished to the standard you'd notice in someone else's home",
      promise: 'One project at a time. From survey to final clean, the same hands.',
      riskReversal: 'Fixed price after survey. No staged-payment surprises. Photographs of every stage.',
      ctaLabel: 'Book a survey',
    },
    voiceTone: { formality: 4, urgency: 2, technicality: 3 },
    brandColors: { primary: '#3B4A3F', ink: '#1C1C1A' },
    testimonials: [
      { author: 'Helena W., Stoke Newington', text: 'We interviewed four firms. Mara was the only one who asked what we did in the bathroom in the morning before he asked about budget. The finished room is the first thing I notice every day. Worth every pound.' },
      { author: 'Richard & Anne F., Highgate', text: "Listed building, awkward stairwell, six-month project. Mara warned us about every difficult decision before it arrived rather than after. We never had a 'where's the builder' moment in the whole build." },
      { author: 'Priya S., Clapham Old Town', text: "I'd been collecting photos for three years. Mara walked the room, listened, then proposed something I hadn't considered. He was right. The finish is calmer than what I'd been planning and much more 'us'." },
    ],
  },
  page: {
    id: 'home',
    slug: 'home',
    title: 'Home',
    type: 'home',
    seo: {
      title: 'House of Mara — Considered Bathroom Renovation in London',
      description: 'Owner-led bathroom renovation for London period homes. One project at a time. Survey, design, build and finish from the same pair of hands.',
    },
    sections,
  },
};
