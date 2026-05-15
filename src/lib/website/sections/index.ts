// =============================================================================
// Section registry — the const array of every registered section type.
//
// Order matches the "Add section" menu order in the editor (Session 4+).
// Adding a new section type is one entry here + a new module under sections/.
// =============================================================================

import type { SectionType } from '../types';
import type { SectionTypeDefinition } from '../registry';

import { heroSection } from './hero';
import { offerSection } from './offer';
import {
  ctaSection,
  faqSection,
  reviewsSection,
  schedulePickerSection,
  thanksConfirmationSection,
  trustSection,
} from './placeholders';
import { servicesSection } from './services';

export const SECTION_REGISTRY: readonly SectionTypeDefinition[] = [
  heroSection,
  offerSection,
  trustSection,
  servicesSection,
  reviewsSection,
  faqSection,
  ctaSection,
  schedulePickerSection,
  thanksConfirmationSection,
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

// Re-export per-section data types for typed consumers (e.g. when a caller
// reads section.data and wants a typed handle on it).
export type { HeroData } from './hero';
export type { OfferData } from './offer';
export type { ServiceItem, ServicesData } from './services';
