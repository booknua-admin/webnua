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
import { heroSection } from '@/lib/website/sections/hero';
import { offerSection } from '@/lib/website/sections/offer';
import { schedulePickerSection } from '@/lib/website/sections/schedulePicker';
import { servicesSection } from '@/lib/website/sections/services';
import { thanksConfirmationSection } from '@/lib/website/sections/thanksConfirmation';
import { trustSection } from '@/lib/website/sections/trust';

import type { CTAData } from '@/lib/website/sections/cta';
import type { HeroData } from '@/lib/website/sections/hero';
import type { OfferData } from '@/lib/website/sections/offer';
import type { SchedulePickerData } from '@/lib/website/sections/schedulePicker';
import type { ServicesData } from '@/lib/website/sections/services';
import type { ThanksConfirmationData } from '@/lib/website/sections/thanksConfirmation';
import type { TrustData } from '@/lib/website/sections/trust';

// ---- Helpers --------------------------------------------------------------

function mkSection<TData>(
  id: string,
  type: SectionType,
  data: TData,
  enabled = true,
): Section {
  return {
    id,
    type,
    enabled,
    data: data as Record<string, unknown>,
  };
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
// Section content sourced from the onboarding wizard's stubbed answers
// (lib/onboarding/voltline-build.tsx) so the wizard's published output and
// the funnel editor's seed agree.

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
  tag: '// THE 90-MINUTE PROMISE',
  title: '90 minutes — or $50 off the call-out',
  priceLabel: '$95',
  priceCaption: 'standard call-out · $165 after-hours',
  includedText: [
    'Licensed sparky on site within 90 min of confirmation',
    'Fixed call-out fee, no quibbling',
    '$20M public liability + EC 47829',
    'Written quote before any further work',
  ].join('\n'),
  scarcityCopy:
    "Skin in the game: if we don't arrive in 90, you get $50 off — no questions, no quibbling.",
  ctaLabel: "Book today's slot →",
  ctaHref: '#schedule',
};

const voltlineLandingTrust: TrustData = {
  ...trustSection.defaultData(),
  intro: '// 1,840+ JOBS · PERTH HOMEOWNERS TRUST US',
  ratingValue: '4.9',
  ratingMax: '5',
  ratingSource: 'Google · 184 reviews',
  yearsLabel: '11 yrs in Perth',
  licenceLabel: 'EC Lic 47829',
  guaranteeLabel: '$20M public liability',
};

const voltlineLandingServices: ServicesData = {
  ...servicesSection.defaultData(),
  title: 'Common jobs · prices on the page',
  intro:
    "Fixed prices on the common stuff. Free written quote for everything else — no surprises after we're on site.",
  services: [
    {
      id: 'svc-powerpoint',
      name: 'Powerpoint install',
      priceFrom: '$85',
      durationLabel: '~45 min',
      description: 'Single or double · indoor or weatherproof outdoor.',
    },
    {
      id: 'svc-smoke',
      name: 'Smoke alarm hardwire',
      priceFrom: '$145',
      durationLabel: '~30 min',
      description: 'Compliance-grade hardwired 240V alarm with backup.',
    },
    {
      id: 'svc-fan',
      name: 'Ceiling fan install',
      priceFrom: '$220',
      durationLabel: '~60 min',
      description: 'Bracket + isolator switch + tidy finish.',
    },
    {
      id: 'svc-switchboard',
      name: 'Switchboard inspection',
      priceFrom: '$220',
      durationLabel: '~90 min',
      description: 'Full visual inspection with written report.',
    },
    {
      id: 'svc-rcd',
      name: 'RCD replacement',
      priceFrom: '$185',
      durationLabel: '~45 min',
      description: 'Same-day replacement, compliance-tested before we leave.',
    },
    {
      id: 'svc-hotwater',
      name: 'Hot water isolator',
      priceFrom: '$165',
      durationLabel: '~60 min',
      description: 'Isolator + safety switch with new wiring run.',
    },
  ],
};

const voltlineLandingCTA: CTAData = {
  ...ctaSection.defaultData(),
  tag: '// READY?',
  headline: "Sparkie at your door this hour.",
  sub: 'One call, fixed callout, written quote on arrival.',
  ctaLabel: "Book today's slot →",
  ctaHref: '#schedule',
};

const voltlineSchedulePicker: SchedulePickerData = {
  ...schedulePickerSection.defaultData(),
  title: 'Pick a time that works for you',
  intro:
    "Pick a window and we'll text you back within 5 min to confirm. Most days you'll see a sparky on site the same day.",
  durationLabel: '60–90 min on site',
  earliestSlotLabel: 'Next slot: today, 2:30 PM',
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
    mkSection('sec-vf-landing-services', 'services', voltlineLandingServices),
    mkSection('sec-vf-landing-cta', 'cta', voltlineLandingCTA),
  ],
  createdAt: VOLTLINE_CREATED_AT,
});

const voltlineScheduleStep = mkStep({
  id: 'step-voltline-schedule',
  funnelId: VOLTLINE_FUNNEL_ID,
  slug: 'schedule',
  title: 'Schedule',
  type: 'schedule',
  sections: [
    mkSection('sec-vf-schedule-picker', 'schedulePicker', voltlineSchedulePicker),
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
