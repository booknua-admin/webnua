// =============================================================================
// Visitor-tracking ingest — POST /api/track.
//
// The single place the platform accepts anonymous analytics writes
// (visitor-tracking-design.md §4.2). PUBLIC + unauthenticated — the tracking
// script (webnua-track.js) on every published page batches events here.
//
// The endpoint is the trust boundary: it writes with the service-role client
// (RLS-bypassing), so ALL validation, bot-filtering, rate-limiting and
// tenant-scoping happen here in code. `anon` has no table access at all.
//
//   1. Rate-limit per IP.
//   2. Parse the batch { trackingKey, events: [...] }.
//   3. Resolve trackingKey → (client_id, surface_id, surface_kind); reject
//      unknown keys.
//   4. Bot-filter by User-Agent.
//   5. Validate each event; drop malformed ones.
//   6. Insert survivors into analytics_events.
//   7. Return 204 fast — fire-and-forget; never block the visitor.
// =============================================================================

import { NextResponse } from 'next/server';

import type { Database } from '@/lib/types/database';
import { clientIp, rateLimit } from '@/lib/public-site/rate-limit';
import { getServiceClient } from '@/lib/supabase/server';

const MAX_EVENTS_PER_BATCH = 80;
/** Accepted client-clock skew — events outside this window are dropped. */
const SKEW_PAST_MS = 24 * 60 * 60 * 1000; // 24h (beaconed events can lag)
const SKEW_FUTURE_MS = 10 * 60 * 1000; // 10min

type EventType = Database['public']['Enums']['analytics_event_type'];

const EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  'page_view',
  'scroll_depth',
  'element_click',
  'form_start',
  'form_field',
  'form_abandon',
  'form_submit',
  'web_vital',
]);

const BOT_UA_RE =
  /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|lighthouse|bingpreview|facebookexternalhit|embedly|preview|monitor|pingdom|gtmetrix/i;

type Surface = {
  clientId: string;
  surfaceId: string;
  surfaceKind: 'website' | 'funnel';
};

// trackingKey → Surface. The key is immutable per surface, so a short-lived
// module cache spares a DB round-trip on every batch.
const surfaceCache = new Map<string, { surface: Surface; at: number }>();
const SURFACE_TTL_MS = 5 * 60 * 1000;

async function resolveSurface(trackingKey: string): Promise<Surface | null> {
  const cached = surfaceCache.get(trackingKey);
  if (cached && Date.now() - cached.at < SURFACE_TTL_MS) return cached.surface;

  const svc = getServiceClient();
  const website = await svc
    .from('websites')
    .select('id, client_id')
    .eq('tracking_key', trackingKey)
    .maybeSingle();
  if (website.data) {
    const surface: Surface = {
      clientId: website.data.client_id,
      surfaceId: website.data.id,
      surfaceKind: 'website',
    };
    surfaceCache.set(trackingKey, { surface, at: Date.now() });
    return surface;
  }
  const funnel = await svc
    .from('funnels')
    .select('id, client_id')
    .eq('tracking_key', trackingKey)
    .maybeSingle();
  if (funnel.data) {
    const surface: Surface = {
      clientId: funnel.data.client_id,
      surfaceId: funnel.data.id,
      surfaceKind: 'funnel',
    };
    surfaceCache.set(trackingKey, { surface, at: Date.now() });
    return surface;
  }
  return null;
}

type IncomingEvent = {
  type?: unknown;
  pageRef?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  occurredAt?: unknown;
  payload?: unknown;
};

type CleanRow = Database['public']['Tables']['analytics_events']['Insert'];

function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/** Normalise an ISO string or epoch-ms number to an ISO timestamp within the
 *  accepted skew window. Returns null when malformed / out of window. */
function cleanOccurredAt(v: unknown): string | null {
  let ms: number | null = null;
  if (typeof v === 'number' && Number.isFinite(v)) ms = v;
  else if (typeof v === 'string') {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) ms = parsed;
  }
  if (ms === null) return null;
  const now = Date.now();
  if (ms < now - SKEW_PAST_MS || ms > now + SKEW_FUTURE_MS) return null;
  return new Date(ms).toISOString();
}

function cleanEvent(raw: IncomingEvent, surface: Surface): CleanRow | null {
  const type = typeof raw.type === 'string' ? raw.type : '';
  if (!EVENT_TYPES.has(type)) return null;

  const visitorId = cleanString(raw.visitorId, 80);
  const sessionId = cleanString(raw.sessionId, 80);
  const occurredAt = cleanOccurredAt(raw.occurredAt);
  if (!visitorId || !sessionId || !occurredAt) return null;

  // page_ref is the page slug / funnel-step slug — '' is a legal home page.
  const pageRef =
    typeof raw.pageRef === 'string' ? raw.pageRef.trim().slice(0, 200) : '';

  // Payload is a bounded plain object — anything else collapses to {}.
  let payload: Record<string, unknown> = {};
  if (raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)) {
    const entries = Object.entries(raw.payload as Record<string, unknown>).slice(
      0,
      24,
    );
    for (const [k, val] of entries) {
      if (
        typeof val === 'string' ||
        typeof val === 'number' ||
        typeof val === 'boolean'
      ) {
        payload[typeof k === 'string' ? k.slice(0, 60) : 'k'] =
          typeof val === 'string' ? val.slice(0, 500) : val;
      }
    }
  } else {
    payload = {};
  }

  return {
    client_id: surface.clientId,
    surface_kind: surface.surfaceKind,
    surface_id: surface.surfaceId,
    page_ref: pageRef,
    event_type: type as EventType,
    visitor_id: visitorId,
    session_id: sessionId,
    occurred_at: occurredAt,
    payload: payload as CleanRow['payload'],
  };
}

export async function POST(req: Request) {
  // Bot filter — drop known crawlers / headless / preview agents.
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT_UA_RE.test(ua)) {
    return new NextResponse(null, { status: 204 });
  }

  if (!rateLimit(`track:${clientIp(req)}`, 40, 60_000)) {
    return new NextResponse(null, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const { trackingKey, events } = (body ?? {}) as {
    trackingKey?: unknown;
    events?: unknown;
  };
  if (typeof trackingKey !== 'string' || !/^[0-9a-f]{16,64}$/i.test(trackingKey)) {
    return new NextResponse(null, { status: 400 });
  }
  if (!Array.isArray(events) || events.length === 0) {
    return new NextResponse(null, { status: 400 });
  }

  const surface = await resolveSurface(trackingKey);
  if (!surface) {
    // Unknown surface — quietly accept-and-drop so a probing script learns
    // nothing about which keys are valid.
    return new NextResponse(null, { status: 204 });
  }

  const rows = (events as IncomingEvent[])
    .slice(0, MAX_EVENTS_PER_BATCH)
    .map((e) => cleanEvent(e, surface))
    .filter((r): r is CleanRow => r !== null);

  if (rows.length > 0) {
    const svc = getServiceClient();
    // Fire-and-forget — a write failure must never surface to the visitor.
    await svc.from('analytics_events').insert(rows);
  }

  return new NextResponse(null, { status: 204 });
}
