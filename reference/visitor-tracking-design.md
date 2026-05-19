# Webnua — visitor engagement tracking

> **Status:** design doc, not yet built. Records the agreed design for the
> visitor-engagement tracking system so it can be implemented alongside the
> public-site rendering workstream. It answers to `backend-schema-design.md`
> (tenant isolation, append-only event tables, the `Result`/`AppError`
> boundary), `builder-design.md` / `form-builder-design.md` §2 (the `leads` /
> `lead_events` conversion mechanism), and the dashboard surfaces in
> `lib/dashboard/` (`HubFunnelConversion`, `LandingSnapshot`).
>
> **Hard dependency:** this feature emits real numbers only once published
> websites/funnels are actually *served on the internet*. There is no public
> render/hosting pipeline today (all routes are auth-gated; generated sites
> live as JSON snapshots in `website_versions` / `funnel_versions`). The
> ingestion + storage + aggregation + read layers below are buildable and
> testable independently with synthetic events, but the live data path is
> coupled to the public-rendering build. **Implement this doc with that
> workstream.**

---

## 1. What this is — and why it's a USP

Webnua tells a client not just *how many leads* they got, but *what visitors
did on the page*: arrived, scrolled, clicked the CTA, started the form,
abandoned it, completed it, booked. That visitor-behaviour funnel — the top of
the funnel — is the platform's differentiator over "you got 14 leads this
week." It explains *where* prospects are lost so Webnua can act on it (the
dashboard insight band already speaks this language: *"Form-started →
submitted is your weak point — 60 people start typing then drop"*).

Today that band, the top three funnel bars, and the landing-page snapshot
(`visits / conv. rate / avg time / page speed`) render honest `—`
placeholders. **No events / page-view / analytics table exists in the schema.**
The bottom of the funnel is already real — `leads`, `bookings`,
`job_completions`, `reviews` are live tables and `lib/dashboard/queries.tsx`
`conversionFunnel()` computes the last three bars from them. This system builds
the missing top.

### 1.1 Goals

- Track an anonymous visitor's journey on every published website **and**
  funnel: view → scroll → click → form-start → form-abandon → form-submit →
  booking.
- Capture Web Vitals (LCP / CLS / INP) for the "page speed" stat.
- Feed the existing funnel-bar, landing-snapshot, and dashboard-insight
  surfaces — no new UI components, just real data behind the ones that exist.
- Apply automatically to every client; nothing per-client to wire.
- Per-client **consent banner** (decision below) gating non-essential tracking.

### 1.2 Non-goals (V1)

- Real-time (sub-minute) dashboards — batch hourly rollups, matching how the
  rest of the dashboard already works.
- Cross-site / cross-device identity stitching — anonymous, per-origin only.
- A standalone "Analytics" page — V1 only backfills existing surfaces.
- Heatmaps / session replay / scroll maps — out of scope, possibly never.
- Server-side / edge tracking of bot-rendered HTML — client-side script only.

---

## 2. Event taxonomy — the visitor lifecycle

One canonical stage model, shared by websites and funnels. The `event_type`
enum (new, migration `0001`-style):

| `event_type` | Fired when | Funnel stage |
|---|---|---|
| `page_view` | Page/step loads | **Landing visits** |
| `scroll_depth` | Scroll past 25 / 50 / 75 / 90% (one event each) | **Engaged scroll** (≥50%) |
| `element_click` | Click on a CTA-role element | (CTA clicks — insight only) |
| `form_start` | First focus of any field in a form | **Form started** |
| `form_field` | A field is completed (blur, non-empty) | (per-field drop-off) |
| `form_abandon` | Page hidden/unloaded with a started-but-unsubmitted form | (abandonment) |
| `form_submit` | Form submitted successfully | **Form submitted** |
| `web_vital` | `PerformanceObserver` reports LCP / CLS / INP | (page-speed stat) |

`booking` and `reviewed` are **not** tracked events — they already exist as
`bookings` / `reviews` rows. The funnel read layer (§7) merges the tracked top
with the live-table bottom.

Each event also carries dimensional context in `payload` (§3): scroll %,
element id/label, form id, field key, vital name+value, referrer, UTM params,
device class, viewport size.

---

## 3. Data model

New migration `0033_analytics_tables.sql`. Three tables + one enum.

### 3.1 `analytics_events` — raw append-only stream

