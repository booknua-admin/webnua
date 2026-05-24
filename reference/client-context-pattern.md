# Client context routing — the canonical pattern

> The settled pattern for routes that need to behave differently for an
> operator in agency mode vs an operator drilled into one client vs a
> client-role user. Every new shared route follows this pattern; every fix
> session bringing an inconsistent route into line follows the migration
> recipe in §10.
>
> Audit input: `reference/client-context-audit.md` enumerates every route
> and classifies it. Phase 9b · Session 1 made four routes (`/tickets`,
> `/leads`, `/calendar`, `/search`) conform; Session 2 brought
> `/automations` and `/reviews` into line (see §7); Session 3 closed out
> `/campaigns` and `/(admin)/websites` (see §13). **The pattern is now
> applied consistently across every shared route in the app.**

---

## 1. The three-way dispatcher

The platform has **three user populations** and they want to see different
things on the same `/route`:

| Viewer | `useRole()` | `useIsAgencyMode()` | `useWorkspace().activeClientId` |
|---|---|---|---|
| Operator · agency mode | `admin` | `true` | `null` |
| Operator · sub-account mode | `admin` | `false` | `<slug>` |
| Client | `client` | (n/a — picker hidden) | (always own client) |

A route that has all three population needs is a **3-way dispatcher**. A
route that is purely role-shared (no agency / sub-account axis — e.g. a
ticket detail keyed by id) is a **2-way dispatcher**. The choice is "does
the operator's experience differ between agency and sub-account mode here?"
— if yes, 3-way.

### Canonical 3-way `page.tsx`

Mirror of `src/app/dashboard/page.tsx` (the gold-standard reference). The
dispatcher itself stays short — its only job is to pick the sibling. No
data fetching, no business logic. Imports the three sibling components,
reads `useRole()` + `useIsAgencyMode()`, returns one.

```tsx
'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminThingContent } from './_admin-content';
import { ClientThingContent } from './_client-content';
import { SubAccountThingContent } from './_sub-account-content';

export default function ThingPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    return isAgencyMode ? <AdminThingContent /> : <SubAccountThingContent />;
  }
  return <ClientThingContent />;
}
```

That's the entire dispatcher. The pattern doc lives here, not as inline
comments in every dispatcher; the file should be self-explanatory.

### Canonical 2-way `page.tsx`

For role-shared routes that don't have an agency/sub-account axis (typical
shape: id-scoped detail pages — `/leads/[id]`, `/bookings/[id]`,
`/tickets/[id]`). The role split is the only axis:

```tsx
'use client';

import { useRole } from '@/lib/auth/user-stub';

import { AdminThingContent } from './_admin-content';
import { ClientThingContent } from './_client-content';

export default function ThingPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminThingContent />;
  return <ClientThingContent />;
}
```

### When does a route need 3 siblings vs 2?

A route is a 3-way candidate when **agency mode and sub-account mode want
different shapes**, not just different data. Two signals:

1. **Agency view is a roster / cross-client triage** (one row per
   client × N items) — `/leads`, `/tickets`, `/calendar`, `/campaigns`.
   The operator-drilled-in view should reframe to single-business: drop
   the per-row client pill, drop the "every client" hero copy, drop the
   in-page `ClientMultiSelect`. → 3-way.
2. **Client view is a rich single-business surface** (deep-dive +
   reassurance band + activity feed) — `/campaigns`, `/reviews`,
   `/dashboard`. The operator drilled in expects the same deep-dive +
   their operator chrome on top. → 3-way.

A route is fine with 2 siblings (or just one role-shared body) when
**the data narrows but the shape doesn't change**. The id-scoped detail
pages are the canonical example: a lead detail at `/leads/abc-123` looks
the same regardless of mode — only the row's tenancy bounds what you can
see, and RLS handles that.

---

## 2. Sibling naming

| Sibling | When it renders | Naming convention |
|---|---|---|
| `_client-content.tsx` | `role === 'client'` | exports `Client{Thing}Content` |
| `_sub-account-content.tsx` | operator + sub-account mode | exports `SubAccount{Thing}Content` |
| `_admin-content.tsx` | operator + agency mode | exports `Admin{Thing}Content` |
| `_hub-content.tsx` | legacy alt name — only `/dashboard` uses it | — |

The underscore prefix is a naming convention so the sibling files don't
get picked up as Next routes. (Next's "private folder" semantics use a
leading underscore on the folder, not the file; underscore-prefixed files
are conventionally siblings + are not magic.)

