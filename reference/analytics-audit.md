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

## §2 — Funnel lead tracking through a funnel run

> Run 2026-05-20. Same diagnostic posture as §1: trace the data, name the
> gaps, propose nothing beyond the smallest-next-step. Pulls from the
> §1 analytics surfaces plus the lead-cluster code in `src/lib/leads/`,
> `src/app/api/forms/submit/`, the public renderer, and the leads UI
> under `src/app/leads/`.
>
> **TL;DR:** the funnel is structurally **two disconnected forms**, not
> a linked two-step lead-capture. Step 1 creates lead A. Step 2 creates
> lead B. Nothing in the running system stitches them together — the
> design comments openly acknowledge this ("Unused until the public
> funnel renderer threads a visitor-session leadId across steps", lib/
> leads/queries.tsx line 884). Compounding that, the funnel rollup is
> keyed at the funnel surface level — step 1 and step 2 form-submits
> increment the **same** `form_submitted` counter, so even the analytics
> path can't tell them apart. The operator's leads inbox surfaces neither
> "completed step 1 only" nor "completed step 2 (qualified)" as a
> filter. **A tradie's customer can fill out step 1, fill out step 2,
> and the operator will see two unrelated lead rows in the inbox — or,
> if they only fill step 1, one orphan row with no signal that step 2
> was the goal.**
>
> One smallest-next-step candidate at the end.

### 2.0 Funnel shape as built

Per `lib/website/generate-funnel-live.ts` lines 1–22 and the seeded
funnel data, a published funnel has three steps:

| # | Slug | Type | Lead role |
|---|---|---|---|
| 1 | `landing` | `landing` | Captures **name + email** (lead-capture form). The same form is *also* attached to the hero via `Section.form` envelope so it can submit above-the-fold or at the bottom — both fire the same `/api/forms/submit`. |
| 2 | `schedule` (or similar) | `schedule` | Captures **phone, service address, preferred date, time-of-day, budget** (qualification form). |
| 3 | `thanks` | `thanks` | Deterministic confirmation — no form. |

Step transitions are encoded as `FormConfig.afterSubmit.kind === 'nextStep'`;
`PublicSiteRenderer` resolves the next slug via `resolveSite()` and the
form does `window.location.href = nextStepHref` on successful submit.

### 2.1 Event-by-event pipeline

For each state transition the prompt asked about, here is what
actually exists in code today.

