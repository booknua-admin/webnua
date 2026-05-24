# Client context audit — sidebar selector consistency

> Read-only audit. No code changes. Enumerates every route under `src/app/`,
> classifies how each handles the operator's agency-vs-sub-account workspace
> mode, and proposes a migration plan to bring the inconsistent surfaces into
> line with the settled `/dashboard` / `/website` / `/funnels` / `/settings/*`
> pattern.

## 0. Mental model recap

Three user populations, three relationships with the sidebar client picker
(`src/components/admin/AdminClientPicker.tsx`):

- **OPERATOR · agency mode** — `useIsAgencyMode() === true`. No client picked
  in the sidebar. Should see cross-client / aggregate views.
- **OPERATOR · sub-account mode** — `useIsAgencyMode() === false`,
  `useWorkspace().activeClientId === <slug>`. Drilled into one client via the
  picker. Should see that one client's data through the SAME screens a client
  would see, but with operator capabilities layered in (edit, override,
  break-glass).
- **CLIENT** — `useRole() === 'client'`. No mode axis. Always scoped to
  `user.clientId`. Picker is hidden in `ClientSidebar`.

Mode is **state-driven**, not URL-driven. The active client id lives in
`localStorage` under `webnua.dev.active-client-id`
(`src/lib/workspace/workspace-stub.tsx:32`) and is read via
`useWorkspace().activeClientId` (slug) / `useActiveClient()` (object) /
`useIsAgencyMode()` (boolean sugar). Switching the sidebar picker fires a
custom event that `useSyncExternalStore` re-reads — no URL change.

The settled pattern (the one CLAUDE.md identifies as the platform standard)
is **state-driven dispatch inside the route**: a `'use client'` `page.tsx`
reads `useIsAgencyMode()` and renders one of two siblings —
`_admin-content.tsx` (agency-mode body), `_sub-account-content.tsx` /
`_hub-content.tsx` / `_client-content.tsx` (sub-account / client body). URL
stays clean. Three reference precedents: `/dashboard`, `/website`,
`/funnels`. `/settings/*` adopts a variant — `useSettingsNav()` resolves
the visible tab set per mode + a layout guard bounces direct-URL access to
a wrong-mode tab.

## 1. Full route inventory

Every `page.tsx` under `src/app/`. The "Mode handling" column tracks what
the route does TODAY when an operator's sidebar selection changes. The
"Verdict" column maps to the four classifications in section 2.

### 1.1 Top-level / shared routes (live outside the role groups because the URL space is shared between both roles)

