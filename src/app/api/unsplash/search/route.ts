// =============================================================================
// POST /api/unsplash/search — AI-assisted Unsplash image search for the
// website builder.
//
// Blank queries can be expanded from section/field/business context. The
// Unsplash access key stays server-side; the client only receives mapped
// search results that preserve the required hotlinked URL flow.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';

export const maxDuration = 60;

const QUERY_MODEL = 'claude-sonnet-4-6';
const UNSPLASH_UTM_SOURCE = 'webnua';
const UNSPLASH_SEARCH_ENDPOINT = 'https://api.unsplash.com/search/photos';

const QUERY_SYSTEM_PROMPT = `You create short visual search queries for Unsplash inside a small-business website builder.

Return ONLY a single JSON object:
{
  "query": string
}

Rules:
- 2 to 6 words.
- Focus on what should appear in the image, not marketing copy.
- Prefer realistic documentary small-business imagery.
- No brands, no logos, no text overlays, no camera jargon.
- Do not invent specific cities, uniforms, or demographics unless the input already includes them.
- If the field sounds like a logo or icon slot, return a generic business photo query instead of a logo query.`;

type SearchRequest = {
  query?: unknown;
  context?: {
    sectionLabel?: unknown;
    fieldLabel?: unknown;
    industry?: unknown;
    audienceLine?: unknown;
  };
};

type UnsplashSearchResponse = {
  errors?: unknown;
  results?: unknown;
};

type UnsplashPhoto = {
  id?: unknown;
  width?: unknown;
  height?: unknown;
  color?: unknown;
  alt_description?: unknown;
  description?: unknown;
  urls?: {
    raw?: unknown;
    small?: unknown;
    regular?: unknown;
  };
  user?: {
    name?: unknown;
    links?: {
      html?: unknown;
    };
  };
  links?: {
    html?: unknown;
    download_location?: unknown;
  };
};