`_hub-content.tsx` predates the `_sub-account-content` naming and was kept
for `/dashboard` (the operator hub is a richer composition than a "sub-
account dashboard" — keeping the name in case it sees more divergence).
New 3-way routes use `_sub-account-content.tsx`.

---

## 3. Data hooks — extending vs swapping

The query hooks today fall into three patterns. Pick the right one when
wiring a `_sub-account-content`:

### 3a. Hook works as-is — filter client-side after the fetch

Most read hooks (`useAdminTicketsInbox`, `useAdminLeadsInbox`,
`useAdminCalendar`) already return every row the operator can see
(RLS-bounded). The row carries a `clientSlug`. The simplest path is to
call the hook + filter the result in the sub-account content component:

```tsx
const { activeClientId } = useWorkspace();
const { data: tickets } = useAdminTicketsInbox();
const clientTickets = useMemo(
  () => (tickets ?? []).filter((t) => t.client.slug === activeClientId),
  [tickets, activeClientId],
);
```

Use this when the hook already returns the field you'd filter on. No new
hook needed. Tickets, leads, calendar, automations, campaigns, reviews
follow this shape today.

### 3b. Hook works but the row doesn't carry the filter axis

Some hooks (`useAllPendingApprovals`,
`useAllPendingFunnelApprovals`) return rows that don't carry a
`clientSlug` today. Fix this **on the data side**, not in the consumer:
extend the join + the mapper to include `clientSlug`. Phase 9b · S1 did
this for both approval hooks (the `clients(name, slug)` join was already
there for `clientName` — adding `slug` to the projection was a 1-line
change).

### 3c. The query genuinely needs a client filter parameter

If the hook can't be filtered post-fetch (e.g. global search where the
join itself fans out a top-N per kind — narrowing client-side would
return fewer than N rows for sub-account mode), extend the hook to accept
a client filter parameter. Phase 9b · S1 did this for `useSearch`:

```ts
export function useSearch(
  query: string,
  scope: SearchScope,
  clientSlugFilter: string | null = null,
) {
  return useQuery({
    queryKey: ['search', scope, query, clientSlugFilter],
    queryFn: () => fetchSearch(query, scope, clientSlugFilter),
  });
}
```

The filter goes into the `queryKey` so React Query caches each scope
separately. The default `null` keeps every existing call site working.

### Which to use?