| Path | File | Layout | Mode handling | Verdict |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | root | redirect → `/dashboard` (n/a) | n/a |
| `/dashboard` | `src/app/dashboard/page.tsx` | `dashboard/layout.tsx` | **dispatches**: admin + agency → `_admin-content` (cross-client roster); admin + sub-account → `_hub-content` (single-client overview hub); client → `_client-content` | **MODE-DISPATCHED** ✅ |
| `/website` | `src/app/website/page.tsx` | `website/layout.tsx` | resolves `activeClientId = role==='client' ? user.clientId : workspace.activeClientId`; admin + no client → `AgencyEmptyState` (drill tiles); admin + client → that client's hub; client → their hub | **MODE-DISPATCHED** ✅ |
| `/website/new` | `src/app/website/new/page.tsx` | website | reads `workspace.activeClientId` | **CLIENT-SPECIFIC** (operator scoped via workspace) |
| `/website/[pageId]` | `src/app/website/[pageId]/page.tsx` | website | reads `workspace.activeClientId` | **CLIENT-SPECIFIC** |
| `/website/header` | `src/app/website/header/page.tsx` | website | reads `workspace.activeClientId` | **CLIENT-SPECIFIC** |
| `/website/footer` | `src/app/website/footer/page.tsx` | website | reads `workspace.activeClientId` | **CLIENT-SPECIFIC** |
| `/website/review` | `src/app/website/review/page.tsx` | website | reads `workspace.activeClientId` | **CLIENT-SPECIFIC** |
| `/funnels` | `src/app/funnels/page.tsx` | `funnels/layout.tsx` | resolves `activeClientId` same as `/website`; admin + no client → `AdminAgencyRoster`; admin + client → that client's list; client → their list | **MODE-DISPATCHED** ✅ |
| `/funnels/[id]` | `src/app/funnels/[id]/page.tsx` | funnels | id-scoped detail; no workspace read (uses id directly) | **CLIENT-SPECIFIC** (id is the scope) |
| `/funnels/[id]/edit/[stepId]` | same | funnels | id-scoped editor | **CLIENT-SPECIFIC** |
| `/funnels/[id]/review` | same | funnels | id-scoped | **CLIENT-SPECIFIC** |
| `/leads` | `src/app/leads/page.tsx` | `leads/layout.tsx` | role dispatcher only (`admin` → `_admin-content`; `client` → `_client-content`). `_admin-content` reads `useIsAgencyMode()` + `activeClientId` and **filters the cross-client roster** down to the selected client when one is set; the page chrome (hero, tabs, client multi-select) stays roster-shaped either way | **AMBIGUOUS** — narrows data but does not switch shape |
| `/leads/[id]` | `src/app/leads/[id]/page.tsx` | leads | role dispatcher only; no workspace read | **CLIENT-SPECIFIC** (id is scope) |
| `/leads/[id]/conversation` | `src/app/leads/[id]/conversation/page.tsx` | leads | role dispatcher only | **CLIENT-SPECIFIC** |
| `/calendar` | `src/app/calendar/page.tsx` | `calendar/layout.tsx` | role dispatcher. `_admin-content` reads workspace, **filters bookings in the grid** to the selected client; grid + legend + today-panel chrome stays cross-client-shaped (just narrowed) | **AMBIGUOUS** — narrows data but does not switch shape |
| `/tickets` | `src/app/tickets/page.tsx` | `tickets/layout.tsx` | role dispatcher only. `_admin-content` has its OWN per-tab client multi-select but **does not read workspace context at all** — sidebar selection is ignored | **AMBIGUOUS / BROKEN** — ignores selector |
| `/tickets/[id]` | `src/app/tickets/[id]/page.tsx` | tickets | role dispatcher only | **CLIENT-SPECIFIC** (id is scope) |
| `/tickets/new` | `src/app/tickets/new/page.tsx` | tickets | shared form, no workspace read | mixed — see notes |
| `/automations` | `src/app/automations/page.tsx` | `automations/layout.tsx` | role dispatcher. `_admin-content` reads workspace, **filters groups** to the selected client; chrome (hero, stats, multi-select) stays roster-shaped | **AMBIGUOUS** |
| `/automations/[id]` | `src/app/automations/[id]/page.tsx` | automations | id-scoped editor; no workspace read | **CLIENT-SPECIFIC** (id is scope) |
| `/campaigns` | `src/app/campaigns/page.tsx` | `campaigns/layout.tsx` | role dispatcher. `_admin-content` reads workspace, **filters rows** to the selected client; chrome stays roster-shaped. The client deep-dive (`_client-content`) renders a fundamentally different rich UI (managed band, hero card, trend chart, activity, change CTA) that operators in sub-account mode never see | **AMBIGUOUS / BROKEN** — shape divergence between roles |
| `/reviews` | `src/app/reviews/page.tsx` | `reviews/layout.tsx` | role dispatcher. `_admin-content` reads workspace, **filters per-client cards** to one; same shape narrowed. Client side (`_client-content`) renders a single-business summary (rating headline, distribution bars, callout, GBP connect) that operators in sub-account mode never see | **AMBIGUOUS / BROKEN** — shape divergence between roles |
| `/bookings/[id]` | `src/app/bookings/[id]/page.tsx` | `bookings/layout.tsx` | role dispatcher only; id-scoped detail | **CLIENT-SPECIFIC** |
| `/bookings/[id]/complete` | `src/app/bookings/[id]/complete/page.tsx` | bookings | id-scoped flow | **CLIENT-SPECIFIC** |
| `/search` | `src/app/search/page.tsx` | `search/layout.tsx` | reads `useRole()` only; hardwires `scope = role==='admin' ? 'admin' : 'client'`. **Workspace selection is ignored** — an operator in sub-account mode searches cross-client | **AMBIGUOUS / BROKEN** — ignores selector |

### 1.2 `/settings/*` (shared-slug tabs, mode-dispatched via layout + nav)

`src/app/settings/layout.tsx` is the layout guard: AGENCY_ONLY and SUB_ACCOUNT_ONLY tab lists bounce direct-URL access to a wrong-mode tab back to `/settings`. `useSettingsNav()` resolves the visible tab set per mode. The tab pages themselves are either single-mode or shared-slug dispatchers.

