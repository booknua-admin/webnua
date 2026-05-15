// =============================================================================
// Section registry — the const array of every registered section type.
//
// Order matches the "Add section" menu order in the editor (Session 4+).
// Adding a new section type is one entry here + a new module under sections/.
// =============================================================================

import type { ContainerKind, SectionType } from '../types';
import type { SectionTypeDefinition } from '../registry';

import { ctaSection } from './cta';
import { faqSection } from './faq';
import { footerSection } from './footer';
import { headerSection } from './header';
import { heroSection } from './hero';
import { offerSection } from './offer';
import { reviewsSection } from './reviews';
import { schedulePickerSection } from './schedulePicker';
import { servicesSection } from './services';
import { thanksConfirmationSection } from './thanksConfirmation';
import { trustSection } from './trust';

export const SECTION_REGISTRY: readonly SectionTypeDefinition[] = [
  // Stackable on pages and funnel steps
  heroSection,
  offerSection,
  trustSection,
  servicesSection,
  reviewsSection,
  faqSection,
  ctaSection,
  // Funnel-only stackable
  schedulePickerSection,
  thanksConfirmationSection,
  // Website-level singletons
  headerSection,
  footerSection,
] as readonly SectionTypeDefinition[];

export function getSectionDefinition(
  type: SectionType,
): SectionTypeDefinition | undefined {
  return SECTION_REGISTRY.find((d) => d.type === type);
}

export function getImplementedSections(): SectionTypeDefinition[] {
  return SECTION_REGISTRY.filter((d) => d.implemented);
}

export function getPlaceholderSections(): SectionTypeDefinition[] {
  return SECTION_REGISTRY.filter((d) => !d.implemented);
}

/** Section types that can be added inside the given container. */
export function getSectionsForContainer(
  container: ContainerKind,
): SectionTypeDefinition[] {
  return SECTION_REGISTRY.filter((d) =>
    d.allowedContainers.includes(container),
  );
}

// Re-export per-section data types for typed consumers.
export type { CTAData } from './cta';
export type { FAQData, FAQItem } from './faq';
export type { FooterData } from './footer';
export type { HeaderData } from './header';
export type { HeroData } from './hero';
export type { OfferData } from './offer';
export type { ReviewsData, ReviewItem } from './reviews';
export type { SchedulePickerData } from './schedulePicker';
export type { ServiceItem, ServicesData } from './services';
export type { ThanksConfirmationData } from './thanksConfirmation';
export type { TrustData } from './trust';
