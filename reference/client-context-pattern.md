# Client context routing — the canonical pattern

> The settled pattern for routes that need to behave differently for an
> operator in agency mode vs an operator drilled into one client vs a
> client-role user. Every new shared route follows this pattern; every fix
> session bringing an inconsistent route into line follows the migration
> recipe in §8.
>
> Audit input: `reference/client-context-audit.md` enumerates every route
> and classifies it. Phase 9b · Session 1 made four routes (`/tickets`,
> `/leads`, `/calendar`, `/search`) conform. `/automations`, `/reviews`,
> `/campaigns`, `/(admin)/websites` follow in future sessions per §8.

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

## 6. `WorkspaceContextBanner` — when to drop, when to keep

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

## 7. In-page `ClientMultiSelect` — kill on rosters

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
default; if narrowing is needed, drill in via sidebar).

`/reviews` and `/campaigns` still carry the multi-select — they get
revisited in future sessions per §8.

---

## 8. Migration recipe for the remaining routes

The audit identifies three routes still half-dispatched as of Phase 9b ·
S1: `/automations`, `/reviews`, `/campaigns`. Plus the agency-only
`/(admin)/websites` matrix should redirect operators in sub-account mode
to `/website`.

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
4. **Drop `ClientMultiSelect`** from `_admin-content.tsx` (§7), unless
   a concrete multi-client narrowing case is documented.
5. **Drop redundant `WorkspaceContextBanner`** from
   `_sub-account-content.tsx` if the hero already carries the client
   name (§6).

### Recommended order

Order by data dependency + shape complexity:

1. **`/automations`** — medium. Operator addition is non-trivial (Test
   send, editor entry, GBP guard) but the client shape exists and the
   admin query already exposes the data per-flow. Settles the pattern
   for routes whose client view is "stats cards per flow".
2. **`/reviews`** — medium. Client shape is the rating headline + dist
   bars + recent reviews. Operator addition is the reply composer (which
   already mounts for clients too via `ReviewItem`'s shared reply UI —
   so the only delta is the GBP "Sync now" / "Change location"
   affordances, both already on `/settings/integrations`). Smaller
   delta than `/campaigns` and could plausibly land first if a session's
   risk budget is small.
3. **`/campaigns`** — largest. The client deep-dive is rich (managed
   band + hero card + 4-week trend chart + activity log + change CTA);
   the operator additions are the launch / sync Meta affordances + the
   pause/resume control. Take this last — the pattern is settled by
   then, and the data dependencies are the biggest (Meta integration
   joins).
4. **`/(admin)/websites`** — small, optional cleanup. Add a layout-
   guard redirect: operator in sub-account mode hitting `/websites`
   gets routed to `/website`. Sibling of the `/settings/layout.tsx`
   wrong-mode guard.

---

## 9. Anti-patterns

These are the failure modes the discipline guards against. Don't:

### 9a. Numbered suffixes (`AutomationCard2`)

Means a duplicate that should have been a reuse. If a component "needs"
a second variant for the operator-in-sub-account case, the right path is
either (a) a `variant` prop discriminating two render modes on the
**same** component, or (b) a sibling component with a clearly different
name describing what it does, not which copy it is.

### 9b. Parallel cross-client + per-client components

A `LeadsAdminRoster` and a `LeadsAdminClientView` (same operator,
different framings) implemented as fully separate components, not as
two siblings of one `LeadsPage` dispatcher. The split should be at the
page level (dispatcher → siblings), not at the component level
(component → conditional internal branches).

### 9c. `viewerRole`-style internal branching that should be dispatch

A component that takes `viewerRole: 'operator' | 'client'` and then
internally renders 60% different chrome based on that prop is a
dispatcher trying to escape. Split it into siblings at the page level
or compose it from smaller primitives that don't know about role.

The right time to use `viewerRole`: the component is small (≤100
lines), the per-role differences are 1-2 affordances, and the underlying
data shape is identical (§4 Strategy B).

### 9d. Reaching into `useRole()` / `useWorkspace()` from deep components

The dispatcher should resolve these once at the page level and pass
behavioural props down — `LeadRow` doesn't need to know the workspace
mode to render. Components that read `useRole()` directly tend to grow
internal branching that's painful to test and surprises consumers.

Exception: `Topbar` reads `useRole()` because the chrome is shared
across every route — there is no per-page dispatch to make that
decision.

### 9e. URL-based scoping (`/clients/[id]/leads`)

Three reasons not to: breaks every existing `/leads` deep-link, doubles
the route tree (every shared surface gets a `/clients/[id]/` mirror),
doesn't solve the shape divergence on its own (the `/clients/[id]/leads`
page still needs the single-client shape — which is the actual work).
State-driven dispatch via `useWorkspace()` is the settled choice; don't
relitigate without a concrete trigger.

---

## 10. Reference points

- **Gold-standard dispatcher:** `src/app/dashboard/page.tsx` (3-way
  with the `_hub-content` legacy name).
- **Phase 9b · S1 dispatchers:** `src/app/tickets/page.tsx`,
  `src/app/leads/page.tsx`, `src/app/calendar/page.tsx`,
  `src/app/search/page.tsx`.
- **Workspace API:** `src/lib/workspace/workspace-stub.tsx` — exports
  `useWorkspace()`, `useActiveClient()`, `useIsAgencyMode()`.
- **The audit:** `reference/client-context-audit.md` — full route
  inventory + classifications + the original migration plan.