```
id              uuid pk
client_id       uuid not null            -- denormalised for RLS scoping
surface_kind    text not null            -- 'website' | 'funnel'
surface_id      uuid not null            -- website_id or funnel_id
page_ref        text not null            -- page slug / funnel-step slug
event_type      analytics_event_type not null
visitor_id      text not null            -- anonymous first-party id (§9)
session_id      text not null
occurred_at     timestamptz not null     -- client clock, validated server-side
payload         jsonb not null default '{}'
ingested_at     timestamptz not null default now()
```

Append-only — **no UPDATE / DELETE policies** (the `lead_events` precedent).
Indexed on `(client_id, surface_id, occurred_at)` and `(surface_id, session_id)`.

### 3.2 Rollup tables — `analytics_funnel_daily` + `analytics_page_daily`

Raw events grow fast and cost money per row; reads go against pre-aggregated
daily rollups, and the raw table is prunable on a retention window (§10).

```
analytics_funnel_daily
  client_id, surface_kind, surface_id, day (date), stage (text),
  event_count int, unique_visitors int
  pk (surface_id, day, stage)

analytics_page_daily
  client_id, surface_id, page_ref, day (date),
  visits int, unique_visitors int, avg_seconds numeric,
  lcp_p75 numeric, cls_p75 numeric, inp_p75 numeric
  pk (surface_id, page_ref, day)
```

### 3.3 RLS

- **`anon`**: no access to any analytics table — *not even insert*. Ingestion
  goes through the §4 endpoint, which writes with the service role. Granting
  `anon` table access is forbidden (it would defeat tenant isolation).
- **`authenticated`**: SELECT only, scoped by `client_id IN
  accessible_client_ids()` — the standard tenant-isolation helper. Operators
  see all their clients; a client sees their own.
- Rollups: SELECT-only for `authenticated`, same scoping; written by the
  aggregation job (service role).

### 3.4 The site `tracking_key`

`websites` and `funnels` each gain a `tracking_key text` column — a public,
non-secret per-surface token, generated at creation. The script (§4) embeds
it; the ingest endpoint resolves it to `(client_id, surface_id, surface_kind)`.
It is *not* an auth secret — it only namespaces events and lets the endpoint
reject events for unknown surfaces.

---

## 4. Ingestion — script + endpoint

### 4.1 `webnua-track.js` — the tracking script

A small (~3–4 KB minified, zero-dependency) first-party script auto-injected
into the `<head>` of every **published** website page and funnel step by the
public renderer (the dependency workstream). Never loaded in the editor
preview or the authed app.

Responsibilities:

- Generate/read the anonymous `visitor_id` + `session_id` (§9).
- Auto-instrument: `page_view` on load; `scroll_depth` at thresholds;
  `element_click` on elements tagged with a CTA data-attribute (the renderer
  marks CTA buttons — no per-client config); form `start` / `field` /
  `abandon` / `submit` by attaching listeners to rendered `<form>`s;
  `web_vital` via `PerformanceObserver`.
- **Batch** events in memory; flush on a debounce, on `visibilitychange`
  (hidden), and via `navigator.sendBeacon` on unload so `form_abandon` and the
  last events survive navigation.
- Respect the consent gate (§5) — buffer nothing until consent resolves;
  send only `page_view` (essential) until consent is granted.

The script is **generated/served by Webnua**, versioned, and identical for
every client — embedding is automatic, there is no snippet to copy.

### 4.2 `POST /api/track` — the ingest endpoint

A **public, unauthenticated** Next route handler (`app/api/track/route.ts`) —
the single place the platform accepts anonymous writes. It:

1. Accepts a batched JSON body: `{ trackingKey, events: [...] }`.
2. Resolves `trackingKey` → surface; rejects unknown keys.
3. Validates each event (known `event_type`, `occurred_at` within a sane
   skew window, payload shape per type) and **drops** malformed ones.
