// =============================================================================
// Anchor 04 — Transformation-led family landscaper (Field & Hedge, S Dublin)
//
// Buying motivation: TRANSFORMATION. Customer has been looking at their
// tired garden for years. They don't want to read about process — they
// want to see one image of the future garden, then a short path to
// commission it. 5 sections (smallest count yet among multi-section
// anchors). NO reviews section — a single testimonial folded into the
// about as a pullQuote does the social-proof work. NO final cta section
// — contact IS the final section and its own form converts.
// =============================================================================

import type { Section } from '../types';
import type { HeroData } from '../sections/hero';
import type { GalleryData } from '../sections/gallery';
import type { AboutData } from '../sections/about';
import type { FeaturesData } from '../sections/features';
import type { ContactData } from '../sections/contact';
import type { Anchor } from './types';

const hero: Partial<HeroData> = {
  layout: 'overlay',
  overlayOpacity: 45,
  eyebrow: '// GARDEN DESIGN · SOUTH DUBLIN SINCE 1972',
  headline: "A garden you'll grow into.",
  headlineAccent: 'Three generations, one family, since 1972.',
  sub: 'Field & Hedge designs and plants gardens across South Dublin and Wicklow. The hands that draw it plant it, and come back to shape it as it grows in.',
  ctaPrimaryLabel: 'Request a site visit',
  ctaPrimaryHref: '#sec-contact',
  ctaPrimaryVisible: true,
  ctaSecondaryLabel: '',
  ctaSecondaryHref: '',
  ctaSecondaryVisible: false,
  heroImageUrl: '',
};

const gallery: Partial<GalleryData> = {
  layout: 'masonry',
  columns: 2,
  aspect: 'landscape',
  headerAlign: 'left',
  showFilters: false,
  eyebrow: '// SIX RECENT GARDENS',
  headline: 'What we make.',
  sub: "Each one photographed two summers after handover — a garden isn't finished on the day the last plant goes in, it's finished when it fills the space it was designed for.",
  items: [
    { id: 'gal-rathgar', imageUrl: '', caption: 'Rathgar · renovation · 2024', category: '' },
    { id: 'gal-dundrum', imageUrl: '', caption: 'Dundrum · family · 2023', category: '' },
    { id: 'gal-greystones', imageUrl: '', caption: 'Greystones · coastal · 2023', category: '' },
    { id: 'gal-delgany', imageUrl: '', caption: 'Delgany · period · 2022', category: '' },
    { id: 'gal-stillorgan', imageUrl: '', caption: 'Stillorgan · meadow · 2024', category: '' },
    { id: 'gal-rathmines', imageUrl: '', caption: 'Rathmines · courtyard · 2023', category: '' },
  ],
  ctaVisible: false,
  ctaLabel: '',
  ctaHref: '',
};

const about: Partial<AboutData> = {
  layout: 'story-arc',
  extra: 'none',
  imageSide: 'right',
  eyebrow: '// THREE GENERATIONS',
  headline: 'Started in 1972.',
  headlineAccent: 'Still planting the gardens we sketched.',
  sub: 'Three generations of one family doing the same work in the same suburbs. Not a marketing brand fronting a rota of contractors. Tom, Niall and James — father, son, son — and the small team that has worked alongside us for years.',
  imageUrl: '',
  chapters: [
    { id: 'ch-1972', heading: 'Frank, 1972', body: 'Frank Harker started the firm out of a Volkswagen pickup. By the time he handed over in 2001, his gardens were already a quiet currency in Dublin 6, Dublin 14 and the Wicklow commuter belt. Most of the mature trees we now prune for second-generation clients were planted by his hand.' },
    { id: 'ch-2001', heading: 'Tom, 2001', body: 'Tom took over with a degree in landscape architecture and the same instinct for working with a place rather than against it. The firm grew under Tom from one designer to a small in-house team, never larger than ten. He still walks every site at the planting.' },
    { id: 'ch-2014', heading: 'Niall & James, 2014', body: 'Niall came in from seven years at the National Botanic Gardens. James joined in 2018 after a stonemasonry apprenticeship in Wicklow. Design, planting and stonework all in-house, no subcontracted trades — that is the version of the firm they have built together.' },
  ],
  // The pullQuote replaces a dedicated reviews section. Single testimonial,
  // structurally corroborates the "three-generations" claim by naming the
  // generation handover — work a praise paragraph couldn't do.
  pullQuote: '"His son Niall came back to plant the second wave in 2022. There aren\'t many firms left where the second generation already knows the project." — Emer & Donal, Rathgar',
};

