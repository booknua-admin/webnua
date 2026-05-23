# GBP UI consolidation audit

> Phase 7 GBP integration. The backend (migrations 0066–0069, the job
> handlers, the API client, the API routes, the render-context wiring) is
> correct and stays. The frontend in PR #99 created a dedicated
> `/settings/google-business` tab — wrong. GBP is an implementation detail
> of reviews + lead-management, not a top-level concept users navigate to.
>
> This audit identifies where each GBP UI piece belongs in Webnua's
> existing three-tier user model, before any moves are made.

## Three-tier user model — recap

1. **OPERATOR** — Webnua staff. Logs into operator console. Sees all
   clients. Manages multi-client concerns.
2. **CLIENT** — paying business owner. Logs into their own account. Sees
   only their own data.
3. **CUSTOMER** — the client's end customer (lead / booking person). Never
   logs in; only receives SMS/email automations.

GBP UI needs surfaces for OPERATOR + CLIENT (not customer).

## Inventory of existing surfaces — destinations

### A. Reviews

| Context | File | Today |
|---|---|---|
| OPERATOR (cross-client) | `src/app/reviews/_admin-content.tsx` | `useAdminReviews()` builds an `AdminReviewsPage` (hero + 4-up stats + N `ReviewClientCard`s, one per accessible client; each card holds 3 recent reviews via `ReviewItem variant="compact"`). |
| CLIENT (single business) | `src/app/reviews/_client-content.tsx` | `useClientReviews()` builds a `ClientReviewsPage` (hero + summary + distribution bars + N `ReviewItem variant="full"`). |

Data source today: both hooks read the `public.reviews` table (`src/lib/reviews/queries.tsx`) — that table was designed for GBP (it carries `source` default `'gbp'` and `external_id`) but has no live writer; Phase 7's GBP sync writes to the richer `gbp_reviews` table instead. So the existing UI shows nothing in production.

The Webnua-authored `ReviewItem` component is read-only — there is NO existing reply UI anywhere. Reply is a net-new affordance that has to extend the existing component (NOT a redesign — a single inline reply Textarea, the same pattern PR #99 built; just mounted on `ReviewItem` instead of a new section).

### B. Lead detail

| Context | File | Today |
|---|---|---|
| OPERATOR | `src/app/leads/[id]/_admin-content.tsx` | Right rail with `<LeadQuickActions actions={lead.quickActions} />` + `<LeadTimeline events={lead.timeline} />`. |
| CLIENT | `src/app/leads/[id]/_client-content.tsx` | Same shape — same `LeadQuickActions` + `LeadTimeline` components. |

Quick actions are data — `LeadQuickAction[]` built in `lib/leads/queries.tsx` `buildLeadDetail`. Today the array carries 4 stub actions (`Call`, `Open conversation`, `Book a job`, `Push to follow-up`). The shape is `{ icon, label, primary?, href? }`. **No `onClick` field exists today** — actions only navigate via `href`. To add a manual "Send review request" we need to extend the type with `onClick?: () => void` and have the renderer dispatch it as a `<button>`.

Timeline is also data — `LeadTimelineEvent[]` rendered through `LeadTimeline` / `LeadTimelineEventRow`. Each event has a `dot` type. The natural home for review-request audit entries is right here — they ARE a timeline event ("Review request sent · SMS"), not a separate section.

### C. Booking detail

| Context | File | Today |
|---|---|---|
| OPERATOR | `src/app/bookings/[id]/_admin-content.tsx` | `<AdminBookingHero actions={<>…</>}>` — actions are hardcoded JSX (Mark complete / Reschedule / Open leads / Cancel). |
| CLIENT | `src/app/bookings/[id]/_client-content.tsx` | Right rail of `RailCard`s, each carrying a `ClientBookingActionGroup` (`{ heading, actions: ClientBookingAction[] }`). The renderer dispatches on `a.label` for hardcoded handlers (`Reschedule` → `RescheduleBookingButton`; `Edit job notes` → modal; `Cancel booking` → confirm; etc.) and falls through to a `<Link>`/`<a>` for the rest. |

Bookings already auto-fire a review request via the DB trigger when status → `completed` (migration 0069). A manual "Send review request" action is still valuable for re-sends + off-platform jobs.

### D. Integration management

| Context | File | Today |
|---|---|---|
| OPERATOR (sub-account mode) | `src/app/settings/integrations/_admin-content.tsx` → `IntegrationConnectionsSection` | The per-client OAuth connection panel for both GBP + Meta. Already mounts the Connect button + OAuth result banner. |
| CLIENT | `src/app/settings/integrations/_client-content.tsx` | Static `IntegrationCard` UI; no connections panel. **Customer never connects GBP themselves** — operator does it on their behalf in sub-account mode. |

OAuth callback redirects to `/settings/integrations?integration=google_business_profile&integration_status=connected`. The `OAuthResultBanner` inside `IntegrationConnectionsSection` reads those params and shows a toast. THIS is where the `GbpLocationPickerModal` should auto-mount when `integration === 'google_business_profile' && integration_status === 'connected'`.

### E. Dashboard widget

| Context | File | Today |
|---|---|---|
| OPERATOR sub-account hub | `src/app/dashboard/_hub-content.tsx` | `<GbpReviewsWidget clientId={…} />` already mounted in PR #99. |
| CLIENT dashboard | `src/app/dashboard/_client-content.tsx` | `<GbpReviewsWidget clientId={…} href="/reviews" />` already mounted in PR #99. |

**No change.** Widget stays — it's the right pattern (extends existing dashboards, doesn't introduce a new tab).

