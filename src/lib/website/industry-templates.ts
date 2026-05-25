// =============================================================================
// industry-templates — per-industry generation guidance for both the Claude
// prompt path and the deterministic fallback.
//
// Why this exists: today every industry feeds the same prompt and the same
// section recipes, so an electrician's preview and a cleaner's preview differ
// only in business name + offer text. Pattern B's "tradie sees their site
// before paying" UX needs that difference to feel meaningful — a publish
// decision turns on whether the preview reads as written for THIS tradie.
//
// Industry resolution is fuzzy: `mapIndustry(freeText)` normalises common
// synonyms onto a closed `IndustryKey` union. Unknown industries fall back to
// `generic` — a strong neutral template, never broken behaviour.
//
// The shape carries:
//   - `urgencyMode` — how the customer arrives (emergency-callout vs
//     scheduled vs project work). Drives CTA framing + hero patterns.
//   - `contextForModel` — a paragraph the Claude prompt sends per generation
//     so the model knows the customer's actual mindset for this trade.
//   - `valuePropositions` / `proofPoints` / `objectionHandlers` — the
//     conversion levers per industry. Sent to the model as examples
//     (not literal copy to repeat).
//   - `defaultServices` — the common jobs in this trade. Used when
//     `brief.business.services` is empty.
//   - `trustSignals` — region-flexible certification mentions (RECI / Gas
//     Safe / etc.). The model picks whichever fits the business; the
//     fallback picks the first.
//   - `stockImages` — best-effort Unsplash URLs for hero + gallery. A 404
//     leaves the section image empty, which matches the pre-Pattern-B
//     default — no worse than today. Replace with operator brand photos
//     as soon as the customer uploads them.
//
// **NOT a stock-imagery API.** The URL set is a curated starter list. When a
// real Unsplash / brand-photo pipeline lands, swap this layer or extend it
// to a server function that reads from a verified photo table. Until then:
// best-effort URLs with empty-string fallback is the right honest default.
// =============================================================================

/** The closed industry union. Adding a key means: (1) add it here, (2) add a
 *  template entry below, (3) add synonyms to the SYNONYM_MAP. The wizard
 *  collects free text — we never restrict input — but the resolver maps
 *  whatever was typed onto one of these keys (or `generic`). */
export type IndustryKey =
  | 'electrician'
  | 'plumber'
  | 'cleaner'
  | 'landscaper'
  | 'roofer'
  | 'painter'
  | 'hvac'
  | 'locksmith'
  | 'handyman'
  | 'carpenter'
  | 'generic';

export type UrgencyMode =
  | 'emergency-callout' // customer searching at the moment something broke
  | 'scheduled' // customer planning an upcoming routine job
  | 'project' // customer scoping a larger one-off piece of work
  | 'mixed'; // both — handyman / HVAC

export type ObjectionHandler = {
  /** Short label of the customer objection. */
  objection: string;
  /** A one-line response the model can weave in. */
  response: string;
};

export type IndustryStockImages = {
  /** Primary hero image — used in the hero section default. */
  hero: string;
  /** Gallery / "our recent work" set. */
  gallery: readonly string[];
  /** Optional team / about-section portrait. */
  team?: string;
};

export type IndustryTemplate = {
  key: IndustryKey;
  /** Operator-facing label. */
  displayName: string;
  urgencyMode: UrgencyMode;
  /** A one-paragraph context block the prompt sends per generation so the
   *  model knows the customer mindset, the trade's vocabulary, and what
   *  conversion levers matter. */
  contextForModel: string;
  /** Value-prop sentences the model can paraphrase. Not literal — the model
   *  weaves these into its own copy. The fallback uses them verbatim. */
  valuePropositions: readonly string[];
  /** Proof / credibility lines (years of work, jobs completed, certifications). */
  proofPoints: readonly string[];
  /** Objection-handler patterns — what customers worry about, what to say. */
  objectionHandlers: readonly ObjectionHandler[];
  /** Default services if the brief doesn't list any. */
  defaultServices: readonly string[];
  /** CTA framing for this trade. `primary` is the conversion CTA; `secondary`
   *  is usually a "talk to a human" route. */
  ctaPrimary: string;
  ctaSecondary: string;
  /** Region-flexible trust signals — UK/IE focused since that's Webnua's
   *  market. The model picks contextually. */
  trustSignals: readonly string[];
  /** Stock-image starter set. Replace with operator brand photography. */
  stockImages: IndustryStockImages;
  /** A one-line offer framing the model can adopt for this trade's hero
   *  sub or the offer section's subtitle. */
  offerFraming: string;
};

// -- Stock-image base URL pattern -------------------------------------------
// Unsplash CDN images with size + crop params. Photo IDs were curated against
// the trade categories below; verify against unsplash.com before production
// deploy. A 404 leaves the section image empty (current default behaviour),
// so a broken URL never breaks the page.

const U = (id: string): string =>
  `https://images.unsplash.com/photo-${id}?w=1600&auto=format&fit=crop&q=80`;

// =============================================================================
// Per-industry templates
// =============================================================================
//
// Each template's `defaultServices` array is the canonical list of typical
// services for that trade, drawn from UK/IE market vocabulary. The
// conversational onboarding services checkbox UI renders these as the full
// list the customer can tick/untick; the AI extraction layer (Session C)
// pre-ticks a subset based on what the customer mentioned in their first
// message. Title Case throughout; 2-5 word labels; no marketing copy.

