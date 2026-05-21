// =============================================================================
// Funnel preflight rule engine (A3 · funnel publish + approval lane).
//
// The funnel-shaped sibling of `lib/website/preflight.ts`. The website rule
// engine reads a `VersionSnapshot` (pages + header/footer/nav singletons); a
// funnel snapshot is `{ steps, stepOrder }` with no shared chrome, so the rule
// set is its own — but the result + report types are reused verbatim so the
// review surface can render either with the same `PreflightChecklist`.
//
// Rules are pure functions over a snapshot. Hard-fail rules block publish;
// warnings allow publish with a confirm step. A funnel is operator-managed
// (CLAUDE.md), so the rule set is leaner than the website's — the few rules
// that genuinely break a live funnel (empty step, no lead-capture field) are
// fails; the advisory ones (SEO title, lead-capture presence) are warnings.
// =============================================================================

import type { CTAData } from '@/lib/website/sections/cta';
import type { HeroData } from '@/lib/website/sections/hero';
import type {
  PreflightReport,
  PreflightResult,
  PreflightStatus,
} from '@/lib/website/preflight';
import type { Section } from '@/lib/website/types';

import type { FunnelStep, FunnelVersionSnapshot } from './types';

export type { PreflightReport, PreflightResult, PreflightStatus };

// ---- Helpers ---------------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function nonEmpty(v: unknown): boolean {
  return isString(v) && v.trim().length > 0;
}

function stepEditorHref(funnelId: string, stepId: string): string {
  return `/funnels/${funnelId}/edit/${stepId}`;
}

function enabledSectionsByType(step: FunnelStep, type: Section['type']): Section[] {
  return step.sections.filter((s) => s.enabled && s.type === type);
}

function stepLabel(step: FunnelStep): string {
  return step.title || step.slug || step.type;
}

type FunnelPreflightRule = {
  id: string;
  title: string;
  run(snapshot: FunnelVersionSnapshot, funnelId: string): PreflightResult[];
};

// ---- Rules -----------------------------------------------------------------

const stepHasSectionsRule: FunnelPreflightRule = {
  id: 'funnel-step-has-sections',
  title: 'Every step has at least one enabled section',
  run(snapshot, funnelId) {
    return snapshot.steps.flatMap((step): PreflightResult[] => {
      if (step.sections.some((s) => s.enabled)) return [];
      return [
        {
          ruleId: 'funnel-step-has-sections',
          status: 'fail',
          title: 'Step has no enabled sections',
          message: `${stepLabel(step)} would publish as a blank step. Add a section or remove the step.`,
          pageId: step.id,
          fixHref: stepEditorHref(funnelId, step.id),
        },
      ];
    });
  },
};

const heroContentRule: FunnelPreflightRule = {
  id: 'funnel-hero-content',
  title: 'Hero sections have a headline',
  run(snapshot, funnelId) {
    const results: PreflightResult[] = [];
    for (const step of snapshot.steps) {
      for (const section of enabledSectionsByType(step, 'hero')) {
        const data = section.data as Partial<HeroData>;
        if (!nonEmpty(data.headline)) {
          results.push({
            ruleId: 'funnel-hero-content',
            status: 'fail',
            title: 'Hero missing headline',
            message: `The hero on ${stepLabel(step)} has no headline — the step leads with empty space.`,
            pageId: step.id,
            sectionId: section.id,
            fixHref: stepEditorHref(funnelId, step.id),
          });
        }
      }
    }
    return results;
  },
};

const ctaContentRule: FunnelPreflightRule = {
  id: 'funnel-cta-content',
  title: 'CTA sections have a headline + button',
  run(snapshot, funnelId) {
    const results: PreflightResult[] = [];
    for (const step of snapshot.steps) {
      for (const section of enabledSectionsByType(step, 'cta')) {
        const data = section.data as Partial<CTAData>;
        const missing: string[] = [];
        if ((data.layout ?? 'centered') === 'dual') {
          const hasButton =
            nonEmpty(data.panelA?.buttonLabel) ||
            nonEmpty(data.panelB?.buttonLabel);
          if (!hasButton) missing.push('panel button');
        } else {
          if (!nonEmpty(data.headline)) missing.push('headline');
          if (!nonEmpty(data.primaryLabel)) missing.push('button label');
        }
        if (missing.length > 0) {
          results.push({
            ruleId: 'funnel-cta-content',
            status: 'fail',
            title: 'CTA section incomplete',
            message: `The CTA on ${stepLabel(step)} is missing ${missing.join(' + ')}.`,
            pageId: step.id,
            sectionId: section.id,
            fixHref: stepEditorHref(funnelId, step.id),
          });
        }
      }
    }
    return results;
  },
};