export async function POST(request: Request): Promise<Response> {
  if (!env.UNSPLASH_ACCESS_KEY) {
    return NextResponse.json({ error: 'unsplash-not-configured' }, { status: 503 });
  }

  let body: SearchRequest;
  try {
    body = (await request.json()) as SearchRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const context = {
    sectionLabel: readString(body.context?.sectionLabel),
    fieldLabel: readString(body.context?.fieldLabel),
    industry: readString(body.context?.industry),
    audienceLine: readString(body.context?.audienceLine),
  };

  let query = readString(body.query);
  if (!query) {
    query = await buildSuggestedQuery(context);
  }
  if (!query) {
    return NextResponse.json(
      { error: 'missing-query', detail: 'Provide a query or enough context to infer one.' },
      { status: 400 },
    );
  }

  const url = new URL(UNSPLASH_SEARCH_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('page', '1');
  url.searchParams.set('per_page', '12');
  url.searchParams.set('content_filter', 'high');
  url.searchParams.set('orientation', chooseOrientation(context));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[unsplash-search] network error', error);
    return NextResponse.json(
      { error: 'search-failed', detail: 'Unable to reach Unsplash right now.' },
      { status: 502 },
    );
  }

  const payload = (await response.json().catch(() => ({}))) as UnsplashSearchResponse;
  if (!response.ok) {
    const detail = extractUnsplashError(payload) || response.statusText || 'Unknown error';
    return NextResponse.json(
      { error: 'search-failed', status: response.status, detail },
      { status: 502 },
    );
  }

  const photos = Array.isArray(payload.results) ? payload.results : [];
  return NextResponse.json({
    queryUsed: query,
    photos: photos.map(mapPhoto).filter((photo): photo is UnsplashResult => photo !== null),
  });
}

type SuggestedQueryContext = {
  sectionLabel: string;
  fieldLabel: string;
  industry: string;
  audienceLine: string;
};

type UnsplashResult = {
  id: string;
  alt: string;
  previewUrl: string;
  appliedUrl: string;
  width: number;
  height: number;
  color: string | null;
  photographerName: string;
  photographerUrl: string;
  unsplashUrl: string;
  downloadLocation: string;
};

async function buildSuggestedQuery(context: SuggestedQueryContext): Promise<string> {
  if (env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic();
      const message = await client.messages.create({
        model: QUERY_MODEL,
        max_tokens: 120,
        system: QUERY_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Section: ${context.sectionLabel || '(not specified)'}
Field: ${context.fieldLabel || '(not specified)'}
Industry: ${context.industry || '(not specified)'}
Audience cue: ${context.audienceLine || '(not specified)'}

Return the JSON object now.`,
          },
        ],
      });

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

      const query = parseQuery(text);
      if (query) return query;
    } catch (error) {
      console.error('[unsplash-search] query suggestion failed', error);
    }
  }

  return fallbackQuery(context);
}

function parseQuery(text: string): string {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return '';

  try {
    const parsed = JSON.parse(body.slice(start, end + 1)) as { query?: unknown };
    return readString(parsed.query);
  } catch {
    return '';
  }
}

function fallbackQuery(context: SuggestedQueryContext): string {
  const section = normalizeWords(context.sectionLabel);
  const field = normalizeWords(context.fieldLabel);
  const industry = normalizeWords(context.industry) || 'small business';
  const audience = normalizeWords(context.audienceLine);
  const scope = `${section} ${field}`;

  if (scope.includes('team') || scope.includes('founder') || scope.includes('about')) {
    return `${industry} business owner portrait`;
  }
  if (scope.includes('gallery') || scope.includes('project')) {
    return `${industry} work detail`;
  }
  if (scope.includes('review') || scope.includes('trust') || scope.includes('testimonial')) {
    return `${industry} professional at work`;
  }
  if (scope.includes('contact') || scope.includes('location')) {
    return `${industry} storefront exterior`;
  }
  if (scope.includes('logo') || scope.includes('icon')) {
    return `${industry} business workspace`;
  }
  if (audience.includes('family') || audience.includes('homeowner')) {
    return `${industry} home service professional`;
  }
  return `${industry} professional service`;
}

function chooseOrientation(context: SuggestedQueryContext): 'landscape' | 'portrait' | 'squarish' {
  const scope = `${context.sectionLabel} ${context.fieldLabel}`.toLowerCase();
  if (scope.includes('portrait') || scope.includes('founder') || scope.includes('team')) {
    return 'portrait';
  }
  if (scope.includes('logo') || scope.includes('icon') || scope.includes('avatar')) {
    return 'squarish';
  }
  return 'landscape';
}

function mapPhoto(value: unknown): UnsplashResult | null {
  const photo = value as UnsplashPhoto;
  const id = readString(photo.id);
  const rawUrl = readString(photo.urls?.raw);
  const previewUrl =
    readString(photo.urls?.small) || readString(photo.urls?.regular) || rawUrl;
  const photographerName = readString(photo.user?.name);
  const photographerUrl = withReferral(readString(photo.user?.links?.html));
  const unsplashUrl = withReferral(readString(photo.links?.html));
  const downloadLocation = readString(photo.links?.download_location);

  if (
    !id ||
    !rawUrl ||
    !previewUrl ||
    !photographerName ||
    !photographerUrl ||
    !unsplashUrl ||
    !downloadLocation
  ) {
    return null;
  }

  const alt =
    readString(photo.alt_description) ||
    readString(photo.description) ||
    `${photographerName} photo on Unsplash`;

  return {
    id,
    alt,
    previewUrl,
    appliedUrl: `${rawUrl}&w=1600&fit=max&q=80&auto=format`,
    width: toInt(photo.width),
    height: toInt(photo.height),
    color: readString(photo.color) || null,
    photographerName,
    photographerUrl,
    unsplashUrl,
    downloadLocation,
  };
}

function withReferral(url: string): string {
  if (!url) return '';
  try {
    const next = new URL(url);
    next.searchParams.set('utm_source', UNSPLASH_UTM_SOURCE);
    next.searchParams.set('utm_medium', 'referral');
    return next.toString();
  } catch {
    return url;
  }
}

function extractUnsplashError(payload: UnsplashSearchResponse): string {
  const errors = payload.errors;
  if (Array.isArray(errors)) {
    const text = errors.filter((item): item is string => typeof item === 'string').join(' ');
    if (text) return text;
  }
  return '';
}

function normalizeWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(image|photo|picture|media|field|section)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