4. Bot-filters (§9) — drops known crawler UAs / headless signatures.
5. Rate-limits per `visitor_id` + IP.
6. Inserts surviving events into `analytics_events` using the **service-role
   key** (a server-only env var — it never reaches the browser; this is the
   first server-side Supabase usage and needs a server client per
   `backend-schema-design.md`'s deferred server-client note).
7. Returns `204` fast — fire-and-forget; never blocks the visitor's page.

The endpoint is the trust boundary: the service role bypasses RLS, so *all*
validation, filtering, and scoping happens here in code.

---

## 5. Consent — per-client banner

**Decision: per-client consent banner.** Each client can toggle a consent
banner on their published site; the script gates non-essential tracking
behind it.

- `websites` / `funnels` (or the `clients` row — placement TBD in §12) gain a
  `tracking_consent_mode` field: `banner` (show a banner, gate on accept) or
  `implied` (track on load — for jurisdictions/clients where that's
  acceptable). Default `banner`.
- When `banner`: the public renderer shows a lightweight cookie/consent
  banner. Before acceptance the script sends **only `page_view`** (treated as
  essential, no first-party id persisted — a per-request ephemeral id). After
  acceptance it persists the `visitor_id` and sends the full event set.
- Consent state itself is stored in first-party `localStorage` on the visitor
  side; no consent record is sent to Webnua (nothing to store, nothing to
  leak).
- The banner copy + the toggle live in the client's site settings surface
  (a small addition — exact home in §12).

Rationale: anonymous first-party tracking still carries obligations
(Australian Privacy Act; GDPR for any EU traffic). The banner is the
defensible default; `implied` is an opt-in escape hatch the operator sets
deliberately, not silently.

No PII is ever collected. IP is used transiently for rate-limiting + coarse
bot-filtering and **not stored** (not even hashed) in V1 — if coarse geo is
wanted later, store a truncated/region-only derivation, never the raw IP.

---

## 6. Aggregation

A **scheduled edge function** (`pg_cron`, hourly) rolls raw `analytics_events`
into the two daily tables:

- Re-aggregates *today* + *yesterday* each run (late/beaconed events arrive
  after the hour boundary; a two-day window absorbs them; the rollup upserts
  on its pk so re-runs are idempotent).
- Sessionises (§9), dedups, computes `unique_visitors`, `avg_seconds` (from
  consecutive `page_view`/last-event timestamps per session), and the
  `*_p75` Web-Vital percentiles.

Batch, not realtime: the dashboard's "this week" cards already aren't live, so
hourly is consistent and far cheaper than streaming. Trade-off noted in §10.

A retention job prunes `analytics_events` older than the window (§10); the
rollups are kept long-term (they're tiny).

---

## 7. Read layer & UI wiring

New `lib/analytics/queries.tsx` — TanStack Query hooks over the rollup tables,
following the `lib/dashboard/queries.tsx` pattern (RLS-bounded reads, `AppError`
on failure):

- `useFunnelAnalytics(surfaceKind, surfaceId, period)` → the full **6-stage**
  funnel: tracked top three stages (`landing` / `engaged` / `form_started`)
  from `analytics_funnel_daily`, merged with the live `form_submitted` /
  `booked` / `reviewed` counts the existing `conversionFunnel()` already
  computes from `leads` / `bookings` / `reviews`.
- `useLandingSnapshot(websiteId)` → `visits / conv. rate / avg time / page
  speed`, replacing the four `—` placeholders in `landingSnapshot()`.

**No new components.** `FunnelConversionBars`, `StatCard` / `LandingSnapshotCard`,
`MiniTrendBars`, and the dashboard insight band all already render whatever
structured data they're handed. The work is data-layer only:

- Extend `lib/dashboard/queries.tsx` `conversionFunnel()` to call the analytics
  read layer for the top three bars (currently it returns 3 bars; the screenshot
  target is 6).
- Point `landingSnapshot()` at `useLandingSnapshot` instead of the placeholder
  array.
- `lib/funnels/` (the `/funnels/[id]` analytics-detail surface) consumes the
  same `useFunnelAnalytics` for per-funnel drill-down.

The insight band's "weak point" sentence (`ClientFunnelSummary.weakPoint`,
`FunnelInsight`) becomes computable — it's the largest percentage drop between
adjacent tracked stages.

---

## 8. Lead correlation — keeping the funnel internally consistent

A tracked `form_submit` and the real `leads` row it creates must agree, or the
funnel's "Form submitted" bar and the "New leads" stat card will disagree.

When a public form submits, the renderer:

1. Generates a `submission_id` (uuid).
2. Creates the `leads` row (the existing form-builder write path — see
   `form-builder-design.md`), storing `submission_id` on it (new nullable
   column on `leads`, or in an existing metadata field).
3. Fires the `form_submit` analytics event carrying the same `submission_id`
   in `payload`.

The read layer can then reconcile: `form_submit` events with a `submission_id`
that resolves to a real lead are "confirmed"; the funnel's submitted count is
taken from `leads` (source of truth), and the tracked `form_submit` count is
used only to detect tracking gaps. Bookings/reviews stay sourced from their own
tables exactly as today.

---

## 9. Identity, sessions, bot filtering

- **`visitor_id`** — anonymous, random, stored first-party (`localStorage`).
  No third-party cookies. Not stitched across origins or devices. Reset if the
  visitor clears storage — counts are visit-based, not person-based, and that
  is fine for this product.
- **`session_id`** — random per session; a session ends after 30 min idle or
  on a UTM/referrer change. Sessionisation is finalised server-side in
  aggregation (the client `session_id` is a hint).
- **Bot filtering** — UA blocklist + headless/automation signatures at the
  ingest endpoint; aggregation applies a second pass (e.g. drop sessions with a
  single instantaneous event, impossible scroll velocity). Never perfect —
  numbers are *directional*.

---

## 10. Limitations & trade-offs

1. **Coupled to public rendering.** No real numbers until generated sites are
   served. Layers 1–4/6–7 can be built + tested with seeded synthetic events;
   the live path waits.
2. **Anon-writable ingestion is an abuse vector.** A public endpoint can be
   spammed with fabricated events. `tracking_key` + rate-limiting + origin
   checks + bot-filtering reduce, not eliminate, this. Analytics are
   directional, not audited — never bill or make irreversible decisions off
   raw event counts.
3. **Ad blockers / privacy browsers.** A first-party script + first-party
   endpoint dodges most blockers, but counts still under-report somewhat.
4. **Bots.** Filtering is heuristic; some bot traffic always leaks through.
5. **Consent reduces coverage.** With the banner default, pre-consent traffic
   contributes only `page_view`. Real funnels will show some "landing" volume
   with no downstream events from non-consenting visitors — expected, not a
   bug; the read layer should frame it honestly.
6. **Cost / volume.** `analytics_events` accumulates fast. Mitigated by daily
   rollups + a raw-event retention window (proposed: 90 days raw, rollups
   forever). Still a real Supabase row-cost line.
7. **Batch latency.** Hourly rollups — the funnel is not second-by-second
   live. Deliberate; matches the rest of the dashboard.
8. **First server-side Supabase usage.** The ingest endpoint needs a
   service-role server client + the `SUPABASE_SERVICE_ROLE_KEY` env var — the
   server-client pattern `backend-schema-design.md` deferred. This doc is where
   it lands.
9. **`avg time` is approximate.** Time-on-page derived from event timestamp
   gaps undercounts the last page of a session (no unload timestamp beyond the
   beacon). Acceptable for a directional stat.

---

## 11. Build phases & dependencies

| Phase | Work | Blocked? |
|---|---|---|
| A | Migration `0033` (tables, enum, RLS, `tracking_key` columns) | No |
| B | `app/api/track` endpoint + server-side service-role Supabase client | No |
| C | `webnua-track.js` script (build + serve) | No (testable standalone) |
| D | Aggregation edge function + `pg_cron` + retention job | No |
| E | `lib/analytics/queries.tsx`; wire `conversionFunnel()` + `landingSnapshot()`; seed synthetic events for UI verification | No |
| F | Consent banner + `tracking_consent_mode` setting | No |
| G | **Inject the script into served public pages; real data flows** | **Yes — public render/hosting pipeline** |

Phases A–F deliver a complete, dormant system verifiable with synthetic data.
Phase G is the only one gated on public rendering and should ship with it.

---

## 12. Open questions

- **`tracking_consent_mode` placement** — on `websites`/`funnels` (per-surface)
  or `clients` (per-account)? Per-account is simpler and probably right (a
  client has one consent posture); confirm when the site-settings surface for
  it is designed.
- **`submission_id` on `leads`** — dedicated nullable column vs an existing
  metadata/jsonb field. Decide against the live `leads` schema at build time.
- **Retention window** — 90 days raw proposed; confirm against cost once real
  volume is observable.
- **Web-Vital "page speed" score** — the snapshot shows a single `96`. Decide
  the formula (Lighthouse-style composite of LCP/CLS/INP p75s) when wiring §7.
- **Funnel-detail period control** — `useFunnelAnalytics` takes a `period`; the
  existing `FunnelPeriodToggle` (7D/14D/30D/90D) should drive it — confirm the
  rollup range covers 90D within the retention window.
