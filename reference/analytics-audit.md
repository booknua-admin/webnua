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
> **UPDATE 2026-05-20 — the duplicate-lead gap is now fixed.** The
> §2.6 smallest-next-step has shipped: the public submit route accepts
> `existingLeadId`, validates it belongs to the same `clientId`, and
> appends a `form_submitted` event to the referenced lead instead of
> inserting a new row. `FormBlock` reads `?lead=` from the URL on
> mount and appends `?lead=<id>` to the `nextStepHref` redirect after
> step 1's submission. So step 1 + step 2 from one visitor now land
> as a single lead with two timeline events. Events 4 + 6 in §2.1
> and §2.5 question 1 are resolved.
>
> **UPDATE 2026-05-20 (Session B — funnel step-granularity).**
> §2.2 (step-1-vs-step-2 ambiguity in the rollup) is now closed:
> migration 0042 extends `analytics_funnel_daily`'s PK with `page_ref`
> and the aggregator's GROUP BY to match — step-1 and step-2 events
> roll up as distinct rows. `fetchFunnelStepBreakdown(surfaceId,
> pageRefs)` exposes the per-step axis; surfaced on `/funnels/[id]`
> per prototype Screen 23. §2.6 inbox completion filtering is also
> closed: completion is derived at read time from `lead_events`
> (count of `form_submitted` events), surfaced as `LeadCompletion`
> on the row records, consumed by the new `LeadCompletionFilter` on
> both inbox bodies. Drop-off detection has a derived read-time
> signal (`isLeadDroppedOff` + the `LEAD_DROP_OFF_HOURS = 24`
> threshold) — the actual scheduled worker calling it is Phase 8
> (automation execution engine). Funnel-to-lead attribution
> (`leads.source_funnel_id`) is the immediate follow-up session;
> the hero "booked from this funnel" tile renders `—` via the
> shape-stable `getBookedFromFunnelCount` until then. See CLAUDE.md
> "Funnel analytics gaps that remain after lead threading" for the
> resolved-vs-deferred split.
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

---

## §3 — Form interaction tracking (Layer 2)