// ELECTRICIAN — full residential + light commercial coverage. Emergency
// callouts lead since that's the highest-urgency entry point; rewires +
// fuse-board (consumer-unit) upgrades + EV chargers are the big-ticket
// jobs; certification + testing items cover landlord / compliance demand.
const ELECTRICIAN: IndustryTemplate = {
  key: 'electrician',
  displayName: 'Electrician',
  urgencyMode: 'emergency-callout',
  contextForModel:
    'Residential & light-commercial electrical work. Customer arrival is often urgent — power out, breaker tripping, a sparking outlet, EV charger install needed before delivery day. They search after something has broken or before something is unsafe. Conversion levers in order: (1) response time ("on site today" / "within 2 hours"), (2) licence/certification with a real number, (3) fixed-quote-before-we-start pricing (kills the "tradie surprise invoice" fear), (4) work warranty. Voice: practical, calm, no jargon — customers want reassurance they\'re not being upsold. Avoid corporate words ("comprehensive", "solutions provider").',
  valuePropositions: [
    'Same-day callout for emergencies — most jobs sorted within 2 hours',
    'Fixed-price quote written before we start — no surprise invoices',
    'Fully licensed and insured — every job certified to standard',
    'Workmanship guarantee — if it goes wrong, we come back and fix it',
    'Clean exit — switchboard tidy, all rubbish removed, work explained',
  ],
  proofPoints: [
    'Licensed electrician with 15+ years on the tools',
    'Hundreds of safety certificates issued every year',
    'Recommended by local builders and property managers',
    '5-star average across Google reviews',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about the price ballooning',
      response: 'Written fixed quote before we start. The number we agree is the number you pay.',
    },
    {
      objection: 'Worried about cowboy work',
      response: 'Every job certified and inspected — we issue the safety paperwork on the day.',
    },
    {
      objection: 'Worried about not being able to reach a real person',
      response: 'Direct number — we pick up, or call back within 30 minutes.',
    },
  ],
  defaultServices: [
    'Emergency Callouts',
    'Fuse Board Replacement',
    'Full & Partial Rewires',
    'EV Charger Installation',
    'Lighting Installation',
    'Sockets & Power Points',
    'Smoke Alarm Installation',
    'Safety Certificates & Inspections',
    'Fault Finding & Repairs',
    'PAT Testing',
    'Outdoor & Garden Lighting',
    'Bathroom Extractor Fans',
  ],
  ctaPrimary: 'Call now',
  ctaSecondary: 'Get a written quote',
  trustSignals: [
    'RECI registered',
    'NICEIC approved contractor',
    'Master Electrician',
    'EC-licensed',
  ],
  stockImages: {
    hero: U('1565608087341-404b25492fee'),
    gallery: [
      U('1556982094-c47b1ac0e91d'),
      U('1565608087341-404b25492fee'),
      U('1581094288338-2314dddb7ece'),
      U('1581092918056-0c4c3acd3789'),
    ],
  },
  offerFraming:
    'Fixed-price callouts. Licensed, on the tools today, in and out clean.',
};

// PLUMBER — emergency leaks lead (highest-urgency entry); boiler work +
// bathroom installs are the big-ticket projects; drain unblocking + tap
// + radiator work cover the mid-range repair jobs. Gas Safe / RGI lives
// on trust signals, not here.
const PLUMBER: IndustryTemplate = {
  key: 'plumber',
  displayName: 'Plumber',
  urgencyMode: 'emergency-callout',
  contextForModel:
    'Residential plumbing — leaks, blocked drains, boiler / hot-water failure, bathroom installs. The customer arrives wet, panicked, or with a deadline (heating off in winter, party tomorrow, sale on Tuesday). Conversion levers: (1) "we can be there today", (2) licensed + insured (Gas Safe / RGI matters specifically), (3) we tell you the cost up front, (4) we clean up. Big trust-gap because plumbing horror stories are common (cowboys, hidden damage, blank-cheque invoices). Voice: warm, reassuring, no upsell. Avoid: "premium solutions", "industry-leading".',
  valuePropositions: [
    'Same-day emergency callouts — leaks and blockages sorted today',
    'Fixed-price quote before any work starts — never a surprise invoice',
    'Fully licensed and insured (Gas Safe / RGI registered where applicable)',
    'We clean up before we leave — no mess, no debris',
    '12-month workmanship warranty on every job',
  ],
  proofPoints: [
    'Local plumber serving the area for over a decade',
    'Hundreds of bathroom and boiler installs completed',
    'Gas Safe / RGI registered for boilers and gas work',
    'Recommended across local Facebook groups',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about being ripped off on a small fix',
      response: 'Fixed price agreed before we start. No "while we\'re here" upsells.',
    },
    {
      objection: 'Worried about damage to the property',
      response: 'Fully insured — and we lay down drop sheets and dry-vac on the way out.',
    },
    {
      objection: 'Worried about gas / safety',
      response: 'Gas Safe / RGI registered. Every gas job certified and logged.',
    },
  ],
  defaultServices: [
    'Emergency Leaks & Burst Pipes',
    'Blocked Drains & Toilets',
    'Boiler Installation',
    'Boiler Repairs & Servicing',
    'Bathroom Installation',
    'Hot Water Cylinder Installation',
    'Radiator Installation & Repair',
    'Tap & Mixer Replacement',
    'Toilet Repair & Replacement',
    'Leak Detection',
    'Power Flushing',
    'Outside Taps & Garden Plumbing',
  ],
  ctaPrimary: 'Call now',
  ctaSecondary: 'Request a quote',
  trustSignals: [
    'Gas Safe registered',
    'RGI registered',
    'WaterSafe approved',
    'Fully insured',
  ],
  stockImages: {
    hero: U('1607472586893-edb57bdc0e39'),
    gallery: [
      U('1585704032915-c3400ca199e7'),
      U('1607472586893-edb57bdc0e39'),
      U('1581094288338-2314dddb7ece'),
      U('1558618047-3c8c76ca7d13'),
    ],
  },
  offerFraming:
    'Local plumber, on the road today. Fixed quote before any spanner turns.',
};

