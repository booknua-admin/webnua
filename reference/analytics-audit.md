# Webnua — analytics & tracking audit

> **Status:** read-only diagnostic. No code or config changed. Run
> 2026-05-20 from branch `claude/audit-analytics-tracking-FDsGo`.
>
> **Question this answers:** for each tracking layer, what infrastructure
> exists, what's actually being written, and what's surfaced. Layer 1
> below; Layers 2–4 + the funnel-specific lead-tracking question will be
> appended to this same file in follow-up passes.
>
> **TL;DR for Layer 1:** pageview tracking is **fully wired end-to-end**
> — DB → ingest → script-injection on published pages → hourly rollup →
> dashboard read. It is **not "scaffolded but unwired" anywhere.** The
> only reason it's not producing live numbers in production is the
> upstream gap CLAUDE.md already calls out: no client websites are
> *actually being served to the public internet yet*. The plumbing for
> pageviews has nothing else missing.

---

## Layer 1 — Pageview tracking

The design spec is `reference/visitor-tracking-design.md` (382 lines).
Compared against what's actually in the tree, every component the
design specifies for pageview tracking has shipped. There is a single
behavioural gap (funnel surfaces emit events that the dashboard read
layer does not yet consume) — flagged in the "Gaps & risks" section
below.

### 1.1 Database schema

**Lives in:** `supabase/migrations/0035_analytics_tables.sql` (263 lines).
**Wired:** yes — RLS enabled, indices created, cron schedule active.

| Object | Kind | Notes |
|---|---|---|
| `analytics_event_type` | enum | 8 values: `page_view`, `scroll_depth`, `element_click`, `form_start`, `form_field`, `form_abandon`, `form_submit`, `web_vital`. |
| `public.analytics_events` | table (raw, append-only) | `(client_id, surface_kind, surface_id, page_ref, event_type, visitor_id, session_id, occurred_at, payload jsonb, ingested_at)`. Three indices: `(client_id, surface_id, occurred_at)`, `(surface_id, session_id)`, `(occurred_at)`. |
| `public.analytics_funnel_daily` | rollup | PK `(surface_id, day, stage)` — per-stage daily uniques. |
| `public.analytics_page_daily` | rollup | PK `(surface_id, page_ref, day)` — per-page daily visits + dwell + Web Vitals p75. |
| `websites.tracking_key` | column | `text not null default replace(gen_random_uuid()::text,'-','')`, unique index. |
| `funnels.tracking_key` | column | Same shape as `websites.tracking_key`. |
| `clients.tracking_consent_mode` | column | `text` check-constrained to `'banner' \| 'implied'`, default `'banner'`. |
| `leads.submission_id` | column | `uuid`, partial index, for Layer-4 lead correlation (see §1.7 below). |
| `private.aggregate_analytics()` | function | `SECURITY DEFINER`, rebuilds today + yesterday rollups idempotently, prunes raw events past 90 days. |
| `pg_cron` job `webnua-analytics-rollup` | schedule | `'7 * * * *'` (hourly at :07). The migration `cron.unschedule`s any prior entry before re-creating, so re-running the migration is safe. |
| RLS | policy | `analytics_events`, `analytics_funnel_daily`, `analytics_page_daily` — `SELECT` only for `authenticated`, scoped by `private.accessible_client_ids()`. `INSERT/UPDATE/DELETE` explicitly REVOKED from `authenticated`. Writes happen via the service-role client only. |

### 1.2 Ingest API — `POST /api/track`

**Lives in:** `src/app/api/track/route.ts` (224 lines).
**Wired:** yes — public, unauthenticated, called by `public/webnua-track.js`.

Trust boundary at this endpoint:

1. User-Agent bot filter (regex covering crawler / headless / preview agents) — drop with 204.
2. Per-IP rate limit, 40 requests / 60 s window (`lib/public-site/rate-limit.ts`, in-memory; documented best-effort).
3. JSON body parse; `trackingKey` must match `/^[0-9a-f]{16,64}$/i`.
4. `resolveSurface(trackingKey)` — cached 5-min lookup against `websites.tracking_key` then `funnels.tracking_key`, returning `(clientId, surfaceId, surfaceKind)`. Unknown key → 204 (accept-and-drop to avoid leaking key validity).
5. Per-event validation in `cleanEvent`: event type ∈ enum; `visitorId`/`sessionId` non-empty strings ≤80 chars; `occurredAt` within `now − 24h` / `now + 10min` skew window; `pageRef` truncated to 200 chars; `payload` collapsed to ≤24 entries of primitive (string ≤500 chars / number / boolean) values.
6. Batch capped at 80 events (`MAX_EVENTS_PER_BATCH`); survivors inserted via the service-role client into `analytics_events`.
7. Always returns 204; the visitor never blocks on a write.

**Observability:** none — failures are swallowed (line 220 `await … insert(rows)` has no error handling). This is consistent with the design's "never block the visitor" mandate but means tracking-side failures are invisible without DB-side monitoring.

### 1.3 Client tracking script — `public/webnua-track.js`

**Lives in:** `public/webnua-track.js` (646 lines, zero deps, IIFE).
**Wired:** yes — injected into every published page by `src/app/published/[host]/[[...slug]]/page.tsx` (see §1.4).

For pageview tracking specifically:

- `trackPageView()` (lines 233–259) fires on `start()` (`DOMContentLoaded` or immediate). Always sent — `page_view` is the only event type in the `essential` consent category (`categoryFor` returns `'essential'` for `page_view`, `'analytics'` for everything else), so it bypasses the consent gate in `enqueue()`.
- Payload carries `surfaceKind`, `referrer` (truncated 300), `path`, `viewportWidth`, `device` (`mobile` / `tablet` / `desktop`). UTM params (`utm_source/medium/campaign`) only added when marketing consent is granted.
- Identity: with analytics consent, persistent `webnua_vid` in localStorage; without, ephemeral `anon-<rand>` per page-load. `webnua_sid` is a 30-minute idle session.
- Transport: batched queue (debounce 3 s or 20 events), `fetch` with `keepalive: true`, `navigator.sendBeacon` on `pagehide`/`visibilitychange→hidden`. Always-on essential page-views are still queued so they ride the same flush path.
- Consent banner (banner mode): renders inline-styled DOM on `<body>` with three categories (Essential locked-on, Analytics, Marketing). Implied mode skips the banner entirely. Choice stored in `webnua_consent` localStorage (versioned, v1).

The script is config-driven via `data-*` attributes on its own `<script>` tag — no hard-coded keys. It can't run anywhere it isn't injected with a valid key.

### 1.4 Script injection — `app/published` renderer

**Lives in:** `src/app/published/[host]/[[...slug]]/page.tsx` lines 101–120.
**Wired:** yes — injected on **both** website and funnel render paths (lines 162–166 and 168–179).

```tsx
<TrackingScript tracking={target.tracking} />
```

`TrackingScript` returns `null` when `tracking.trackingKey` is empty, so an unpublished surface or a missing key short-circuits cleanly. The script tag carries `id="webnua-track"`, `src="/webnua-track.js"`, and the four `data-*` attributes the script reads. It is `async`.

The `tracking` config object is populated by `lib/public-site/resolve.ts`:

- Website branch (resolve.ts lines 296–315) sets `{ trackingKey: website.tracking_key, surfaceId: website.id, surfaceKind: 'website', pageRef: page.slug, consentMode }`.
- Funnel branch (resolve.ts lines 335–362) sets the same shape with `surfaceKind: 'funnel'` and `pageRef: step.slug`.
- `consentModeForClient(clientId)` (resolve.ts line 184) reads `clients.tracking_consent_mode` and coerces to `'implied' | 'banner'`, defaulting to `'banner'` when unset/null.