| Path | File | Mode | Notes |
|---|---|---|---|
| `/settings` | `src/app/settings/page.tsx` | shared | reads `useWorkspace().activeClientId`, redirects to the mode-appropriate landing tab | **MODE-DISPATCHED** ✅ |
| `/settings/access` | `src/app/settings/access/page.tsx` | both | reads workspace; agency mode renders the cross-client roster, sub-account mode renders the cap grid + seat-limit card for that client | **MODE-DISPATCHED** ✅ |
| `/settings/billing` | `src/app/settings/billing/page.tsx` | both | `'use client'` role+mode dispatcher → `_admin-content` (agency) / `_sub-account-content` (sub-account) / `_client-content` (client) | **MODE-DISPATCHED** ✅ |
| `/settings/integrations` | `src/app/settings/integrations/page.tsx` | both | same shape as billing — three siblings | **MODE-DISPATCHED** ✅ |
| `/settings/team` | `src/app/settings/team/page.tsx` | both | role dispatcher (`_admin-content` / `_client-content`) | **MODE-DISPATCHED** ✅ |
| `/settings/notifications` | `src/app/settings/notifications/page.tsx` | sub-account + client | reads workspace for guard; layout `SUB_ACCOUNT_ONLY` enforces | scoped ✅ |
| `/settings/email` | `src/app/settings/email/page.tsx` | sub-account | reads workspace; SUB_ACCOUNT_ONLY guard | scoped ✅ |
| `/settings/sms` | `src/app/settings/sms/page.tsx` | sub-account | reads workspace; SUB_ACCOUNT_ONLY guard | scoped ✅ |
| `/settings/profile` | `src/app/settings/profile/page.tsx` | sub-account (or client) | SUB_ACCOUNT_ONLY for operators | scoped ✅ |
| `/settings/workspace` | `src/app/settings/workspace/page.tsx` | agency only | AGENCY_ONLY guard | scoped ✅ |
| `/settings/plans` | `src/app/settings/plans/page.tsx` | agency only | AGENCY_ONLY guard | scoped ✅ |
| `/settings/defaults` | `src/app/settings/defaults/page.tsx` | agency only | AGENCY_ONLY guard | scoped ✅ |
| `/settings/seats` | `src/app/settings/seats/page.tsx` | agency only | AGENCY_ONLY guard | scoped ✅ |
| `/settings/api` | `src/app/settings/api/page.tsx` | agency only | AGENCY_ONLY guard | scoped ✅ |
| `/settings/platform-templates` | `src/app/settings/platform-templates/page.tsx` | agency only (admin only) | AGENCY_ONLY guard | scoped ✅ |
| `/settings/security` | `src/app/settings/security/page.tsx` | user-level | orthogonal to workspace mode | n/a |
| `/settings/help` | `src/app/settings/help/page.tsx` | global | static | n/a |
| `/settings/danger` | `src/app/settings/danger/page.tsx` | both | static | n/a |

### 1.3 `(admin)/` route group — admin-only by URL space

These routes have no client analogue. Live inside `(admin)/` because both layouts (admin sidebar + `AppShell`) apply uniformly. The picker is rendered in the sidebar but the routes themselves are agency-level by intent.

| Path | File | Notes |
|---|---|---|
| `/clients/new` | `src/app/(admin)/clients/new/page.tsx` | hosts the `CreateClientButton`; agency-level | **CROSS-CLIENT** ✅ |
| `/clients/new/result` | `src/app/(admin)/clients/new/result/page.tsx` | after a successful create, calls `setActiveClientId` to switch into the new sub-account | **CROSS-CLIENT** ✅ (then transitions) |
| `/websites` | `src/app/(admin)/websites/page.tsx` | cross-client matrix; "Open →" calls `setActiveClientId` + routes to `/website` | **CROSS-CLIENT** ✅ |

### 1.4 `(client)/` route group — client-only by URL space

| Path | File | Notes |
|---|---|---|
| `/recurring/new` | `src/app/(client)/recurring/new/page.tsx` | reads `user.clientId` directly; no admin analogue today (Phase 5 placement). | **CLIENT-SPECIFIC** |

### 1.5 `(auth)/` group

| Path | File | Notes |
|---|---|---|
| `/login` | `src/app/(auth)/login/page.tsx` | unauthenticated | n/a |

### 1.6 `/dev/*` and `/published/*`

`/dev/sections` is off-nav developer utility — n/a. `/published/[host]/[[...slug]]` is the public renderer for the generated sites — host-scoped, not workspace-scoped.

## 2. Classification

### MODE-DISPATCHED ✅ — already correctly branches on mode

- `/dashboard` (gold standard — three siblings)
- `/website` and every nested editor (resolves active client into the hub or renders an agency empty state with drill tiles)
- `/funnels` (mirrors `/website`)
- `/settings/*` (whole tree, via layout guard + `useSettingsNav()` + per-tab three-sibling dispatchers where appropriate)

### CLIENT-SPECIFIC ✅ — id-scoped or client-scoped, no roster shape

- `/website/[pageId]`, `/website/header`, `/website/footer`, `/website/new`, `/website/review` (read `workspace.activeClientId`)
- `/funnels/[id]` and its `edit/[stepId]` + `review` children (id IS the scope; tenancy enforced via RLS on the funnel id)
- `/automations/[id]` (id is scope)
- `/tickets/[id]`, `/leads/[id]`, `/leads/[id]/conversation`, `/bookings/[id]`, `/bookings/[id]/complete` (id is scope)
- `/(client)/recurring/new` (client-only URL space)

### CROSS-CLIENT ✅ — intentionally agency-level, no sub-account version

- `/(admin)/websites` (the cross-client matrix; complements `/website` sub-account mode)
- `/(admin)/clients/new`, `/(admin)/clients/new/result`
- `/settings/workspace`, `/settings/plans`, `/settings/defaults`, `/settings/seats`, `/settings/api`, `/settings/platform-templates` (agency HQ tabs)