const formFieldsRule: FunnelPreflightRule = {
  id: 'funnel-form-fields',
  title: 'Lead-capture forms have at least one field',
  run(snapshot, funnelId) {
    const results: PreflightResult[] = [];
    for (const step of snapshot.steps) {
      for (const section of step.sections) {
        // A form lives on the Section envelope (`section.form`) — the `form`
        // section type is born with one, any section can attach one.
        if (!section.enabled || !section.form) continue;
        if (section.form.fields.length === 0) {
          results.push({
            ruleId: 'funnel-form-fields',
            status: 'fail',
            title: 'Form has no fields',
            message: `A form on ${stepLabel(step)} captures nothing — add a field or remove the form.`,
            pageId: step.id,
            sectionId: section.id,
            fixHref: stepEditorHref(funnelId, step.id),
          });
        }
      }
    }
    return results;
  },
};

const leadCaptureRule: FunnelPreflightRule = {
  id: 'funnel-lead-capture',
  title: 'The funnel captures a lead somewhere',
  run(snapshot, funnelId) {
    const hasForm = snapshot.steps.some((step) =>
      step.sections.some((s) => s.enabled && s.form),
    );
    if (hasForm) return [];
    const firstStep = snapshot.steps[0];
    return [
      {
        ruleId: 'funnel-lead-capture',
        status: 'warn',
        title: 'No lead-capture form',
        message:
          'No step in this funnel has a form — visitors have no way to convert. Add a form section or attach a form to the hero.',
        pageId: firstStep?.id,
        fixHref: firstStep
          ? stepEditorHref(funnelId, firstStep.id)
          : undefined,
      },
    ];
  },
};

const seoTitleRule: FunnelPreflightRule = {
  id: 'funnel-seo-title',
  title: 'Steps have an SEO title',
  run(snapshot, funnelId) {
    return snapshot.steps.flatMap((step): PreflightResult[] => {
      if (nonEmpty(step.seo.title)) return [];
      return [
        {
          ruleId: 'funnel-seo-title',
          status: 'warn',
          title: 'SEO title missing',
          message: `${stepLabel(step)} has no SEO title — search + share previews use an uncontrolled fallback.`,
          pageId: step.id,
          fixHref: stepEditorHref(funnelId, step.id),
        },
      ];
    });
  },
};

// ---- Runner ----------------------------------------------------------------

export const FUNNEL_PREFLIGHT_RULES: readonly FunnelPreflightRule[] = [
  stepHasSectionsRule,
  heroContentRule,
  ctaContentRule,
  formFieldsRule,
  leadCaptureRule,
  seoTitleRule,
];

export function runFunnelPreflight(
  snapshot: FunnelVersionSnapshot,
  funnelId: string,
): PreflightReport {
  const results = FUNNEL_PREFLIGHT_RULES.flatMap((r) => r.run(snapshot, funnelId));
  const counts: Record<PreflightStatus, number> = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status]++;
  const passingRules = FUNNEL_PREFLIGHT_RULES.filter((rule) =>
    results.every((r) => r.ruleId !== rule.id),
  ).length;
  counts.pass = passingRules;
  return {
    results,
    counts,
    canPublish: counts.fail === 0,
    allClear: counts.fail === 0 && counts.warn === 0,
  };
}

/** Group results by step id (mirror of `groupResultsByPage`). Every funnel
 *  result carries a `pageId` (the step id) — there is no `__site` bucket. */
export function groupFunnelResultsByStep(
  results: PreflightResult[],
): Record<string, PreflightResult[]> {
  const grouped: Record<string, PreflightResult[]> = {};
  for (const r of results) {
    const key = r.pageId ?? '__funnel';
    (grouped[key] ??= []).push(r);
  }
  return grouped;
}