### 1.5 Host-based routing — how a visitor reaches the renderer at all

**Lives in:** `src/middleware.ts` (47 lines).
**Wired:** yes — `matcher` covers `/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)`.

Any non-app host (anything other than `APP_HOST`, `localhost`, `127.0.0.1`, or `*.vercel.app`) is internally rewritten to `/published/{host}{path}`. The visitor's URL bar is unchanged. This is the only path to the `published` route tree, which is the only path that injects the tracking script.

**Implication:** the script never loads in the editor, the admin app, on `localhost` (the standard dev server), or on Vercel preview URLs. It loads only on a real custom host that's been registered against a `websites.domain_primary` / alias or a `funnels` host (resolution detail in `resolve.ts`).

### 1.6 Aggregation — hourly cron

**Lives in:** `supabase/migrations/0035_analytics_tables.sql` lines 155–263.
**Wired:** yes — `cron.schedule('webnua-analytics-rollup', '7 * * * *', …)`.

`private.aggregate_analytics()`:

- Rebuilds the prior-day + current-day partitions of both rollup tables (`DELETE` + `INSERT … SELECT` — idempotent on its PK; safe to re-run). Late/beaconed events that arrive after the hour boundary are absorbed on the next pass.
- Funnel rollup maps raw events to stage strings (`page_view → landing`, `scroll_depth (≥50%) → engaged`, `element_click → cta_click`, `form_start → form_started`, `form_submit → form_submitted`), counts both events and distinct visitors.
- Page rollup computes per-(surface, page, day) visit counts, distinct visitors, mean per-session dwell (`max(occurred_at) − min(occurred_at)`), and Web-Vital p75s.
- Prunes raw events older than 90 days at the end of each run.

Re-running the migration cleanly re-creates the cron job (the `DO $$ … cron.unschedule(…) EXCEPTION WHEN OTHERS THEN null` guard).

### 1.7 Read layer — `lib/analytics/queries.tsx`

**Lives in:** `src/lib/analytics/queries.tsx` (199 lines).
**Wired:** yes — see §1.8 for consumers.

- `fetchSurfaceFunnelTotals(surfaceId)` → reads `analytics_funnel_daily` over a 7-day window (`ANALYTICS_WINDOW_DAYS = 7`), sums `unique_visitors` per stage, returns `SurfaceFunnelTotals = { landing, engaged, formStarted, hasData }`.
- `fetchSurfacePageTotals(surfaceId)` → reads `analytics_page_daily` over the same window, sums visits + uniques, averages dwell + LCP/CLS/INP p75s.
- Both fetchers **swallow errors and return empty totals with `hasData: false`** — deliberate per the design's "dashboard must still render before any traffic" requirement.
- `pageSpeedScore(lcpMs, cls, inpMs)` derives a 0–100 composite (50% LCP / 25% CLS / 25% INP) using the published "good / poor" bands.
- `formatDwell(seconds)` → `'m:ss'` formatter.

### 1.8 Surfacing — where pageview totals actually render

**Lives in:** `src/lib/dashboard/queries.tsx` (lines 23–26 import, 475/476 + 707/886 use).

| Surface | Read path | Behaviour |
|---|---|---|
| Client dashboard (`/dashboard` for a client) | `composeClientDashboard` ← `fetchSurfaceFunnelTotals(website.id)` + `fetchSurfacePageTotals(website.id)` (lines 473–478) | `LandingSnapshot` (lines 692–745) renders real `visits / unique / conv. rate / page speed / avg dwell` when `pageTotals.hasData`; otherwise an honest `—` placeholder with "Awaiting analytics" caption. Conversion rate is `leads / visits × 100`, rounded to one decimal. |
| Admin sub-account hub (`/dashboard` agency → sub-account mode) | `composeHub` ← `fetchSurfaceFunnelTotals(hubWebsite.id)` (lines 885–887) | Feeds the hub's top-of-funnel bars. |

