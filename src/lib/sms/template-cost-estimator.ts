// =============================================================================
// SMS template cost estimator — for the template editor UI.
//
// A template's raw length is misleading: {{lead.firstName}} is 18 characters
// in the editor but renders to "Sarah" (5) — or "Christopher" (11) on a long
// day. estimateCost() runs the template through the renderer with realistic
// sample data, then validates the RENDERED output, so the operator sees the
// length / segments / cost a real send will have. estimateWorstCase() does the
// same with the longest realistic value of every variable.
//
// SERVER + CLIENT safe — pure, composes the renderer + validator.
// =============================================================================

import { validateTemplate, type SegmentEncoding } from './character-validator';
import { segmentCost } from './pricing';
import { render } from './template-renderer';
import { buildSampleContext, type RenderContext } from './template-variables';

export type SmsCostEstimate = {
  /** The template rendered with the sample data. */
  renderedText: string;
  /** Character count of the rendered output. */
  length: number;
  segments: number;
  encoding: SegmentEncoding;
  /** Estimated cost of one send, in EUR. */
  costEur: number;
  /** True when the rendered output is GSM-7 clean. */
  isGSMCompatible: boolean;
  /** Variables referenced by the template but missing from the context. */
  missingVariables: string[];
};

/**
 * Estimate the cost of a template with typical data. Pass a custom context to
 * estimate against specific values; omit it for the built-in typical sample.
 */
export function estimateCost(template: string, sampleContext?: RenderContext): SmsCostEstimate {
  const context = sampleContext ?? buildSampleContext('typical');
  return estimateWith(template, context);
}

/**
 * Estimate the maximum-length scenario — every variable resolved to its
 * longest realistic value. This is the number that catches an operator out
 * ("it was 1 segment in the preview, why am I billed for 2?").
 */
export function estimateWorstCase(template: string): SmsCostEstimate {
  return estimateWith(template, buildSampleContext('long'));
}

function estimateWith(template: string, context: RenderContext): SmsCostEstimate {
  const rendered = render(template, context);
  const validation = validateTemplate(rendered.text);
  return {
    renderedText: rendered.text,
    length: validation.length,
    segments: validation.segments,
    encoding: validation.segmentEncoding,
    costEur: segmentCost(validation.segments),
    isGSMCompatible: validation.isGSMCompatible,
    missingVariables: rendered.missingVariables,
  };
}
