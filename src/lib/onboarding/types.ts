import type { ReactNode } from 'react';

export type OnboardingStepSlug =
  | 'basics'
  | 'idea'
  | 'offer'
  | 'trust'
  | 'draft'
  | 'automations'
  | 'review'
  | 'published';

export type OnboardingStep = {
  slug: OnboardingStepSlug;
  number: number;
  label: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { slug: 'basics', number: 1, label: 'Business basics' },
  { slug: 'idea', number: 2, label: 'The big idea' },
  { slug: 'offer', number: 3, label: 'The offer' },
  { slug: 'trust', number: 4, label: 'Trust + jobs menu' },
  { slug: 'draft', number: 5, label: 'Polish your draft' },
  { slug: 'automations', number: 6, label: 'Automations' },
  { slug: 'review', number: 7, label: 'Review + publish' },
];

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length;

export function stepHref(slug: OnboardingStepSlug): string {
  return `/clients/new/${slug}`;
}

export function getStepNumber(slug: OnboardingStepSlug): number {
  return ONBOARDING_STEPS.find((s) => s.slug === slug)?.number ?? 0;
}

export type AIPillTone = 'will-draft' | 'drafted' | 'suggested';

export type BusinessBasics = {
  trade: string;
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  serviceArea: string;
  website: string;
  websiteHelper: string;
  responsePromise: string;
  licence: string;
};

export type ReframeOption = {
  id: string;
  tag: string;
  text: ReactNode;
  reason: string;
};

export type OfferDetails = {
  anchor: string;
  subHeadline: string;
  normalRate: string;
  afterHoursRate: string;
  primaryCta: string;
  secondaryCta: string;
  guarantee: string;
};

export type TrustSignal = {
  label: string;
  value: string;
  previewLabel: string;
};

export type JobsMenuItem = {
  id: string;
  name: string;
  price: string;
  type: 'flat' | 'quote';
};

export type AutomationChannel = 'sms' | 'email';

export type AutomationStep = {
  number: number;
  channel: AutomationChannel;
  delay: ReactNode;
  body: ReactNode;
  isEditing?: boolean;
  meta?: { label: string; value: string }[];
};

export type Automation = {
  id: string;
  tag: string;
  title: string;
  description: ReactNode;
  enabled: boolean;
  trigger: string;
  steps: AutomationStep[];
};

export type NextStep = {
  num: string;
  title: string;
  description: string;
};