Both calls are guarded on `website` (or `hubWebsite`) existing — a client with no website never invokes the read layer.

The `submission_id` columns (in `leads` and in the `form_submit` payload, written by `data-webnua-submission` on the form element via `FormBlock.tsx` lines 95–107) are present for Layer-4 lead correlation but are not part of the pageview tracking path. Flagged here only because the migration introduces the column alongside the analytics tables.

### 1.9 Gaps & risks for Layer 1

| # | Item | Severity | Detail |
|---|---|---|---|
| 1 | **No published sites are actually being served yet.** | Blocker for live data, not a code defect. | CLAUDE.md's "Public site rendering" gap. Middleware + renderer + script-injection are all built; what's missing is the *production* path that points a client's domain at the Vercel project + persists `websites.domain_primary` for a real customer. Until then, every wired piece below is correct but never fires. |
| 2 | **Funnel surfaces are tracked but not surfaced.** | Minor inconsistency. | The tracking script is injected on funnel render (renderer line 177); `/api/track` writes funnel events fine (the trackingKey resolver handles both tables). But the dashboard read path calls `fetchSurfaceFunnelTotals` only against the website's `id`, never against a funnel's `id`. A funnel that converts visitors will accumulate rollup rows that no UI reads. Expected — V1 design surfaces "visits → leads" per-client at the website level — but worth a note. |
| 3 | **`/api/track` write-failures are silent.** | Operational. | `await svc.from('analytics_events').insert(rows)` has no error handling; a Postgres write error becomes an unhandled rejection in a serverless function that's already returned 204. Consistent with the "never block the visitor" mandate, but means tracking outages are observable only at the DB layer. The design doc §10 acknowledges this implicitly; no monitoring is in place to alert on a drop in `ingested_at` insertion rate. |
| 4 | **In-memory rate limiter.** | Known. | `lib/public-site/rate-limit.ts` calls out its own per-instance / per-warm-lifetime limitation in the file header. Acceptable for now; design-doc-acknowledged. |
| 5 | **Cron schedule depends on the Supabase project running `pg_cron`.** | Operational. | The migration declares `create extension if not exists pg_cron`. If a target environment doesn't have this enabled at the cluster level, the migration will fail at that statement — not at the `cron.schedule(…)` call. Worth confirming the production project has `pg_cron` enabled before treating this as fully deployed. |

### 1.10 Verdict — Layer 1

**Status:** infrastructure complete, end-to-end. Not "started previously and abandoned" — finished and waiting for upstream public-site rollout to start producing traffic.

| Component | State |
|---|---|
| DB schema (events / rollups / keys / consent column / aggregation function / cron) | ✅ built, wired |
| Ingest endpoint (`/api/track`) | ✅ built, wired |
| Client script (`webnua-track.js`) | ✅ built, wired (injected by renderer) |
| Renderer injection | ✅ both website + funnel paths |
| Middleware host routing | ✅ rewrites all non-app hosts to renderer |
| Hourly aggregation | ✅ `pg_cron` registered |
| Read layer (`lib/analytics/queries.tsx`) | ✅ built, error-resilient |
| Dashboard consumption (`composeClientDashboard`, `composeHub`) | ✅ wired for **websites only**; funnels write but no read |

When a real client site goes live on a public host, the script will fire, events will land, the rollup will populate at :07 past the next hour, and the existing dashboard placeholders will swap to real numbers without any further code change.

---

## Layer 2 — Form interactions

> Pending — covered in a follow-up pass on this same branch.

## Layer 3 — Funnel progression

> Pending — covered in a follow-up pass on this same branch.

## Layer 4 — Conversions

> Pending — covered in a follow-up pass on this same branch.

## Funnel-specific — lead tracking through a funnel run

> Pending — covered in a follow-up pass on this same branch.
