// =============================================================================
// Email template renderer.
//
// Phase 7 Resend session. Sibling of src/lib/sms/template-renderer.ts —
// substitutes `{{variable}}` placeholders with values from a render context.
// HTML AND plain-text bodies render the same context; the same placeholder
// set works in both.
//
// A missing variable renders to empty string (NOT the literal `{{…}}`) — a
// customer must never receive an un-substituted placeholder — and is
// reported on `missingVariables`. Falsy values (empty string, etc.) are kept
// as-is.
//
// SERVER-ONLY-by-convention — the renderer is pure, but the values it gets
// fed come from a server-only context build.
// =============================================================================

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9._]*)\s*\}\}/g;

export type EmailRenderContext = Record<string, string>;

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  variablesUsed: string[];
  missingVariables: string[];
};

export type EmailTemplateInput = {
  subject: string;
  body_html: string;
  body_text: string;
};

/** Render one email — subject, HTML body, and plain-text body. */
export function renderEmail(
  template: EmailTemplateInput,
  context: EmailRenderContext,
): RenderedEmail {
  const used = new Set<string>();
  const missing = new Set<string>();

  const subject = renderOne(template.subject, context, used, missing);
  const html = renderOne(template.body_html, context, used, missing);
  const text = renderOne(template.body_text, context, used, missing);

  return {
    subject: subject.trim(),
    html,
    text,
    variablesUsed: [...used],
    missingVariables: [...missing],
  };
}

function renderOne(
  template: string,
  context: EmailRenderContext,
  used: Set<string>,
  missing: Set<string>,
): string {
  if (typeof template !== 'string' || template.length === 0) return '';
  return template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    used.add(key);
    if (!(key in context)) {
      missing.add(key);
      return '';
    }
    return context[key] ?? '';
  });
}

/** Plain-text footer appended to every customer-facing outbound email
 *  (operator → lead). Customer-facing sends are plain-text only — no HTML
 *  chrome — and carry this subtle attribution. NOT applied to Webnua →
 *  operator emails (Surface 1), which are branded HTML and don't need it.
 *
 *  Format follows the RFC 3676 §4.3 signature convention: a line containing
 *  exactly `-- ` (dash-dash-space) separates the signature from the body.
 *  Most mail clients render anything below muted.
 *
 *  Not a feature flag — every customer-facing send carries it. */
export const CUSTOMER_FOOTER = '\n\n-- \nPowered by Webnua · https://webnua.com';

/** Append the customer-facing footer to a plain-text body. Idempotent on
 *  empty input (returns empty — never a footer with no body above it). */
export function appendCustomerFooter(text: string): string {
  if (!text || !text.trim()) return text;
  return text + CUSTOMER_FOOTER;
}

/** Strip an HTML body down to a plain-text approximation — used when a caller
 *  hands us HTML and we need a text alt. Naïve but sufficient for the
 *  operator-reply path; the customer-template path is content-authored in
 *  both formats. */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
