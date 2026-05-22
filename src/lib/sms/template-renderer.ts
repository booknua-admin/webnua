// =============================================================================
// SMS template renderer — substitutes {{variable}} placeholders.
//
// render(template, context) walks the template, swapping every {{group.name}}
// for its value in the context. It reports which variables it used and which
// were referenced but missing — the editor surfaces the missing list as a
// warning (a typo'd variable would otherwise ship an empty gap to a customer).
//
// A referenced-but-missing variable renders as an empty string, NOT as the
// literal {{...}} — a customer must never receive an un-substituted
// placeholder.
//
// SERVER + CLIENT safe — pure, no imports beyond the variable types.
// =============================================================================

import type { RenderContext } from './template-variables';

export type RenderResult = {
  /** The template with every {{variable}} substituted. */
  text: string;
  /** Distinct variable keys the template referenced, in first-seen order. */
  variablesUsed: string[];
  /** Variable keys referenced but absent from the context (rendered empty). */
  missingVariables: string[];
};

// {{ group.name }} — dotted key, optional surrounding whitespace.
const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

/**
 * Render `template` against `context`. Every {{variable}} is replaced with its
 * context value; an unknown variable becomes an empty string and is reported
 * in `missingVariables`.
 */
export function render(template: string, context: RenderContext): RenderResult {
  const usedOrder: string[] = [];
  const used = new Set<string>();
  const missing = new Set<string>();

  const text = template.replace(PLACEHOLDER_RE, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (!used.has(key)) {
      used.add(key);
      usedOrder.push(key);
    }
    const value = context[key];
    if (value === undefined) {
      missing.add(key);
      return '';
    }
    return value;
  });

  return {
    text,
    variablesUsed: usedOrder,
    missingVariables: [...missing],
  };
}

/** The distinct variable keys a template references, without rendering. */
export function extractVariables(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    seen.add(match[1].trim());
  }
  return [...seen];
}