// CLEANER — recurring domestic at the top (weekly + fortnightly are the
// bread-and-butter); end-of-tenancy + post-build are the high-margin
// one-offs; oven + carpet + window are common add-ons customers tick on
// top of a regular clean.
const CLEANER: IndustryTemplate = {
  key: 'cleaner',
  displayName: 'Cleaning service',
  urgencyMode: 'scheduled',
  contextForModel:
    'Domestic and small-commercial cleaning. Customer almost never arrives in emergency mode — they\'re planning ahead (weekly clean, post-build deep clean, holiday-let turnover, end-of-tenancy). Conversion levers: (1) reliability ("same cleaner every week"), (2) insured + police-checked (people are letting strangers into their home), (3) transparent flat pricing per visit, (4) flexible — easy to skip a week, change the schedule. Voice: warm, calm, domestic — never "industry-leading". Avoid emergency-trade urgency framing (no "call now"). Frame as easy booking, not panic response.',
  valuePropositions: [
    'Same trusted cleaner every visit — never a rotating stranger',
    'Insured, vetted, and police-checked — your home in safe hands',
    'Flat per-visit pricing — no add-ons, no surprises',
    'Easy to skip, reschedule, or cancel — text us, we sort it',
    'All cleaning products and equipment supplied — nothing for you to provide',
  ],
  proofPoints: [
    'Trusted by hundreds of homes and offices across the area',
    'Fully insured and police-checked team',
    'Average 5-star rating across Google',
    'Recurring customers booked weeks ahead',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about strangers in the home',
      response: 'Same vetted cleaner each visit — you\'ll know them by name.',
    },
    {
      objection: 'Worried about price creep',
      response: 'Flat price per visit. No hidden extras, no "while I\'m here" upsells.',
    },
    {
      objection: 'Worried about commitment',
      response: 'Cancel or pause any time — one text, no penalty.',
    },
  ],
  defaultServices: [
    'Weekly House Cleaning',
    'Fortnightly House Cleaning',
    'End of Tenancy Cleaning',
    'Post-Build & Renovation Cleaning',
    'Holiday Let Turnovers',
    'Office Cleaning',
    'One-Off Deep Cleans',
    'Oven Cleaning',
    'Carpet Cleaning',
    'Window Cleaning',
    'Spring Cleaning',
  ],
  ctaPrimary: 'Book a clean',
  ctaSecondary: 'Get a quote',
  trustSignals: [
    'Fully insured',
    'Police-vetted team',
    'Eco-friendly products',
    'Same-cleaner-every-visit guarantee',
  ],
  stockImages: {
    hero: U('1581578731548-c64695cc6952'),
    gallery: [
      U('1581578731548-c64695cc6952'),
      U('1527515637462-cff94eecc1ac'),
      U('1584622650111-993a426fbf0a'),
      U('1556910103-1c02745aae4d'),
    ],
  },
  offerFraming:
    'Weekly cleans, holiday turnovers, end-of-tenancy deep cleans. Insured, reliable, the same trusted person each time.',
};

// LANDSCAPER — mix of recurring maintenance (mowing, hedge) and project
// work (patio, decking, design). Lawn mowing leads as the highest-volume
// recurring booking; hard-landscaping items (patio / decking / driveway /
// fencing) are the higher-ticket project work.
const LANDSCAPER: IndustryTemplate = {
  key: 'landscaper',
  displayName: 'Landscaper / Gardener',
  urgencyMode: 'scheduled',
  contextForModel:
    'Garden maintenance, lawn care, landscaping projects, planting, hedge work. Often a mix of scheduled recurring work (weekly mow, monthly hedge) and one-off projects (new patio, redesign). Customers value: (1) reliability over showmanship — "they actually turn up", (2) tidy finish — no clippings left, gates closed, (3) honest scoping on bigger projects (no scope creep), (4) good with neighbours / quiet hours respected. Voice: friendly, practical, no buzzwords. Project-side customers care about design taste; maintenance-side customers care about consistency. Pricing framing differs — maintenance is per-visit / monthly, projects are quoted.',
  valuePropositions: [
    'Show up when we say we will — calendar set weeks ahead',
    'Tidy finish every visit — clippings cleared, gates closed, no mess left',
    'Honest project quotes — fixed scope, fixed price, no scope creep',
    'Garden plans you can grow with — designed for your soil, light, and budget',
    'Mindful of neighbours — quiet hours respected, equipment maintained',
  ],
  proofPoints: [
    'Maintaining gardens across the area for over 10 years',
    'Hundreds of regular customers booked year-round',
    'City & Guilds / RHS-trained team',
    'Insured for property and public liability',
  ],
  objectionHandlers: [
    {
      objection: 'Worried they won\'t turn up consistently',
      response: 'Routes scheduled weeks ahead — you\'ll get a calendar invite for every visit.',
    },
    {
      objection: 'Worried a project quote will balloon',
      response: 'Quotes are itemised and fixed. Scope changes only on your written go-ahead.',
    },
    {
      objection: 'Worried about mess',
      response: 'Clippings bagged and removed, gates closed, surfaces blown clean before we leave.',
    },
  ],
  defaultServices: [
    'Lawn Mowing & Maintenance',
    'Hedge Trimming & Pruning',
    'Garden Tidy-Ups',
    'Patio Installation',
    'Decking Installation',
    'Planting & Soft Landscaping',
    'Tree Surgery & Stump Removal',
    'Fencing & Gates',
    'Turfing & Lawn Laying',
    'Driveway Installation',
    'Garden Design',
    'Seasonal Garden Clear-Up',
  ],
  ctaPrimary: 'Book a visit',
  ctaSecondary: 'Get a project quote',
  trustSignals: [
    'Public liability insured',
    'RHS / City & Guilds trained',
    'Local authority approved',
  ],
  stockImages: {
    hero: U('1416879595882-3373a0480b5b'),
    gallery: [
      U('1416879595882-3373a0480b5b'),
      U('1558904541-efa843a96f01'),
      U('1416879595882-3373a0480b5b'),
      U('1597844808286-b4f9cbd9e4a4'),
    ],
  },
  offerFraming:
    'Garden care that turns up. Weekly mow to full redesign — honestly quoted, neatly delivered.',
};