Default to **3a** (filter client-side). The cost of fetching every
accessible row + filtering one out is negligible at platform scale (RLS
already bounded the rows to the operator's accessible clients). Move to
**3c** only when post-fetch filtering breaks correctness (limits, paging,
top-N).

---

## 4. `_sub-account-content` vs `_client-content` — convergence vs separate

The operator-in-sub-account view should **render the same conceptual
view** the client sees — single business, no cross-client framing. But:

- the **operator** is signed in (different auth user, different
  capabilities, sees operator-only affordances),
- the **operator query hook** runs (different RLS scope — still
  workspace-bounded but not own-tenant),
- some operator-only chrome is bolted on (Open Meta Ads, Sync Now,
  override toggles, force-publish menus, etc.).

Two valid strategies:

### Strategy A — separate `_sub-account-content` file (default)

A net-new file rendering the single-business shape, calling the
operator-side query hook, filtering to the active client. **This is the
default** — and what Phase 9b · S1 used for all four routes. Reasons:

- the operator chrome diverges from the client chrome enough to be
  awkward as conditional props,
- the type shape of the operator query result usually differs from the
  client query result (admin row carries `clientName` / `meta`, client
  row carries `suburb` / `urgency`),
- explicit beats implicit — three siblings make the dispatch obvious,
- the cost of duplication is modest. Each sibling is typically 100–200
  lines of mostly chrome composition. The shared primitives
  (`LeadRow`, `TicketRow`, `CalendarGrid`, etc.) carry the real
  rendering logic.

### Strategy B — share `_client-content` via a `viewerRole` prop

The lightest possible extension when the shapes are near-identical and
the operator additions are tiny (one extra `Button`, one extra row
column). Pass a `viewerRole: 'operator' | 'client'` and branch internally
for the small differences. **Not used today.**

Use Strategy B only when:

- the operator addition is one or two affordances, AND
- the operator and client data hooks return structurally identical row
  shapes (or you're already projecting to a shared shape).

In every other case use Strategy A. **Don't** invent a `viewerRole` prop
that triggers significant internal branching — at that point you've
recreated the dispatch decision inside the component and lost the
readability win.

---

## 5. Cross-client features in sub-account mode

Sub-account mode is "drilled into one client", but occasionally the
operator wants a temporary cross-client escape hatch without leaving the
current screen. The `/search` toggle (Phase 9b · S1) is the precedent:

> Default: narrowed to active client.
>
> Banner above results carries a "Search across all clients →" toggle
> that widens the scope without changing route.

This is **fine for read-only widening** (search, lookups). It's **not
fine for stateful actions** — never let an operator in sub-account mode
"apply this automation to all clients" via a toggle; route them back to
agency mode first.

When to add an escape-hatch toggle:

- Lookups across clients (search a customer name, find a booking by id),
- Comparing aggregates ("does this client's lead volume look normal?").

When NOT to:

- Anything that mutates state — agency mode is the home for cross-client
  mutations (bulk seat-limit changes, plan reassignment, etc.).

---

## 6. Stats cards in sub-account mode (the "stats-cards-per-flow" pattern)

Sub-account mode reframes a roster into a single-business view. Beyond just
filtering the data, the operator wants **headline metrics for what they're
drilled into** — a 4-up `StatCard` row above (or per-card stats below) the
single-business deep-dive. The pattern is settled enough now that future
routes copy it directly.

### Two flavours of the same pattern

The pattern shows up two ways. Both use the same visual chrome
(`StatCard` / `AutomationStatTile` rendered in a `grid grid-cols-4 gap-3.5`
row of paper-bg `rounded-lg` tiles, mono uppercase label + Inter Tight
value); they differ in **where** they sit.

**Flavour A — page-level stats row.** A single 4-up `StatCard` row above
the deep-dive content. Used when the page's primary content is a single
deep-dive (`/reviews`: summary header + distribution + reviews list).
Sub-account `/reviews` lands a 4-up row above the summary card with:

- `// AVG RATING` — `4.7 ★`
- `// TOTAL REVIEWS` — `47`
- `// NEW · 30D` — `12` (good tone if > 0)
- `// RESPONSE RATE` — `83%` (good tone if ≥ 80%)

**Flavour B — per-flow stats grid.** One `AutomationStatsCard` per item,
each carrying its own 4-tile stats grid in the card footer. Used when the
page's primary content is a LIST of similar items, each with its own
performance signal (`/automations`: one card per flow). Sub-account
`/automations` lands one card per automation with:

- `// LAST FIRED` — `2d` (relative time, or `—` if never)
- `// RUNS · 30D` — `47`
- `// COMPLETED` — `42`
- `// COMPLETION` — `89%`

The card's existing `enabled` flag hides the stats grid when off (the
zero-state is "this flow is disabled" not "this flow has no data").

### Data shape

Both flavours read the same kind of data: a small fixed set of derived
metrics per entity (the picked client, or each flow within it). The data
hook should return them already-derived:

```ts
// Flavour A (page-level)
type SubAccountStat = {
  label: string;       // mono uppercase: '// AVG RATING'
  value: ReactNode;    // Inter Tight value, <em> for rust accent
  trend?: ReactNode;   // small caption
  trendTone?: 'good' | 'quiet';
};

// Flavour B (per-item) — re-uses the existing AutomationStat shape
type AutomationStat = {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'accent';
};
```

The metrics themselves come from one query (Flavour A — extend the
existing page query to compute them server-side) or one batched query
(Flavour B — a separate hook keyed on the list of ids, see
`useAutomationStatsBatch`). Avoid N+1 per-card queries.

### When to use which

- The page is a SINGLE deep-dive surface → Flavour A.
- The page is a LIST of items, each meaningfully comparable → Flavour B.
- The page is a roster spread across many tenants (agency mode) → no
  stats-card row; the existing `StatCard` workspace row stays in
  `_admin-content` where it already lives.

### What NOT to do

- Don't add stats for stats' sake. Every tile should answer a question
  the operator would otherwise ask (e.g. "is this flow firing?", "how
  often does it succeed?", "how recent is the last review?").
- Don't fetch stats per-card with N separate hooks. Batch in one query.
- Don't render fake / placeholder values. If the data isn't there yet,
  render `—` and add an honest label ("no runs yet") rather than `0` or
  a misleading 0%.
- Don't reuse the agency-mode workspace stats row verbatim — its labels
  ("// CLIENTS") are cross-tenant; sub-account stats are single-tenant
  and labels should reflect that.

---

## 7. Per-route notes: `/automations`, `/reviews`

Notes from the routes Phase 9b · S2 brought into line. These exist to
inform `/campaigns` (S3) — read them before designing that session.

### 7a. `/automations`

**Sub-account shape**: stacked `AutomationStatsCard` per flow (Flavour B
of §6). The same card the client view uses, fed by a
`useSubAccountAutomations(clientSlug)` hook that filters the operator's
existing `fetchAutomations` query post-fetch (§3a). Each card stays
toggleable (clients AND operators can toggle here — the parked decision
"client tier mutations preserved" still applies) with the same
`useAutomationGbpGuard` guard the client view uses. Click-through to
`/automations/[id]` is the editor entry — the per-card `href` is the only
operator-side affordance bolted on (the GBP guard works for both roles).

The per-card stats grid is wired through a NEW batched hook
`useAutomationStatsBatch(ids[])` that runs ONE `automation_runs` query
across all the picked client's automations and groups client-side. This
is the answer to the previously-parked "per-card stats are expensive
because they're per-id" — batched, the cost is one query per page load.

Hero copy uses the client name verbatim: `Voltline's automations.` (not
"Your automations" — the operator isn't Voltline). The info banner is a
rust-soft `AutomationInfoBanner` (same component the client view uses)
with operator-tilted copy explaining the toggle + editor entry.

**Agency mode** keeps the trigger-type-grouped roster (`AutomationGroup`).
The `ClientMultiSelect` is gone — the sidebar picker is canonical. The
per-flow GBP guard still fires inside the roster (the operator can toggle
flows for any client from the agency-mode view via the row toggles).

### 7b. `/reviews`

**Sub-account shape**: page-level 4-up `StatCard` row (Flavour A) above
the SAME client deep-dive composition (`ReviewSummaryHeader` +
`ReviewDistributionBars` + `ReviewCallout` + the reviews list with
`ReviewItem`'s built-in inline reply UI). The reply UI is keyed on
`review.clientId` — the sub-account view passes the picked client's
UUID, so the inline composer dispatches replies through
`useReplyToGbpReview(clientId)` for the right tenant. No extra reply
chrome was needed — the existing primitive already covers operator AND
client.

GBP "Sync now" / "Change location" affordances are NOT mounted here —
they live on `/settings/integrations` (the connection-management surface).
The empty state (`!gbpConnected`) renders `GbpConnectPanel` exactly as
the client view does, with the picked client's UUID — operator can drive
the OAuth flow on the customer's behalf from this entry point.

The data layer adds a `useSubAccountReviews(clientSlug)` hook returning
`ClientReviewsPage & { clientId, stats }` — the same shape `useClientReviews`
returns plus the augmentations (`clientId` for the GBP hooks, `stats` for
the 4-up row).

### What `/campaigns` (Session 3) should copy

The patterns settled here that `/campaigns` slots into directly:

1. **Sub-account hook shape**: `useSubAccountCampaigns(clientSlug)`
   that fetches the operator's accessible-clients pool, filters to the
   picked client, and returns the SAME `ClientCampaignsPage` shape the
   client view consumes (extended with `clientId` if Meta hooks need it).
   No second projection — mirror the client shape.
2. **Stats row**: campaigns has a richer existing client deep-dive
   (managed band + hero card + 4-week trend chart). Don't bolt a 4-up
   `StatCard` row ON TOP of all that — the existing `CampaignMetricTile`
   row inside `CampaignHeroCard` already IS the stats surface. Treat it
   as Flavour A satisfied by the existing primitive. The hero card's
   metrics already include leads / spend / CPL / ROAS; reusing them
   avoids duplication.
3. **Operator chrome**: launch + sync + pause/resume Meta affordances
   bolt on as a top-of-page `OperatorActionBar` (mirror of
   `admin/hub/OperatorActionBar` from the dashboard hub). Don't squeeze
   them into the existing card chrome — they're metadata.
4. **The data-layer extension is the biggest risk.** Meta integration
   joins live in `lib/campaigns/queries.tsx`; the existing query
   returns a single campaign for the client deep-dive but ALL campaigns
   for admin roster. The sub-account hook needs ALL campaigns for the
   picked client — possibly a third query shape. Audit first; don't
   assume the existing two cover it.

---

## 8. `WorkspaceContextBanner` — when to drop, when to keep

`WorkspaceContextBanner` was useful when half-dispatched views needed to
tell the operator "you've narrowed down to X client". Once the route
properly dispatches on mode, the banner is **redundant**: the hero
already says it.

Rule of thumb:

| Surface | Banner? |
|---|---|
| `_sub-account-content` with a client-named hero | drop |
| `/settings/*` (shared route tree, hero is generic) | keep (mounted by `SettingsContextBanner`) |
| Any screen where the hero doesn't carry the client name | keep |

Phase 9b · S1 dropped the banner from `/leads` and `/calendar`
`_sub-account-content` since both heros now lead with the client name.
`/tickets` `_sub-account-content` ships without a banner from day one for
the same reason. `/settings/*` keeps the banner because the per-tab heros
are surface-named, not client-named.

---

## 9. In-page `ClientMultiSelect` — kill on rosters

The sidebar `AdminClientPicker` is **canonical** for narrowing scope.
The in-page `ClientMultiSelect` predates the workspace-mode pattern; once
sub-account mode hands cross-client narrowing off via the sidebar, the
in-page picker duplicates the affordance with a different semantic
(sidebar = drill into one client; in-page = compare N clients).

The "compare N clients at once" use case has **not** surfaced as a real
operator need. So:

- **Default action when migrating a route**: drop the in-page
  `ClientMultiSelect` from `_admin-content`.
- **Keep** the multi-select only if a concrete "compare N clients side
  by side" use case is documented for that surface — and even then,
  consider whether a dedicated comparison view is the better home.

Phase 9b · S1 dropped the multi-select from `/leads`, `/calendar`, and
`/tickets` (the tickets ClientMultiSelect was orphaned the moment the
3-way dispatcher landed — the agency-mode roster shows every client by
default; if narrowing is needed, drill in via sidebar). Phase 9b · S2
dropped it from `/automations` and `/reviews`.

`/campaigns` is the last roster still carrying the multi-select — it
gets revisited in Session 3 per §10.

---

## 10. Migration recipe for the remaining routes

After Phase 9b · S2, `/campaigns` is the last shared-route surface still
half-dispatched. The agency-only `/(admin)/websites` matrix should also
redirect operators in sub-account mode to `/website`.

### Recipe per route

For each migration session:

1. **Audit first.** Read `_admin-content.tsx`, `_client-content.tsx`,
   and any data hooks (`use*Inbox`, `use*Detail`). Identify:
   - the client-shape composition the operator should see
     (deep-dive vs roster row),
   - whether the operator query hook returns the right shape or needs
     a `clientSlug` projection added (§3b),
   - any in-page `ClientMultiSelect` to drop,
   - any `WorkspaceContextBanner` mount to drop.
2. **Add `_sub-account-content.tsx`.** Default to Strategy A (§4).
   Mirror the client shape; use the operator's query hook + a client-
   slug filter; bolt operator chrome where appropriate.
3. **Convert `page.tsx` to a 3-way dispatcher** (§1, canonical
   template).
4. **Drop `ClientMultiSelect`** from `_admin-content.tsx` (§9), unless
   a concrete multi-client narrowing case is documented.
5. **Drop redundant `WorkspaceContextBanner`** from
   `_sub-account-content.tsx` if the hero already carries the client
   name (§8).

### Status + recommended order

- ✅ **`/automations`** — DONE (Phase 9b · S2). Stats-cards-per-flow
  pattern established via `useSubAccountAutomations` +
  `useAutomationStatsBatch`. See §7a for notes.
- ✅ **`/reviews`** — DONE (Phase 9b · S2). Page-level stats row pattern
  established via `useSubAccountReviews`. See §7b for notes.
- ✅ **`/campaigns`** — DONE (Phase 9b · S3). Operator action strip +
  reused `CampaignMetricTile` row as Flavour A stats surface. See §13a.
- ✅ **`/(admin)/websites`** — DONE (Phase 9b · S3). Sub-account-mode
  redirect to `/website`. See §13b.

**The pattern is now applied consistently across every shared route in
the app.** New shared routes follow §1's canonical dispatcher template;
inconsistencies should be flagged as bugs, not opt-out judgement calls.

---

## 11. Anti-patterns

These are the failure modes the discipline guards against. Don't:

### 11a. Numbered suffixes (`AutomationCard2`)

Means a duplicate that should have been a reuse. If a component "needs"
a second variant for the operator-in-sub-account case, the right path is
either (a) a `variant` prop discriminating two render modes on the
**same** component, or (b) a sibling component with a clearly different
name describing what it does, not which copy it is.

### 11b. Parallel cross-client + per-client components

A `LeadsAdminRoster` and a `LeadsAdminClientView` (same operator,
different framings) implemented as fully separate components, not as
two siblings of one `LeadsPage` dispatcher. The split should be at the
page level (dispatcher → siblings), not at the component level
(component → conditional internal branches).

### 11c. `viewerRole`-style internal branching that should be dispatch

A component that takes `viewerRole: 'operator' | 'client'` and then
internally renders 60% different chrome based on that prop is a
dispatcher trying to escape. Split it into siblings at the page level
or compose it from smaller primitives that don't know about role.

The right time to use `viewerRole`: the component is small (≤100
lines), the per-role differences are 1-2 affordances, and the underlying
data shape is identical (§4 Strategy B).

### 11d. Reaching into `useRole()` / `useWorkspace()` from deep components

The dispatcher should resolve these once at the page level and pass
behavioural props down — `LeadRow` doesn't need to know the workspace
mode to render. Components that read `useRole()` directly tend to grow
internal branching that's painful to test and surprises consumers.

Exception: `Topbar` reads `useRole()` because the chrome is shared
across every route — there is no per-page dispatch to make that
decision.

### 11e. URL-based scoping (`/clients/[id]/leads`)

Three reasons not to: breaks every existing `/leads` deep-link, doubles
the route tree (every shared surface gets a `/clients/[id]/` mirror),
doesn't solve the shape divergence on its own (the `/clients/[id]/leads`
page still needs the single-client shape — which is the actual work).
State-driven dispatch via `useWorkspace()` is the settled choice; don't
relitigate without a concrete trigger.

---

## 12. Reference points

- **Gold-standard dispatcher:** `src/app/dashboard/page.tsx` (3-way
  with the `_hub-content` legacy name).
- **Phase 9b · S1 dispatchers:** `src/app/tickets/page.tsx`,
  `src/app/leads/page.tsx`, `src/app/calendar/page.tsx`,
  `src/app/search/page.tsx`.
- **Phase 9b · S2 dispatchers:** `src/app/automations/page.tsx`,
  `src/app/reviews/page.tsx`.
- **Workspace API:** `src/lib/workspace/workspace-stub.tsx` — exports
  `useWorkspace()`, `useActiveClient()`, `useIsAgencyMode()`.
- **The audit:** `reference/client-context-audit.md` — full route
  inventory + classifications + the original migration plan.

---

## 13. Per-route notes: `/campaigns`, `/(admin)/websites` (Phase 9b · S3)

Notes from the routes Phase 9b · S3 brought into line. These complete the
migration — every shared route in the app now follows the pattern.

### 13a. `/campaigns`

**Sub-account shape**: same `CampaignHeroCard` + `CampaignTrendChart` +
`CampaignActivityCard` deep-dive the client view consumes, scoped to the
picked client via a new `useSubAccountCampaigns(clientSlug)` hook.

**The data-layer extension was a third query shape** (§7 recommendation 4
flagged this as the biggest risk; the audit confirmed it). The existing
`fetchClientCampaigns` reads via `supabase.auth.getUser()` + RLS-bounded
`clients` (returns the signed-in client's row); the existing
`fetchAdminCampaigns` reads ALL campaigns across every accessible client.
Sub-account drilled-in needs a third path: one specific client by slug,
joined to that client's campaigns. The new hook:

```ts
export type SubAccountCampaignsPage = {
  hero: ClientCampaignsPage['hero'];
  active: ClientCampaignsPage['active'];
  trend?: ClientCampaignsPage['trend'];
  activity: ClientCampaignsPage['activity'];
  clientId: string;  // for future Meta hook wiring
};

export function useSubAccountCampaigns(clientSlug: string | null);
```

It returns a SUBSET of `ClientCampaignsPage` — intentionally dropping the
`managedBand` and `changeCard` fields. Those are client-facing reassurance
("Webnua handles your strategy", "Text Craig") that doesn't make sense on
an operator view where the operator IS Webnua. The operator action strip
(see below) replaces them as the operator's affordance surface. Performance
characteristics: two sequential queries (`clients` by slug → `campaigns`
by client_id) plus the same Meta-side stitching the client hook does. RLS
refuses the slug lookup if it's outside the operator's accessible set,
which surfaces as a row-not-found error.

**Did `_sub-account-content` and `_client-content` end up sharing
implementation?** No. The two siblings stayed independent — at 80–120
lines each, both are mostly composition over the same canonical components
(`CampaignHeroCard`, `CampaignTrendChart`, `CampaignActivityCard`), and
the operator chrome (action strip + dropped client-facing blocks) makes
the two layouts diverge enough that conditional internal branching would
have been the §11c anti-pattern. The pattern doc's §4 Strategy A default
held: explicit siblings, modest duplication, shared via the underlying
primitive components rather than a shared layout shell.

**Operator action strip**: the existing `admin/hub/OperatorActionBar`'s
typed `OperatorAction[]` chip array couldn't host the stateful
`LaunchMetaCampaignButton` (which owns sync mutation state + computes
Ads-Manager deep-link URLs from the connected ad-account row). So the
sub-account content carries an `OperatorActionStrip` local component
that visually mirrors `OperatorActionBar` (paper-2 surface, rust mono
`// OPERATOR ACTIONS` label, "Viewing as operator" right-aligned note)
but mounts `LaunchMetaCampaignButton` directly. The button already
handles both states (no ad account → "Wire Meta first"; ad account wired
→ Sync + Open Ads Manager pair). Pause/resume per-campaign was scoped out
— Meta Ads Manager itself is the canonical edit surface (V1 model), and
the launch button IS one click away from it.

**Stats**: per §7 recommendation 2, the existing `CampaignMetricTile` row
inside `CampaignHeroCard` IS the Flavour A stats surface. No additional
4-up `StatCard` row above the deep-dive — that would have been duplication
+ visual noise. The hero card's leads / cost-per-lead / spend / conversion
tiles cover the same questions a separate row would have.

**Agency mode** keeps the cross-client roster with the per-row
`CampaignClientRow`. The `ClientMultiSelect` was dropped (§9); a status
filter (`all / active / paused / pending`) using the shared `FilterChips`
replaced it — per §7 recommendation 1's framing "filter by status /
platform, not by client". The `LaunchMetaCampaignButton` was also dropped
from agency mode — it's a per-client action that lives on the sub-account
view's action strip; in agency mode it would be a permanently-disabled
"Pick a client" affordance (= noise).

### 13b. `/(admin)/websites`

The matrix is the operator's agency-mode birds-eye over every client's
website state. A sub-account-mode operator hitting it should land on
that client's `/website` hub directly, without a "click into the matrix,
find your row, drill in again" hop.

The fix is a top-of-page `useEffect` that redirects when
`workspace.hydrated && workspace.activeClientId`. While hydrating or
mid-redirect the page returns `null` so the matrix doesn't flash. Query
strings + hash fragments forward through (`router.replace(`/website${search}${hash}`)`).

Hooks-order discipline: the effect + the redirect-window early return
sit AFTER the data hooks (`useAdminClients`, `useAllWebsites`,
`useAllWebsiteVersions`) so hook order is preserved across the
redirect-vs-render branch. Doing the early return BEFORE the hooks
would have broken rules-of-hooks.

This is NOT a layout-level guard (which is what the original audit
suggestion contemplated). A layout guard would need its own
`useEffect` + `null`-render in `/(admin)/layout.tsx`, only to special-
case the one route that needs it — disproportionate scaffolding for a
single redirect. Page-level effect is the lower-cost answer.

### What's left

Nothing on the client-context axis. The pattern is universal across every
shared-route surface in the app:

- Every 3-way candidate route has the three siblings.
- Every 2-way route uses the 2-way template.
- No `ClientMultiSelect` survives on a roster.
- No `WorkspaceContextBanner` sits redundantly above a client-named hero.

Future work the audit didn't surface but is worth flagging:

- The shared `OperatorActionStrip`-style chrome (`/campaigns`'s strip,
  `/dashboard`'s `OperatorActionBar`) could fold into one component
  with a `children` slot for stateful actions — defer to the third use
  per CLAUDE.md's "extract on the third use" rule.
- `CampaignManagedBand` + `CampaignChangeCard` continue to exist as
  client-facing components, used only by `_client-content`. Re-evaluate
  the split if a future operator surface wants the "managed by Webnua"
  framing for a different audience (e.g. embedded operator-overview
  cards in a billing surface).
