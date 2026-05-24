# Mobile Responsiveness Audit — Webnua Platform

**Audit date:** 2026-05-24
**Audit scope:** entire `src/app/` + `src/components/` + the public-site render pipeline
**Auditor's posture:** read-only — no code changes, no fixes attempted

---

## 1. Methodology

This is a **static code audit**, not a live browser audit (no DevTools / device emulator
available). The method:

1. Read `CLAUDE.md` to enumerate routes + components and confirm intent
   (`build-roadmap.md` carries the standing constraint: *"Any new UI built must work
   on mobile (320–768px viewport) as well as desktop"*; `builder-design.md` explicitly
   carves out *"Editor is desktop-only. Mobile/tablet editor flow is V2"*).
2. Grep for mobile-hostile patterns:
   - Hardcoded fixed widths (`w-[Npx]`, `max-w-[Npx]`) without responsive variants
   - Fixed-pixel grid templates (`grid-cols-[Apx_Bpx_...]`) with cumulative width > 375px
   - `min-w-[Npx]` rows exceeding 375px
   - Modal sizes (`size="lg"` = 920px)
   - Sticky elements
   - `flex` rows that don't `flex-wrap`
   - Button tap-target sizes (`h-8` < 44px iOS standard)
   - Sidebar collapse / drawer / hamburger logic
   - Viewport breakpoint usage (`md:`, `lg:`, `sm:`) vs container queries (`@2xl:`)
3. Classify each surface: **Works well** / **Works but ugly** / **Broken** / **Catastrophic**.
4. Cross-check against the deliberate scope decisions in `builder-design.md`.