// ROOFER — emergency leaks + storm damage lead the urgent entries; tile +
// slate variants matter (different UK/IE roof stock); flat roofs, gutters,
// fascia/soffit, and chimney work cover the project + repair spread.
// Insurance work + free surveys are the high-trust conversion levers.
const ROOFER: IndustryTemplate = {
  key: 'roofer',
  displayName: 'Roofer',
  urgencyMode: 'mixed',
  contextForModel:
    'Roof repair, full replacement, gutters, leaks. Mix of emergency callouts (storm damage, active leak — high urgency) and planned project work (re-roof, gutter overhaul — high consideration). Customers worry about: (1) cowboys (roofing has a reputation), (2) being upsold (full re-roof when patch will do), (3) safety / liability on tall jobs, (4) insurance work claims if storm-related. Conversion levers: (1) we\'ll tell you honestly if it\'s a patch or a re-roof, (2) all jobs photographed before/after, (3) fully insured for height work, (4) free quote with drone or ladder survey. Voice: calm, expert, anti-upsell.',
  valuePropositions: [
    'Free roof survey — we\'ll tell you honestly if it needs a patch or a re-roof',
    'Every job photographed before and after — you see what we found',
    'Fully insured for height work and public liability',
    'Storm and insurance claims handled directly with your insurer',
    '10-year workmanship guarantee on full replacements',
  ],
  proofPoints: [
    'Roofing across the area for 20+ years',
    'Thousands of roofs surveyed and repaired',
    'Approved by major home insurers for claim work',
    'NFRC-trained team where applicable',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about being upsold to a full re-roof',
      response: 'Honest survey first. We patch where patching works — only replace when it actually needs it.',
    },
    {
      objection: 'Worried about safety on a tall job',
      response: 'Fully insured for height work. Proper scaffold or harness — no shortcuts.',
    },
    {
      objection: 'Worried about insurance claim hassle',
      response: 'We deal direct with your insurer. Photos, quotes, paperwork — sorted.',
    },
  ],
  defaultServices: [
    'Emergency Leak Repairs',
    'Storm Damage Repairs',
    'Full Roof Replacement',
    'Roof Tile Replacement',
    'Slate Roof Repair',
    'Flat Roof Installation & Repair',
    'Gutter Cleaning & Repair',
    'Fascia & Soffit Replacement',
    'Chimney Repointing & Flashing',
    'Roof Surveys',
    'Insurance Claim Work',
  ],
  ctaPrimary: 'Book a roof survey',
  ctaSecondary: 'Get a quote',
  trustSignals: [
    'NFRC member',
    'Fully insured for height work',
    'Insurer-approved contractor',
  ],
  stockImages: {
    hero: U('1632935190508-bd13d4ed5f4c'),
    gallery: [
      U('1632935190508-bd13d4ed5f4c'),
      U('1558618047-3c8c76ca7d13'),
      U('1530124566582-a618bc2615dc'),
      U('1635340467088-7c1f8b86d62e'),
    ],
  },
  offerFraming:
    'Honest roofing. Free survey, photos of what we find, fix what needs fixing — no upsell.',
};

// PAINTER — interior + exterior at the top (the headline split); wallpaper
// + feature walls as common styling adds; trim / ceiling / spray as
// finish-grade options; plastering + patch repair captures the
// pre-paint surface work many decorators offer.
const PAINTER: IndustryTemplate = {
  key: 'painter',
  displayName: 'Painter & Decorator',
  urgencyMode: 'project',
  contextForModel:
    'Interior and exterior painting, decorating, wallpapering. Almost entirely project work — never an emergency, always considered. Customers shop on craft (the finish), tidiness (their home is invaded for days), and reliability ("they actually finished it"). Conversion levers: (1) finish quality — photos of recent jobs are gold, (2) protection — they cover everything, lay drop sheets, mask perfectly, (3) timeline honesty ("3 days, here\'s how I split it"), (4) clean exit. Voice: craft-proud, tidy, calm. Avoid: hard urgency, "call now". Frame as scoping a project.',
  valuePropositions: [
    'Finish that lasts — proper prep, two coats, the right paint for the surface',
    'Your home protected — drop sheets down, edges masked, fixtures moved and replaced',
    'Honest timeline — we tell you the days and we hit them',
    'Tidy exit — every brush washed, every floor swept, every drop sheet gone',
    'Free colour consult — we\'ll help you settle on the right palette',
  ],
  proofPoints: [
    'Painting and decorating across the area for 15+ years',
    'Hundreds of homes refreshed inside and out',
    'Trained decorator with a craft-first approach',
    'Insured for property and public liability',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about mess and disruption',
      response: 'Floors and furniture covered, edges masked tight, dust kept down — you\'ll barely know we were here.',
    },
    {
      objection: 'Worried the job will drag on',
      response: 'Timeline agreed up front. If we say three days, we mean three days.',
    },
    {
      objection: 'Worried about the wrong shade',
      response: 'Free colour consult — we test a patch on your wall, in your light, before we commit.',
    },
  ],
  defaultServices: [
    'Interior Painting',
    'Exterior Painting',
    'Wallpapering',
    'Feature Walls',
    'Woodwork & Trim Painting',
    'Ceiling Painting',
    'Spray Painting',
    'Plastering & Patch Repairs',
    'Colour Consultation',
    'Pre-Sale Refresh',
    'Commercial Painting',
  ],
  ctaPrimary: 'Get a quote',
  ctaSecondary: 'Book a colour consult',
  trustSignals: [
    'Dulux / Farrow & Ball trained',
    'Fully insured',
    'Local authority approved',
  ],
  stockImages: {
    hero: U('1581094288338-2314dddb7ece'),
    gallery: [
      U('1581094288338-2314dddb7ece'),
      U('1562259949-e8e7689d7828'),
      U('1558618666-fcd25c85cd64'),
      U('1599619351208-3e6c839d6828'),
    ],
  },
  offerFraming:
    'Painting and decorating done properly. Prep, paint, tidy exit — on the timeline we agreed.',
};