## What moves where

### Piece 1: Reviews list + inline reply UI

**Current location:** `src/app/settings/google-business/page.tsx` →
`GbpReviewsSection` (new tab — wrong home).

**OPERATOR destination:** `src/app/reviews/_admin-content.tsx`. Each
`ReviewClientCard` already lists 3 recent reviews per client; the
operator should be able to reply to any of them. The `ReviewItem`
component (`variant="compact"`) gets a reply affordance; replying calls
`useReplyToGbpReview(clientId)` with the client_id from the card.
**Surface exists; needs extension** (reply affordance on `ReviewItem` +
`useAdminReviews()` re-sourced to `gbp_reviews`).

**CLIENT destination:** `src/app/reviews/_client-content.tsx`. The
existing list of `ReviewItem variant="full"` rows gets the inline reply
affordance. The reply call is `useReplyToGbpReview(clientId)` with the
signed-in client's id. **Surface exists; needs extension** (same reply
affordance; `useClientReviews()` re-sourced to `gbp_reviews`).

**Data-source change:** `useClientReviews()` + `useAdminReviews()`
(`src/lib/reviews/queries.tsx`) re-pointed from `public.reviews` to
`public.gbp_reviews`. The existing `reviews` table predates the Phase 7
GBP sync — no live writer, no live data in production. The Webnua-
authored `reviews` table stays in the schema (not dropped in this PR —
that's a backend / migration concern out of scope) but the UI consumes
`gbp_reviews`. `ReviewItem` shape extends with optional reply fields
(`replyText?`, `replyAt?`, `clientId?`, `gbpReviewRowId?`) so the
reply mutation has the keys it needs; the existing `id` / `authorName`
/ `text` / `stars` / `age` fields are unchanged.

### Piece 2: Review request audit log

**Current location:** `src/app/settings/google-business/page.tsx` →
`GbpReviewRequestsSection` (new tab — wrong home, and the table view is
a heavy redesign).

**Destination — BOTH operator + client:** the **lead detail timeline**
(`src/components/shared/leads/LeadTimeline.tsx` rendered by both
`_admin-content.tsx` and `_client-content.tsx`). A review-request send
is a typed event — `dot: 'review-request'` (new) — slotted into the
existing `LeadTimelineEvent[]` chronologically. Per-row meta carries the
channel (SMS / email), the timestamp, and the attribution
("✓ Review left" when `resulted_in_review_id` is set). **Surface
exists; needs extension** (`buildLeadDetail` in `lib/leads/queries.tsx`
appends review-request rows to the timeline; `LeadTimeline` already
supports custom dot types — one new tone + a `'review-request'` entry
in `LeadTimelineDot`).

**Operator cross-client log** is intentionally NOT built — operators
see per-client requests when they open a lead. A cross-client requests
roster would be a new surface (not in scope; not in any prototype).

### Piece 3: Manual "Send review request" action

**Current location:** `src/app/settings/google-business/page.tsx` →
`GbpReviewRequestsSection` button (modal). Wrong home.

**Destination A — lead detail:** append a `'Send review request'`
`LeadQuickAction` (icon: '⭐') to the array in `buildLeadDetail`. Both
operator + client get it. The renderer needs an `onClick` branch added
to `LeadQuickActions` (currently only routes `href`).

**Destination B — booking detail:** add a `'Send review request'`
entry to the client booking action group (renderer needs an `else if`
branch matching the existing `Reschedule` / `Edit job notes` pattern),
AND a button in the admin `AdminBookingHero` actions slot. Both
trigger the same modal extracted from `GbpReviewRequestsSection`.

Modal becomes a small reusable `<GbpSendRequestButton>` component (the
existing `ManualSendModal` body extracted) so the same modal opens from
either trigger.

### Piece 4: Connection management

**Current location:** `src/app/settings/google-business/page.tsx` →
`GbpLocationSection`. Wrong — this duplicates OAuth management and adds
a "pick location" step.

**Destination:** `src/components/shared/settings/IntegrationConnectionsSection.tsx`
already owns OAuth connect/disconnect/reconnect for all providers,
including GBP. Two enhancements:

1. **Auto-trigger the picker on successful GBP connect.** `OAuthResultBanner`
   inside the section reads `?integration=google_business_profile&integration_status=connected`
   from the URL. When detected, also auto-open `GbpLocationPickerModal`
   (already built; this just changes its trigger).
2. **Show GBP location summary on the GBP connection row.** When the GBP
   provider's connection is `active` AND a `client_gbp_locations` row
   exists, surface the location title + last sync time + "Change location"
   link on the existing connection row (using `useClientGbpLocation` —
   already built). No new component — extend `ConnectionRow` for the
   GBP provider only with a small footer block.

The "Sync now" affordance moves onto the same connection row as a
secondary button.

### Piece 5: `/settings/google-business` route

**Delete it.** Plus:

- Delete `src/components/shared/settings/GbpLocationSection.tsx` (logic
  moves into `IntegrationConnectionsSection` enhancement).
- Delete `src/components/shared/settings/GbpReviewsSection.tsx` (logic
  moves into `ReviewItem` extension + the reviews pages).
- Delete `src/components/shared/settings/GbpReviewRequestsSection.tsx`
  (table view moves into lead timeline; modal extracted to a reusable
  button component).
- `GbpLocationPickerModal` stays — re-triggered from
  `IntegrationConnectionsSection`.
- Remove the `Google Business` tab from `subAccountSettingsNav`.
- Remove `'/settings/google-business'` from `SUB_ACCOUNT_ONLY` in
  `src/app/settings/layout.tsx`.

## UI without an obvious existing home

None. Every piece maps cleanly onto an existing surface (reviews page,
lead timeline, lead quick actions, booking actions, integration
connection row). The closest call was the request audit — between
"timeline event on the lead" and "new audit log section on the lead".
Going with the timeline event because: (a) the rest of the lead
timeline already carries SMS sent / email sent events, so a
review-request fits the same vocabulary; (b) a separate section under
the timeline would duplicate the chronology; (c) the attribution
("✓ Review left" within 7 days) is one more line on a timeline event,
not a separate column.

## Action plan (executed in this PR)

1. Re-source `useClientReviews()` + `useAdminReviews()` from
   `gbp_reviews` and extend `ReviewItem` shape with reply fields.
2. Extend `ReviewItem` component with inline reply UI; wire via
   `useReplyToGbpReview(clientId)` from the parent.
3. Add `'review-request'` to `LeadTimelineDot`; emit review-request
   events in `buildLeadDetail`.
4. Extend `LeadQuickAction` with `onClick?: () => void`; extend
   `LeadQuickActions` renderer to dispatch button clicks; emit the new
   `'Send review request'` action from `buildLeadDetail`.
5. Add `'Send review request'` to client booking action group; render
   via the same shared `GbpSendRequestButton`; mount the button in the
   admin booking hero.
6. Extract the manual-send modal body into
   `src/components/shared/gbp/GbpSendRequestButton.tsx`.
7. Extend `OAuthResultBanner` (or a sibling effect in
   `IntegrationConnectionsSection`) to auto-mount `GbpLocationPickerModal`
   on the GBP success URL.
8. Extend `ConnectionRow` GBP-only footer block with location summary +
   "Sync now" + "Change location" affordances.
9. Delete `/settings/google-business` page; delete the 3 dependent
   section components; remove nav + layout-guard entries.

Zero new top-level navigation. Zero new dedicated tabs. All GBP
functionality reachable from established surfaces.

## Constraints honoured

- No backend changes (migrations 0066–0069 stay; job handlers stay; API
  routes stay; `lib/integrations/gbp/` stays).
- The lib-layer query files (`src/lib/reviews/queries.tsx`,
  `src/lib/leads/queries.tsx`) ARE touched — these are UI-data
  plumbing, not the GBP integration backend, and the move requires
  re-sourcing reviews + emitting new lead events.
- No visual redesign — every change is a small extension to an
  existing component (one inline reply affordance on `ReviewItem`, one
  `onClick` branch on `LeadQuickActions`, one timeline-dot tone, one
  modal-button extraction).
- Both operator + client contexts get every GBP affordance through
  their existing surfaces.
