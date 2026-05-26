// =============================================================================
// Stub funnel data — Voltline's "$99 emergency call-out" funnel built against
// the Session 3.5 Funnel + FunnelStep types and the section registry.
//
// One client today (Voltline) has an editable funnel. FreshHome / KeyHero /
// NeatWorks ship without funnels in the stub layer — the agency-mode roster
// renders empty rows for them.
//
// Coexists with the analytics-detail stub at `lib/funnels/client-detail.tsx`
// (plural) — different concern, same Voltline funnel surface. The shared id
// (`emergency-call-out`) lets `/funnels/[id]` resolve both stubs from one URL.
//
// FIX G — section shape mirrors the live generator. The landing step uses
// `features` (not the deprecated `services`); the schedule step uses a
// `form` section with a `Section.form` envelope (not the deprecated
// `schedulePicker`, which the live generator never emits — see
// `generate-funnel-live.ts`'s qualification-step plan). The thanks step is
// unchanged. Adding sections here means picking from the live registry —
// don't reintroduce deprecated section types (`services` / `schedulePicker`)
// even via copy-paste.
//
// When real backend lands the Funnel + FunnelStep + FunnelVersion data move
// to Supabase reads against `funnels` / `funnel_steps` / `funnel_versions`
// tables; the public accessors below keep their shape so call sites don't
// change.
// =============================================================================

import type {
  Funnel,
  FunnelStep,
  FunnelStepType,
  FunnelVersion,
} from './types';
import type { Section, SectionType } from '@/lib/website/types';

import { ctaSection } from '@/lib/website/sections/cta';
import { featuresSection } from '@/lib/website/sections/features';
import { heroSection } from '@/lib/website/sections/hero';
import { offerSection } from '@/lib/website/sections/offer';
import { thanksConfirmationSection } from '@/lib/website/sections/thanksConfirmation';
import { trustSection } from '@/lib/website/sections/trust';

import type { CTAData } from '@/lib/website/sections/cta';
import type { FeaturesData } from '@/lib/website/sections/features';
import type { HeroData } from '@/lib/website/sections/hero';
import type { OfferData } from '@/lib/website/sections/offer';
import type { ThanksConfirmationData } from '@/lib/website/sections/thanksConfirmation';
import type { TrustData } from '@/lib/website/sections/trust';

import type { FormConfig, FormField } from '@/lib/website/form-config';
import { defaultFormField, makeFieldId } from '@/lib/website/form-config';

// ---- Helpers --------------------------------------------------------------

function mkSection<TData>(
  id: string,
  type: SectionType,
  data: TData,
  enabled = true,
  form?: FormConfig,
): Section {
  const section: Section = {
    id,
    type,
    enabled,
    data: data as Record<string, unknown>,
  };
  if (form) section.form = form;
  return section;
}

function mkStep(args: {
  id: string;
  funnelId: string;
  slug: string;
  title: string;
  type: FunnelStepType;
  sections: Section[];
  createdAt: string;
}): FunnelStep {
  return {
    id: args.id,
    funnelId: args.funnelId,
    slug: args.slug,
    title: args.title,
    type: args.type,
    sections: args.sections,
    seo: {},
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
  };
}

// ---- Voltline funnel ------------------------------------------------------
// Three-step "$99 emergency call-out" funnel — landing → schedule → thanks.
// Seed content for the funnel editor + the funnel queries' stub fallback.

const VOLTLINE_FUNNEL_ID = 'emergency-call-out';
const VOLTLINE_CREATED_AT = '2026-05-01T09:30:00+08:00';

const voltlineLandingHero: HeroData = {
  ...heroSection.defaultData(),
  eyebrow: '// SPARKIES ON CALL · PERTH METRO',
  headline:
    "You're not selling sparky hours. You're selling your Tuesday back.",
  sub: '24/7 emergency sparky. Same-day for everything else. Licensed, insured, fixed-rate menu published.',
  ctaPrimaryLabel: "Book a sparky · today's slots",
  ctaPrimaryHref: '#schedule',
  ctaSecondaryLabel: '☏ 0411 567 234',
  ctaSecondaryHref: 'tel:0411567234',
};

const voltlineLandingOffer: OfferData = {
  ...offerSection.defaultData(),
  tag: 'THE 90-MINUTE PROMISE',
  title: '90 minutes — or $50 off the call-out',
  priceLabel: '$95',
  priceCaption: 'standard call-out · $165 after-hours',
  inclusions: [
    'Licensed sparky on site within 90 min of confirmation',
    'Fixed call-out fee, no quibbling',
    '$20M public liability + EC 47829',
    'Written quote before any further work',
  ].map((text, i) => ({ id: `inc-vlo-${i}`, text })),
  scarcityCopy:
    "Skin in the game: if we don't arrive in 90, you get $50 off — no quibbling.",
  ctaLabel: "Book today's slot",
  ctaHref: '#schedule',
};