// HVAC — boiler work dominates the UK/IE residential market (install /
// replace / service / breakdown); AC + heat pumps are the growth-side
// installs; underfloor heating + radiators + thermostat work cover the
// system extensions. Gas Safe / F-Gas lives on trust signals, not here.
const HVAC: IndustryTemplate = {
  key: 'hvac',
  displayName: 'Heating & Cooling',
  urgencyMode: 'mixed',
  contextForModel:
    'Heating, air-conditioning, boilers, ventilation. Mixed-mode: emergency callouts in winter (no heat) or summer (no cool) AND planned installs / annual servicing. Customers value: (1) speed when something\'s broken, (2) trust on big-ticket installs (boiler replacement is a £3-8k decision), (3) efficiency advice that\'s honest (not "buy the biggest unit"), (4) annual service relationship — they want a returning engineer. Conversion levers: (1) callout speed, (2) Gas Safe / F-Gas registration with a real number, (3) free install survey, (4) annual service plan.',
  valuePropositions: [
    'Same-day breakdown response — heating or cooling back on today',
    'Free in-home survey before any install — sized properly, quoted clearly',
    'Gas Safe and F-Gas registered — every job certified',
    'Annual service plans — keep your system efficient and under warranty',
    'Honest efficiency advice — we won\'t sell you a unit bigger than you need',
  ],
  proofPoints: [
    '20+ years across heating and cooling',
    'Hundreds of boilers and AC units installed and serviced',
    'Gas Safe / F-Gas registered with real numbers',
    'Approved installer for major brands',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about being oversold',
      response: 'Free survey first. We size what your home needs — not the biggest unit we can sell.',
    },
    {
      objection: 'Worried about being left without heat / cool',
      response: 'Same-day breakdown response. We carry common parts on the van.',
    },
    {
      objection: 'Worried about install costs',
      response: 'Free written quote after the survey. Finance options available on bigger installs.',
    },
  ],
  defaultServices: [
    'Boiler Installation',
    'Boiler Replacement',
    'Boiler Servicing & Annual Checks',
    'Heating Breakdown Repairs',
    'Air Conditioning Installation',
    'Air Conditioning Servicing',
    'Heat Pump Installation',
    'Underfloor Heating Installation',
    'Radiator Installation',
    'Smart Thermostat Installation',
    'Power Flushing',
    'Ventilation & Ductwork',
  ],
  ctaPrimary: 'Book a callout',
  ctaSecondary: 'Get an install quote',
  trustSignals: [
    'Gas Safe registered',
    'F-Gas registered',
    'OFTEC registered',
    'Approved installer',
  ],
  stockImages: {
    hero: U('1631545806609-c8e63ae3ce9c'),
    gallery: [
      U('1631545806609-c8e63ae3ce9c'),
      U('1558618666-fcd25c85cd64'),
      U('1581094288338-2314dddb7ece'),
      U('1585704032915-c3400ca199e7'),
    ],
  },
  offerFraming:
    'Heating and cooling that works when you need it. Same-day breakdown, honest install quote, annual service plan.',
};

// LOCKSMITH — narrower trade than the others (per brief: "some industries
// naturally have fewer real services"). Emergency lockouts lead; uPVC
// door lock work is a UK/IE staple (multi-point mechanisms fail often);
// smart locks + safe work cover the modern + commercial spread.
const LOCKSMITH: IndustryTemplate = {
  key: 'locksmith',
  displayName: 'Locksmith',
  urgencyMode: 'emergency-callout',
  contextForModel:
    'Almost entirely emergency callouts — locked out, lost keys, post-break-in lock change. Customer is stressed, on the pavement, often after dark. Conversion levers in order: (1) actual response time — "30 minutes" beats "ASAP", (2) fixed callout fee — kills the "they\'ll charge whatever they want" fear (locksmith scam horror stories are well-known), (3) non-destructive entry where possible — they\'re scared we\'ll wreck the door, (4) all major lock brands, modern security upgrades. Voice: calm, fast, reassuring. The customer is reading the page from their phone in panic — keep it scannable.',
  valuePropositions: [
    '30-minute response across the area — most calls reached inside an hour',
    'Fixed, transparent callout fee — quoted before we leave the van',
    'Non-destructive entry where possible — your door, lock, and frame intact',
    'All major lock brands — domestic, commercial, and high-security',
    'Post-break-in lock change — including police-report paperwork',
  ],
  proofPoints: [
    '24/7 locksmith service across the area for 10+ years',
    'Thousands of lockouts opened — and almost all non-destructively',
    'Master Locksmith Association approved',
    'DBS-checked and insured',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about being scammed on price',
      response: 'Fixed callout fee, quoted on the phone before we leave the van. The number is the number.',
    },
    {
      objection: 'Worried about door / lock damage',
      response: 'Picked, not drilled, where possible — almost every job is non-destructive.',
    },
    {
      objection: 'Worried about waiting in the cold',
      response: '30-minute response is the standard, not the exception.',
    },
  ],
  defaultServices: [
    'Emergency Lockouts',
    'Lost Key Replacement',
    'Lock Changes & Upgrades',
    'Post-Break-In Security Restoration',
    'uPVC Door Lock Repair',
    'Smart Lock Installation',
    'Key Cutting',
    'Safe Opening & Installation',
    'Commercial & Retail Locks',
  ],
  ctaPrimary: 'Call now',
  ctaSecondary: 'Get a quote',
  trustSignals: [
    'Master Locksmith Association approved',
    'DBS checked',
    'Fully insured',
    '24/7 emergency response',
  ],
  stockImages: {
    hero: U('1582574906168-44d6daab8c1f'),
    gallery: [
      U('1582574906168-44d6daab8c1f'),
      U('1558618047-3c8c76ca7d13'),
      U('1556910103-1c02745aae4d'),
      U('1581092918056-0c4c3acd3789'),
    ],
  },
  offerFraming:
    '30 minutes to the door. Fixed callout fee, picked not drilled where possible.',
};