> **UPDATE 2026-05-20 (website-side close).** The website-side aggregation
> gaps in §3 / §4 are now closed. Migration 0040 wired `form_abandon` to
> the `form_abandoned` rollup stage; **migration 0041** (this session)
> adds the three previously-dropped scroll thresholds (`scrolled_25`,
> `scrolled_75`, `scrolled_90`) plus a per-element `element_label`
> column on `analytics_funnel_daily` (PK extended to
> `(surface_id, day, stage, element_label)`) so per-CTA click rollup
> rows are queryable. `SurfaceFunnelTotals` gained `scrolled25 / scrolled75 /
> scrolled90 / ctaClickTotal`, a new `fetchSurfaceClickBreakdown`
> returns the top-N CTAs by clicks, and a new `fetchPageTotalsByRef`
> reads `analytics_page_daily` keyed by page slug for the per-page
> stats now rendered on `PageGridCard` (visits 30d + avg time). A
> `WebsiteEngagementCard` mounted on `/website` surfaces the three
> panels (scroll-depth breakdown / top CTAs / form completion). The
> funnel rollup step-granularity question (per-step `page_ref` on
> `analytics_funnel_daily`) is **Session B** — not addressed here.
>
> Run 2026-05-20. Same diagnostic posture as §1 / §2. Scope: every
> client-side form event the tracker can fire (`form_start`,
> `form_field`, `form_abandon`, `form_submit`) plus the form-submit
> failure path the prompt asked about. Pulls from
> `public/webnua-track.js` lines 300–364,
> `src/app/api/track/route.ts`,
> `supabase/migrations/0035_analytics_tables.sql` lines 168–188,
> `src/lib/analytics/queries.tsx`, and the
> `src/components/shared/website/FormBlock.tsx` submit handler.
>
> **UPDATE 2026-05-20 — re-run after PR #73 (funnel lead threading).**
> PR #73 lands the §2.6 fix: step 2 now appends a `form_submitted`
> `lead_events` row to the step-1 lead rather than inserting a new
> `customers` + `leads` row. The §3 findings below are otherwise
> unchanged — the form-event taxonomy, the consent gating, the
> aggregation `case` block, the read layer, and the
> document-capture-phase `form_submit` listener all stayed put.
>
> One refinement applies to the form-submit-success row (§3.1 row 4):
> tracked-submits and `leadCount` used to match numerically (1 lead
> row per submit) and now **diverge for multi-step funnels** —
> tracked-submits counts every submit attempt (so 2 for a step-1 +
> step-2 visitor), while `leadCount` counts unique leads (1 for the
> same visitor). The dashboard's "Form submitted" step counts
> `leadCount`, so it now under-counts tracked submits in funnel
> traffic. The `submission_id` reconciliation column (§1.7, §2.3)
> still has no consumer; PR #73 makes its job slightly harder by
> stashing step-2's submission id inside `lead_events.payload.submissionId`
> rather than promoting it to `leads.submission_id`, so a full
> reconciliation now needs to union the column with the event payload.
>
> Top-3 gaps in §5.2 are unchanged. Gap #1 (form-submit error silent
> + false-positive against `form_submit`) is the same code path PR #73
> touched but did not address — and the threading actually amplifies
> the impact slightly: a step-2 submit that fails at `/api/forms/submit`
> (e.g. the cross-tenant guard at route.ts lines 155–163 rejects a
> tampered `?lead=`) still fires `form_submit` at the tracker and
> leaves the step-1 lead orphaned with no second event. Worth tracking.
>
> **TL;DR:** of the five form events worth tracking, **one is wired
> end-to-end** (`form_submit` → counted in the `form_submitted`
> funnel stage and surfaced on the dashboard). **Two are scaffolded
> but die at the aggregation boundary** (`form_field` and
> `form_abandon` accept-and-store as raw events, then are dropped at
> rollup and pruned after 90 days). **One is rollup-mapped but
> never read** (`form_start` lands in `analytics_funnel_daily.stage =
> 'form_started'` and is fetched by `SurfaceFunnelTotals.formStarted`,
> which surfaces on website dashboards only — funnel surfaces write
> it but nothing reads it; the §1.9 gap #2 applies). **One is
> completely absent** (`form_submit` for the API-failure path —
> there is no `form_submit_error` event; a failed submit is
> indistinguishable from a successful one in the tracking stream).

### 3.1 Event-by-event matrix

| Event | Infrastructure | Capture | Aggregation | Surfacing | Status |
|---|---|---|---|---|---|
| **Form start** (first focus of any field per `<form>`) | `onFocusIn` (webnua-track.js 316–326) registered as `document.addEventListener('focusin', onFocusIn, true)` (line 625). One-shot per form-index per page-load via `formState[idx].started` guard. | ✅ Written to `analytics_events.event_type = 'form_start'` with `payload = { formIndex }`. **Consent-gated** — `categoryFor('form_start') = 'analytics'` (line 81–83), so a visitor who has not accepted the banner emits no `form_start`. | ✅ Aggregation function maps `form_start → 'form_started'` (migration 0035 line 181). Lands in `analytics_funnel_daily` keyed `(surface_id, day, 'form_started')`. | ✅ Read by `fetchSurfaceFunnelTotals` (queries.tsx line 96) and surfaced as `SurfaceFunnelTotals.formStarted`. Dashboard conversion-funnel "Form started — Began typing details" step (`composeHub` / `composeClientDashboard` lines 343–349). **Funnel surfaces write it but never read it** (the §1.9 gap #2 dead-end). | **Fully wired for website surfaces. Tracked-not-surfaced for funnel surfaces.** |
| **Field interaction** (field blur with non-empty value) | `onFocusOut` (webnua-track.js 328–340) registered as `document.addEventListener('focusout', onFocusOut, true)` (line 626). Filters to `input \| textarea \| select` only; only fires when `value.trim()` is non-empty. **No `onChange` / no focus-only event** — drift from the prompt's "field focus/blur events" framing; the tracker captures *field completion*, not focus or skip. | ✅ Written to `analytics_events.event_type = 'form_field'` with `payload = { formIndex, field: name \| id \| tag }` (capped 80 chars). Consent-gated. **Fires on every qualifying blur** — no per-field dedupe, so editing → blurring → re-editing → blurring re-fires. | ❌ **Missing from the aggregation stage map.** The `case` block in `aggregate_analytics()` (migration 0035 lines 175–183) covers `page_view`, `scroll_depth`, `element_click`, `form_start`, `form_submit`. `form_field` is not listed; the `staged` subquery returns NULL for `stage` on that event type and the outer `where stage is not null` drops it. The row stays in `analytics_events` until the 90-day pruner removes it. | ❌ Nothing reads `event_type = 'form_field'` from `analytics_events` directly either — no SQL view, no query helper, no UI. The data is captured and then evaporates. | **Captured raw, dropped at rollup, never surfaced.** |
| **Form abandon** (page hides with a started, unsubmitted form) | `flushAbandons` (webnua-track.js 355–364) called from the `visibilitychange → hidden` listener (line 630–631) and `pagehide` listener (line 635–637). Walks `formState`, fires once per form-index where `started && !submitted && !abandoned`. | ✅ Written to `analytics_events.event_type = 'form_abandon'` with `payload = { formIndex }`. Consent-gated. **Delivery channel:** dispatched via `flush(true)` which prefers `navigator.sendBeacon` (line 206–215) — by design, since the page is unloading; falls back to `fetch({ keepalive: true })`. | ❌ **Same gap as `form_field`** — `form_abandon` is not in `aggregate_analytics()`'s `case` block. Lands in raw events; never rolled up. | ❌ No consumer. There is no "abandoned forms today" tile, no per-form drop-off rate, no count anywhere in `lib/analytics/queries.tsx` or `lib/dashboard/queries.tsx`. §2.1 event 7 flagged this; this audit confirms the entire end-to-end is dead. | **Captured raw, dropped at rollup, never surfaced.** |
| **Form submit — success** | `onSubmit` (webnua-track.js 342–353) registered as `document.addEventListener('submit', onSubmit, true)` (line 627). Capture-phase on `document` — fires **before** React's `<form onSubmit>` bubble-phase handler, so it always runs on a real submit attempt regardless of what the React handler does next. | ✅ Written to `analytics_events.event_type = 'form_submit'` with `payload = { formIndex, submissionId }` (read off `data-webnua-submission` set by `FormBlock` lines 95–107). Consent-gated. | ✅ Aggregation maps `form_submit → 'form_submitted'` (line 182). Lands in `analytics_funnel_daily.stage = 'form_submitted'`. | ⚠️ **Aggregated and stored, but the read layer doesn't expose it.** `SurfaceFunnelTotals` (queries.tsx lines 24–33) exposes `landing`, `engaged`, `formStarted` — **not `formSubmitted`**. The dashboard funnel uses the source-of-truth `leadCount` (from `leads` table) instead, for the "Form submitted — Became a new lead" step (queries.tsx 351–356). So the tracked submit count exists in the rollup but is never read; the operator sees lead counts, not tracked-submit counts. The `submission_id` column on `leads` (§1 / §2.3) was designed for reconciling the two — and still has no consumer. **Post-PR-#73 note:** the substitution now produces a numeric divergence rather than a match — tracked-submits counts attempts (step 1 + step 2 = 2) while `leadCount` counts unique leads (= 1 after threading). See the §3 update block above. | **Captured & aggregated; lead-count substituted at the read layer.** Per §1 / §2 the lead count is the source of truth, so this is by design — but the parallel rollup row is wasted I/O, and (post-PR-#73) the silent numeric gap between the two is now structural. |
| **Form submit — error** (API rejection, 4xx/5xx) | **None.** `FormBlock` (lines 235–262) catches the failure and renders a warn notice ("Something went wrong — please try again") — no tracking event is emitted on the failure path. And because the tracker's `onSubmit` is on `document` in the capture phase, it has **already fired `form_submit`** by the time React's bubble-phase `<form onSubmit>` handler calls `preventDefault()` and makes the (eventually-failing) network call. | ⚠️ The successful-side `form_submit` event still fires for a failed submit. There is no compensating `form_submit_error` event, no `form_submit_failed`, no payload flag distinguishing the two. The tracker also marks `formState[idx].submitted = true` on the same dispatch (line 348), so `flushAbandons` will **not** fire `form_abandon` on a subsequent page-hide either — the visitor's failed attempt registers as a successful submit AND suppresses the abandon signal. | n/a — no event to aggregate. | ❌ Absent. The operator cannot tell from analytics that visitors are bouncing off a broken submit; only the `leads` count diverging from the tracked `form_submitted` count would reveal it, and §2.3 already established that nothing reads the divergence. The `analytics_event_type` enum (0035 lines 22–31) does not include any error event type, so adding one is a schema migration. | **Completely absent + a false-positive against `form_submit`.** This is the worst behavioural gap in §3 — a real outage on the submit API is invisible to analytics and inflates the success-funnel count. |

### 3.2 Closer look — the abandoned-form pipeline

The prompt specifically asked about the `form_abandon` gap §2 flagged. Detail:

1. **Capture works** (script lines 355–364). The script tracks
   per-form state (`started`, `submitted`, `abandoned` flags), and on
   `visibilitychange → hidden` / `pagehide` it walks every form that
   was started but not submitted and not already flagged abandoned,
   firing one `form_abandon` event per such form.
2. **Transport works** — the abandon flush is paired with
   `flush(true)` (line 632 + 637), which uses `sendBeacon` on hide, the
   intended channel for "fire-and-forget on unload". This is the
   correct shape; the visitor's data lands at `/api/track`.
3. **Ingest works** — `/api/track`'s `EVENT_TYPES` allowlist
   (route.ts line 41) includes `'form_abandon'`, so the row writes
   into `analytics_events` cleanly. Confirmed by inspection of the
   service-role insert path.
4. **Aggregation is the failure point.** Re-reading the rollup case
   block (migration 0035 lines 175–183):

   ```sql
   case
     when event_type = 'page_view' then 'landing'
     when event_type = 'scroll_depth'
       and coalesce((payload->>'depth')::int, 0) >= 50 then 'engaged'
     when event_type = 'element_click' then 'cta_click'
     when event_type = 'form_start' then 'form_started'
     when event_type = 'form_submit' then 'form_submitted'
   end as stage
   ```

   `form_abandon` is not in the list. The outer
   `where stage is not null` filters the event out — so a perfectly
   captured, perfectly transmitted, perfectly stored `form_abandon`
   row vanishes at the rollup boundary and is pruned 90 days later.
5. **Read layer wouldn't see it even if rolled up.**
   `SurfaceFunnelTotals` (queries.tsx 24–33) hard-codes `landing /
   engaged / formStarted` as its returned fields. Adding a `form_abandon`
   rollup stage would still need a parallel `abandoned` field on the
   read shape + a UI consumer.

**What "add to the aggregation" would look like** (descriptive only, not
a recommendation): one additional `when event_type = 'form_abandon'
then 'form_abandoned'` branch in `aggregate_analytics()`, one new
field on `SurfaceFunnelTotals`, one new step in the dashboard
conversion funnel between `form-started` and `leads`. The
already-captured raw rows would back-fill the rollup on the next
hourly pass (the aggregation re-builds today + yesterday on each
run), so historical data within the 90-day raw retention window is
recoverable. None of this is in place today.

### 3.3 Verdict — Layer 2

| Event | State |
|---|---|
| Form start | ✅ end-to-end on websites; ⚠️ tracked-not-surfaced on funnels (§1.9 #2) |
| Field interaction (`form_field`) | ❌ scaffolded but dead — captured raw, dropped at rollup |
| Form abandon | ❌ scaffolded but dead — same shape as `form_field` |
| Form submit success | ⚠️ aggregated rollup row never read; `leads` count substitutes at the dashboard |
| Form submit error | ❌ completely absent + a false-positive against `form_submit` |

The most surface-area-affecting gap is **form-submit error**: it is
silent in tracking and registers as a successful submit. Of the
"existing data but no surfacing" category, **form_abandon** is the
cleanest closeable — raw data is being collected today, only the
aggregation `case` branch and a read field stand between it and the
operator's dashboard.

---

## §4 — Engagement tracking (Layer 3)

> Run 2026-05-20. Pulls from `public/webnua-track.js` lines 261–298
> + 134–162, `supabase/migrations/0035_analytics_tables.sql`,
> `src/lib/analytics/queries.tsx`, and the dashboard composers in
> `src/lib/dashboard/queries.tsx`.
>
> **TL;DR:** the script captures **more engagement signal than the
> read layer exposes.** Scroll-depth thresholds are tracked at four
> resolutions (25/50/75/90 — NOT 25/50/75/100 as the prompt
> assumed); only the 50% threshold is exposed (as "engaged"). Clicks
> on every anchor / button / role=button are captured indiscriminately
> (no CTA flag, no section attribution); the rollup counts them as a
> generic `cta_click` stage that nothing reads. Time-on-page is
> **derived from event timestamps**, not from an explicit dwell event
> or a `visibilitychange`-aware accumulator — meaning a visitor who
> tab-switches, comes back 30 minutes later and reads, then leaves
> records an inflated dwell. Session duration as a cross-page
> concept is **not derived anywhere** — `session_id` persists across
> pages but no query asks "how long was session X overall?".
> Persistent `visitor_id` exists in localStorage and crosses
> sessions, but no read surface asks "is this a returning visitor".

### 4.1 Event-by-event matrix

| Event | Infrastructure | Capture | Aggregation | Surfacing | Status |
|---|---|---|---|---|---|
| **Scroll depth** | `onScroll` (webnua-track.js 263–277) registered as `window.addEventListener('scroll', onScroll, { passive: true })` (line 622), called once on `start()` (line 623) so a load that arrives already scrolled (anchor jump, restored scroll position) counts. **No throttle / no `requestAnimationFrame`** — the handler runs on every scroll event, deduped per-threshold via `scrollFired[t]`. | ✅ Written to `analytics_events.event_type = 'scroll_depth'` with `payload = { depth: 25 \| 50 \| 75 \| 90 }`. Note the **thresholds: 25, 50, 75, 90** — NOT 100 as the prompt assumed. The 90% cap is a deliberate "near-bottom" heuristic (full 100% is hard to hit on pages with sticky footers / mobile address bars). Consent-gated. One event per threshold per page-load (`scrollFired[t]` guard, line 272). | ⚠️ Aggregation rolls **only the ≥50% threshold** to the `engaged` stage (migration 0035 lines 178–180). The 25, 75, and 90 events land in raw `analytics_events` and are dropped at rollup — same fate as `form_field` / `form_abandon`. | ✅ The 50% slice surfaces as `SurfaceFunnelTotals.engaged` and renders on the dashboard "Engaged — Scrolled past halfway" step. **No per-threshold breakdown is exposed.** 25%, 75%, and 90% are invisible. | **Partial — one threshold of four surfaces; the other three are captured raw, dropped at rollup, never surfaced.** |
| **Time on page** | **No explicit instrumentation.** The script does not emit a `dwell` event, does not register `visibilitychange` for time accumulation (it uses `visibilitychange` only for `flushAbandons` + `flush(true)` on hide), does not register `beforeunload` for elapsed time, and does not accumulate elapsed visible time across visibility changes. | n/a — derived only. | ✅ The aggregation function computes dwell **as a side-effect of other events**: per `(surface_id, page_ref, session_id)` it takes `max(occurred_at) - min(occurred_at)` across all events in the day, then averages across sessions (migration 0035 lines 207–219). **Implications:** a visitor who emits a single event (e.g. consent-gated, only `page_view` fires) records zero dwell. A visitor who tab-switches away for 30 minutes and comes back to scroll once records an inflated dwell of ~30 minutes. The 30-minute session-idle reset on `webnua_sid` (script line 131) bounds the inflation but doesn't eliminate it. | ✅ `SurfacePageTotals.avgSeconds` is computed (queries.tsx 139) and rendered on the dashboard `LandingSnapshot` as the "AVG TIME" stat via `formatDwell()` (lines 731–738). | **Captured as a derivation, surfaced — but the derivation is loose** (visibility-blind, conflated with idle time). Honest for V1; not accurate enough to make confident UX claims from. |
| **Click engagement** | `onClick` (webnua-track.js 281–298) registered as `document.addEventListener('click', onClick, true)` (line 624). Walks up the DOM at most 4 hops looking for `<a>`, `<button>`, or `role="button"`. | ✅ Written to `analytics_events.event_type = 'element_click'` with `payload = { label (innerText ≤120 chars), href, tag }`. Consent-gated. **No CTA / no section attribution / no marker:** every clickable element in the page counts identically — primary hero CTA, footer privacy link, nav anchor, phone-number `tel:` link, social-icon button. The renderer does not stamp section ids or CTA flags onto the markup that the click handler reads. | ✅ Aggregation maps `element_click → 'cta_click'` (migration 0035 line 180). Lands in `analytics_funnel_daily.stage = 'cta_click'` — counted at the per-surface per-day level, **not per-CTA**. Even if a per-CTA query were written, there is no `payload->>label` aggregation in the rollup; you'd have to query raw events while the 90-day retention window still holds. | ❌ **Nothing reads `cta_click`.** `SurfaceFunnelTotals` exposes only `landing / engaged / formStarted` (queries.tsx 24–33); the dashboard funnel jumps from "engaged" straight to "form-started" with no click stage between. The rollup row writes for nothing. | **Captured & aggregated as one undifferentiated stage; never read; per-element data discarded at rollup.** |
| **Session duration** (cross-page within a session) | **No instrumentation.** `session_id` (`webnua_sid`) persists in localStorage with a 30-minute idle window (script lines 142–156); every event in the queue stamps the current `sessionId`. But the tracker emits no session-end event, no cumulative duration, no per-session accumulator. | n/a — derivable from raw events only. | ❌ **Not derived anywhere.** The dwell averaging (queries.tsx + the rollup) is keyed `(surface_id, page_ref, session_id)` — it produces a **per-page** dwell, summed across pages would in theory give a session duration, but no query does this. The page-level dwell metric is averaged across sessions, then exposed as one number — the per-session axis is consumed in the aggregation and never surfaces. | ❌ No surface. | **Completely absent at the read layer.** Raw data sufficient to derive it sits in `analytics_events` for 90 days and is pruned. |
| **Visitor return** (same `visitor_id` across sessions) | `webnua_vid` is persistent in localStorage with analytics consent (script lines 137–141); ephemeral `anon-<rand>` without (line 158). Every event stamps the current `visitor_id`. | ✅ The data carries it — `analytics_events.visitor_id` is on every row. | ⚠️ The rollup uses `count(distinct visitor_id)` for `unique_visitors` per surface per day (and per stage in the funnel rollup). It does **not** track first-seen / last-seen / returning-count: there is no `analytics_visitors` table, no `first_seen_at` column on the rollup, no "returning vs new" split. | ❌ No surface. The dashboard never asks "of today's visitors, how many were here before"; `SurfacePageTotals.uniqueVisitors` is just today's distinct count, with no historical comparison axis. | **Captured at the identity layer, used for uniques only, not surfaced as a return-rate or cohort axis.** |

### 4.2 Web Vitals — the one engagement-adjacent signal that IS fully wired

Worth calling out because Web Vitals (`web_vital` event with
`{ name, value }` payload for LCP / CLS / INP) is the only
beyond-pageview signal the dashboard actually renders end-to-end:

- Captured by `trackVitals()` (webnua-track.js 368–424) via three
  `PerformanceObserver`s; reported once on first `visibilitychange →
  hidden`.
- Aggregated as `lcp_p75 / cls_p75 / inp_p75` on `analytics_page_daily`
  via `percentile_cont(0.75)` (migration 0035 lines 220–235).
- Surfaced as the "PAGE SPEED" stat on the client `LandingSnapshot`
  via `pageSpeedScore()` (queries.tsx 156–189; renderer lines
  707–746). Composite 50%/25%/25% LCP/CLS/INP score → 0–100,
  banded as Fast / Moderate / Needs work.

This is the proof-point that the analytics pipeline *can* deliver an
end-to-end engagement signal — the gaps in §4.1 above are
read-layer / aggregation gaps, not infrastructure gaps.

### 4.3 Verdict — Layer 3

| Event | State |
|---|---|
| Scroll depth — 50% (engaged) | ✅ end-to-end |
| Scroll depth — 25 / 75 / 90 | ❌ captured raw, dropped at rollup |
| Time on page | ⚠️ derived & surfaced, but visibility-blind so the value is loose |
| Click engagement (per CTA) | ❌ captured raw, rolled as undifferentiated stage, never read |
| Session duration | ❌ derivable but never derived |
| Visitor return | ❌ data exists at identity layer, no analytics surface |
| Web Vitals (LCP / CLS / INP) | ✅ end-to-end (page-speed score on dashboard) |

The pattern from §3 repeats here: **client-side capture is generous;
the read layer is the bottleneck.** Three of the four "captured raw,
dropped at rollup" events (25 / 75 / 90 scroll thresholds, `form_field`,
`form_abandon`) are unblockable by aggregation-layer edits without
schema changes — they would need new stage values in
`analytics_funnel_daily` and new fields on `SurfaceFunnelTotals`.

---

## §5 — Cross-layer synthesis

### 5.1 What the operator sees today, walked through a real session

Hypothetical visitor session against a published website:

> Visitor lands on the home page → scrolls past the offer →
> clicks the hero CTA → focuses the email field → submits the form →
> visits the contact page → leaves.

| Step | Captured? | Surfaced to operator? | Notes |
|---|---|---|---|
| Landing on home | Yes — `page_view` (essential, no consent gate) | Yes — `LandingSnapshot.visits`, `SurfaceFunnelTotals.landing` (§1) | The only step that lands without analytics consent. |
| Scroll past offer (≥50%) | Yes — `scroll_depth { depth: 50 }`; consent-gated | Yes — funnel "Engaged" step | Aggregated. |
| Scroll past 25 / 75 / 90 | Yes — three separate raw events | **No** — dropped at rollup | Granularity exists but is invisible. |
| Click hero CTA | Yes — `element_click { label: "Get a quote", … }`; consent-gated | **No** — `cta_click` rollup row writes for nobody. The dashboard skips from "engaged" to "form started". | Per-CTA labels discarded at rollup. |
| Focus email field (first focus) | Yes — `form_start`; consent-gated | Yes — `SurfaceFunnelTotals.formStarted`, "Form started" funnel step (website surfaces). **No** for funnel surfaces (§1.9 #2). | Wired for websites only. |
| Type into email field, blur | Yes — `form_field { field: "email" }`; consent-gated | **No** — dropped at rollup, no read consumer | Field-completion telemetry exists in raw for 90 days, then evaporates. |
| Submit form | Yes — `form_submit { submissionId }`; consent-gated | **Partially.** The tracked rollup row is written but unread; the operator sees the real `leads` row in their inbox and the "Form submitted" funnel step counts `leadCount`, not tracked submits. (§2 already noted the `submission_id` reconciliation column is never read.) | Source-of-truth is the `leads` table; tracking carries a parallel count. |
| If the submit had failed at the API | **No** — there is no `form_submit_error` event; the `form_submit` already fired in the capture phase, falsely counting it as a success. (§3.1 row 5) | n/a | Most-impactful unsurfaced behaviour gap. |
| Navigate to contact page (same session) | Yes — new `page_view` on the new path; same `session_id` retained until 30-min idle | Yes for visits / dwell — page-keyed (§1) | Per-page totals work. |
| Total session duration across the two pages | Yes — implicitly, all events stamp `session_id` | **No** — never derived | Two pages of dwell exist; no roll-up sums them. |
| Visitor leaves the contact page (page hide) | Yes — `flushAbandons` (no started form so nothing fires); Web Vitals report; queue beacon-flushed | Yes for vitals — feeds "PAGE SPEED" stat | Departure itself is implicit (no events arrive after). |
| Visitor returns next week (same `webnua_vid`) | Yes — persistent localStorage id | **No** — no "returning visitor" surface; only that day's unique count is shown | Identity persists; insight does not. |

**One-paragraph summary an operator could read today:**

> Your dashboard tells you how many people landed on your site, how
> many scrolled past halfway, how many touched a form field, how
> many submitted (counted from real leads, not tracker counts),
> how many converted to bookings, how many of those left a review,
> and a one-number page-speed score from the visitor's browser.
> What it does **not** tell you: which CTA they clicked, how far
> down the page they actually got beyond "past halfway", how long
> their whole session lasted across pages, whether they were here
> before, whether they tried to submit the form and got a server
> error, whether they started a form and walked away without
> submitting, or — for funnel surfaces specifically — *any* of the
> engagement numbers above, because the dashboard fetches funnel
> rollups only at the website level (§1.9 gap #2).

### 5.2 Top 3 highest-value gaps to close

> **UPDATE 2026-05-20 — all three gaps closed in follow-up commits.**
> Gap #1 (form-submit error) shipped via the new `form_submit_error`
> event type (migrations 0038 + 0039) + a `window.webnuaTrack.formSubmitError`
> API the React `FormBlock` calls in its catch block — successful
> submits now read as `formSubmitted − formFailed`. Gap #2
> (`form_abandon` aggregation) shipped via migration 0040 — abandons
> roll up into a `form_abandoned` stage and the conversion-funnel
> view renders a "Form abandoned · Left without submitting"
> side-channel step. Gap #3 (funnel surfaces never read) shipped via
> the dashboard composers — `composeClientDashboard` and `composeHub`
> now prefer the client's funnel surface for tracked totals, falling
> back to the website when no funnel exists.
>
> **UPDATE 2026-05-20 (Session B — funnel step-granularity).**
> §2.2 step-1-vs-step-2 ambiguity is also closed: migration 0042
> extends the rollup PK with `page_ref`. The dashboard composers'
> per-client aggregate keeps reading via `fetchSurfaceFunnelTotals`
> (which sums across `page_ref` rows — same numeric result as
> pre-migration); per-step rendering moves to `/funnels/[id]` via
> the new `fetchFunnelStepBreakdown`. Operator inbox now carries
> `LeadCompletionFilter` (in-progress vs completed, derived from
> `form_submitted` event count on each lead). The funnel-to-lead
> attribution piece (`leads.source_funnel_id` for the hero "booked"
> tile) ships in the next session — see the parked CLAUDE.md
> "Funnel-to-lead attribution" item.
> The ranked list below is preserved as the original audit record.

Ranked by severity × surface area × closeability — same lens as §1 / §2.

1. **Form-submit error is silent + counted as a success.**
   *Severity: silent data loss + false positive on the funnel.*
   *Surface area: every form on every published site.* *Closeability:
   small — `FormBlock`'s catch block could fire an explicit tracker
   event (`'form_submit_error'`), and the existing `form_submit`
   stamping in the capture-phase listener could be deferred to a
   submit-resolved channel.* Today an outage on `/api/forms/submit`
   shows up nowhere in analytics; tracked-submits and leads diverge
   silently. This is the worst behavioural gap surfaced by §3 and
   the only one that *inflates* a positive metric the operator
   trusts (the "form submitted" funnel step counts leads, but the
   underlying tracked stream — which the dashboard would fall back
   to if leads were ever delayed — overcounts).

2. **`form_abandon` is fully captured, fully transmitted, fully
   stored — and dropped at the rollup boundary.**
   *Severity: visibility gap.* *Surface area: every form on every
   published site.* *Closeability: smallest — one additional `when
   event_type = 'form_abandon' then 'form_abandoned'` branch in the
   aggregation `case` block, one new field on `SurfaceFunnelTotals`,
   one new funnel step.* The 90-day raw-event window means the
   rollup back-fills the moment the branch is added — no historical
   loss for fixes deployed in the next 90 days of traffic. This is
   the operator-side complement to gap #1: knowing how many people
   *try* the form (formStarted), submit it (formSubmitted), and
   walked away (formAbandoned) closes the form's drop-off picture.

3. **Funnel surfaces emit every engagement event but the dashboard
   never reads them.** *Severity: structural — every gain from
   closing gaps #1 / #2 has to be re-closed for funnels separately,
   and §2 already identified this as a contributing factor in the
   funnel-lead duplicate-rows problem.* *Surface area: every
   published funnel.* *Closeability: medium — `composeHub` and
   `composeClientDashboard` call `fetchSurfaceFunnelTotals(website.id)`
   today; routing a funnel surface's id through the same call would
   require deciding which funnel(s) a given dashboard view should
   aggregate (per §1.9 gap #2, the data is per-surface and the
   funnel rollup loses step granularity to `surface_id × stage`).*
   This is the §1.9 #2 / §2.2 already-flagged gap, re-confirmed here
   because Layer-2 and Layer-3 events ride the same dead-end pipe.
   Until this is wired, every per-event fix is half a fix.

Gaps #4–N (`form_field` rollup, per-CTA click attribution, scroll
thresholds beyond 50%, session duration, returning-visitor surface)
are real but lower priority — none of them inflate a wrong number,
and each is recoverable from raw data within the 90-day window for
the first 90 days after the read layer learns to ask for them.

