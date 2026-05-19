// =============================================================================
// SEO generation — shared by the website + funnel SEO panels.
//
// `generateSeo` posts to the Claude-backed /api/generate-seo route and falls
// back to `generateSeoSync` (deterministic, no I/O) when the route is
// unconfigured (no ANTHROPIC_API_KEY) or fails — same pattern as
// site-generation-stub.ts.
//
// A "target" is generic over a website Page and a funnel FunnelStep: both
// carry `sections: Section[]` and a `seo: PageSEO`, so one generator serves
// both surfaces.
// =============================================================================

import type { PageSEO, Section } from './types';

export type SeoTarget = {
  /** Page id / funnel-step id — the key the result map is keyed on. */
  id: string;
  /** Human label (page / step title) — the deterministic title seed. */
  label: string;
  /** Page type / step type — extra context for the model. */
  kind: string;
  sections: Section[];
  seo: PageSEO;
};

export type SeoBusinessContext = {
  name: string;
  industry?: string;
  audience?: string;
};

export type SeoDraft = { title: string; description: string };

// Search-engine display caps — titles truncate ~60 chars, descriptions ~160.
const TITLE_MAX = 60;
const DESC_MAX = 158;

// ---- Text extraction ------------------------------------------------------

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    const t = value.trim();
    // Skip urls, hrefs, anchors, and bare hex colours — not page copy.
    if (t.length > 2 && !/^(https?:|\/|#|[0-9a-f]{3,8}$)/i.test(t)) {
      out.push(t);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

/** Flatten every enabled section's copy into one capped text blob — the
 *  source material both the model and the deterministic fallback read. */
export function collectSectionText(sections: Section[]): string {
  const out: string[] = [];
  for (const s of sections) {
    if (!s.enabled) continue;
    collectStrings(s.data, out);
  }
  return out.join(' · ').slice(0, 1200);
}

// ---- Helpers --------------------------------------------------------------

function clamp(value: string, max: number): string {
  const t = value.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

// ---- Deterministic fallback ----------------------------------------------

/** Builds reasonable SEO from existing page copy, no API call. Always works
 *  — the fallback when the Claude route is unconfigured or fails. */
export function generateSeoSync(
  targets: SeoTarget[],
  ctx: SeoBusinessContext,
): Record<string, SeoDraft> {
  const result: Record<string, SeoDraft> = {};
  for (const target of targets) {
    const text = collectSectionText(target.sections);
    const firstLine = text.split(' · ')[0] ?? '';

    const titleSeed = target.seo.title?.trim() || target.label || ctx.name;
    const title =
      ctx.name && !titleSeed.toLowerCase().includes(ctx.name.toLowerCase())
        ? clamp(`${titleSeed} · ${ctx.name}`, TITLE_MAX)
        : clamp(titleSeed, TITLE_MAX);

    const descSeed =
      target.seo.description?.trim() ||
      [firstLine, ctx.audience].filter(Boolean).join(' ').trim() ||
      `${target.label} — ${ctx.name}.`;
    result[target.id] = { title, description: clamp(descSeed, DESC_MAX) };
  }
  return result;
}

// ---- Claude-backed generation --------------------------------------------

type RouteResult = { results?: Record<string, unknown> };

function isDraft(value: unknown): value is SeoDraft {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as SeoDraft).title === 'string' &&
    typeof (value as SeoDraft).description === 'string'
  );
}

/** Generate SEO for every target. Tries the real Claude route; any failure
 *  (no key → 503, network, malformed response) falls through to the
 *  deterministic generator so the button always produces something. */
export async function generateSeo(
  targets: SeoTarget[],
  ctx: SeoBusinessContext,
): Promise<Record<string, SeoDraft>> {
  if (targets.length === 0) return {};
  try {
    const res = await fetch('/api/generate-seo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        business: ctx,
        targets: targets.map((t) => ({
          id: t.id,
          label: t.label,
          kind: t.kind,
          text: collectSectionText(t.sections),
        })),
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as RouteResult;
      const raw = json.results;
      if (raw && typeof raw === 'object') {
        const out: Record<string, SeoDraft> = {};
        for (const target of targets) {
          const candidate = raw[target.id];
          if (isDraft(candidate)) {
            out[target.id] = {
              title: clamp(candidate.title, TITLE_MAX + 8),
              description: clamp(candidate.description, DESC_MAX + 12),
            };
          }
        }
        // Backfill any target the model skipped from the deterministic path.
        const sync = generateSeoSync(targets, ctx);
        for (const target of targets) {
          if (!out[target.id]) out[target.id] = sync[target.id];
        }
        return out;
      }
    }
  } catch {
    // fall through to deterministic
  }
  return generateSeoSync(targets, ctx);
}