const features: Partial<FeaturesData> = {
  layout: 'plain',
  columns: 2,
  mediaStyle: 'icon',
  iconStyle: 'bare',
  headerAlign: 'left',
  eyebrow: '// WHAT WE TAKE ON',
  headline: 'Four kinds of project.',
  items: [
    { id: 'proj-renovation', icon: 'leaf', imageUrl: '', title: 'Full garden renovation', description: 'Tired lawn, broken paving, overgrown beds — transformed into a coherent garden over four to twelve weeks. Design drawings, hard landscaping, soft landscaping and a planting plan that fills out over two to three seasons.', linkLabel: '', linkHref: '' },
    { id: 'proj-stonework', icon: 'hammer', imageUrl: '', title: 'Patios, paths & stone', description: 'Reclaimed limestone, granite, sandstone or Wicklow stone — laid by James and the stonework team. Period-property work a specialism. We source it, we cut it on site where needed, we never subcontract the laying.', linkLabel: '', linkHref: '' },
    { id: 'proj-planting', icon: 'sprout', imageUrl: '', title: 'Planting design', description: 'Often a stand-alone job for a garden whose structure already works. Planting plan drawn, plants sourced from named nurseries, planted by us. Two-year establishment guarantee on everything we put in the ground.', linkLabel: '', linkHref: '' },
    { id: 'proj-maintenance', icon: 'calendar', imageUrl: '', title: 'Maintenance contracts', description: "Annual or seasonal visits to gardens we've designed and a small number we haven't. Hedging, pruning, bed renewal, lawn care. The same person back each visit. Most of our maintenance clients have been with us ten years or more.", linkLabel: '', linkHref: '' },
  ],
};

const contact: Partial<ContactData> = {
  layout: 'details',
  showInlineForm: true,
  eyebrow: '// START THE CONVERSATION',
  headline: 'A site visit is two hours. No obligation.',
  sub: "Tell us where you are and roughly what you're imagining. Niall or Tom replies within two working days to arrange a visit. We take on around twelve new design projects a year, so the conversation is unhurried — but if you're planting this autumn, talk to us by August.",
  items: [
    { id: 'con-phone', icon: 'phone', label: 'Phone', value: '01 555 0166', sub: 'Weekdays 9am – 5pm' },
    { id: 'con-email', icon: 'mail', label: 'Email', value: 'design@fieldandhedge.ie', sub: '' },
    { id: 'con-office', icon: 'clock', label: 'Office', value: 'Weekdays 9am – 5pm', sub: '' },
    { id: 'con-visits', icon: 'calendar', label: 'Site visits', value: 'By appointment, year-round', sub: '' },
    { id: 'con-area', icon: 'map-pin', label: 'We work across', value: 'South Dublin, Wicklow and the Kildare borders. Rathgar, Dundrum, Stillorgan, Greystones, Delgany and most of D6, D14 and D18.', sub: '' },
  ],
  formTitle: 'Request a site visit',
  formButtonLabel: 'Send & arrange a visit',
  showPhoneField: true,
};

const sections: Section[] = [
  { id: 'sec-hero', type: 'hero', enabled: true, data: hero as Record<string, unknown> },
  { id: 'sec-gallery', type: 'gallery', enabled: true, data: gallery as Record<string, unknown> },
  { id: 'sec-about', type: 'about', enabled: true, data: about as Record<string, unknown> },
  { id: 'sec-features', type: 'features', enabled: true, data: features as Record<string, unknown> },
  {
    id: 'sec-contact',
    type: 'contact',
    enabled: true,
    data: contact as Record<string, unknown>,
    form: {
      title: 'Request a site visit',
      showTitle: false,
      submitLabel: 'Send & arrange a visit',
      fields: [
        { id: 'name', label: 'Your name', type: 'text', required: true, leadRole: 'name' },
        { id: 'phone', label: 'Phone', type: 'phone', required: true, leadRole: 'phone' },
        { id: 'postcode', label: 'Where is the garden?', type: 'text', required: true, placeholder: 'Suburb or postcode', leadRole: 'address' },
        { id: 'project', label: 'What are you imagining?', type: 'textarea', required: true, placeholder: "A few sentences is plenty — full renovation, planting only, new patio, ongoing maintenance, or just 'come and tell us what you'd do'.", leadRole: 'service' },
      ],
      afterSubmit: { kind: 'message', heading: 'Thank you', body: "Niall or Tom will reply within two working days to arrange a visit." },
      colors: {},
    },
  },
];