// HANDYMAN — broad small-jobs coverage by design (the trade's whole pitch
// is "one person, one visit, several jobs"). Hung-on-wall items, flatpack,
// and small fixes lead since they're the highest-volume bookings; outdoor
// + tile + paint touch-ups cover the rest of the typical to-do list.
const HANDYMAN: IndustryTemplate = {
  key: 'handyman',
  displayName: 'Handyman',
  urgencyMode: 'mixed',
  contextForModel:
    'Small jobs across trades — shelves up, doors hung, leaks tightened, flatpack built. Customers value the time-saved framing ("the to-do list gone in a day") more than per-trade expertise. Conversion levers: (1) one person, one visit — no booking three tradies, (2) honest scope ("this is a handyman job; this needs a plumber"), (3) hourly or per-job pricing transparency, (4) takes the awkward "is this big enough to bother a tradie about" jobs nobody else wants. Voice: friendly, practical, never grandiose. Anti-corporate.',
  valuePropositions: [
    'The to-do list gone in a day — small jobs nobody else turns up for',
    'One person, one visit — no booking three tradies for three things',
    'Honest scope — if it needs a real sparky or plumber, we tell you',
    'Hourly or per-job — your call. Quoted up front either way',
    'Bring own tools and supplies — you don\'t need to source a thing',
  ],
  proofPoints: [
    'Hundreds of homes helped with the small stuff',
    '15+ years across general trades',
    'Insured for property and public liability',
    'Recommended through local Facebook and word of mouth',
  ],
  objectionHandlers: [
    {
      objection: 'Worried the job is too small to bother a tradie about',
      response: 'Small jobs are the whole job. Two-hour minimum — and we\'ll happily do five things in those two hours.',
    },
    {
      objection: 'Worried about it being out of scope',
      response: 'We\'ll tell you on the call if it actually needs a sparky or a plumber — no waste of your money.',
    },
    {
      objection: 'Worried about pricing',
      response: 'Hourly or per-job — quoted before we start.',
    },
  ],
  defaultServices: [
    'Shelving & Mirrors Hung',
    'Picture & Artwork Hanging',
    'Door Hanging & Adjustment',
    'Flatpack Assembly',
    'TV Wall Mounting',
    'Curtain Pole & Blind Fitting',
    'Small Plumbing Fixes',
    'Small Electrical Fixes',
    'Fence & Gate Repairs',
    'Tile Repairs & Re-Grouting',
    'Garden Furniture Assembly',
    'Paint Touch-Ups',
    'General Repairs',
  ],
  ctaPrimary: 'Book a visit',
  ctaSecondary: 'Get a quote',
  trustSignals: ['Fully insured', 'Local & trusted', 'Same-day booking available'],
  stockImages: {
    hero: U('1426927308491-6380b6a9936f'),
    gallery: [
      U('1426927308491-6380b6a9936f'),
      U('1558618666-fcd25c85cd64'),
      U('1581092918056-0c4c3acd3789'),
      U('1581094288338-2314dddb7ece'),
    ],
  },
  offerFraming:
    'The to-do list gone in a day. One person, one visit, honest pricing.',
};

// CARPENTER — bespoke joinery work; fitted wardrobes + kitchen installs
// are the high-ticket projects; staircase + decking + garden joinery
// cover the structural + outdoor work; skirting + architrave + window
// + floor laying are the finish-grade items customers commission.
const CARPENTER: IndustryTemplate = {
  key: 'carpenter',
  displayName: 'Carpenter',
  urgencyMode: 'project',
  contextForModel:
    'Bespoke joinery, fitted wardrobes, kitchen carcass work, decking, staircase work. Almost entirely project work — high consideration, high cost, high craft. Customers shop on (1) craft photos — they want to see real work, (2) honest scope and timeline, (3) tidy finish, (4) finish-grade timber and proper joinery (not screw-and-fill). Voice: craft-proud, calm, precise. Avoid: discount language, urgency. Frame as quoting a project.',
  valuePropositions: [
    'Bespoke joinery — built for your space, not flat-packed and trimmed',
    'Real timber, real joints — screwed-and-filled is not what we do',
    'Honest project timeline — quoted in days, not "soon"',
    'Free in-home consultation — talk through the build before any sawdust',
    'Tidy site — protection laid, dust extracted, all offcuts removed',
  ],
  proofPoints: [
    'Bespoke carpentry for over 15 years',
    'Hundreds of fitted wardrobes, kitchens, and feature joinery completed',
    'Time-served carpenter with City & Guilds qualifications',
    'Insured for property and public liability',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about flat-pack-pretending-to-be-bespoke',
      response: 'Built on site or in the workshop — every join cut for your space. Not flat-pack with a cover panel.',
    },
    {
      objection: 'Worried about mess and dust',
      response: 'Dust-extracted tools, floor protection laid down, offcuts bagged and removed.',
    },
    {
      objection: 'Worried about timeline slippage',
      response: 'Project quoted in days. We tell you the start and finish dates and we hit them.',
    },
  ],
  defaultServices: [
    'Bespoke Fitted Wardrobes',
    'Kitchen Installation',
    'Built-In Shelving',
    'Decking',
    'Staircase Repair & Rebuild',
    'Door Hanging & Frames',
    'Skirting & Architrave Fitting',
    'Loft Conversion Carpentry',
    'Window Frame Repair',
    'Garden Joinery (Sheds & Pergolas)',
    'Floor Laying',
    'Feature Joinery',
  ],
  ctaPrimary: 'Get a quote',
  ctaSecondary: 'Book a consultation',
  trustSignals: [
    'City & Guilds qualified',
    'CSCS card holder',
    'Fully insured',
  ],
  stockImages: {
    hero: U('1601058268499-e52658b8bb88'),
    gallery: [
      U('1601058268499-e52658b8bb88'),
      U('1558618666-fcd25c85cd64'),
      U('1581094288338-2314dddb7ece'),
      U('1599619351208-3e6c839d6828'),
    ],
  },
  offerFraming:
    'Bespoke carpentry — built for your space, finished properly, on the timeline we agreed.',
};