### AMBIGUOUS / BROKEN ❌ — the audit's punchlist

Five routes:

1. **`/tickets`** — `_admin-content.tsx` does not import `useWorkspace`. The cross-client multi-select inside the page is the only filter; the sidebar selection is ignored. An operator drilled into one client still sees every client's tickets.
2. **`/leads`** — `_admin-content.tsx` reads workspace and narrows the row list, but the page chrome (hero copy "Lead inbox · cross-client view", the `ClientMultiSelect` filter, the cross-client tab counts) stays roster-shaped. There is no "single-client inbox" sub-account variant despite a perfectly-good `_client-content.tsx` already implementing the right shape.
3. **`/calendar`** — same pattern as `/leads`. Workspace narrows the bookings shown in the grid + filter the legend + today-panel, but the screen is still framed as the cross-client grid (the client `_client-content` is a different shape with its own hero + composition).
4. **`/automations`** — same pattern. Cross-client group roster stays, narrowed to one client. There is a `_client-content.tsx` with the single-business toggle-cards shape that an operator drilled into a sub-account never gets to see.
5. **`/campaigns`** — same pattern, with the largest shape divergence. The client deep-dive (`CampaignManagedBand` + `CampaignHeroCard` + `CampaignTrendChart` + `CampaignActivityCard` + `CampaignChangeCard`) is a richer surface than the roster row + stat tiles. An operator who picked a client expects the deep-dive, gets the row.

**`/reviews`** is on the border. The roster narrows to one client card; the per-client card already contains the rating + recent-reviews data the client deep-dive has, so the divergence is smaller than `/campaigns`. But the client side has a single-business hero, GBP connect panel, and negative-review intercept that operators never see. Classify as **AMBIGUOUS**.

**`/search`** is an honest break — it hardwires admin scope and never narrows. An operator in sub-account mode searching for "anna" probably wants results limited to that client. Classify as **AMBIGUOUS**.

## 3. Current behavior per route

For the AMBIGUOUS / BROKEN routes, three viewers:

### `/tickets`

| Viewer | What they see today |
|---|---|
| Operator · agency mode | Cross-client tickets inbox + the page's own client multi-select (works as expected) |
| Operator · sub-account mode | **Identical** to agency mode — sidebar selection has no effect. To filter to the picked client, the operator must use the in-page multi-select. |
| Client | Their own tickets inbox via `_client-content` |

### `/leads`

| Viewer | What they see today |
|---|---|
| Operator · agency mode | Cross-client lead inbox, `ClientMultiSelect` at top, all stats / hero / tab counts reflect every client |
| Operator · sub-account mode | Same chrome; `selectedClients` is overridden to `[activeClientId]` internally so rows narrow, but the hero still says "across every client", the `ClientMultiSelect` is replaced with a `WorkspaceContextBanner`, tab counts narrow. **Half-converted** — data narrows, framing does not. |
| Client | Their own inbox via `_client-content` (different hero, no multi-select) |

### `/calendar`