**Confidence levels.** Static analysis can confidently identify:
- structural blockers (sidebar that doesn't collapse on mobile = guaranteed-broken)
- fixed-pixel grids exceeding viewport (guaranteed overflow)
- absence of `overflow-x-auto` escape valves on tables (no scroll, just truncation)
- absence of viewport-responsive classes (guaranteed no-collapse)

Static analysis CANNOT confidently identify:
- text wrapping behaviour at specific viewport widths
- visual quality (visual ugly vs visually working)
- iOS Safari–specific viewport quirks (e.g. 100svh handling)
- whether a touch interaction is *physically usable* even if mathematically large enough

Where this matters I flag the assessment as **best-effort** and recommend live verification.

---

## 2. The structural root cause (read this first)

**The AppShell is hard-coded `grid-cols-[280px_1fr]` with no responsive variant.**

```tsx
// src/components/shared/AppShell.tsx
<div className="grid min-h-svh w-full grid-cols-[280px_1fr] bg-paper">
  {sidebar}
  <main className="flex min-w-0 flex-col">{children}</main>
</div>
```

```tsx
// src/components/shared/Sidebar.tsx
<aside className="sticky top-0 flex h-svh flex-col gap-0 overflow-y-auto bg-ink py-7 text-paper">
```

**There is zero mobile drawer logic anywhere in the codebase.** A grep of
`md:hidden | hamburger | drawer | mobile` across `Sidebar.tsx`, `AppShell.tsx`,
`AdminSidebar.tsx`, `ClientSidebar.tsx` returns the single literal "mobile" in `AppShell.tsx`'s
`min-h-svh` — no functional mobile pattern.

Consequences on a 375px viewport:
- Sidebar always renders at 280px.
- Main content gets the remaining **95px**.
- Every page that uses `px-10` (40px each side, 80px total) for body padding leaves
  **15px** of useful horizontal space.
- Every fixed-pixel inner grid (lead rows, ticket rows, calendar) horizontally overflows
  the main column and either gets clipped or pushes the layout sideways.

**This single fact makes almost every authed surface unusable on a phone.** It is not a
collection of independent small bugs; it is one structural decision (sidebar permanently
visible) that compounds across the surface inventory.

The platform's own constraint doc (`build-roadmap.md`) calls for mobile-first; the
implementation never landed.

### Supporting facts

- Across `src/app/` + `src/components/`, viewport-responsive breakpoint classes
  (`md:`, `lg:`, `sm:`) appear in **only 15 places** — most of them on the `/website`
  hub.
- Container queries (`@container`, `@2xl:`) appear in `src/lib/` (the public section
  library) **75 times**, but in the authed app only **1 time**. Customer-facing site
  templates were built responsive; the operator/client platform was not.
- `overflow-x-auto` appears exactly **once** in the entire app — there is no escape
  valve for tables that would otherwise overflow.
- The Dialog primitive DOES handle mobile width
  (`max-w-[calc(100%-2rem)] sm:max-w-[920px]`), but uses `p-10` internally — heavy on
  a 375px viewport.

---

## 3. Surface-by-surface assessment

52 distinct routes audited. Counts by severity at the end of the section.

### 3.1 Customer-facing (published sites)

This is the **most important section** for the business outcome — these are the websites
and funnels real customers land on after clicking an ad / Google result, and the form
they fill in to become leads.

| Surface | Files | Severity | Notes |
|---|---|---|---|
| `/published/[host]/[[...slug]]` (website page) | `app/published/.../page.tsx`, `PublicSiteRenderer.tsx`, `lib/website/sections/*.tsx` | **Works well** | Built responsive on purpose. Section library uses `@container` + `@2xl:` container queries (75 occurrences across 13 of 17 section files); `SectionShell.tsx` makes each section a container-query context (`'relative w-full @container'`). Sections reflow without needing a viewport-aware editor. |
| `/published/...` (funnel step) | same | **Works well** | Same path. |
| `FormBlock` (lead-capture form on a published page/funnel) | `components/shared/website/FormBlock.tsx` | **Works well** | All `w-full`, no fixed-pixel widths, no horizontal grid. Inputs are full-width. This is the most important conversion surface — it is mobile-OK. |
| `SiteMessage` (404 / unpublished fallback) | `app/published/.../page.tsx` | **Works well** | Uses inline styles `maxWidth: 420` + centered flex — survives mobile. |

**Per-section caveats** (best-effort; section files are 800–1000 lines each):
- `hero.tsx` — has `@2xl:grid-cols-[1fr_400px]`-style splits that collapse to single
  column at narrow widths; **OK**.
- `about.tsx` — uses `@3xl:grid-cols-2` and `grid-cols-2 gap-3` (the latter for stat
  pills, which IS forced 2-up — may cramp on 320px but viable for 375px).
- `services.tsx` — uses plain `md:grid-cols-2` (viewport-keyed, not container-keyed —
  fine since this is the customer's browser viewport, not the editor preview).
- `features.tsx`, `gallery.tsx`, `reviews.tsx`, `cta.tsx`, `faq.tsx`, `trust.tsx`,
  `contact.tsx`, `offer.tsx`, `thanksConfirmation.tsx`, `schedulePicker.tsx`,
  `form.tsx`, `header.tsx`, `footer.tsx` — all carry `@container`-keyed responsive
  classes. Sample inspection shows footer uses `flex flex-wrap`.

**Net call: customer-facing published sites are mobile-ready.** This is the surface
that ships the business outcome; it works.

### 3.2 Auth

| Surface | Severity | Notes |
|---|---|---|
| `/login` | **Works well** | `app/(auth)/layout.tsx` is a plain centred flex with `px-6`. The Card containing the form has no fixed width. |

### 3.3 Authed app shell (everything below sits inside this)

| Surface | Severity | Notes |
|---|---|---|
| `AppShell` (the role-based sidebar+main grid) | **Catastrophic** | `grid-cols-[280px_1fr]` with no responsive variant. **No mobile drawer pattern exists.** This is the single root cause of nearly every broken authed surface. |
| `Sidebar` (`ink-bg, sticky h-svh`, sole layout for nav) | **Catastrophic** | Always 280px wide, no collapse logic. Sticks open eating screen real estate on every page. |
| `Topbar` (sticky, `px-10`) | **Works but ugly** | The 68px height + sticky position is mobile-acceptable, but `px-10` over a ~95px main column is too much. The auto-rendered `GlobalSearchInput` for operators is centred and would cramp. |
| `NotificationBell` popover | **Broken** | `w-[420px]` popover. On a 375px viewport the popover would either overflow the viewport on the right or push left and clip the bell. |

### 3.4 Dashboard

| Surface | Severity | Notes |
|---|---|---|
| `/dashboard` (admin agency-mode roster) | **Broken** | `px-10 py-10` body, `grid-cols-3` + `grid-cols-4` stat tiles (non-responsive), `grid-cols-[1.6fr_1fr]` two-column layouts. Each `StatCard` would be ~24px wide on mobile inside the 95px main column. |
| `/dashboard` (admin sub-account hub) | **Broken** | Same patterns: `grid-cols-3`, `grid-cols-4`, `grid-cols-2`. `ClientHubHero` carries an `mt-5 grid grid-cols-4` stat strip with no breakpoint. |
| `/dashboard` (client) | **Broken** | Same — `grid-cols-2`, `grid-cols-4` stat tiles non-responsive. |

The dashboards are the single most-frequently-checked surface for tradies-on-the-go and
are completely unusable on a phone.

### 3.5 Lead inbox + detail

| Surface | Severity | Notes |
|---|---|---|
| `/leads` (admin inbox) | **Broken** | Header row `grid-cols-[36px_180px_1fr_110px_80px_80px_100px]` = 586px+gaps minimum, plus the cold-lead row `grid-cols-[4px_36px_1fr_140px_120px_auto]` = 300px+ fixed. Both render inside the 95px main column. **No `overflow-x-auto` wrapper.** |
| `/leads` (sub-account) | **Broken** | Identical patterns. |
| `/leads` (client) | **Works but ugly** | Client `LeadRow` uses `grid-cols-[44px_1fr_auto_auto_auto_70px]` — has flexible cells. Might survive but cramped. |
| `/leads/[id]` (detail) | **Broken** | Reuses `TicketDetailLayout`'s `grid-cols-[1fr_320px]` — the 320px side rail forces a horizontal squeeze. |
| `/leads/[id]/conversation` | **Broken** | Same layout shell, same problem. |

The lead-detail layout is one of the platform's most-used surfaces (the operator/client
checking and replying to a lead between jobs). Critical mobile path is broken.

### 3.6 Tickets

| Surface | Severity | Notes |
|---|---|---|
| `/tickets` (admin) | **Broken** | Header row `grid-cols-[20px_180px_1fr_110px_120px_110px_80px]` = 620px+ minimum. |
| `/tickets` (client/sub-account) | **Broken** | `grid-cols-[36px_1fr_90px_auto]` is more flexible but the `px-10` body padding still pushes things off. |
| `/tickets/[id]` | **Broken** | `TicketDetailLayout` `1fr 320px`. |
| `/tickets/new` | **Works but ugly** | Form-style page; no fixed-width grids beyond layout shell. Survives but cramped. |

### 3.7 Calendar

| Surface | Severity | Notes |
|---|---|---|
| `/calendar` (admin / sub-account / client) | **Catastrophic** | `CalendarGrid` uses `gridTemplateColumns: '70px repeat(6, minmax(0, 1fr))'`. Six day columns + time gutter inside 95px main = each day column would be ~4px wide. The booking pills (which are absolutely positioned and use timestamps to compute pixel positions) would be unreadable bars. |

The calendar would technically render (everything uses `minmax(0, 1fr)`) but produces a
completely unusable result. This is a "rebuild as a day-view + day-picker on mobile"
job, not a CSS tweak.

### 3.8 Bookings detail / completion

| Surface | Severity | Notes |
|---|---|---|
| `/bookings/[id]` (admin/client) | **Broken** | `px-10 py-10` + the booking-detail rail layout. |
| `/bookings/[id]/complete` | **Works but ugly** | Centered `max-w-[760px]` content with `px-10` outer padding. The content itself is form-shaped, single column — but lives inside the 95px main. |

### 3.9 Recurring schedule

| Surface | Severity | Notes |
|---|---|---|
| `/recurring/new` (client) | **Broken** | Uses `FrequencyGrid` (4-col card picker) and `ChipSelector` with day chips — both expect ≥ ~600px. |

### 3.10 Settings (every tab)

| Surface | Severity | Notes |
|---|---|---|
| `/settings` and every `/settings/*` (16 tabs) | **Broken** | `SettingsShell` uses `grid-cols-[220px_1fr]` with `px-10 py-10`. On 375px mobile inside the 95px main column, the 220px tab nav alone overflows. **No mobile collapse logic.** Plus each tab body has its own grids — `DnsRecordsTable.tsx` uses `grid-cols-[80px_1fr_2fr_60px_60px]`, `InvoiceList` uses `grid-cols-[120px_1fr_90px_100px_80px]`. |

A couple of bright spots: `QuietHoursSection`, `NotificationPreferencesSection`,
`EmailSenderSection` use `sm:grid-cols-...` — these tabs handle their internal content
responsively even though the shell breaks.

### 3.11 Website editor + hub

| Surface | Severity | Notes |
|---|---|---|
| `/website` (hub) | **Works but ugly** | Uses `md:grid-cols-[1.4fr_1fr]`, `sm:grid-cols-2 lg:grid-cols-3`, `sm:grid-cols-2 lg:grid-cols-4` — actually responsive! `WebsiteEngagementCard` uses `md:grid-cols-3`, `WebsiteHero` uses `md:grid-cols-[1.4fr_1fr]`. **This is the one authed surface that was built responsive.** Still trapped behind the non-collapsing sidebar but the internal layout is responsive-aware. |
| `/website/[pageId]` (editor) | **Catastrophic by design** | `SectionEditor` uses `grid-cols-[1fr_400px]` — 400px fields panel + preview. Per `builder-design.md`: *"Editor is desktop-only. Mobile/tablet editor flow is V2."* This is an intentional scope decision; flag as catastrophic for completeness but not a bug. The mobile/tablet preview within the editor (420px / 840px) is operator-facing and works as designed. |
| `/website/header`, `/website/footer` | **Catastrophic by design** | Same editor; same scope decision. |
| `/website/new` | **Works but ugly** | Q&A flow — single-column step cards. Survives. |
| `/website/review` | **Works but ugly** | Uses `sm:grid-cols-2 lg:grid-cols-3` — responsive. |

### 3.12 Funnels

| Surface | Severity | Notes |
|---|---|---|
| `/funnels` (list) | **Broken** | Row `grid-cols-[48px_1fr_120px_120px_70px]` = 358px + gaps. Borderline on a 375px screen but rendered inside ~95px main → completely off-screen. |
| `/funnels/[id]` (detail) | **Broken** | `px-10 py-10` and complex stat panels. |
| `/funnels/[id]/edit/[stepId]` | **Catastrophic by design** | Same `SectionEditor`. |
| `/funnels/[id]/review` | **Works but ugly** | Uses `sm:grid-cols-2 lg:grid-cols-3` — responsive. |

### 3.13 Automations

| Surface | Severity | Notes |
|---|---|---|
| `/automations` (admin/sub/client) | **Broken** | `AutomationFlowMini` and per-client group cards expect ≥ 600px. |
| `/automations/[id]` (editor) | **Broken** | `AutomationEditorLayout` = `grid-cols-[1fr_340px]` + sticky right rail. Action cards use `grid-cols-[26px_auto_1fr_auto_auto_auto]`. |

### 3.14 Campaigns

| Surface | Severity | Notes |
|---|---|---|
| `/campaigns` (admin) | **Broken** | `CampaignClientRow` = `grid-cols-[36px_1.4fr_110px_100px_110px_100px_100px]` = ~600px + gaps. |
| `/campaigns` (client / sub-account) | **Broken** | Single-campaign deep dive with `grid-cols-4` metric tiles + 4-week trend chart — fixed pixel work. |

### 3.15 Reviews

| Surface | Severity | Notes |
|---|---|---|
| `/reviews` (admin) | **Broken** | Per-client card grid; each card carries `grid-cols-[200px_1fr_240px]` = 440px fixed. |
| `/reviews` (sub-account / client) | **Broken** | Same `grid-cols-[200px_1fr_240px]` card layout. |

### 3.16 Search

| Surface | Severity | Notes |
|---|---|---|
| `/search` (admin/client) | **Works but ugly** | `SearchResultRow` is `grid-cols-[40px_1fr_auto]` — flexible. Survives but constrained inside 95px main. |

### 3.17 Admin-only

| Surface | Severity | Notes |
|---|---|---|
| `/(admin)/clients/new` (CreateClientButton + modal) | **Broken** | The modal is `size="lg"` (920px desktop; `max-w-[calc(100%-2rem)]` mobile) — but the content uses `grid grid-cols-2` and `grid-cols-[110px_1fr]` panels with `p-10` outer padding. Survives modal width but cramped internally. |
| `/(admin)/clients/new/result` | **Broken** | Result view + live previews. |
| `/(admin)/websites` (cross-client matrix) | **Broken** | The integrations matrix uses fixed-column widths and is intended desktop. |

### 3.18 Modals (cross-cutting)

| Modal | Severity | Notes |
|---|---|---|
| Most `size="default"` dialogs | **Works but ugly** | `max-w-[calc(100%-2rem)]` ensures mobile fit, but internal `p-10` is heavy. |
| `size="lg"` dialogs (14 usages) — `CreateClientModal`, `NewBookingModal`, `RescheduleModal`, `TeamInviteModal`, `PopupEditorDialog`, `SeoPanel`, `ManagePagesPanel`, etc. | **Broken** | Same fit, but internal multi-col grids (`grid-cols-3` for date pickers, `grid-cols-[1fr_300px]` for previews) overflow. |
| `ConfirmDialog` (size default) | **Works well** | Simple title + description + 2 buttons. |
| Notification popover (`w-[420px]`) | **Broken** | Wider than 375px screen. |

### 3.19 Severity counts

Surface inventory (52 routes, several rendering multiple role variants):

- **Works well:** 8 (login + customer-facing published sites including FormBlock)
- **Works but ugly:** ~10 (`/website` hub, `/website/new`, `/website/review`, `/funnels/[id]/review`, `/tickets/new`, `/search`, `/bookings/[id]/complete`, client `/leads` list, `ConfirmDialog`, simple settings tab bodies)
- **Broken:** ~28 (most of the authed app)
- **Catastrophic:** 6 — the AppShell+Sidebar root cause, `/calendar` (any role), and the section editors (by-design)

---

## 4. Customer-facing vs platform-admin separation

**This is the single most important framing in the audit.**

The platform has two completely separate mobile postures:

| Layer | Mobile-ready? | Reason |
|---|---|---|
| **Customer-facing published sites** (the websites + funnels visitors land on) | **YES, ready** | Built responsive from the section-library level (`@container` queries, `flex-wrap`, max-widths). The `FormBlock` lead-capture is mobile-OK. |
| **Platform admin** (operator + client surfaces) | **NO, not ready** | Built desktop-first. 280px non-collapsing sidebar + `px-10` body + fixed-pixel grids. |

The brief asked which matters most. **Both matter, but they're independently resolvable.**
The customer-facing layer can ship today — when a tradie's customer clicks a Google Ad
and lands on their published Webnua funnel, the experience is fine. The platform admin
is where every operator/client interaction lives, and that surface is unusable on a phone
today.

**This separation also means a "fix mobile" project can be split:**
1. *Customer-side mobile:* verify edge cases on real devices (1 session).
2. *Platform-side mobile:* a multi-session structural rebuild (see §7).

---

## 5. Critical mobile paths

| Path | Works on mobile? | Why |
|---|---|---|
| **Customer visits client's published site** | YES | `@container` queries + responsive `FormBlock`. |
| **Customer fills lead-capture form on funnel** | YES | `FormBlock` is `w-full`, native HTML inputs, mobile-friendly. |
| **Customer is redirected step-1 → step-2 of a funnel** | YES | Same render pipeline. |
| **User signs in** | YES | Centered Card on plain flex. |
| **Tradie (client) checks lead inbox between jobs** | NO | `/leads` is broken; even if accessible, the row grid overflows. |
| **Tradie replies to a lead from phone** | NO | `/leads/[id]/conversation` reuses TicketDetailLayout (`1fr 320px`). |
| **Operator triages cross-client inbox** | NO | `/leads` admin row is 586px+. |
| **Operator switches active client** | NO | `AdminClientPicker` lives in the always-280px sidebar; sidebar takes whole mobile screen. |
| **Operator marks job complete from on-site** | PARTIALLY | `/bookings/[id]/complete` is single-column form. Reaching it is the problem (sidebar/calendar blocked). |
| **Operator checks today's calendar** | NO | Calendar is catastrophic on mobile. |
| **Client requests a website change** | YES with caveats | `/tickets/new` is form-shaped; the trip to *reach* the form (sidebar nav) is broken. |
| **Client checks dashboard overview** | NO | `grid-cols-4` stat tiles non-responsive. |
| **Client edits page copy** | N/A | Editor is desktop-only by design (documented). |

The MOST IMPORTANT path — customer → funnel → lead — works.
Every OPERATIONAL path (the team running the platform) is broken.

---

## 6. Patterns vs one-offs

**Almost every broken surface traces to ONE OF FIVE root patterns** — not 28 independent bugs.

### Pattern 1: `AppShell grid-cols-[280px_1fr]` (1 file, fixes ~30 broken surfaces)
The whole authed app sits in this shell with no mobile collapse. Adding a mobile-drawer
pattern (sidebar slides in over content via hamburger) fixes the structural cause of
nearly every broken authed surface. Without this fix, every other fix is rearranging
deck chairs.

### Pattern 2: Universal `px-10 py-10` body padding (every page-content file)
A grep finds `px-10` body padding in dashboard, calendar, bookings, settings shell, etc.
40px each side on a phone wastes half the column. Should become `px-4 py-6 md:px-10 md:py-10`.

### Pattern 3: Fixed-pixel multi-column grids (`grid-cols-[Apx_Bpx_...]`) — 86 occurrences in components
Row layouts for leads (`36px_180px_1fr_110px_80px_80px_100px`), tickets, campaigns,
domains, etc. Each blows past 375px. The fix isn't "add responsive variants to all 86" —
the fix is **add `overflow-x-auto` wrappers** to the list containers, OR **redesign as
mobile cards** (each row becomes a stacked card under 768px).

### Pattern 4: Non-responsive stat-card grids (`grid-cols-4`, `grid-cols-3`)
Dashboard, hub, client dashboard. Each StatCard becomes ~24px wide. Pattern fix: change
to `grid-cols-2 md:grid-cols-4`. One-line change per file (~10 files).

### Pattern 5: 320px detail-rail layouts (`TicketDetailLayout`, `AutomationEditorLayout`)
`grid-cols-[1fr_320px]` (and `1fr_340px`, `1fr_400px`). These need the rail to stack
*below* the main on mobile. Pattern fix: `grid-cols-1 lg:grid-cols-[1fr_320px]`.

### One-offs (worth listing)
- `NotificationBell` popover `w-[420px]` — needs `max-w-[calc(100vw-1rem)]` or similar.
- `Calendar` grid — needs a wholly different mobile representation (day-view + day-picker).
- `SettingsShell` `grid-cols-[220px_1fr]` — needs the tab nav to become a top horizontal
  scrolling row on mobile (`flex overflow-x-auto`) instead of a left column.
- `Button` `size="sm"` is 32px tall — below 44px iOS tap target standard.

---

## 7. Recommended fix order (top 10)

Ordered for maximum surface-area unlock per session.

| # | Fix | Pattern or one-off? | Complexity | Unlocks |
|---|---|---|---|---|
| 1 | **AppShell mobile drawer** — add a hamburger button to `Topbar` that toggles the sidebar as an off-canvas overlay on `<md`; AppShell becomes `grid-cols-1 md:grid-cols-[280px_1fr]`. | Pattern | Medium (1 session) | Unblocks every authed surface. Pre-requisite for everything else. |
| 2 | **`px-10` body-padding pass** — global find/replace `px-10 py-10` → `px-4 py-6 md:px-10 md:py-10` across ~25 page content files. | Pattern | Low (1 session) | Adds usable horizontal space across every authed surface. |
| 3 | **Detail-rail collapse** — `grid-cols-[1fr_320px]` → `grid-cols-1 lg:grid-cols-[1fr_320px]` in `TicketDetailLayout`, `AutomationEditorLayout`, the inline lead-detail shape. | Pattern | Low (1 session) | Lead detail, ticket detail, automation editor become usable. |
| 4 | **Dashboard stat-card responsiveness** — `grid-cols-4` → `grid-cols-2 md:grid-cols-4` on every stat-tile grid (`/dashboard` admin/hub/client, `LandingSnapshotCard`, `ClientHubHero`). | Pattern | Low (1 session) | All three dashboard variants become usable. |
| 5 | **List row containers — `overflow-x-auto` wrappers** — wrap every fixed-pixel grid row (`LeadRow`, `TicketRow`, `CampaignClientRow`, `AllDomainsTable`, `InvoiceList`, `ApiKeyRow`, `SessionRow`, `DnsRecordsTable`) in `<div className="overflow-x-auto">`. Adds horizontal scroll without redesigning. | Pattern | Low (1 session) | Roughly half the broken inbox/list surfaces become "broken but scrollable". Stopgap before redesigning as mobile cards. |
| 6 | **List rows redesigned as mobile cards** — under `<md`, hide the grid layout and render each row as a stacked card with the same data in a vertical flow. Affects `LeadRow`, `TicketRow`, `CampaignClientRow`, `ClientListRow`, `FunnelApprovalRow`, `WebsiteApprovalRow`. | Pattern | Medium-high (2 sessions) | All inbox/list surfaces become genuinely mobile-good rather than scroll-wallpapered. |
| 7 | **Settings shell mobile collapse** — `SettingsNav` becomes a horizontal scrolling pill row on mobile; `SettingsShell` collapses the `220px_1fr` grid to `grid-cols-1`. | Pattern | Medium (1 session) | All 16 settings tabs become usable. |
| 8 | **Calendar mobile redesign** — replace the 6-day week-grid with day-view + day-picker under `<md`. Different component, not a CSS tweak. | One-off (big) | High (1-2 sessions) | `/calendar` becomes usable; unblocks the daily on-site operator pattern. |
| 9 | **Notification bell popover** — `w-[420px]` → `w-[min(420px,calc(100vw-1rem))]` + reposition to centre on mobile or full-width drawer. | One-off | Low (1 session, can bundle with #1) | Notifications usable on mobile. |
| 10 | **Modal internal padding + grid** pass — `size="lg"` modals (`NewBookingModal`, `RescheduleModal`, `CreateClientModal`, `TeamInviteModal`, `SeoPanel`, `ManagePagesPanel`, `PopupEditorDialog`) — drop `p-10` to `p-5 md:p-10`, change internal `grid-cols-3` date pickers to `grid-cols-1 md:grid-cols-3`. | Pattern | Medium (1 session) | All modals usable on mobile. |

### Out of scope (intentionally not on the list)
- `SectionEditor` and downstream editor shells (`builder-design.md` carves these out as
  desktop-only V1).
- Customer-facing published sites (already mobile-ready).

---

## 8. Estimated session count to launch-ready mobile

**Total: 7–9 focused sessions** to bring the authed app from "completely broken on mobile"
to "fully usable on mobile" (where "fully usable" means: every critical operator/client
flow works on a 375px viewport; the dashboards are scannable; lead inbox + reply works;
calendar has a real mobile view).

| Tier | Sessions | Description |
|---|---|---|
| **Tier 1 — unblock (3 sessions)** | Fix #1 (sidebar drawer), #2 (`px-10` pass), #3 (detail-rail collapse), #4 (dashboard stat-tile responsiveness) | Authed app becomes *navigable* and the dashboards become scannable. |
| **Tier 2 — usable (3 sessions)** | Fix #5 (list-row scroll wrappers — stopgap), #7 (settings shell), #10 (modal internals), #9 (notification popover) | Every routine flow works; some surfaces are "scrollable but ugly" rather than redesigned. |
| **Tier 3 — polished (2-3 sessions)** | Fix #6 (list rows as mobile cards), #8 (calendar mobile day-view) | Surfaces become genuinely mobile-good, not just "doesn't break". |

**Customer-facing published sites:** add **1 verification session** (live-device pass
across 320/375/414 viewports + iOS Safari quirks). I'm 95% confident they work based on
code patterns; the 5% is iOS Safari–specific behaviour static analysis can't catch.

**Bottom line: 8–10 sessions total to reach "launch-ready mobile" across both layers.**

---

## 9. Architectural decisions needed before fix work starts

These need to be decided before Tier 1 begins, because they shape every subsequent fix.

1. **Mobile sidebar pattern.** Off-canvas drawer (slides in over content with overlay)
   vs. bottom-tab nav (iOS-app-style 4–5 tab bar). The drawer preserves the current 280px
   sidebar verbatim; bottom tabs would mean designing a flat 4–5 item nav per role.
   **Recommendation:** drawer, because it preserves the structurally-decided role-aware
   sidebar contents (`AdminClientPicker`, workspace blocks, the nested groups).
   Bottom-tab would force a parallel nav design.

2. **List rows on mobile: scroll-wrapper (stopgap) vs. card-stack (redesign).** A
   scroll wrapper is one session; the card-stack redesign is two sessions per list type.
   **Recommendation:** ship the scroll wrapper as Tier 2, then bake card-stacks in as
   Tier 3.

3. **Calendar mobile view.** Day-view + day-picker is the obvious answer; the question
   is whether bookings-per-day are dense enough to need an agenda list instead of a
   pixel-positioned timeline. **Recommendation:** day-view timeline at the same 50px/hr
   scale + a swipe-to-change-day gesture. Defer agenda-list view until use data shows
   density.

4. **`SettingsShell` mobile pattern.** Top horizontal pill nav vs. accordion sections.
   **Recommendation:** horizontal pill nav matches the existing visual vocabulary
   (`TicketTabsBar`, `FilterChips`) — reuse, don't invent a third nav pattern.

5. **Editor — strict desktop-only or polite mobile guard?** Today `SectionEditor` is
   catastrophic on mobile but renders anyway. Per `builder-design.md` it's V2 work.
   **Recommendation:** for V1 launch-ready-mobile, add a polite mobile redirect screen
   ("Editing your site is desktop-only — open this URL on a laptop") rather than ship
   a broken editor.

6. **Tap-target audit follow-up.** `Button size="sm"` is 32px — below the 44px iOS
   standard. Decide whether `size="sm"` becomes `min-h-[44px]` on touch devices via
   `[@media(pointer:coarse)]` variant or whether the sm size is reserved for
   non-tap-target contexts (e.g. icon buttons inside hover toolbars that never appear
   on touch). **Recommendation:** the second — keep `sm` for editor chrome, audit
   each on-page usage.