// GENERIC — catch-all for ANY service business outside the 10 curated
// trades. The customer's actual trade is captured in
// `brand.industryCategory` (the AI extraction's `industryDescription`
// field — e.g. "Mobile car valeting", "Wedding photography",
// "Small-business accounting") and lands in this prompt as the
// `Industry: ...` line. The template's job is NOT to pretend to know
// the trade — it's to give the model a SAFE NEUTRAL FRAME that lets the
// customer's own words drive the copy.
//
// The service list below is intentionally broad (project type + lifecycle
// stages) rather than trade-specific. The AI extraction layer never
// pre-ticks them — for generic industries, the customer's own services
// (turn 2 free-text additions) are the anchor, not these.
const GENERIC: IndustryTemplate = {
  key: 'generic',
  displayName: 'Service business',
  urgencyMode: 'mixed',
  contextForModel:
    "This is a service business outside the 10 named trades. The customer's actual trade is named in the `Industry:` line above (\"Mobile car valeting\", \"Wedding photography\", \"Personal training\", \"Small-business accounting\", etc.) — that line is the ANCHOR for every piece of copy you write. Use the customer's own framing. Customer mindset depends on the trade: reactive emergencies for some (\"my car needs valeting today before I sell it\"), planned bookings for most (a personal trainer client, a tutor session, a photographer wedding), project work for some (an accountant onboarding a new business). Conversion levers that work across local services: (1) clear pricing posture (fixed quote / hourly / free first consult — whatever the brief says), (2) genuine local — service area named, (3) honest about scope, (4) reliable — turn up when you say you will, (5) lean on the customer's own service description. Voice: warm, practical, no corporate words. Avoid: claiming category-specific certifications you don't have evidence for (no \"Gas Safe\" for a car valet, no \"CFA charter\" for an accountant unless the brief says so). Avoid: making up industry-specific jargon — write in the trade's own ordinary vocabulary the customer used.",
  valuePropositions: [
    "Local — we live and work in the area, and we're here for the long run",
    "Reliable — when we say we'll be there, we're there",
    'Honest pricing — quoted clearly before we get started',
    'Care about the work — we do it properly and stand behind it',
    'Real people, real phone numbers — you can always reach us',
  ],
  proofPoints: [
    'Serving the local area for years',
    'Hundreds of happy customers and counting',
    'Fully insured and locally owned',
    'Recommended by word of mouth and on local Facebook',
  ],
  objectionHandlers: [
    {
      objection: 'Worried about price surprises',
      response: "Clear quote up front. The number we agree is the number you pay.",
    },
    {
      objection: 'Worried about reliability',
      response: "We turn up when we say we will. If anything changes, you hear from us first.",
    },
    {
      objection: 'Worried about getting through to a real person',
      response: 'Real phone, real people. Pick up or call back within the hour.',
    },
  ],
  // Broad service categories that read sensibly across any service business
  // (a car valet, dog groomer, photographer, accountant, etc.). These are
  // STARTER slots only — the conversational flow captures the customer's own
  // services in turn 2; for generic industries the AI extraction never
  // pre-ticks any of these.
  defaultServices: [
    'New customers',
    'Regular bookings',
    'One-off jobs',
    'Quotes & consultations',
    'Premium / package service',
  ],
  ctaPrimary: 'Get in touch',
  ctaSecondary: 'Request a quote',
  trustSignals: ['Locally owned', 'Fully insured', 'Reviewed locally'],
  stockImages: {
    hero: U('1556910103-1c02745aae4d'),
    gallery: [
      U('1556910103-1c02745aae4d'),
      U('1558618666-fcd25c85cd64'),
      U('1581094288338-2314dddb7ece'),
      U('1426927308491-6380b6a9936f'),
    ],
  },
  offerFraming:
    'Local, reliable, honestly priced — the work done when we said we\'d do it.',
};

// =============================================================================
// Public template registry
// =============================================================================

export const INDUSTRY_TEMPLATES: Record<IndustryKey, IndustryTemplate> = {
  electrician: ELECTRICIAN,
  plumber: PLUMBER,
  cleaner: CLEANER,
  landscaper: LANDSCAPER,
  roofer: ROOFER,
  painter: PAINTER,
  hvac: HVAC,
  locksmith: LOCKSMITH,
  handyman: HANDYMAN,
  carpenter: CARPENTER,
  generic: GENERIC,
};

// =============================================================================
// Fuzzy industry resolver
// =============================================================================

/** Synonym table — maps common free-text industry inputs onto the closed
 *  IndustryKey union. Order matters slightly: the resolver checks longer /
 *  more-specific terms first via the loop below. Unmapped → `generic`. */