| Viewer | What they see today |
|---|---|
| Operator · agency mode | Cross-client week grid (every client's bookings colour-keyed), legend, today panel |
| Operator · sub-account mode | Same grid; bookings filtered to one client; legend still cross-client-shaped (just narrowed); today panel still cross-client-shaped |
| Client | `_client-content` — different framing entirely (single-business weekly view) |

### `/automations`

| Viewer | What they see today |
|---|---|
| Operator · agency mode | Cross-client roster grouped by automation type (`Instant confirm` group, `24h follow-up` group, …), each group lists every client's flows |
| Operator · sub-account mode | Same grouped roster; flows filtered to one client; per-group enabled counts narrow |
| Client | `_client-content` — single-business toggle cards with stats (sent / delivered / etc.) — different surface |

### `/campaigns`

| Viewer | What they see today |
|---|---|
| Operator · agency mode | Cross-client roster (one row per campaign per client, status pill, leads-per-week, spend, CPL, sparkline) |
| Operator · sub-account mode | Same roster, narrowed to one client's campaigns. **NOT** the rich `ClientCampaignsContent` deep-dive the client sees. |
| Client | The deep-dive: managed band + active hero card + 4-week trend chart + activity log + "want to change something?" CTA |

### `/reviews`

| Viewer | What they see today |
|---|---|
| Operator · agency mode | Workspace stats + per-client `ReviewClientCard` grid |
| Operator · sub-account mode | Same; cards narrow to one. NOT the client single-business view. |
| Client | Single-business rating headline + distribution bars + recent reviews + GBP connect panel + negative-review intercept trigger |

### `/search`

| Viewer | What they see today |
|---|---|
| Operator (either mode) | `scope='admin'` — cross-tenant results. The sidebar selection is ignored. |
| Client | `scope='client'` — own-tenant results. |

## 4. Inconsistencies and bugs

1. **`/tickets` admin content does not import `useWorkspace` at all.** Direct hole — the sidebar selection has zero effect on the tickets inbox. Every other workspace-aware roster (leads, calendar, automations, campaigns, reviews) at least narrows the data; tickets is the only one that ignores it outright.
2. **`/leads`, `/calendar`, `/automations`, `/campaigns`, `/reviews` are "half-dispatched".** Each one reads workspace and narrows the row list / grid / cards, but the page chrome and shape stay agency-roster-flavoured. The result is a screen that:
   - shows the sub-account's data, ✓
   - but in a UI designed for triage across many clients (cross-client multi-select replaced with a banner that says "you're in client X", roster-style stats, no deep-dive composition).
   - The client-role view (`_client-content`) is a fundamentally different and richer per-client shape that operators in sub-account mode never see.
3. **Shape divergence between operator-in-sub-account and client is widest on `/campaigns` and `/reviews`.** A client gets the single-business deep-dive; an operator drilled into the same client gets a one-row roster shadow. Operationally the operator wants the deep-dive AND the operator capabilities (edit, override, force) on top.
4. **`/tickets` and `/leads` redundantly carry an in-page `ClientMultiSelect`** when in agency mode. The sidebar picker is the canonical way to scope; the in-page filter duplicates the affordance with a different semantic (single-select sidebar = "drill in"; in-page multi-select = "narrow agency view"). The multi-select pattern was useful when the sidebar selection did nothing for that surface; once mode-dispatch lands it stays useful only for the narrower "show me clients A + B but not the others" case — and that use case has yet to surface in practice.
5. **`/search` does not narrow on sub-account.** An operator inside a sub-account searches across every tenant. Two paths forward — narrow the scope, or leave it cross-client and label it explicitly so the operator knows.
6. **No client-side sidebar mounts the picker** (correct), but the `/dashboard` cross-client roster's "drill in" entry tiles + `/website` `AgencyEmptyState` drill tiles + the matrix's "Open →" all use the picker to switch context — the operator has three different visual entry points to drilling in (sidebar picker, drill-tile, matrix "Open"). Each one fires `workspace.setActiveClientId(id)`. This redundancy is fine (multiple entry points are correct), but it makes the inconsistency in step 2 above more obvious — once the operator has drilled in (by any path), the URL doesn't change and most surfaces still show a roster.

## 5. Proposed correct behavior

The settled pattern (`/dashboard`, `/website`, `/funnels`) is: **agency mode renders one shape; sub-account mode renders the SAME shape the client sees, augmented with operator capabilities**. The same shape isn't always literally `_client-content` re-used — `/dashboard` has a distinct `_hub-content.tsx` because the operator hub needs the operator-action bar — but the framing and composition match the single-business view, not the roster.

Apply that to each problem route:

### `/tickets`

- **Agency mode** — keep `_admin-content` shape (cross-client tickets inbox + multi-select for narrow filtering + stats).
- **Sub-account mode** — render a sub-account-flavoured ticket inbox (single client's tickets, framed as "FreshHome's tickets", no client column or per-row client pill, but still operator's full set of actions). Either:
  - reuse `_client-content` shape with operator chrome bolted on (the way `_hub-content` reuses ClientHub), or
  - build a `_sub-account-content` sibling.
- **Client** — unchanged (`_client-content`).

### `/leads`

- **Agency mode** — keep `_admin-content` shape.
- **Sub-account mode** — render the same shape `_client-content` renders (single-client inbox, hero scoped to that client, no `ClientMultiSelect`, no "across every client" framing) with operator action affordances layered in.
- **Client** — unchanged.

### `/calendar`

- **Agency mode** — keep the cross-client grid with the legend + per-client colour key + today panel grouped by client.
- **Sub-account mode** — render the single-client weekly grid (no per-client legend, no cross-client today panel) — the framing the client sees.
- **Client** — unchanged.

### `/automations`

- **Agency mode** — keep the grouped roster.
- **Sub-account mode** — render the client-shape stats-cards-per-flow view, with operator-level toggle + the operator's editor entry point per row.
- **Client** — unchanged.

### `/campaigns`

- **Agency mode** — keep the cross-client roster + workspace stats.
- **Sub-account mode** — render the `ClientCampaignsContent` shape (managed band + hero card + trend chart + activity + change CTA) with operator additions: launch-Meta button (already exists), "↻ Sync campaigns", paus/resume affordance, plus the change CTA pointing to `/tickets/new` *as well as* operator-direct editing where appropriate.
- **Client** — unchanged.

### `/reviews`

- **Agency mode** — keep workspace stats + per-client card grid.
- **Sub-account mode** — render the client single-business shape (rating headline + distribution bars + callout + recent reviews list), with operator reply affordances enabled.
- **Client** — unchanged.

### `/search`

- **Agency mode** — admin scope, cross-tenant.
- **Sub-account mode** — client scope, narrowed to `activeClientId`. The header should make this explicit ("Searching FreshHome only · clear scope") so the operator sees the constraint and can clear it.
- **Client** — unchanged.

## 6. Architectural recommendation

**Keep state-driven dispatch.** Three reference precedents (`/dashboard`,
`/website`, `/funnels`, plus the `/settings/*` variant) means the pattern is
settled. Switching to URL-based scoping (`/clients/[id]/leads`) at this
stage would:

- break every existing bookmark and deep-link to a stub-era roster URL,
- duplicate the bulk of the route tree (every shared surface gets a
  `(client)/[id]/` mirror),
- require an extra resolver everywhere that today reads
  `useWorkspace().activeClientId`,
- not solve the shape-divergence problem on its own — `/clients/[id]/leads`
  still needs to render the per-client inbox shape, which is the actual
  work.

The state-driven approach gets sub-account scoping correct with one
additional rendering branch per affected route — five routes — without
touching the URL space or any consumer of `useWorkspace`.

### What "state-driven dispatch" means concretely for the migration

For each AMBIGUOUS / BROKEN route, the recipe matches `/dashboard`:

1. `app/<route>/page.tsx` becomes a thin `'use client'` dispatcher (most
   already are role dispatchers — extend them with a mode dispatch on the
   admin branch).
2. Add a `_sub-account-content.tsx` sibling that renders the single-client
   shape with operator capabilities. For some routes this can simply be
   `_client-content.tsx` extended via a `viewerRole: 'operator' | 'client'`
   prop (the lightest possible extension); for others (`/campaigns`,
   `/reviews`) it warrants a dedicated sibling because the operator
   capabilities are non-trivial.
3. The `_admin-content.tsx` keeps its current cross-client shape and stays
   the agency-mode body. **Drop the in-page `ClientMultiSelect`** unless an
   actual need for two-client-at-once narrowing emerges — it duplicates the
   sidebar.
4. Cross-tenant-only routes (`/(admin)/websites`, `/settings/workspace`,
   `/settings/plans`, …) stay agency-only. When an operator in sub-account
   mode reaches one of these, the existing `/settings/layout.tsx` guard
   pattern bounces them back to `/settings` (the index, which then routes
   to a mode-appropriate landing tab).

### How redirects should work

Two cases:

1. **Operator picks a client and lands on an agency-only screen.** The
   layout guard fires and redirects to the same screen's mode-appropriate
   sibling — typically the sub-account index for that domain. `/settings`
   already does this; extend the same pattern to `/(admin)/websites` (if
   the operator's in sub-account mode and hits `/websites`, redirect to
   `/website`).
2. **Operator clears the picker on a screen that needs a client.** The
   `/website` `AgencyEmptyState` is the precedent — render an explicit
   "pick a client" empty state with drill tiles, don't redirect to
   `/clients`. The "drill tiles" pattern is a real affordance, not just an
   error state.

### RLS interaction

**None of this affects security.** `accessible_client_ids()` in Supabase RLS
already scopes every row, so a client-role user reading `/leads` cannot see
another tenant's leads even if the UI somehow asked for them. The audit is
**purely UI/UX scoping** — the question is "what does the operator expect
to see" not "what is the user allowed to see". Get the UI right; RLS
already has the security side covered. (The standing RLS validation
follow-up `reference/rls-test-suite.md` covers the security side
separately.)

## 7. Migration plan

Ordered by dependency: shared primitives first, then thin extensions, then
the bigger shape divergences.

### Session 0 — pick the API shape (optional planning session, no code)

Decision points:
- Does `_sub-account-content` reuse `_client-content` with a `viewerRole`
  prop, or do we sibling them outright? Either is defensible; favour
  prop-extension for the routes whose operator-additions are small
  (`/calendar`, `/leads`, `/automations`, `/reviews`) and siblings for the
  routes whose operator-additions are non-trivial (`/campaigns`,
  `/tickets`).
- Do we keep the in-page `ClientMultiSelect` on agency-mode rosters, or
  drop it? Recommend drop unless a concrete narrow-to-N-clients use case
  exists.
- What `viewerRole='operator'` flips: edit affordances, hide capability
  gating in favour of always-on, show the operator action bar where
  applicable.

### Session 1 — `/tickets` (small)

`_admin-content.tsx` adds `useIsAgencyMode()` + `useWorkspace()`. When
sub-account, narrow the inbox to `clientSlug === activeClientId`, switch
hero copy, hide the per-row client pill, hide the in-page multi-select.
No new sibling needed for V1.

- Files: `src/app/tickets/page.tsx`, `src/app/tickets/_admin-content.tsx`.
- Complexity: SMALL.
- RLS implications: none.

### Session 2 — `/leads` sub-account variant (small)

Either: (a) `_admin-content.tsx` reads workspace and switches the chrome
(hero, drop multi-select, drop client pills) in addition to narrowing the
rows; or (b) extend `page.tsx` to render `_client-content` with a
`viewerRole='operator'` prop when in sub-account. (a) is the smaller diff;
(b) is the cleaner pattern. Recommend (b) — it matches the
`_admin-content` / `_sub-account-content` split the other routes will
need anyway.

- Files: `src/app/leads/page.tsx`, `src/app/leads/_client-content.tsx`
  (add `viewerRole` prop), possibly `src/app/leads/_sub-account-content.tsx`
  as a thin wrapper.
- Complexity: SMALL.
- RLS implications: none.

### Session 3 — `/calendar` sub-account variant (small/medium)

Same shape as `/leads`. Drop the per-client legend + cross-client today
panel in sub-account mode.

- Files: `src/app/calendar/page.tsx`, `_client-content.tsx`, possibly
  `_sub-account-content.tsx`.
- Complexity: SMALL — MEDIUM (the calendar grid is the most data-heavy of
  the five; verify the read-side `useAdminCalendar` query narrows
  correctly when fed a single client id, otherwise switch to
  `useClientCalendar` keyed on the active client).
- RLS implications: none.

### Session 4 — `/automations` sub-account variant (medium)

Render the client toggle-card shape but with operator chrome (edit
affordance per flow, the editor entry point per row, the operator's
forced-publish-ish "Test send" affordance where applicable). The client
shape already exists; the operator additions are roughly the existing
`_admin-content` row affordances mapped onto the client card shape.

- Files: `src/app/automations/page.tsx`, `_client-content.tsx`,
  `_sub-account-content.tsx` (new sibling recommended — the operator
  additions are non-trivial).
- Complexity: MEDIUM.
- RLS implications: none.

### Session 5 — `/reviews` sub-account variant (medium)

Render the client single-business shape. Operator additions: reply
composer on every review row (already wired for the client too), GBP
"sync now" + "change location" affordances (already on
`/settings/integrations` but a quick-link from `/reviews` sub-account is
sensible).

- Files: `src/app/reviews/page.tsx`, `_client-content.tsx`,
  `_sub-account-content.tsx` (new sibling).
- Complexity: MEDIUM.
- RLS implications: none.

### Session 6 — `/campaigns` sub-account variant (medium/large)

The biggest shape change. Render the client deep-dive (managed band, hero
card with metrics, trend chart, activity, change CTA) for the operator,
with operator-only chrome layered in: launch / sync Meta buttons (exist),
the per-campaign pause/resume + the "change CTA" pointing operator-side
to direct editing where capability permits.

- Files: `src/app/campaigns/page.tsx`, `_client-content.tsx`,
  `_sub-account-content.tsx` (new sibling), possibly extract a
  `CampaignDeepDive` shared composition that both `_client-content` and
  `_sub-account-content` render.
- Complexity: MEDIUM — LARGE.
- RLS implications: none.

### Session 7 — `/search` mode awareness (small)

Read `useIsAgencyMode()` + `useWorkspace()`. In sub-account mode, narrow
the search scope to `activeClientId` (the `useSearch` hook needs a
`scope: 'admin' | 'client' | { kind: 'sub-account', clientId }` extension,
or just pass an extra clientId arg). Header banner explains the scope.

- Files: `src/app/search/page.tsx`, `src/lib/search/queries.tsx` (extend
  to accept a client filter).
- Complexity: SMALL.
- RLS implications: none — RLS already scopes; this is just the query
  filter.

### Session 8 — sidebar / cross-tenant link guards (small, optional)

The `/(admin)/websites` matrix and a couple of other agency-only routes
that don't have a settings-style layout guard should redirect operators
in sub-account mode to the sub-account analogue (e.g. `/websites`
sub-account → `/website`). One small effect in each route's `page.tsx`,
or generalise into a shared layout guard.

- Files: `src/app/(admin)/websites/page.tsx`.
- Complexity: SMALL.
- RLS implications: none.

### Order

Sessions 1 → 2 → 3 → 7 are the "small wins" — they close the obvious
gaps with minimal risk. Sessions 4 → 5 → 6 are the bigger shape changes
and benefit from doing the small ones first to nail the pattern (the
`viewerRole` prop / `_sub-account-content` sibling decision settles
early). Session 8 is an optional cleanup.

## 8. Risks and gotchas

- **Existing bookmarks** — no URLs change, so bookmarks survive. The
  shape changes underneath; an operator who bookmarked
  `/leads?client=freshhome` (no such param exists today) — fine. An
  operator who relied on the in-page `ClientMultiSelect` to filter agency
  mode to specific clients loses that affordance if we drop it; the
  workaround is one sidebar click (drill in to that client). Worth a
  callout in release notes; not a blocker.
- **Client UX** — completely unaffected. The five `_client-content.tsx`
  bodies stay the same shape they are today. The risk is that we extend
  them with a `viewerRole` prop and accidentally regress the client
  branch; mitigated by keeping the client branch as the default
  (`viewerRole = 'client'`) and only flipping under the sub-account
  branch.
- **Operator intentional cross-tenant work** — there are a few moments
  where an operator legitimately wants the cross-client view even while
  drilled into a sub-account. The "← back to agency" return button in
  `WorkspaceContextBanner` is the existing recovery path; verify it stays
  prominent on every sub-account screen post-migration.
- **Two queries per route** — for narrowing, today's
  `_admin-content` reads `useAdminLeadsInbox` (cross-client) and filters
  client-side. The cleaner version reads `useClientLeadsInbox`
  parameterised by `activeClientId` — a different query that returns less
  data. Either path works; choose the per-route based on whether the
  cross-client query has a meaningful overhead at sub-account zoom.
- **Hub vs `_sub-account-content` confusion** — `/dashboard` uses
  `_hub-content` because the single-client overview hub needs the operator
  action bar etc. The new sibling pattern is `_sub-account-content`. We
  could rename `_hub-content` to `_sub-account-content` for consistency,
  but that's a churn-for-the-sake-of-it move and the hub name has
  semantic value (it's a hub, not just a sub-account body). Recommend:
  leave `/dashboard/_hub-content` alone; use `_sub-account-content`
  going forward as the canonical name where the body doesn't have a more
  specific semantic.
- **Capability layer interaction** — the capability layer
  (`CapabilityGate`, the 14 caps) is orthogonal to mode dispatch and works
  the same for an operator in sub-account mode as for a client in their
  own workspace. Operators have `ADMIN_DEFAULTS` (every cap), so every
  affordance is present and live; clients have `CLIENT_DEFAULTS`
  (`viewBuilder` only) plus per-website grants. The `_sub-account-content`
  bodies should NOT hard-code "operator means show this button" — let the
  cap layer drive it the way `_client-content` already does. Cleaner and
  it means a client-with-grants and an operator look almost identical on
  the same screen (which is the right model).
- **The Topbar `hideSearch` opt-out** — some surfaces (admin leads + admin
  tickets inboxes) suppress the auto-rendered operator search input because
  they carry their own in-body search. If we narrow these to sub-account
  shape and drop the in-body search, remember to also drop `hideSearch` so
  the topbar search returns. Easy to miss.

## 9. Open questions

These need operator (the human) input before sessions 1–8 land. Pasted
verbatim so the fix session has them.

1. **In-page `ClientMultiSelect` — drop, keep, or move?** Currently
   present on agency-mode `/leads`, `/calendar`, `/automations`,
   `/campaigns`, `/reviews`. The sidebar picker is a single-select; the
   in-page version is multi-select ("show clients A + B but not the
   others"). Drop unless there's a real use case; if kept, accept that
   it's redundant with the sidebar for the sub-account-of-one case.
2. **`/dashboard/_hub-content` vs naming a new `_sub-account-content`** —
   should we rename for consistency, or keep `_hub-content` as a
   semantic name? Recommend keep; please confirm.
3. **`/search` in sub-account mode — narrow or label?** Two acceptable
   answers: (a) narrow scope to `activeClientId` (with an "expand to all
   clients" banner toggle); (b) keep cross-client but prefix every
   per-tenant result with the client pill so the operator sees the
   tenancy at a glance. (a) is the more opinionated choice; (b) is the
   less surprising one.
4. **`/(admin)/websites` matrix when in sub-account mode** — redirect to
   `/website`, or render anyway with the picked client's row highlighted?
   The matrix has cross-client value the operator might want even while
   drilled in (e.g. "is FreshHome the only client with a draft pending?").
   Suggest: render anyway, no redirect.
5. **`/tickets` — does the agency-mode admin shape stay with the
   per-tab approvals queue intact**, or does the sub-account variant get
   approvals scoped to that client only? Approvals is one shared queue
   today; ideally the sub-account variant filters to one client's
   pending approvals.
6. **`viewerRole` prop vs sibling files** — please confirm the preferred
   pattern. Recommend mixing: small operator-additions → extend
   `_client-content` with `viewerRole`; non-trivial operator-additions
   (campaigns, tickets) → dedicated `_sub-account-content` sibling.
7. **`/(client)/recurring/new` has no admin equivalent.** Should an
   operator in sub-account mode be able to set up recurring schedules on
   the picked client's behalf? Today they can't (the route is in
   `(client)/`). If yes, the route needs to move out of `(client)/` to
   top-level shared with a role+mode dispatcher. Not blocking the audit;
   surfaces as a "by the way".

---

*Audit complete. No source edits. Five problem routes; ~6-8 sessions of
work to bring them in line; pattern is settled (state-driven dispatch on
`useIsAgencyMode()`), risk is low because RLS already enforces tenancy.*