const voltlineLandingTrust: TrustData = {
  ...trustSection.defaultData(),
  eyebrow: 'PERTH HOMEOWNERS TRUST US',
  headline: '1,840+ jobs done right.',
  sub: 'Eleven years of licensed electrical work across Perth metro.',
};

// Features (FIX G — was `services`, the deprecated section type). Mirrors
// the live generator's value-stack shape: a value-prop grid with concrete
// what-you-get items, not a priced service menu.
const voltlineLandingFeatures: FeaturesData = {
  ...featuresSection.defaultData(),
  eyebrow: '// WHAT YOU GET',
  headline: 'Four things that make a midnight callout actually work.',
  sub: 'No call centre, no surprise bills, no cowboy gear left on your driveway.',
  columns: 2,
  ctaVisible: false,
  ctaLabel: '',
  ctaHref: '',
  items: [
    {
      id: 'feat-phone',
      icon: 'phone',
      imageUrl: '',
      title: '24/7 phone — answered by a human',
      description: 'Mark or the on-call sparky picks up. No call centre.',
      linkLabel: '',
      linkHref: '',
    },
    {
      id: 'feat-eta',
      icon: 'clock',
      imageUrl: '',
      title: 'On site within 90 minutes',
      description: 'Anywhere in Perth metro. Vans loaded with the parts most callouts need.',
      linkLabel: '',
      linkHref: '',
    },
    {
      id: 'feat-quote',
      icon: 'circle-check',
      imageUrl: '',
      title: 'Fixed quote before work starts',
      description: 'We diagnose first, write the price down, and only start when you sign off.',
      linkLabel: '',
      linkHref: '',
    },
    {
      id: 'feat-licensed',
      icon: 'shield-check',
      imageUrl: '',
      title: 'Licensed and insured',
      description: 'EC47829 · $20M public liability · safety paperwork lodged on the day.',
      linkLabel: '',
      linkHref: '',
    },
  ],
};

const voltlineLandingCTA: CTAData = {
  ...ctaSection.defaultData(),
  eyebrow: 'READY?',
  headline: 'Sparkie at your door this hour.',
  sub: 'One call, fixed callout, written quote on arrival.',
  primaryLabel: "Book today's slot",
  primaryHref: '#schedule',
};

// Qualification form (FIX G — was `schedulePicker`, the deprecated section
// type). Mirrors the live generator's `buildQualificationFormConfig` shape:
// phone + service address + preferred date + time-of-day + budget. Attached
// to a `form` section via the `Section.form` envelope (see `mkSection`).
function voltlineQualificationForm(): FormConfig {
  const phone: FormField = defaultFormField('phone');
  phone.required = true;

  const address: FormField = {
    id: makeFieldId(),
    type: 'text',
    label: 'Service address',
    required: true,
    placeholder: 'Where should we come?',
    leadRole: 'address',
  };

  const preferredDate: FormField = {
    id: makeFieldId(),
    type: 'date',
    label: 'Preferred date',
    required: false,
  };

  const timeOfDay: FormField = {
    id: makeFieldId(),
    type: 'select',
    label: 'Preferred time of day',
    required: false,
    placeholder: 'Pick a window',
    options: ['Morning', 'Afternoon', 'Evening'],
  };

  const budget: FormField = {
    id: makeFieldId(),
    type: 'select',
    label: 'Budget',
    required: false,
    placeholder: 'Ballpark',
    options: ['Under $500', '$500–$2,000', '$2,000–$10,000', '$10,000+', 'Not sure yet'],
  };

  return {
    title: 'Lock in your callout',
    showTitle: false,
    submitLabel: 'Confirm my booking',
    fields: [phone, address, preferredDate, timeOfDay, budget],
    afterSubmit: { kind: 'nextStep' },
    colors: {},
  };
}

const voltlineQualificationData: Record<string, unknown> = {
  eyebrow: '// FINAL 30 SECONDS',
  heading: 'Lock in your callout',
};

const voltlineThanks: ThanksConfirmationData = {
  ...thanksConfirmationSection.defaultData(),
  title: "You're booked. Mark's on his way.",
  body: "Confirmation SMS just sent to your number. Mark will call you 15 min before arrival to confirm the address.",
  detailLine:
    'Need to change the time? Reply RESCHEDULE to the SMS and we’ll sort it.',
  referralTitle: 'Know someone else who needs a sparky?',
  referralBody:
    'We pay $25 cash for any referral that books — no caps, no T&Cs.',
  referralCtaLabel: 'Share Voltline →',
};

// ---- Steps ---------------------------------------------------------------