| Event | Infrastructure | Capture | Linked to lead | Surfaced | Status |
|---|---|---|---|---|---|
| **1. Funnel landing — step 1 page loaded** | webnua-track.js (`trackPageView`, line 233); `page_view` event always sent (essential). | ✅ Yes — written to `analytics_events`, rolled up to `analytics_funnel_daily.stage = 'landing'` and `analytics_page_daily` keyed on `page_ref = step.slug`. | ❌ Not yet — no lead exists at this point. The visitor's `visitor_id` (localStorage `webnua_vid` when analytics consent granted, else ephemeral) is the only handle. | Per-page-view counts surface via `fetchSurfacePageTotals(funnel.id)`. But §1.9 gap #2 calls out that the dashboard reads page totals only against `website.id`, never against `funnel.id` — so even the rollup data has no consumer. | **Captured, not surfaced.** |
| **2. Step 1 in progress — any form field focused** | webnua-track.js `onFocusIn` (line 316); first focus per `<form>` emits `form_start`. | ✅ Captured — but **gated on analytics consent**. With banner-mode consent (the default per `clients.tracking_consent_mode`), a visitor who has not accepted the banner emits **no** form events; only the always-on `page_view` lands. | ❌ Not yet — same as event 1. Visitor identity only. | Rolls up to `analytics_funnel_daily.stage = 'form_started'`. **Surfaced nowhere today** (see §1.9 gap #2). | **Captured (consent-gated), not surfaced.** |
| **3. Step 1 submitted — lead created** | `/api/forms/submit` route (route.ts lines 74–185). Service-role write to `customers` + `leads` + `lead_events`. | ✅ Captured. Lead row carries `source = "Form · hero"` (or similar, derived from the section label). `submission_id` (the form-instance UUID from `data-webnua-submission`) is persisted on `leads.submission_id` (line 155) per the visitor-tracking §8 reconciliation design. | ✅ Yes — by construction (this **creates** the lead). | Real lead lands in `useClientLeadsInbox()` / `useAdminLeadsInbox()`; `lead_events` row of `kind = 'form_submitted'` lands on the timeline. The new-lead notification trigger (`0032`) fans to the client's users. **But no funnel-step or "which step" attribution beyond the free-text `source` label.** | **Captured, partially surfaced** — the lead is visible; the journey is not. |
| **4. Step 2 reached — qualification page loaded** | webnua-track.js `trackPageView` — same as event 1. | ✅ Captured — written to `analytics_events`, rolled into `analytics_page_daily` keyed on `page_ref = step2.slug`. | ❌ **Critical break.** Nothing on step 2 reads any identifier from the URL, cookie, query parameter, or `localStorage` to find the lead created on step 1. The only handle is the same `webnua_vid` localStorage visitor id — but that id is **never written to** `leads` or `lead_events`. There is no `leads.visitor_id` column and the form-submit route does not record the visitor id. | Page-view counts roll up as in event 1; surfaced nowhere. | **Captured, not linked.** A visitor directly landing on step 2 is **not** redirected back to step 1 — the public renderer happily serves any funnel step that resolves; the only "guard" is that the form there asks for fields step 1 already collected. The operator has no way to detect "stepped onto step 2 without completing step 1". |
| **5. Step 2 in progress — qualification field focused** | webnua-track.js `onFocusIn` — same as event 2. | ✅ Same as event 2 (consent-gated). | ❌ Same as event 4 — no lead identity. | Rolls up into the same `form_started` bucket as step 1 — see §2.2 below. | **Captured (consent-gated), step ambiguity.** |
| **6. Step 2 submitted — qualification data captured** | `/api/forms/submit` — exactly the same route as event 3. | ⚠️ **Creates a SECOND lead row.** The route has no branch for "find an existing partial lead from the same visitor and update it" — every POST does an unconditional `customers` insert + `leads` insert + `lead_events` insert. Phone / address / date / time / budget land in `lead_events.payload.fields` of this second lead, not on the first. | ❌ **The two leads are not linked at the data layer.** The design *anticipates* a link via `submitLead(input.existingLeadId)` in `lib/leads/queries.tsx` (lines 882–928 — the function appends a `form_submitted` event to an existing lead instead of inserting a new one). But: (a) `submitLead` is the **editor** test-submit path, not the public-form path; (b) the public `/api/forms/submit` route never accepts `existingLeadId`; (c) no caller threads such an id from step 1 to step 2 anywhere in the renderer. | The operator sees two distinct lead rows with the same name/email (lead A: step 1) and a different identity (lead B: step 2 — `customer_name_snapshot` falls back to `'Website enquiry'` if step 2's form has no `leadRole = 'name'` field, which is the seeded shape). **No status transition** from `'new'` → `'qualified'` — both leads land in `status = 'new'` (route.ts line 152). The `lead_status` enum (`new \| contacted \| booked \| completed \| lost`, migration 0006) has no `'partial'` or `'qualified'` value. | **Worst gap — silent duplicate + no qualification status.** |
| **7. Step 2 dropped off — visitor leaves step 2 without submitting** | webnua-track.js `flushAbandons` (line 355) fires `form_abandon` on `pagehide`/`visibilitychange→hidden` for any form that emitted `form_start` but no `form_submit`. | ✅ Captured — consent-gated. | ❌ Not tied to any lead (because the step-2 visitor isn't tied to one). The `form_abandon` event is keyed by visitor + session, not lead. | `form_abandon` is **not in the aggregation function's stage map** (`0035_analytics_tables.sql` lines 173–183 only handle `page_view → landing`, `scroll_depth → engaged`, `element_click → cta_click`, `form_start → form_started`, `form_submit → form_submitted`). So a `form_abandon` event lands in raw `analytics_events` but **never reaches any rollup row** and is pruned after 90 days. There is no `cron`/worker that scans for "step 1 submitted but no step 2 submission within N minutes" to flag the partial lead as dropped. | **Captured raw, dropped at rollup, not surfaced.** |
| **8. Funnel abandoned — visitor never submitted step 1** | webnua-track.js — only `page_view` (essential) on bare landing, plus `form_start` / `form_abandon` if they engaged the form. | ✅ Same as events 1 + 7. | n/a — no lead. | Rollup counts an `analytics_funnel_daily.stage = 'landing'` increment with no corresponding `form_submitted`. **The conversion delta is calculable from `tracked.landing − tracked.formStarted − tracked.formSubmitted`** — but the funnel-level surfacing (§1.9 #2) is not wired to read this against a funnel surface. | **Captured at rollup, not surfaced.** |

### 2.2 The funnel rollup conflates the two steps

A subtler problem from `0035_analytics_tables.sql` lines 63–73:

```sql
create table public.analytics_funnel_daily (
  …
  surface_id      uuid not null,
  day             date not null,
  stage           text not null,
  …
  primary key (surface_id, day, stage)
);
```

The PK is **`(surface_id, day, stage)`** — there is **no `page_ref`
column**. The aggregation function (lines 174–183) maps every
qualifying raw event to a stage *for the funnel surface as a whole*,
regardless of which step's slug it fired on. So:

- A step-1 `page_view` and a step-2 `page_view` both increment the
  same `landing` row.
- A step-1 `form_submit` and a step-2 `form_submit` both increment
  the same `form_submitted` row.

Even if step linking were perfect, the rollup as built cannot report
"step-1 → step-2 conversion rate". To compute that you would need to
go back to raw `analytics_events` while it's still in the 90-day
retention window, or change the rollup PK to include `page_ref`.

`analytics_page_daily` **does** carry `page_ref` (line 88), so
per-step page-view + dwell + Web-Vital totals are recoverable; it's
the funnel-stage rollup specifically that loses step granularity.

### 2.3 Operator visibility — what the leads dashboard actually shows

Found in `src/app/leads/_admin-content.tsx`, `src/app/leads/_client-content.tsx`,
`src/lib/leads/queries.tsx`.

- **Inbox tabs filter by `lead.status`** (`_admin-content.tsx` line 59:
  `clientPool.filter((lead) => lead.status === tab.id)`). The tab set
  is the five `lead_status` enum values — `new`, `contacted`, `booked`,
  `completed`, `lost`. **No "partial / completed step 1 only" tab.
  No "qualified / completed both steps" tab.** Both step 1 leads and
  step 2 leads land in `status = 'new'` and are indistinguishable
  except by their `source` string.
- **Lead detail rail (queries.tsx lines 501–511)** renders only:
  `Source` (the free-text section label like `"Form · hero"`),
  `Status`, `Urgency`, `First seen`. No funnel id, no step number,
  no related-lead linkage, no journey timeline beyond the single
  `form_submitted` lead_event on that one lead.
- **The dashboard conversion funnel** (`lib/dashboard/queries.tsx`
  `conversionFunnel`, lines 274–319) shows **leads → booked →
  reviewed** at the website level. If tracked totals exist, three
  additional tracked stages (`landing → engaged → form-started`)
  prepend — but per §1.9 gap #2, tracked totals are only fetched for
  websites, never for funnels. So even when tracking is producing
  numbers, the step-1 → step-2 → booking conversion *for a funnel*
  has no dashboard tile.
- **`leads.submission_id` is written but never read.** A repo-wide
  grep for `submission_id` finds three sites: the database type
  definition (`src/lib/types/database.ts:1233/1247/1261`) and the
  write in `route.ts:155`. No query, no surface, no reconciliation
  consumer. It is dead-column-ready for a future "match the tracked
  `form_submit` count against the actual `leads` count" reconciler
  that does not exist yet.

### 2.4 Drop-off detection

Searched the repo for any worker/cron/scheduled job that would mark
a stale lead as dropped:

- `pg_cron` runs only one job: `webnua-analytics-rollup` (the §1.6
  hourly rollup). It does not touch `leads`.
- No Supabase edge function under `supabase/functions` (the dir
  doesn't exist — the only background work is the SQL `cron.schedule`).
- No "stale lead" / "partial conversion" logic anywhere in
  `src/lib/leads/`.

**Drop-off detection therefore relies entirely on the operator
manually noticing leads that never qualified.** Given that step-1
and step-2 submissions appear as two unrelated rows (§2.1 event 6),
the operator can't tell which step-1 leads are "still pending step 2"
vs "completed step 2 (now lead B)". The manual-noticing baseline
isn't there either.

This is fine for V1 honestly stated — but it's worth flagging the
gap explicitly: there is no UI affordance, no count, no chart, and
no surface that distinguishes partial from qualified.

### 2.5 Critical-path verification

**If a visitor lands on a funnel, fills step 1, navigates to step 2,
fills step 2, the operator sees:**

| Question | Answer |
|---|---|
| A lead record with both step 1 *and* step 2 data | **No.** Two unrelated lead rows. Lead A holds `customer.name`/`customer.email` (step 1 leadRole fields) + a `form_submitted` event with the name/email fields. Lead B holds `customer.phone` (step 2 leadRole field) + a `form_submitted` event with phone/address/date/time/budget. The two are not joined by `submission_id`, `visitor_id`, customer email, or any other key. Customer email exists on lead A but step 2's form (per `generate-funnel-live.ts buildQualificationFormConfig`) does not re-ask for email — so even a manual same-email join is not reliable. |
| Knowledge that this lead came through a *funnel* (not a website contact form) | **Partial.** The `lead.source` text reads `"Form · hero"` or `"Form · form"` (lowercased section label) — it does not name the funnel, name the step, or distinguish a funnel-form lead from a website-form lead. The funnel surface's identity (its `id`, `slug`, or name) is lost at the `/api/forms/submit` boundary; only `clientId` is required. |
| Journey timestamps for step-1 vs step-2 submission | **No.** Two separate `created_at` timestamps on two separate `leads` rows — they correlate temporally but the system does not assert the correlation. The operator would have to read off two adjacent rows by hand and guess. |
| If the visitor dropped off at step 2, a way to see that | **No.** The orphan step-1 lead (lead A) carries no signal that step 2 exists, was reached, or was abandoned. Whether the visitor never advanced or simply hasn't been pulled into the operator's CRM is indistinguishable from the lead row. |

All four answers are "no". The funnel lead pipeline has structural
gaps that block production readiness.

### 2.6 Smallest-next-step

Two candidate one-thing fixes ranked by leverage:

1. **(Recommended) Thread a lead identifier from step 1 to step 2 so
   step 2 appends to the existing lead instead of creating a new
   one.** The seam is already in place: `submitLead(input.existingLeadId)`
   (lib/leads/queries.tsx 882–928) does exactly this on the editor
   path. The minimum-viable wire-up:
   - On step-1 submit, `/api/forms/submit` returns `{ ok: true,
     leadId }` (already does — line 184). Redirect to step 2 with
     `?lead=<leadId>` (the renderer already controls `nextStepHref`
     in `resolve.ts` lines 342–346 — append the query string there).
   - On step-2 mount, `FormBlock` reads `?lead=` and posts it as
     `existingLeadId` alongside the submission.
   - Add an `existingLeadId` branch to `/api/forms/submit` that — when
     present and the lead is owned by the same `clientId` — appends a
     `form_submitted` `lead_event` to the existing lead and updates
     `customer.phone` / `customer.address` from the step-2 leadRole
     fields. No new lead row.

   This closes the single biggest gap (silent duplicate leads) with
   one parameter on one route and one URL-param read in `FormBlock`.
   It does **not** require:
   - A new `lead_status` enum value (the lead stays `'new'`; the
     timeline gains a second `form_submitted` row).
   - A `funnel_sessions` table.
   - Any change to the funnel rollup PK.
   - A drop-off worker (the operator can already see "one
     `form_submitted` event = step 1 only" vs "two = qualified" on
     the timeline once the linking is in place).

   The `submission_id` column would naturally also become readable
   alongside this — for the analytics-side reconciliation it was
   designed for — but that surfacing is a follow-on.

2. (Alternative) Add `page_ref` to `analytics_funnel_daily`'s PK and
   rollup so per-step funnel counts become recoverable. Higher cost
   (migration + aggregation rewrite + dashboard read changes) and
   does nothing for the duplicate-lead problem; deferable.

Pick (1).

