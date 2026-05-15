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
  footerSection,
  headerSection,
  reviewsSection,
  schedulePickerSection,
  thanksConfirmationSection,
  trustSection,
} from './placeholders';
import { servicesSection } from './services';

import type { ContainerKind } from '../types';

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

/** Section types that can be added inside the given container. */
export function getSectionsForContainer(
  container: ContainerKind,
): SectionTypeDefinition[] {
  return SECTION_REGISTRY.filter((d) =>
    d.allowedContainers.includes(container),
  );
}

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