const SYNONYM_MAP: Record<IndustryKey, readonly string[]> = {
  electrician: [
    'electrician',
    'electric',
    'electrical',
    'sparky',
    'sparkie',
    'spark',
    'sparkies',
    'electrician services',
    'electrical services',
    'electrical contractor',
    'commercial electrical',
    'domestic electrical',
  ],
  plumber: [
    'plumber',
    'plumbing',
    'plumbing services',
    'gas engineer',
    'gas fitter',
    'heating engineer plumber',
    'drainage',
    'drain unblocking',
  ],
  cleaner: [
    'cleaner',
    'cleaning',
    'cleaning service',
    'cleaning services',
    'house cleaning',
    'domestic cleaning',
    'commercial cleaning',
    'office cleaning',
    'janitorial',
    'end of tenancy',
    'holiday let',
    'turnover cleaning',
  ],
  landscaper: [
    'landscaper',
    'landscaping',
    'gardener',
    'gardening',
    'garden services',
    'garden maintenance',
    'lawn care',
    'lawnmower',
    'tree surgeon',
    'arborist',
    'hedge cutting',
    'turf',
  ],
  roofer: [
    'roofer',
    'roofing',
    'roof repair',
    'roof replacement',
    'gutter',
    'guttering',
    'chimney',
    'leadwork',
    'flat roof',
  ],
  painter: [
    'painter',
    'painting',
    'painter and decorator',
    'painter decorator',
    'decorator',
    'decorating',
    'wallpaper',
    'wallpapering',
    'interior decorator',
  ],
  hvac: [
    'hvac',
    'heating',
    'heating engineer',
    'boiler',
    'boiler installation',
    'boiler repair',
    'air conditioning',
    'air con',
    'aircon',
    'ac',
    'cooling',
    'heat pump',
    'ventilation',
    'ducting',
  ],
  locksmith: [
    'locksmith',
    'locks',
    'lockout',
    'lock change',
    'key cutting',
    'security locks',
    'smart lock',
  ],
  handyman: [
    'handyman',
    'handy man',
    'handyperson',
    'odd jobs',
    'general repairs',
    'small jobs',
    'maintenance person',
  ],
  carpenter: [
    'carpenter',
    'carpentry',
    'joiner',
    'joinery',
    'cabinet maker',
    'cabinetry',
    'wardrobes',
    'fitted furniture',
    'bespoke joinery',
    'staircase',
    'decking',
  ],
  generic: [],
};

/** Normalise a free-text industry input onto the closed `IndustryKey` union.
 *  Strategy: lowercase, trim, then check every synonym in every template's
 *  list — first containment-match wins. Unknown returns `generic`.
 *
 *  Examples:
 *    "Electrician" → 'electrician'
 *    "domestic & commercial electrical services" → 'electrician'
 *    "sparky" → 'electrician'
 *    "fence installer" → 'generic' (no fence/fencing key today)
 *    "" / undefined → 'generic' */
export function mapIndustry(freeText: string | null | undefined): IndustryKey {
  if (!freeText) return 'generic';
  const needle = freeText.trim().toLowerCase();
  if (!needle) return 'generic';

  // Two passes so a multi-word synonym match (e.g. "painter and decorator")
  // beats a single-word containment (e.g. "painter") on input like
  // "painter and decorator services".
  // Pass 1: longer synonyms first.
  const allEntries: { key: IndustryKey; synonym: string }[] = [];
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP) as [
    IndustryKey,
    readonly string[],
  ][]) {
    for (const synonym of synonyms) {
      allEntries.push({ key, synonym });
    }
  }
  allEntries.sort((a, b) => b.synonym.length - a.synonym.length);

  for (const { key, synonym } of allEntries) {
    if (needle.includes(synonym)) {
      return key;
    }
  }
  return 'generic';
}

/** Resolve a brief's industry to a full template. The resolver chains
 *  through `mapIndustry` so all callers go through one path. */
export function resolveIndustryTemplate(
  freeText: string | null | undefined,
): IndustryTemplate {
  return INDUSTRY_TEMPLATES[mapIndustry(freeText)];
}

// =============================================================================
// Prompt helpers — used by generation-prompt.ts to build the industry block.
// Kept here so the template + its prompt rendering live in lockstep.
// =============================================================================

/** Render the industry template as a model-facing context block. Sent as one
 *  of the prompt blocks alongside the brand block. Includes the context
 *  paragraph, value-prop examples, proof-point examples, objection patterns,
 *  CTA framing, trust signals, and the offer framing. The model is told
 *  these are PATTERNS to weave in, not literal copy to repeat. */
export function renderIndustryPromptBlock(template: IndustryTemplate): string {
  const lines: string[] = [];

  lines.push(
    `Industry resolved: ${template.displayName} (key: \`${template.key}\`, urgency mode: \`${template.urgencyMode}\`)`,
  );
  lines.push('');
  lines.push('Customer mindset and conversion levers for this trade:');
  lines.push(quoteParagraph(template.contextForModel));
  lines.push('');

  lines.push(
    'Value-proposition patterns to weave in (paraphrase — do not repeat verbatim):',
  );
  for (const v of template.valuePropositions) {
    lines.push(`  - ${v}`);
  }
  lines.push('');

  lines.push(
    'Proof-point patterns (use whichever line up with the brief; never invent specifics):',
  );
  for (const p of template.proofPoints) {
    lines.push(`  - ${p}`);
  }
  lines.push('');

  lines.push('Common customer objections and how to handle them in copy:');
  for (const o of template.objectionHandlers) {
    lines.push(`  - ${o.objection}: ${o.response}`);
  }
  lines.push('');

  lines.push(
    `CTA framing — primary: "${template.ctaPrimary}", secondary: "${template.ctaSecondary}".`,
  );
  lines.push(
    `Offer framing reference: ${template.offerFraming}`,
  );
  lines.push('');

  lines.push(
    'Region-flexible trust signals (use whichever the brief or business details support; never claim a certification the brief does not establish):',
  );
  for (const t of template.trustSignals) {
    lines.push(`  - ${t}`);
  }

  return lines.join('\n');
}

function quoteParagraph(s: string): string {
  return s
    .split('\n')
    .map((line) => `  > ${line}`)
    .join('\n');
}