export const anchorFieldAndHedge: Anchor = {
  meta: {
    anchorId: 'anchor-04-transformation-led-family-landscaper',
    buyingMotivation: 'transformation',
    industry: 'landscaping',
    urgencyMode: 'project',
    voiceVisualNote:
      'Voice: confident, plant-knowledgeable, seasonally aware, three-generations-comfortable, not reverent. Visually should feel like: full-bleed overlay hero on a single resolved garden photograph (single image, not before/after pairing — the customer sees what they want and then reads), warm clay/terracotta accent against an off-white surface, humanist sans throughout (no serif — that vocabulary belongs to Mara). Gallery at position 2 in a wider horizontal format, magazine-spread feeling rather than masonry. Reviews section omitted entirely — the photographs do that job, one review folded into the about section as a pull-quote. Five sections, not six. Headings shorter and more declarative than Mara\'s reflective register.',
    whyThisWinsThisCustomer:
      "The transformation buyer has been looking at their tired garden for years. They don't want to read about craft or process — they want to see one image that looks like the future they're imagining, and they want the path to commissioning it to be short. Hero is the future garden, full-bleed, one CTA. Gallery is six more proofs immediately under it. About is who you're trusting with the work, briefly. Features is what kind of project you could commission. Contact is how you start. No reviews section, no FAQ, no offer — the photos and the family name are the entire proof structure.",
  },
  brief: {
    businessName: 'Field & Hedge',
    industry: 'landscaping',
    urgencyMode: 'project',
    serviceArea: 'South Dublin, Wicklow and the Kildare borders',
    services: [
      'Full garden renovation',
      'Patios, paths and natural stone',
      'Planting design & seasonal beds',
      'Mature tree work',
      'Annual maintenance contracts',
    ],
    targetCustomer:
      'Homeowners in established South Dublin and Wicklow suburbs — Rathgar, Dundrum, Stillorgan, Greystones, Delgany. Forties and up, in the family home for 8+ years, garden tired or never properly designed, project budget €15k–€80k. Want a designer who will still be around in fifteen years when the trees need shaping.',
    usp: 'Three generations of one family, designing and planting gardens in South Dublin since 1972. The same hands that draw it plant it, and come back to shape it as it grows in.',
    offer: {
      headline: "A garden you'll grow into, designed by people who'll be around to prune it",
      promise: 'From design to last planting, the same family. Maintenance contracts available year one onwards.',
      riskReversal: 'Two-year establishment guarantee on every plant we put in the ground.',
      ctaLabel: 'Request a site visit',
    },
    voiceTone: { formality: 3, urgency: 3, technicality: 3 },
    brandColors: { primary: '#B85C3A', ink: '#1F1B17' },
    testimonials: [
      { author: 'Emer & Donal, Rathgar', text: "Tom designed our garden in 2019. His son Niall came back to plant the second wave in 2022. There aren't many firms left where the second generation already knows the project before you have to explain it." },
      { author: 'Hilary, Greystones', text: 'We had three landscapers quote. Field & Hedge were the only ones who asked which way the morning sun came in and where the kids played. Every winter we waited for it to fill out was worth it.' },
      { author: 'The Crowleys, Dundrum', text: "Beech hedge planted fourteen years ago. Niall still comes every two years to shape it. That's the real differentiator — the same person back, a decade on." },
    ],
  },
  page: {
    id: 'home',
    slug: 'home',
    title: 'Home',
    type: 'home',
    seo: {
      title: 'Field & Hedge — Garden Design & Landscaping, South Dublin Since 1972',
      description: 'Three generations of garden designers. Full renovation, planting, stonework and lifelong maintenance across South Dublin and Wicklow.',
    },
    sections,
  },
};