const voltlineLandingStep = mkStep({
  id: 'step-voltline-landing',
  funnelId: VOLTLINE_FUNNEL_ID,
  slug: 'landing',
  title: 'Landing',
  type: 'landing',
  sections: [
    mkSection('sec-vf-landing-hero', 'hero', voltlineLandingHero),
    mkSection('sec-vf-landing-offer', 'offer', voltlineLandingOffer),
    mkSection('sec-vf-landing-trust', 'trust', voltlineLandingTrust),
    mkSection('sec-vf-landing-features', 'features', voltlineLandingFeatures),
    mkSection('sec-vf-landing-cta', 'cta', voltlineLandingCTA),
  ],
  createdAt: VOLTLINE_CREATED_AT,
});

const voltlineScheduleStep = mkStep({
  id: 'step-voltline-schedule',
  funnelId: VOLTLINE_FUNNEL_ID,
  slug: 'schedule',
  title: 'Schedule',
  // Type stays `'schedule'` — the type union is the slot, not the picker;
  // the live generator's qualification step also uses `'schedule'` type.
  type: 'schedule',
  sections: [
    mkSection(
      'sec-vf-schedule-qualify',
      'form',
      voltlineQualificationData,
      true,
      voltlineQualificationForm(),
    ),
  ],
  createdAt: VOLTLINE_CREATED_AT,
});

const voltlineThanksStep = mkStep({
  id: 'step-voltline-thanks',
  funnelId: VOLTLINE_FUNNEL_ID,
  slug: 'thanks',
  title: 'Thanks',
  type: 'thanks',
  sections: [
    mkSection('sec-vf-thanks', 'thanksConfirmation', voltlineThanks),
  ],
  createdAt: VOLTLINE_CREATED_AT,
});

const voltlineFunnelSteps: FunnelStep[] = [
  voltlineLandingStep,
  voltlineScheduleStep,
  voltlineThanksStep,
];

// ---- Versions ------------------------------------------------------------

const voltlinePublishedVersion: FunnelVersion = {
  id: 'fversion-voltline-published',
  funnelId: VOLTLINE_FUNNEL_ID,
  status: 'published',
  snapshot: {
    steps: voltlineFunnelSteps,
    stepOrder: voltlineFunnelSteps.map((s) => s.id),
  },
  createdBy: 'user-admin-craig',
  createdAt: VOLTLINE_CREATED_AT,
  publishedAt: VOLTLINE_CREATED_AT,
  publishedBy: 'user-admin-craig',
  notes: 'Initial funnel publish — landing / schedule / thanks scaffolded.',
};

const voltlineDraftVersion: FunnelVersion = {
  id: 'fversion-voltline-draft',
  funnelId: VOLTLINE_FUNNEL_ID,
  status: 'draft',
  snapshot: {
    steps: voltlineFunnelSteps,
    stepOrder: voltlineFunnelSteps.map((s) => s.id),
  },
  createdBy: 'user-admin-craig',
  createdAt: VOLTLINE_CREATED_AT,
  parentVersionId: voltlinePublishedVersion.id,
};

const stubFunnelVersions: FunnelVersion[] = [
  voltlinePublishedVersion,
  voltlineDraftVersion,
];

// ---- Funnels -------------------------------------------------------------

const voltlineFunnel: Funnel = {
  id: VOLTLINE_FUNNEL_ID,
  clientId: 'voltline',
  name: '$99 emergency call-out · Voltline',
  domain: {
    primary: 'book.voltline.com.au',
    aliases: [],
    sslStatus: 'live',
  },
  draftVersionId: voltlineDraftVersion.id,
  publishedVersionId: voltlinePublishedVersion.id,
  createdAt: VOLTLINE_CREATED_AT,
  updatedAt: VOLTLINE_CREATED_AT,
};

const stubFunnels: Funnel[] = [voltlineFunnel];

// ---- Public accessors -----------------------------------------------------

export const STUB_FUNNELS: readonly Funnel[] = stubFunnels;
export const STUB_FUNNEL_VERSIONS: readonly FunnelVersion[] = stubFunnelVersions;

export function findFunnel(id: string): Funnel | null {
  return STUB_FUNNELS.find((f) => f.id === id) ?? null;
}

export function getFunnelsForClient(clientId: string): Funnel[] {
  return STUB_FUNNELS.filter((f) => f.clientId === clientId);
}

export function findFunnelVersion(id: string): FunnelVersion | null {
  return STUB_FUNNEL_VERSIONS.find((v) => v.id === id) ?? null;
}

export function getDraftForFunnel(funnelId: string): FunnelVersion | null {
  return (
    STUB_FUNNEL_VERSIONS.find(
      (v) => v.funnelId === funnelId && v.status === 'draft',
    ) ?? null
  );
}

export function findStep(
  funnelId: string,
  stepId: string,
): FunnelStep | null {
  const draft = getDraftForFunnel(funnelId);
  if (!draft) return null;
  return draft.snapshot.steps.find((s) => s.id === stepId) ?? null;
}

export function findStepBySlug(
  funnelId: string,
  slug: string,
): FunnelStep | null {
  const draft = getDraftForFunnel(funnelId);
  if (!draft) return null;
  return draft.snapshot.steps.find((s) => s.slug === slug) ?? null;
}
