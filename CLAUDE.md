# CLAUDE.md — Webnua Platform

> This file is read at the start of every Claude Code session. It is the standing
> instruction set for this project. Keep it concise — bloat costs context every session.
> **When something goes wrong, fix the instance AND add a line here so it never recurs.**

---

## What this project is

The Webnua platform — **one application, two roles, role-based access:**

- **Client view** — what a Webnua customer (a business owner) sees: their funnels, tickets, integrations, websites, settings.
- **Admin/operator view** — what the Webnua team sees: all clients, the Proof Page pipeline (audit → build → generate), internal automations, the cross-client integrations matrix, ticket inbox.

These are **not two apps.** They are one codebase, one component library, one design system, with routing and layouts that branch by role. A large share of components are **shared** between the two views. Treat shared-by-default as the assumption; role-specific is the exception that needs justifying.

---

## Stack — these are decided. Do not introduce alternatives.

- **Framework:** Next.js (App Router) + React + TypeScript
- **Styling:** Tailwind CSS, themed to the prototype's design tokens (see Design System below)
- **Primitives:** shadcn/ui — the canonical primitive layer. Button, Input, Dialog, Card, Badge, etc. come from here.
- **Backend (intended, building later):** Supabase. Frontend is built now; build the data layer with Supabase's shape in mind (role-based row access, the audit→proof-page record relationship). Do not invent a placeholder data pattern that will be ripped out.
- **TypeScript:** strict mode, from line one. No `any` without a written reason.

If a task seems to need a library not listed here, **stop and ask** before adding it. Every dependency is a decision.

---

## The cardinal rule: check before you build

**Before creating ANY component, hook, util, or type — search the codebase for an existing one.**

- Grep `src/components/` and `src/lib/` for anything that does this or is close.
- If something close exists: **extend it or compose with it.** Do not create a parallel version.
- If you're unsure whether something exists: **search, don't assume.** An unnecessary search is free; a duplicate component is technical debt.
- If a genuinely new component is needed, check whether it belongs in `ui/`, `shared/`, or a route folder (see Structure) before creating it.

Duplicate components for the same concern are the #1 failure mode this project is guarding against. One canonical Button. One canonical FindingCard. One canonical Stepper.

---

## Project structure — where things live

```
/reference          → the HTML prototypes + spec docs. READ-ONLY. Never import from here.
/src
  /app              → Next.js App Router. Layouts branch by role here.
    /(client)       → client-role routes + client layout
    /(admin)        → admin-role routes + admin layout
    /(auth)         → login / role resolution
  /components
    /ui             → shadcn primitives + low-level building blocks. Canonical. Shared by everyone.
    /shared         → composed components used by BOTH client and admin views
    /client         → composed components used ONLY by the client view
    /admin          → composed components used ONLY by the admin view
  /lib              → utils, helpers, hooks, types, constants
  /lib/types        → shared TypeScript types — the single source of truth for data shapes
```

**Placement rules:**
- A component used by both roles → `components/shared/`. Default here.
- A component used by one role → `components/client/` or `components/admin/`.
- A primitive (does one small thing, no business logic) → `components/ui/`.
- If a `client/` component starts being needed in `admin/`, **move it to `shared/`** — don't copy it.

---

## The prototypes — how to use them

Two HTML prototypes live in `/reference`. They are the **visual and behavioural specification.** They are NOT source to port.

- **Design tokens → extract verbatim.** Colours, fonts, radii, spacing from the prototype CSS go into the Tailwind config. Pure extraction.
- **Primitives → build fresh, once.** Match the prototype's styling, build the canonical shadcn-based version.
- **Composed components → build fresh from primitives**, using the prototype as the visual + behaviour spec.
- **The prototype HTML → never imported into `src`.** It is read-only reference. Look at it to know what to build; never copy from it.

Do not "convert the HTML screen by screen." That produces one-off components. Build the token layer, then primitives, then compose.

---

## Design system

The look comes from the prototype. The tokens (lift these into `tailwind.config` and the CSS variables):

- **Colours (Webnua palette — source of truth):** paper `#f5f1ea`, paper-2 `#ebe5d9`, paper-3 `#e0d8c8`, ink `#0a0a0a` (with ink-soft `#2a2a28`, ink-mid `#4a4a45`, ink-quiet `#6e685c`), rust `#d24317` (with rust-deep `#8a3815`, rust-light `#e8743b`, rust-soft `#f4dccd` — the Perth landing page uses `#d24317`; the tools used `#d45b1a`, **standardise on `#d24317`**), good `#1e6b3a`, warn `#c44444`, info `#2d7d8a`, plum `#6b4ea6` (category swatch — campaigns), amber `#c8941e` (category swatch — reviews), rule `#c9c0b0`.
- **Two utility vocabularies, one bright line.** `globals.css` also exposes shadcn role aliases (`primary`, `secondary`, `background`, `foreground`, `card`, `popover`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`) pointing at the Webnua palette. These are NOT a parallel palette — they're a role layer used internally by shadcn-derived primitives. **Bright line:** shadcn-derived files (anything pulled from `npx shadcn add ...`) keep the shadcn role vocabulary they ship with — don't fight upstream. Everything Webnua-authored — custom primitives in `ui/` like `Eyebrow`/`StatusDot`, and all of `shared/`, `client/`, `admin/` — uses the Webnua palette names (`bg-paper`, `text-ink`, `border-rule`, `text-rust`, etc.). The test is "did this file come from shadcn or did we write it" — no judgment call.
- **Fonts:** Inter Tight (display + body), JetBrains Mono (eyebrows, data, technical labels).
- **Feel:** light theme — paper backgrounds, ink text, rust accent. Heavy uppercase Inter Tight for display headings, tight letter-spacing. Mono eyebrow tags. Generous section rhythm.

When a design decision isn't covered by a token, **ask rather than inventing** — design drift is hard to undo later.

---

## Workflow rules — how we work together

1. **Plan before code.** For anything beyond a trivial change, explain the approach and list the files you'll touch *before* writing. Wait for confirmation on anything non-obvious.
2. **One screen or one feature per session** where possible. Small, focused scope. Large unfocused sessions are where redo/undo happens.
3. **Don't refactor unrelated code while doing something else.** Fixing a bug? Fix the bug. See something else messy? Mention it, don't touch it.
4. **Respect what's working.** Do not "improve," reformat, or restructure code that wasn't part of the task. If existing code looks wrong but works, ask before changing it.
5. **If a change touches more than ~5 files, stop and confirm** the approach before proceeding.
6. **Commit at every working state.** A clean git history is the undo button. Suggest a commit whenever something works.
7. **No silent scope expansion.** If the task turns out bigger than it looked, say so and re-confirm — don't just keep going.

---

## Code conventions

- **Components:** one component per file, named export, file named after the component (`FindingCard.tsx`).
- **Component internal layout:** consistent order — types/props at top, the component, helpers below. Predictable structure makes debugging navigation, not archaeology.
- **Types:** shared data shapes live in `src/lib/types`. Don't redefine the same shape in two places — import it.
- **Naming:** descriptive and specific. `ProofPageStepper` not `Stepper2`. No numbered suffixes ever — a numbered suffix means a duplicate that should have been a reuse.
- **State:** local state for local concerns. Lift only when genuinely shared. Don't reach for global state by default.
- **Error handling:** [decide the pattern on first real use, then document it HERE so it's consistent everywhere].
- **No dead code.** Don't leave commented-out blocks "just in case" — git remembers.

---

## What NOT to touch

- `/reference` — read-only, ever.
- Generated files, lockfiles, `.next/`.
- The `@theme` block in `src/app/globals.css` (the Webnua design tokens — palette, fonts, radii, shadows) and `tsconfig` strict settings — these are deliberate. Tailwind v4 is CSS-first, so tokens live in `@theme`, not `tailwind.config.*`. Changing them needs a conversation.
- Any config that's clearly intentional — ask first.

---

## Known component inventory

> Keep this list current. When a shared component is built, add it here so future sessions
> find it instead of rebuilding it. This is the map that prevents duplication.
> Format: **`Name`** — purpose — variants/sizes/notable props.

### `ui/` — primitives

**shadcn-derived (keep shadcn role vocabulary; don't fight upstream):**

- **`Button`** (`button.tsx`) — canonical action element. Themed to prototype: `h-10 px-[22px]` default, `rounded` (8px), `font-bold`. Variants: `default` (rust/primary), `secondary` (paper-2 with border), `outline` (white with border), `ghost` (transparent, muted text), `link`, `destructive`. Sizes: `sm`, `default`, `lg`, `icon`. Supports `asChild` via Radix `Slot`.
- **`Input`** (`input.tsx`) — single-line text input. `h-10`, white card bg, 14px×10px padding, `rounded-md`. Inherits `bg-card`/`border-input` from alias layer. Standard HTML input props; supports `aria-invalid` styling.
- **`Textarea`** (`textarea.tsx`) — multi-line text input. Same shape as Input but `min-h-20`, `font-mono`, `field-sizing-content` (auto-grows).
- **`Select`** + `SelectTrigger` / `SelectContent` / `SelectItem` / `SelectGroup` / `SelectLabel` / `SelectSeparator` / `SelectValue` / `SelectScrollUpButton` / `SelectScrollDownButton` (`select.tsx`) — Radix-backed dropdown. Trigger has `sm` / `default` sizes. Content opens below by default (popper, start-aligned). Use for any dropdown with discrete options.
- **`Dialog`** + `DialogTrigger` / `DialogContent` / `DialogHeader` / `DialogFooter` / `DialogTitle` / `DialogDescription` / `DialogClose` / `DialogOverlay` / `DialogPortal` (`dialog.tsx`) — Radix-backed modal. **`DialogContent` accepts `size`: `sm` (480px) / `default` (560px) / `lg` (920px).** White card surface, `rounded-2xl`, `p-10`, paper backdrop. Close button auto-renders top-right (suppress with `showCloseButton={false}`).
- **`Card`** + `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` / `CardAction` (`card.tsx`) — white-on-paper surface panel (`.auto-card` in proto). `rounded-xl`, `border-border`, `shadow-card`, `py-6`. Use for any bordered content surface; compose with the sub-parts.
- **`Badge`** (`badge.tsx`) — small pill label, `rounded-full`. Variants: `default` (rust filled), `secondary` (paper-2), `muted` (paper-2 + quiet text — most common in proto), `destructive`, `outline`. Supports inline children including `StatusDot` for dot-prefixed status pills.
- **`Tabs`** + `TabsList` / `TabsTrigger` / `TabsContent` (`tabs.tsx`) — Radix-backed tabs. `TabsList` has `default` (filled pill) and `line` (underline) variants. Default orientation horizontal; vertical supported via `orientation="vertical"`.
- **`Tooltip`** + `TooltipProvider` / `TooltipTrigger` / `TooltipContent` (`tooltip.tsx`) — Radix-backed tooltip. **Wrap the app (or section) in `TooltipProvider`** for tooltips to function. Ink-on-paper styling with arrow.

**Webnua-authored (use Webnua palette tokens; bright line in design-system above):**

- **`BrandMark`** (`BrandMark.tsx`) — canonical "Webnua ◆" wordmark: rotated rust diamond + Inter Tight wordmark, `font-extrabold tracking-[-0.03em]`. Sizes: `sm` / `default` (sidebar size) / `lg` (auth screen). Color is inherited via `text-*` on the parent — set `text-paper` on ink backgrounds, `text-ink` on paper. No business logic. **`SidebarBrand` composes this**; don't duplicate the glyph elsewhere.
- **`Eyebrow`** (`eyebrow.tsx`) — mono uppercase tag used as section/eyebrow label across both prototypes (`.sidebar-section-label`, `.modal-tag`, etc.). JetBrains Mono, `text-[10px]`, `tracking-[0.14em]`, `font-bold`, uppercase. Tones: `rust` (default, brand), `ink`, `quiet`. Optional `bullet` prop renders a leading colored dot via `::before`.
- **`StatusDot`** (`status-dot.tsx`) — 6px colored circle used as inline status/severity indicator (matches `.status-dot` in proto). Tones: `good` (default), `warn`, `info`, `rust`, `quiet`. Composable inside `Badge`/`Eyebrow` for dot-prefixed pills.
- **`Switch`** (`switch.tsx`) — bespoke 44×24 toggle, Radix Switch under the hood. Matches `.toggle` in proto exactly: rule-bg off / good-bg on, 18px white knob slides 20px on activate. Optional `label` prop renders a mono uppercase label adjacent (quiet off, good on — peer-data driven). Use for any boolean on/off control.

### `shared/` — app shell + cross-role composed components

- **`AppShell`** (`AppShell.tsx`) — top-level grid wrapper for the authed app. `grid-cols-[280px_1fr] min-h-svh bg-paper`. Takes `sidebar` slot + `children` (the main area). The 280px sidebar + 1fr main matches both prototypes exactly.
- **`Sidebar`** (`Sidebar.tsx`) — ink-bg, sticky-to-viewport, scrollable column. Structure only; children are passed in (brand, sections, items, footer). Compose via `ClientSidebar`/`AdminSidebar` rather than using directly.
- **`SidebarBrand`** (`SidebarBrand.tsx`) — sidebar-header composition: `BrandMark` (rendered `text-paper` on the ink sidebar bg) + a mono meta line below. Prop: `meta` (e.g. `"Client workspace"` / `"Operator console"`). For the plain wordmark on other surfaces, use `BrandMark` directly (e.g. the auth screen).
- **`SidebarSectionLabel`** (`SidebarSectionLabel.tsx`) — mono uppercase eyebrow used between sidebar groups (`// Your business`, `// Overview`, etc.). Renders `// {children}` styled paper-on-ink quiet.
- **`SidebarItem`** (`SidebarItem.tsx`) — nav row inside the sidebar. Icon + label + optional badge. Wraps `next/link`. Auto-detects active state from `usePathname`. Active state = left rust rail + lifted bg + rust-light icon. Takes a `NavItem` (`{ label, href, icon, badge? }`).
- **`SidebarUser`** (`SidebarUser.tsx`) — bottom-of-sidebar user card. Avatar circle + name + role meta. Props: `initial`, `name`, `role`.
- **`Topbar`** (`Topbar.tsx`) — page-level top bar inside `main`. Three slots: `breadcrumb` (left), `middle` (centered, optional — admin uses it for the step-tracker), `actions` (right, optional). Sticky to the main area with rule border.
- **`TopbarBreadcrumb`** (`Topbar.tsx`) — helper that renders `trail / trail / current` in mono uppercase. Pass as the `breadcrumb` slot of `Topbar`.
- **`PagePlaceholder`** (`PagePlaceholder.tsx`) — placeholder body block used by Phase-4 stub routes and any not-yet-built page. Eyebrow + title + description + a dashed-border "wiring only" hint card. Replace with real page content as each route is built.
- **`PageHeader`** (`PageHeader.tsx`) — canonical page-top block: rust mono `eyebrow` (string, rendered through `Eyebrow tone="rust" bullet`) + 40px Inter Tight `title` (ReactNode, so callers pass `<>Your <em>clients</em>.</>` for rust em-highlight) + optional `subtitle` (ReactNode, `<strong>` segments render ink-bold). Matches the `.screen-title-block`/`.greeting-block` pattern from both prototypes. Default `mb-8` rhythm.
- **`StatCard`** (`StatCard.tsx`) — single white-card stat tile: mono quiet `label` + 30px Inter Tight `value` (ReactNode, supports `<em>` for rust highlight) + optional `trend` line. `trendTone: 'good' | 'quiet'` (default `good`). Matches `.client-stat-card` (admin) and `.c-landing-stat` (client) 1:1. Compose in a `grid grid-cols-4 gap-3.5` row — no `StatRow` wrapper, the grid is too thin to abstract.
- **`DevRoleSwitcher`** (`DevRoleSwitcher.tsx`) — **STUB.** Floating bottom-right pill that shows the current stubbed role and lets you flip client↔admin or sign out. Mounted only inside `(client)` and `(admin)` layouts. Delete with the rest of the role stub (see Open decisions).

### `shared/settings/` — settings + integrations screen pair (Phase 5 sessions A + B)

> **Architectural note — settings lives outside the role route groups.** Routes whose URL space is **shared** between roles can't live inside `(client)` or `(admin)` — Next.js refuses two route groups resolving to the same URL. Three such shared route trees exist at the top level: **`app/dashboard/`** (admin home + client home), **`app/settings/`** (the entire `/settings/*` tab space), and **`app/tickets/`** (`/tickets`, `/tickets/[id]`, `/tickets/new`). Each has its own `layout.tsx` ('use client', reads `useRole()`, picks `ClientSidebar` vs `AdminSidebar`, also mounts the `DevRoleSwitcher`). For `/dashboard` the page itself is a `'use client'` dispatcher with `_admin-content.tsx` / `_client-content.tsx` siblings. For settings, role-specific tab slugs (`/profile`, `/workspace`, `/team`, `/notifications`, `/security`, `/help`, `/defaults`, `/api`, `/danger`) are reached only from the correct role's nav, so their pages render statically without re-checking role; shared-slug tab pages (`/settings/integrations`, `/settings/billing`) are `'use client'` and dispatch on `useRole()` — per-role bodies live as `_admin-content.tsx` / `_client-content.tsx` siblings (underscore = naming convention, not a Next.js private rule). Admin-only URLs that aren't shared still live inside `(admin)` — e.g. `/clients/new/*` (the onboarding wizard) and `/integrations` (the cross-client matrix). When real auth ships, the shared-route layouts become the place to check the JWT role and 404/redirect on mismatched access; nothing else moves.

- **`SettingsShell`** (`settings/SettingsShell.tsx`) — wraps `PageHeader` + the two-column settings layout (`220px` nav left + `1fr` panel right, `gap-7`, `items-start`). Used by every tab page under `app/settings/*` (see the architectural note below — settings lives **outside** the `(client)`/`(admin)` route groups because the URL space is shared between roles). Props: `eyebrow`, `title`, `subtitle`, `items` (the role's `SettingsNavItem[]`), `children` (the right-column panel content). Provides the page padding (`px-10 py-10`) — each tab page renders `Topbar` separately above it.
- **`SettingsNav`** (`settings/SettingsNav.tsx`) — vertical tab nav rendered as `next/link`s. Active state from `usePathname` (matches exact `href` or any deeper path under it). Active style = ink-bg + paper text; inactive = ink-quiet text on paper, hover bumps to paper-2 + ink. Driven by `SettingsNavItem[]` from `lib/nav/`.
- **`SettingsSection`** (`settings/SettingsSection.tsx`) — vertically-stacked section block inside a `Card`. Props: `heading` (ReactNode, supports `<em>` for rust highlight — covers both the plain `settings-section-h` and the `*-content-h` rust-em variants from the prototype), `description` (ReactNode, `<strong>` renders ink-bold), `children`. Auto-separates from the next section with `border-b border-paper-2 pb-7 mb-7`, and removes the border + bottom rhythm when it's the last child (`last:border-b-0 last:mb-0 last:pb-0`).
- **`SettingsFieldRow`** (`settings/SettingsFieldRow.tsx`) — single label/value row inside a `SettingsSection`. Props: `label` (string), `sub` (optional string under label), `value` (ReactNode — wrap a span in `className="mono"` for the JetBrains Mono treatment), `action` (optional ReactNode — typically a "Edit ✎" / "Request change ✎" inline affordance). Grid `220px 1fr`, dotted bottom rule between rows, no rule on the last row.
- **`IntegrationCard`** (`settings/IntegrationCard.tsx`) — the integration row used on both `/settings/integrations` pages. Logo block (56×56, brand-tinted) + name + status pill (inline with name on both roles — converged on the better layout) + description + optional `meta` line + action button. Props: `name`, `description` (ReactNode), `status: 'connected' | 'warning' | 'missing' | 'partial'`, optional `statusLabel` to override the default ("Connected"/"Needs reauth"/"Not connected"/"Partially connected"), `logo: { initial, tone? }` where `tone` is `'gbp' | 'meta' | 'ga' | 'gads' | 'stripe' | 'generic'` (defaults to generic = ink-bg / rust-light glyph), optional `meta` (ReactNode — colour shifts to warn on `warning` status), and `action: { label, href?, variant? }`. Re-exports `IntegrationStatus`, `IntegrationLogoTone`, `IntegrationAction`, `IntegrationCardProps`.
- **`IntegrationProgressHero`** (`settings/IntegrationProgressHero.tsx`) — the ink-bg rust-tagged progress band at the top of the client `/settings/integrations` page. Props: `tag` (rust mono pill string), `title` (ReactNode, `<em>` = rust highlight, 26px headline), `subtitle` (ReactNode, `<strong>` = paper-bold), `connected` + `total` (numeric — drives the big mono fraction + the rust→rust-light gradient fill), `remainingLabel` (ReactNode for the right-of-bar caption). For the admin cross-client matrix's different hero shape (stat tiles, not a single fraction), see `admin/integrations/IntegrationMatrixHero`.
- **`SettingsPanel`** (`settings/SettingsPanel.tsx`) — extracted from the inline `<Card className="py-7"><CardContent className="px-8">` pattern (parked-decision trigger fired on second-use). White-card surface that holds a sequence of `SettingsSection` children with the correct vertical rhythm. Single `className` knob; no other props. Every tab page uses this; no tab page should re-inline the `Card` + `CardContent` composition.
- **`NotificationRow`** (`settings/NotificationRow.tsx`) — single notification preference row used on the client Notifications tab. Props: `label`, optional `sub`, `channels: NotificationChannel[]` (e.g. `['sms','email','push']` — declares which channels are valid for this notification), `active: NotificationChannel[]` (which are currently on). Renders each channel as a dot+label pill — good-green when on, ink-quiet when off. Re-exports `NotificationChannel` type.
- **`BillingPlanCard`** (`settings/BillingPlanCard.tsx`) — ink-bg plan card used at the top of both client + admin `/settings/billing`. Props: `tag` (rust-light mono string), `name` (ReactNode, `<em>` = rust-light highlight, 26px headline), `meta` (ReactNode, `<strong>` = paper-bold), `action` (ReactNode — typically a `Button`). The action slot is open so each role can use its own button styling (client uses a quiet secondary "Talk to Craig"; admin uses the rust primary "Change plan").
- **`InvoiceList`** (`settings/InvoiceList.tsx`) — bordered table of invoice rows used on both billing tabs. Takes `invoices: Invoice[]` where `Invoice = { id, date, description, amount, status: 'paid' | 'pending' | 'failed' }`. Includes a mono header row + a per-status colour-coded status pill + a rust "PDF ↓" affordance per row. Re-exports `Invoice`.
- **`SecurityRow`** (`settings/SecurityRow.tsx`) — bordered row used on the client Login + security tab (credentials + 2FA sections). Props: `heading`, optional `status: { tone: 'verified' | 'warn', label? }` (renders an inline dot-prefixed pill, good-green for verified, rust for warn/recommended), `description` (ReactNode), `action: { label, variant? }` (rendered through `Button`). Re-exports `SecurityRowStatus`.
- **`SessionRow`** (`settings/SessionRow.tsx`) — single active-session row in Login + security. Props: `icon` (emoji glyph), `device`, optional `isCurrent` (renders the rust "THIS DEVICE" pill and suppresses the revoke action), `meta` (mono ink-quiet metadata), `when` (right-aligned mono timestamp). Dotted bottom rule between rows, no rule on the last.
- **`HelpFaqItem`** (`settings/HelpFaqItem.tsx`) — collapsible FAQ entry on the Help tab. Uses native `<details>` for state (no JS), so it works in server components and degrades gracefully. Props: `question`, optional `answer` (ReactNode — items without answers render as question-only, matching the prototype's "expand to see answer" UX), `defaultOpen`. The `+`/`−` glyph toggles via `group-open:` Tailwind variants.
- **`TeamRow`** (`settings/TeamRow.tsx`) — admin Team-tab member row. 5-column grid: avatar (rust-gradient circle) + name & email + role & sub-role + status pill (good for active, rust for pending — dot-prefixed) + actions (mono action chips, with `tone: 'danger'` flipping the hover to warn-bg).
- **`ApiKeyRow`** (`settings/ApiKeyRow.tsx`) — admin API + webhooks tab. 4-column grid: name + masked token, created mono meta, used mono meta, revoke action. Mono token uses JetBrains Mono. The created/used meta slots are `ReactNode` so callers can pass `<>Created <strong>21 Mar 2026</strong></>` for the ink-bold treatment.
- **`WebhookEventRow`** (`settings/WebhookEventRow.tsx`) — single webhook-delivery log row. 3-column mono grid: time (quiet) + event name (rust bold) + status (right-aligned good for `ok`, warn for `failed`). `statusLabel` defaults to `✓ 200 OK` / `✗ Failed` but is overridable.
- **`DangerRow`** (`settings/DangerRow.tsx`) — warn-tinted destructive-action row on the Danger zone tab. Props: `heading`, `description` (ReactNode), `action: { label, solid?, tone? }`. `solid: true` renders a filled destructive `Button`; otherwise `tone: 'neutral'` (ink-bordered, for non-destructive actions like Export) or `tone: 'destructive'` (warn-bordered, the default). Border + bg colour-coded across the whole row.

### `shared/tickets/` — tickets inbox + detail (Phase 5 sessions A + B)

> **Architectural note — tickets lives outside the role route groups, same reason as settings.** Both roles need `/tickets` and `/tickets/[id]`, so `app/tickets/` lives at the top level with its own `layout.tsx` (`'use client'`, reads `useRole()`, picks `ClientSidebar` vs `AdminSidebar`, mounts `DevRoleSwitcher`). The inbox page (`app/tickets/page.tsx`) and the detail page (`app/tickets/[id]/page.tsx`) are both `'use client'` dispatchers — per-role bodies live as `_admin-content.tsx` / `_client-content.tsx` siblings (same `_`-prefixed convention as `/settings/integrations`). `/tickets/new` is a client-only placeholder route (`PagePlaceholder`) reachable from the client inbox's "+ New ticket" CTA — the submit-form arrives in a later session. The `[id]` segment matches any non-`new` slug; for the stub layer it renders a single canonical detail regardless of the actual id (matches the prototype, which only fleshed out TKT-0247).

**Inbox (session A):**

- **`TicketsHero`** (`tickets/TicketsHero.tsx`) — ink-bg rust-tagged hero band at the top of both `/tickets` pages. Props: `tag` (mono pill string), `title` (ReactNode, `<em>` = rust highlight, 30px headline), `subtitle` (ReactNode, `<strong>` = paper-bold), `right` (ReactNode slot — client passes a "+ New ticket" `Button`; admin passes a row of `TicketsHeroStat`s). Standalone — NOT extracted into an `InkHero` primitive (see parked decisions). Sibling export **`TicketsHeroStat`** renders one of the admin hero's right-aligned numbers + mono label, with `tone: 'warn' | 'rust' | 'neutral'` controlling the `<em>` colour.
- **`TicketTabsBar`** (`tickets/TicketTabsBar.tsx`) — `'use client'` pill-tab strip with optional counts. Active tab = ink-bg paper-text rounded-full + count chip on paper/15; inactive = ink-quiet text + count chip on ink/8. Props: `tabs: TicketTab[]` + `defaultActiveId?`. Local `useState` active state — fine for the stub layer; lift when real filtering wires up.
- **`CategoryTile`** (`tickets/CategoryTile.tsx`) — colored mono-glyph square used in the client-variant `TicketRow` as the left-cell category indicator. 6 categories × 6 colors (website→rust, marketing→info, campaigns→plum, reviews→amber, billing→good are all Webnua palette tokens; `other` still uses inline `#5a5a5a` — flag if a third use lands and we'll tokenise that too). `size: 'sm' | 'md'` (md is the row size; sm available for tighter contexts).
- **`pills.tsx`** (`tickets/pills.tsx`) — four small pill primitives exported together so all status/category/urgency colour decisions live in one file: **`StatusPill`** (open/in_progress/blocked/done with `reviewAware` flag — when true, `in_progress` + `awaiting === 'client'` renders as a rust-outlined "Review" pill; optional `label` overrides the default text for e.g. "Open · awaiting your reply" in the detail header), **`UrgencyPill`** (rush/soon/none), **`CategoryPill`** (admin row's pill-style category cell), **`AttentionPill`** (rust-filled "Reply needed" / "Draft ready"). Webnua-authored — uses Webnua palette tokens directly (not `Badge`, which keeps shadcn role vocab).
- **`TicketRow`** (`tickets/TicketRow.tsx`) — the single canonical row, discriminated by `variant: 'client' | 'admin'`. Both variants are `next/link` rows with shared "needs attention" treatment (left rust rail + faint rust bg) — converged from the prototype's `.attention` (client) and `.unread` (admin) variants per the agreed unification. Client variant: `auto 1fr auto auto auto` grid — `CategoryTile` + title+preview (with inline `AttentionPill` when `awaiting === 'client'`) + category label + `StatusPill reviewAware` + age. Admin variant: `20px 180px 1fr 110px 120px 110px 80px` grid — checkbox + client mini-card (tone-tinted avatar + name + mono meta) + title+preview + `CategoryPill` + `StatusPill` + `UrgencyPill` + age. Re-exports `TicketRowProps`, `ClientTicketRowProps`, `AdminTicketRowProps`.

**Detail (session B):**

- **`TicketDetailLayout`** (`tickets/TicketDetailLayout.tsx`) — 2-column grid wrapper for the detail page: `1fr 320px`, items-start, gap-4.5. Wraps `main` in a bordered white card (rounded-[14px], border-ink/8); the right `side` column is a plain flex-col so each `TicketSideCard` carries its own surface. Used by both role detail-content files.
- **`TicketDetailHeader`** (`tickets/TicketDetailHeader.tsx`) — sits at the top of the detail main card. Renders a `next/link` back button + pills row (slot — caller composes `TicketIdLabel` + `CategoryPill` + `StatusPill` + `UrgencyPill`) + 24px ink title (ReactNode, `<em>` = rust) + optional `meta` line (ReactNode, `<strong>` = ink-bold; admin uses this slot to inline a client mini-avatar + "From X" line). Sibling export **`TicketIdLabel`** renders the TKT-0247 mono semibold label — kept inline because it's just decorated text, not a pill.
- **`TicketThreadMessage`** (`tickets/TicketThreadMessage.tsx`) — single message bubble: 36px avatar + bubble with author header (name + role chip + time) + body. `author: 'client' | 'operator'` toggles the surface (paper-2 + ink for client, ink + paper for operator). `children` is the bubble body — pass `<p>...</p>` paragraphs. Same component handles both prototypes' message shapes (the client `.ctd-msg` and admin `.td-msg` markup converged 1:1).
- **`TicketReply`** (`tickets/TicketReply.tsx`) — `'use client'` reply composer: optional mono `label` ("// Reply to Craig" on client; admin omits), optional `chips` (click-to-fill quick-reply buttons above the textarea — client only), `Textarea` (auto-resizing, paper card on paper-2 bg), tools row + `Button` send. `tools: { icon, title }[]` lets each role supply its own toolbar (client: attach/image/voice; admin: attach/link/template). Defaults to a single attach tool if omitted. The chip-to-textarea population is local state — wire to real send when backend lands.
- **`TicketSideCard`** (`tickets/TicketSideCard.tsx`) — the right-rail card wrapper used by every side panel. Props: `heading` (mono uppercase string, e.g. "// Status"), `tone: 'light' | 'dark'` (default light = white card with border; dark = ink-bg paper-text — used by the status card). Both tones share the same eyebrow rhythm and padding (`px-5 py-4.5`). Compose `TicketPropertyRow`s, `TicketActionRow`s, or arbitrary children inside.
- **`TicketStatusCard`** (`tickets/TicketStatusCard.tsx`) — discriminated by `mode: 'display' | 'pick'`. **Display** renders a static `<em>Open</em> · awaiting your reply` headline (statusLabel is ReactNode so the caller wraps the highlighted word in `<em>` for rust-light) + an ink-bg dot + optional description paragraph. **Pick** renders an interactive list of `{ status, label }` options with a rust-light `✓` on the active row; local `useState` tracks active (lift when real status mutation wires up). Both modes use `TicketSideCard tone="dark"` underneath.
- **`TicketPropertyRow`** (`tickets/TicketPropertyRow.tsx`) — single label/value row inside a `TicketSideCard`. `label` (string) + `value` (ReactNode) + `editable` (boolean — appends a mono `✎` glyph). `space-between` flex with a dotted bottom rule between rows; last row's rule is suppressed. Tighter than `SettingsFieldRow` because the 320px side panel can't carry settings' 220px label column.
- **`TicketActionRow`** (`tickets/TicketActionRow.tsx`) — single button-as-row with leading icon glyph + label. Bordered ghost button (`border-ink/10 → border-rust` on hover). Rows auto-space with `mt-1.5` (first row resets via `first:mt-0`). Used for the side-panel "Quick actions" lists; each role passes its own action set.

### `client/` — client-shell-only composed components

- **`ClientSidebar`** (`ClientSidebar.tsx`) — thin composition: `SidebarBrand` + `ClientWorkspaceCard` + `clientNav` rendered through `SidebarSectionLabel` + `SidebarItem` + `ClientSupportCard` + `SidebarUser`. Pulls data from `src/lib/nav/client-nav.ts`.
- **`ClientWorkspaceCard`** (`ClientWorkspaceCard.tsx`) — rust-tinted single-workspace identity block that sits below the brand in the client sidebar. Props: `initial`, `name`, `status`. The status renders with a small good-green dot prefix.
- **`ClientSupportCard`** (`ClientSupportCard.tsx`) — "// Managed by …" support block above the user footer. Takes a `contact: { label, org, description, ctaLabel, ctaHref }` prop — the contact is config, not hardcoded, because the support contact will change.

### `admin/` — admin-shell-only composed components

- **`AdminSidebar`** (`AdminSidebar.tsx`) — thin composition: `SidebarBrand` + `Overview` section + `AdminClientPicker` + `Workspace` section + `AdminWorkspaceBlock` + `SidebarUser`. Pulls data from `src/lib/nav/admin-nav.ts` + `admin-clients.ts`.
- **`AdminClientPicker`** (`AdminClientPicker.tsx`) — collapsible client switcher in the admin sidebar. Closed: shows the active client's logo + name + meta + chevron. Open: lists all clients + "Add new client" + "View all clients". Takes `clients: AdminClient[]` + `activeClientId`.
- **`AdminWorkspaceBlock`** (`AdminWorkspaceBlock.tsx`) — **static block**, not a selector. There's only one workspace ("Webnua") for now. Renders `// Workspace` label + workspace name above the user footer. Grow into a real selector if multi-workspace lands.
- **`ContinueSetupHero`** (`ContinueSetupHero.tsx`) — admin-dashboard "mid-setup" hero card. White surface with rule border, `rounded-3xl`, `px-10 py-9`, two-column grid (content + right-aligned CTA). Props: `tag` (rust mono eyebrow), `title` (ReactNode, supports `<em>` for rust), `description`, `meta` (`ReactNode[]` — segments are separated by `·` and any `<strong>` renders ink-bold), `ctaLabel`, `ctaHref` (rendered through `Button asChild` + `next/link`). Lives in the operator dashboard; admin-only — no client analogue.
- **`ClientListRow`** (`ClientListRow.tsx`) — admin-dashboard live-client row. White card surface, `rounded-lg`, 6-column grid (`32px 1fr 120px 100px 120px 80px`). Composes a 32×32 ink-bg avatar tile with a rust-light glyph, name + meta lines, a status-dot pill (`good`=live, `rust`=setup), `leadsPerWeek` (rust number), `spend`, and a rust "Open →" affordance. Whole row is a `next/link`. Props: `{ id, initial, name, meta, status: 'live'\|'setup', leadsPerWeek, spend, href }`. Re-export `ClientStatus` type. Will be reused on the future "all clients" admin list.

### `admin/integrations/` — cross-client integrations matrix (Phase 5 session B)

Components for the operator-only `/integrations` screen — workspace-wide view across every client. Sits at `(admin)/integrations`, separate from the per-workspace `/settings/integrations` panel.

- **`IntegrationMatrixHero`** (`integrations/IntegrationMatrixHero.tsx`) — ink-bg hero with rust-tagged pill + 28px headline + subtitle + N right-aligned stat tiles. Props: `tag` (mono string), `title` (ReactNode, `<em>` = rust), `subtitle` (ReactNode), `stats: MatrixHeroStat[]` where each stat is `{ num: ReactNode, label: string, tone?: 'good' | 'warn' | 'bad' | 'neutral' }`. `num` is a ReactNode so callers can pass `<em>14</em>` to colour-key the number against the tone. Different shape from the client-side `IntegrationProgressHero` (stat tiles vs single fraction) — kept as a sibling component on purpose.
- **`IntegrationMatrix`** (`integrations/IntegrationMatrix.tsx`) — the table itself. Header bar with title + filter chips, then a `220px + repeat(N, 1fr) + 100px` grid of column headers and per-client rows. Each cell is a coloured circle (`connected` = good check, `warning` = warn `!`, `missing` = dashed-border `×`). The Setup column holds a mini fraction + progress bar tinted by progress level (good = full, warn = ≥50%, bad = <50%). Avatars use `MatrixClientAvatarTone` (`voltline`/`freshhome`/`keyhero`/`flowline`/`generic`) — colours come from the prototype's per-client brand swatches. Re-exports `MatrixCellStatus`, `MatrixIntegrationColumn`, `MatrixClientRow`, `MatrixClientAvatarTone`, `MatrixFilter`.
- **`IntegrationMatrixActionCard`** (`integrations/IntegrationMatrixActionCard.tsx`) — the right-rail action cards under the matrix ("Needs your attention", "Critical gaps"). Props: `heading`, `badge: { label, tone: 'warn' | 'info' }`, `description` (ReactNode), `items: ActionItem[]`, optional `tone: 'attention'` to flip to the warn-tinted gradient background. Each `ActionItem` is `{ id, clientInitial, clientTone?, text, cta }` — `clientTone` is a Tailwind bg class (e.g. `'bg-rust'`) for the avatar tile. Re-exports `ActionItem`.

### `admin/tickets/` — admin-only ticket-inbox extras (Phase 5 session A)

- **`AdminTicketsFilterBar`** (`tickets/AdminTicketsFilterBar.tsx`) — `'use client'` filter-chip strip + search input. Right-side of the admin inbox toolbar; pairs with `TicketTabsBar` on the left in a flex `justify-between` row. Props: `active: string[]` (rust-filled chips with `×`) + `available: string[]` (paper-2 outlined chips like "+ Category" / "+ Client"). Search input uses `Input` with a `⌕` placeholder. Stubbed interactivity — chips don't filter yet, search input is local-state only.

### `shared/builder/` — generic wizard primitives (Phase 5)

> **Architectural note — generic by design.** These are role-agnostic wizard primitives. The admin client-onboarding flow (`/clients/new/*`) uses them now; the universal page builder will reuse them later. Don't bake admin-isms in. Anything funnel-specific lives in `admin/onboarding/` instead.

- **`BuilderLayout`** (`builder/BuilderLayout.tsx`) — two-column wizard shell: `480px` form panel (white-card, `rounded-xl border border-rule`) + `1fr` preview panel (sticky `top-[88px]`, `overflow-hidden`, same chrome). Props: `form` (left content), optional `preview` (right content), `className`. When `preview` is omitted the form fills the row — used by the full-width steps (automations, review, published).
- **`BuilderStepHeader`** (`builder/BuilderStepHeader.tsx`) — wizard step header: rust mono `eyebrow` (string, e.g. `// Voltline · Step 1 of 6`) + 40px Inter Tight `title` (ReactNode, `<em>` = rust) + optional `subtitle` (ReactNode, `<strong>` = ink-bold). Same shape as `PageHeader` but spaced for sequential step rhythm (`mb-7` instead of `mb-8`). Kept as a sibling because the prototype's `screen-title-block` has different vertical rhythm + the step number lives in the eyebrow.
- **`BuilderFooterActions`** (`builder/BuilderFooterActions.tsx`) — bottom-of-form Back/Continue row. Props: `progress` (mono uppercase label, ReactNode, `<strong>` = ink) + `actions` (ReactNode — typically two `Button`s) + `bordered: boolean` (default `true` — adds the `mt-9 border-t pt-5` rhythm; pass `false` when the footer sits outside a form panel).
- **`BuilderField`**, **`BuilderInput`**, **`BuilderTextarea`**, **`BuilderFormSection`**, **`BuilderFormRow`** (`builder/BuilderField.tsx`) — the form-row toolkit. `BuilderField` wraps label + input + optional helper; supports an optional `hint` slot on the same line as the label (right-aligned, rule-coloured) — used by the "Website (optional · for AI to scrape)" pattern. `BuilderInput` / `BuilderTextarea` carry a `variant: 'default' | 'ai'` knob — `'ai'` swaps to the rust-soft fill + rust border for AI-drafted fields (matches `.form-input.with-ai`). `BuilderFormSection` is a section block with a dotted-rule separator (auto-suppressed on last). `BuilderFormRow` is a `grid-cols-2 gap-3` pair-row for two side-by-side fields.
- **`AIPill`** (`builder/AIPill.tsx`) — small `✦ AI-DRAFTED` chip used inline inside `BuilderField` labels. Rust-on-rust-soft, mono `text-[9px]`, the ✦ glyph lives in the `::before` so the children slot is free for any label override (`Will AI-draft` / `AI-drafted` / `AI-suggested · edit prices`).
- **`PreviewPanelBar`** (`builder/PreviewPanelBar.tsx`) — `'use client'` chrome bar at the top of any builder preview pane. Props: `domain` (renders the `● Live · {domain}` rust pulsing pill) + `defaultDevice: 'desktop' | 'mobile'`. Internal `useState` toggles between Desktop/Mobile tabs — stubbed visual state for now, lift to a callback when the preview actually responsive-renders.

### `admin/onboarding/` — client onboarding (funnel build) flow (Phase 5)

> **Architectural note — the wizard lives at `/clients/new/<step>`** under the `(admin)` route group. 7 routes: `/basics`, `/idea`, `/offer`, `/trust`, `/automations`, `/review`, `/published` (and `/clients/new` redirects to `/basics`). Per-step URLs keep the back button and review-card "Edit ✎" jumps working natively. The flow is launched from the "+ Add new client" button on `/dashboard` (the admin home) AND from the Voltline mid-setup hero's "Continue setup →" CTA (both wired to `/clients/new/basics`). Steps 1-4 use `BuilderLayout` (form + `FunnelLandingPreview`); steps 5-7 go full-width.

- **`FunnelLandingPreview`** (`onboarding/FunnelLandingPreview.tsx`) — the right-column live preview. **Section-optional by design** — driven by a `FunnelPreviewState` object where each section (`eyebrow`, `headline`, `sub`, `offerCard`, `cta`, `trust`, `jobs`) is independently nullable. Each step page passes a progressively-fuller state; the component renders only what's set. Props: `state: FunnelPreviewState` + optional `skeleton: { title, description }` — when state has no content sections and `skeleton` is provided, the canvas shows the `{ }` skeleton block (used by Step 1 "Waiting on the big idea"). Composes `PreviewPanelBar` for the top chrome. **This is the piece the universal page builder will reuse** — it's already shape-compatible with editing arbitrary landing-page sections.
- **`ReframeOptionCard`** (`onboarding/ReframeOptionCard.tsx`) — `'use client'` selectable option card used on the Big Idea step. Props: `tag` (mono label string) + `text` (ReactNode, `<em>` = rust) + `reason` (string) + `selected: boolean` + `onSelect: () => void`. Selected state swaps the border to 2px rust + rust-soft bg + adds the rust-filled SELECTED pill in the tag row.
- **`JobsMenuEditor`** (`onboarding/JobsMenuEditor.tsx`) — the white-card jobs grid editor (Trust + jobs step). Props: `jobs: JobsMenuItem[]`. Auto-computes the flat/quote split for the header label. Each row uses an internal `JobRow` (`auto 90px 100px 24px` grid: name + price input + FLAT/QUOTE flag pill + drag handle). Type-tinted pills: `flat` = good-on-good-soft, `quote` = info-on-info-soft. Footer carries the rust "⊕ Add job to menu" affordance. Stubbed — rows aren't actually draggable, the price inputs are `readOnly`.
- **`AutomationCard`** (`onboarding/AutomationCard.tsx`) — `'use client'` toggle-driven automation card used on the Automations step. Props: `automation: Automation`. Uses the canonical `Switch` (with the ON/OFF label) for the toggle; local `useState` tracks enabled state, which hides the body when off. When enabled, renders the ink-bg trigger row (rust circle + `// TRIGGER` label + trigger text) followed by the step list — each step is a `AutomationStepItem` with the numbered ink circle (rust-light digit), channel pill (`sms` = good, `email` = info), mono delay, "Edit copy ✎" link, the copy box (with `[data-slot=var]` token-styled variables and a rust-soft "editing" tint when `step.isEditing`), and an optional mono meta bar at the bottom (Sent / Delivered / Reply rate).
- **`ReviewCard`** (`onboarding/ReviewCard.tsx`) — the white review-grid card used on the Review + publish step. Props: `heading` (string) + `editHref` (string — the per-step `stepHref()` of the section being reviewed; rendered as a rust "Edit ✎" link) + `details: { label, value }[]` (each row = mono uppercase label + Inter Tight value, `<em>` = rust). Optional `children` slot for non-standard bodies — the "Automations" review card uses this to render its 2-up automation-status grid.
- **`PublishCTACard`** (`onboarding/PublishCTACard.tsx`) — the ink-bg rust-glow publish CTA card at the bottom of the Review step. Props: `title` (ReactNode, `<em>` = rust-light) + `description` (ReactNode, `<strong>` = paper-bold) + `ctaLabel` (string) + `ctaHref` (string — the next step, typically `/clients/new/published`). Renders the CTA through `next/link` with the rust glow shadow.
- **`PublishedSuccessHero`** (`onboarding/PublishedSuccessHero.tsx`) — published-state hero: 96px good-tinted ✓ icon + 36px headline + subtitle + URL row with copy/open chips. Props: `title` (ReactNode, `<em>` = rust) + `description` (string) + `url` (string) + optional `scheme: string` (default `'https://'`). URL row is a single inline block with the scheme dimmed + LIVE good pill + ink "Copy link" chip + rust "Open ↗" chip.
- **`NextStepCard`** (`onboarding/NextStepCard.tsx`) — single "what happens next" card used in the 3-up grid below the success hero. Props: `num` (mono rust eyebrow string like `// 01 · NEXT 24 HOURS`) + `title` + `description`.

### `lib/onboarding/` — wizard state + stub data

- **`types.ts`** — `OnboardingStepSlug` (`basics | idea | offer | trust | automations | review | published`), `ONBOARDING_STEPS` + `ONBOARDING_TOTAL_STEPS` + `stepHref(slug)` helpers. Plus the form-shape types: `BusinessBasics`, `ReframeOption`, `OfferDetails`, `TrustSignal`, `JobsMenuItem`, `Automation` + `AutomationStep` (`channel: 'sms' | 'email'`), `NextStep`, and the section-optional `FunnelPreviewState` (header / eyebrow / headline / sub / offerCard / cta / trust / jobs — each individually nullable, driving `FunnelLandingPreview`).
- **`voltline-build.tsx`** — `voltlineBasics`, `voltlineReframes` (3 options + `voltlineSelectedReframeId = 'time'`), `voltlineOffer`, `voltlineTrust`, `voltlineJobs` (10 jobs · 8 flat-rate · 2 quote-only), `voltlineAutomations` (4 with full step config — 3 enabled, no-show recovery off), `voltlineNextSteps`. Plus the four progressive preview-state snapshots: `previewAfterBasics` (skeleton-only), `previewAfterIdea` (+ eyebrow + headline), `previewAfterOffer` (+ sub + offer card + CTAs), `previewAfterTrust` (+ trust row + jobs grid). `.tsx` because reframes / headlines / metric numbers / automation bodies all carry inline `<em>` / `<strong>` JSX. Reshape into Supabase reads when the backend lands.

### `lib/nav/` — nav + sidebar data (single source of truth for nav)

- **`types.ts`** — `NavItem` (`{ label, href, icon, badge? }`) + `NavSection` + `SettingsNavItem` (`{ label, href, icon }`, no badge — settings tabs don't carry one in either prototype).
- **`client-nav.ts`** — `clientNav` (sections + items), `clientWorkspace`, `clientSupport` (used as the `contact` prop on `ClientSupportCard`), `clientUser`.
- **`admin-nav.ts`** — `adminOverviewNav`, `adminWorkspaceNav`, `adminWorkspace`, `adminUser`.
- **`admin-clients.ts`** — `adminClients` (stubbed client list) + `adminActiveClientId`. Replace with backend data when wired.
- **`client-settings-nav.ts`** — `clientSettingsNav` — 6 tabs (Integrations / Profile / Notifications / Billing / Login + security / Help). Order matches the client prototype.
- **`admin-settings-nav.ts`** — `adminSettingsNav` — 7 tabs (Workspace / Team / Integrations / Billing / Defaults / API + webhooks / Danger zone). Order matches the admin prototype.

### `lib/dashboard/` — per-role dashboard stub data

- **`admin-dashboard.tsx`** — operator-dashboard stub data: `dashboardGreeting` (eyebrow), `dashboardStats` (4-tile stat row, `value` is `ReactNode` so the `<em>34</em>` rust highlight on "leads this week" lives in the data), `midSetupClient` (the Voltline continue-setup hero), `liveClients` (the live-client list rows). `.tsx` because the stat values are JSX. Re-shape into Supabase reads when the backend lands.

### `lib/settings/` — per-tab stub data for `/settings/*`

- **`client-profile.ts`** — `clientProfileBusiness` + `clientProfileManagedByWebnua` field-row lists for the client Profile tab.
- **`admin-workspace.ts`** — `adminWorkspaceFields` + `adminWorkspacePlanFields` for the admin Workspace tab (the Workspace ID row carries `mono: true` so the value renders in JetBrains Mono).
- **`client-integrations.tsx`** — `clientIntegrationsHero` (props for `IntegrationProgressHero`) + `clientIntegrations` (the 5 integration cards Voltline sees on `/settings/integrations`). `.tsx` because description / meta / hero copy carry inline `<em>` / `<strong>` JSX.
- **`admin-integrations.tsx`** — `adminConnectedIntegrations` (the 6 workspace-level integrations Webnua Perth has connected — Resend, Twilio, Meta Ads, GBP, Vercel, Anthropic) + `adminAvailableIntegrations` (Stripe + Xero). `.tsx` for the same JSX-in-description reason.
- **`client-notifications.ts`** — `clientNotifications: NotificationGroup[]` (Leads / Bookings / Reviews / Summary emails — each with channel set + per-row default state) + `clientQuietHours` (enabled flag + window string).
- **`client-billing.tsx`** + **`admin-billing.tsx`** — plan card props + payment method + invoice list per role. Client billing has `clientBillingIncluded` (the "what's included" grid); admin doesn't. `.tsx` because plan headlines carry `<em>` highlights.
- **`client-security.ts`** — `clientSecurityCredentials`, `clientSecurityTwoFactor`, `clientSecuritySessions` for the Login + security tab.
- **`client-help.tsx`** — `clientHelpFaqs` (7 FAQ entries, only the first carries an answer + `defaultOpen: true` by default, matching the prototype) + `clientHelpRecentSupport`.
- **`admin-team.ts`** — `adminTeamMembers` + `adminTeamPermissions` for the Team tab.
- **`admin-defaults.ts`** — `adminDefaultsAutomations` (4 toggleable defaults) + `adminDefaultsBranding` + `adminDefaultsPricing` for the Defaults tab.
- **`admin-api.tsx`** — `adminApiKeys`, `adminWebhookEndpoint`, `adminWebhookEvents` for the API + webhooks tab.
- **`admin-danger.tsx`** — `adminDangerWorkspace` (4 entries) + `adminDangerClient` (1 entry) for the Danger zone tab.

### `lib/integrations/` — cross-client integrations matrix data

- **`admin-matrix.tsx`** — `adminMatrixHero`, `adminMatrixFilters`, `adminMatrixColumns` (the 5 integration column defs: GBP / Meta / GA4 / G.Ads / Stripe), `adminMatrixRows` (4 client rows × per-integration status cells + per-client progress), `adminMatrixAttention` + `adminMatrixGaps` (action-card items). `.tsx` because hero stats and action-item text carry inline JSX. Reshape into Supabase reads when the backend lands.

### `client/funnels/` — client funnel detail screen (Phase 5)

> **Architectural note — funnels are client-only AND top-level.** The prototype's funnel detail (client Screen 23) has no admin equivalent — operators interact with funnels through the page-builder flow (admin Screens 41/42/43), which is a different surface entirely. The prototype nests funnels under the Website Overview, but the platform treats funnels as a separate top-level section (their own nav item, their own URL space): `/funnels` (list) + `/funnels/[id]` (detail). `/website` is a sibling section that will hold the page grid + perf hero + request-change flow when that screen is built. The funnel detail's back link reads "← back to funnels" and points to `/funnels`. **Sidebar:** the client nav has a top-level `Funnels` item alongside `Website` — see `lib/nav/client-nav.ts`.

- **`FunnelHero`** (`funnels/FunnelHero.tsx`) — ink-bg banner with rust radial-gradient flourish + a paired `FunnelAggCard` on the right. Props: `back: { label, href }` (renders as `← {label}` mono link), `tag` (rust-light mono pill with 🔒 glyph), `title` (ReactNode, `<em>` = rust-light), `subtitle` (ReactNode, `<strong>` = paper-bold), `meta: FunnelHeroMeta[]` (mono `LABEL` + paper-bold value pairs, e.g. `BUILT 14d ago`), `versionLabel` (optional rust-light pill), `actions: { viewLiveLabel, viewLiveHref, requestChangeLabel, requestChangeHref }` (ghost + primary `Button`s side by side; viewLive opens external), `agg: FunnelAggCardProps`. Grid is `1.4fr 1fr`. **Standalone — not extracted into a shared `InkHero` primitive (see parked decisions; this is the 4th ink-hero data point).**
- **`FunnelAggCard`** (`funnels/FunnelAggCard.tsx`) — translucent-on-ink metric tile used inside `FunnelHero`. Props: `label` (mono eyebrow), `live` (renders the pulsing good-dot LIVE indicator), `metrics: [FunnelAggMetric, FunnelAggMetric]` (2-up grid; `num` is ReactNode so `<em>412</em>` highlights rust-light, plus mono label + optional trend in good-green), `bottom?: { left, right }` (border-topped revenue row).
- **`FunnelFlow`** (`funnels/FunnelFlow.tsx`) — white card containing the 3-step row + 2 arrows + period toggle in its header. Props: `title` (ReactNode, `<em>` = rust), `steps: FunnelStep[]`, `arrows: FunnelArrow[]` (rendered between consecutive steps via `flatMap`; arrow `n` sits between step `n` and `n+1`), `periods: FunnelPeriod[]`, `defaultPeriod?: FunnelPeriod`. Grid is `1fr 100px 1fr 100px 1fr` — widened from the prototype's 40px so the pct pill + wrapped drop-off captions fit cleanly without overflowing into neighbouring step cards. Currently rendering 3 steps; the column template would need to extend for 4+ (out of scope for the stub layer).
- **`FunnelStepCard`** (`funnels/FunnelStepCard.tsx`) — per-step paper-bg card. `step: FunnelStep` does all the work; the `tone` field (`'first' | 'middle' | 'last'`) drives the colour treatment: `first` = rust-soft gradient + rust accent; `last` = good-soft gradient + good accent; `middle` = plain paper + rust accent. Composes `FunnelStepThumbnail` for the visual gist. Hover lifts -translate-y-0.5 + shadow-card.
- **`FunnelStepThumbnail`** (`funnels/FunnelStepThumbnail.tsx`) — small 64px-tall CSS "preview gist" of each step. `variant: 'landing' | 'schedule' | 'thanks'`. Pure visual, no business logic. Already used by both the detail view's step cards AND the funnels list row, so it's a real shared-within-funnels primitive — kept in `client/funnels/` because both consumers are client-only.
- **`FunnelArrow`** (`funnels/FunnelArrow.tsx`) — between-steps cell: rust-soft conversion-rate pill on top, line + `→` glyph in the middle, mono drop-off caption below (`<strong>` renders in warn-red for emphasis on the drop count).
- **`FunnelPeriodToggle`** (`funnels/FunnelPeriodToggle.tsx`) — `'use client'` pill toggle for time-range (7D / 14D / 30D / 90D). Local `useState` active state — fine for the stub layer; lift to a callback or URL state when real period filtering wires up. Optional `onChange` is plumbed but the stub doesn't need it.
- **`FunnelInsightsCard`** (`funnels/FunnelInsightsCard.tsx`) — white-surface "// Insights · what we see" list. Props: `title` (ReactNode, `<em>` = rust), optional `subtitle`, `items: FunnelInsight[]`. Sibling export **`FunnelInsightRow`** renders one row — a 28px tone-tinted icon glyph + body (with `<em>` = rust, `<strong>` = ink-bold) + mono meta line. Severity tones: `warn` (warn-tinted), `good` (good-tinted), `info` (rust-soft).
- **`FunnelHistoryCard`** (`funnels/FunnelHistoryCard.tsx`) — ink-bg version history list with a rust radial-gradient flourish. Props: `title` (ReactNode, `<em>` = rust-light), optional `subtitle`, `items: FunnelVersion[]`, `ctaLabel`, `ctaHref` (rendered through `Button asChild` + `next/link`, full-width below the list). Sibling export **`FunnelHistoryItem`** renders one row — version pill (`current` = rust-filled, others = rust-light on rust/18) + body text + mono meta line + right-aligned mono timestamp. **Not** a `TicketSideCard` — the heading rhythm and the version-pill column make it its own shape.

### `lib/funnels/` — funnels stub data + types

- **`types.ts`** — single source of truth for funnel shapes: `FunnelStepThumbVariant` (`landing` | `schedule` | `thanks`), `FunnelStepTone` (`first` | `middle` | `last`), `FunnelStep`, `FunnelArrow`, `FunnelPeriod` + `FUNNEL_PERIOD_LABEL`, `FunnelInsight` + `FunnelInsightTone`, `FunnelVersion`, `FunnelAggMetric` + `FunnelAggBottom`, `FunnelHeroMeta`, and the top-level `FunnelDetail` that ties it all together (back link, hero, agg, flow config, steps, arrows, insights, history).
- **`client-detail.tsx`** — `voltlineFunnel`: the single canonical Voltline "$99 emergency call-out" funnel stub matching client Screen 23 (412 → 74 → 14, three insights, three versions). `.tsx` because titles / subtitles / metric numbers / insight bodies all carry inline `<em>` / `<strong>` JSX. Reshape into Supabase reads when the backend lands.

### `lib/tickets/` — tickets stub data + types

- **`types.ts`** — single source of truth for ticket shapes: `TicketStatus = 'open' | 'in_progress' | 'blocked' | 'done'` (admin's vocabulary is the stored one — client's `Review` is derived view-time via `StatusPill reviewAware` when status is `in_progress` and `awaiting === 'client'`), `TicketUrgency`, `TicketCategory`, `TicketAwaiting` (`'operator' | 'client' | null` — drives both the client row's attention pill and the derived `Review` label), `TicketTab`, plus the `CATEGORY_LABEL` / `STATUS_LABEL` / `URGENCY_LABEL` maps.
- **`client-tickets.tsx`** — `clientTicketsHero` (props for `TicketsHero`), `clientTicketTabs` (Active / Needs your reply / Done / All), `clientTickets: ClientTicketRow[]` (7 rows — Mark's queue from the prototype). `.tsx` because previews carry inline `<strong>Craig:</strong>` / `<strong>You:</strong>` JSX.
- **`admin-tickets.tsx`** — `adminTicketsHero` (props for `TicketsHero` with 4 stat tiles in `right`), `adminTicketTabs` (All / Open / In progress / Blocked / Done), `adminTicketFilters` (`active` + `available` chip lists), `adminTickets: AdminTicketRow[]` (10 rows across 4 clients from the prototype). Re-exports `AdminTicketClientTone` (`voltline` / `freshhome` / `keyhero` / `flowline` / `generic`) — drives the row's client-avatar tint.
- **`client-detail.tsx`** — `clientTicketDetail`: the single canonical TKT-0247 detail stub for the client view. Carries `statusLabel` (string for the header pill) + `statusHeadline` (ReactNode with `<em>Open</em>` for the side card — two fields because the same data renders two ways, neither derivable from the other without losing the em-scope decision the prototype made). Plus thread messages, reply config (label / placeholder / 4 quick-chips), status description, properties (read-only), and actions (Call Craig / Edit / Add file / Cancel). Re-exports `TicketDetailMessage`, `TicketDetailProperty`, `TicketDetailAction` so the admin stub can reuse the shapes.
- **`admin-detail.tsx`** — `adminTicketDetail`: same TKT-0247 from the operator side. Differs from the client stub by including `client` (initial/name/tone) for the inline mini-avatar in the header meta, a pre-populated `defaultValue` reply body (the draft Craig has staged), `statusOptions` (4 selectable rows for the status picker), `editable` flags on properties, and admin-only actions (Open Voltline website / Create page draft / Add internal note / Convert to subtasks). Imports the message/property/action shapes from `client-detail.tsx`.

### `shared/leads/` — lead inbox + detail + conversation (Phase 5 · Cluster 1)

> **Architectural note — leads lives outside the role route groups**, same reason as settings / tickets / dashboard. Routes: `/leads` (inbox), `/leads/[id]` (detail), `/leads/[id]/conversation` (conversation). `app/leads/layout.tsx` (`'use client'`, reads `useRole()`, picks `ClientSidebar` vs `AdminSidebar`, mounts `DevRoleSwitcher`). Each page is a `'use client'` dispatcher with `_client-content.tsx` / `_admin-content.tsx` siblings. The detail + conversation pages reuse `TicketDetailLayout` directly (same `1fr 320px` shape). For the stub layer, the `[id]` slug is decorative — both roles render their single canonical Sarah Davies stub regardless of the actual id.

- **`LeadsHero`** (`leads/LeadsHero.tsx`) — ink-bg rust-tagged hero used by the admin inbox. Props: `tag` (mono pill string), `title` (ReactNode, `<em>` = rust), `subtitle` (ReactNode, `<strong>` = paper-bold), optional `right` slot. Visually same chrome as `TicketsHero` (the 5th ink-hero data point — see parked decisions; still hold-pattern, no extraction).
- **`LeadTabsBar`** (`leads/LeadTabsBar.tsx`) — `'use client'` pill-tab strip with counts. Same shape as `TicketTabsBar` but takes the leads-typed `LeadTab[]` instead. Kept separate from `TicketTabsBar` to keep type boundaries clean — if a third surface needs the same pattern, extract to a generic `TabsBar` primitive.
- **`LeadFilterChips`** (`leads/LeadFilterChips.tsx`) — `'use client'` rust-active / paper-inactive filter chip strip with optional counts. Used by admin inbox for the `// CLIENT` filter row (All clients / FreshHome / KeyHero / NeatWorks / Voltline). Local `useState` active state — fine for the stub layer; lift to URL state when real filtering wires up.
- **`LeadRow`** (`leads/LeadRow.tsx`) — single canonical row, discriminated by `variant: 'client' | 'admin'`. Both variants share the `unread` → left rust rail + faint rust bg attention treatment. Client variant: `44px + 1fr + auto + auto + 70px` grid — avatar + name+preview (with suburb prefix in mono) + `LeadStatusPill` + optional `LeadUrgencyPill` + age. Admin variant: `36px + 180px + 1fr + 110px + 90px + 100px` grid — tone-tinted avatar + name+`LeadClientPill` + preview + `LeadStatusPill` + age + tone-coloured activity meta (`good`/`rust`/`quiet`).
- **`LeadDetailHeader`** (`leads/LeadDetailHeader.tsx`) — top-of-detail row: 48px avatar + name + comma-joined meta parts (phone bolded via `<strong>`, suburb, email) + optional `clientPillLabel` (admin uses this for the "FreshHome" pill). `rightActions` slot is open for future per-role overflow.
- **`LeadStatusSwitcher`** (`leads/LeadStatusSwitcher.tsx`) — `'use client'` mono-uppercase segmented control: `// STATUS` label + 5 status buttons (New / Contacted / Booked / Completed / Lost). Active = ink-bg paper-text. Local `useState` — lift when status mutation wires to backend.
- **`LeadTimeline`** + **`LeadTimelineEventRow`** (`leads/LeadTimeline.tsx`) — activity-timeline list: heading + `N EVENTS · NEWEST FIRST` mono meta on the right + vertically-stacked events. Each `LeadTimelineEvent` carries a `dot` type (`sms-in` / `sms-out` / `form` / `status` / `email` / `scheduled-sms` / `scheduled-email`), `meta` (ReactNode), optional `body` + `snippet` (rendered in a tinted bordered block matching dot type), optional right-aligned `rightTime`, and `pending: true` for opacity-dimmed scheduled future events. `auto: true` adds the inline `⤿ AUTO` pill in the meta row.
- **`LeadRailCard`** + **`LeadRailRowItem`** (`leads/LeadRailCard.tsx`) — white-card side-rail container with mono uppercase heading. Takes either a `rows: LeadRailRow[]` array (label/value pairs with `tone: 'good' | 'quiet' | 'default'` and `accent: true` for rust value tinting) or arbitrary `children` (used for the Quick actions card). Structurally similar to `TicketSideCard` — see parked decisions; extracted to be its own component because the row-value tone vocabulary differs (leads has `accent` + tone variants for $$ / status values; tickets has plain bold).
- **`LeadQuickActions`** + **`LeadQuickActionItem`** (`leads/LeadQuickActions.tsx`) — vertical button stack used inside the `// QUICK ACTIONS` rail card. Each `LeadQuickAction` is `{ icon, label, primary?, href? }` — `primary: true` renders rust-filled (used by Call Sarah back now / Open conversation); others render bordered ghost. When `href` is set the item is a `next/link`; otherwise a `<button>`.
- **`LeadStatusPill`** / **`LeadUrgencyPill`** / **`LeadClientPill`** (`leads/pills.tsx`) — three small pills exported together. `LeadStatusPill` tones: `new` (rust) / `contacted` (info) / `booked` (good) / `completed` (ink) / `lost` (quiet); optional `label` override. `LeadUrgencyPill` tones: `asap`/`today` (warn) / `soon` (quiet); `none` renders nothing. `LeadClientPill` is a colour-tinted client-name pill driven by `LeadClientTone` (`voltline` / `freshhome` / `keyhero` / `neatworks` / `flowline` / `generic`) — used in the admin row to attribute leads to their client.
- **`ConversationHeader`** (`leads/ConversationHeader.tsx`) — `'use client'` top-of-conversation row: avatar + name + meta + optional channel-tabs (All / SMS / Email) + optional `actions` (call / chevron / overflow glyphs). Local `useState` for active channel — visual stub for the stub layer.
- **`ConversationThread`** + **`ConversationMessageRow`** + **`ConversationDayDivider`** (`leads/ConversationThread.tsx`) — message-thread wrapper. Days are rendered with a centred mono day-divider pill; each `ConversationMessage` is rendered with a kind-discriminated bubble: `incoming` (paper card on left), `outgoing` (ink on right), `auto` (rust-tinted on right with inline `⤿ AUTO` meta), `system` (centred paper-2 mono pill). Bubble metadata (channel / timestamp / `DELIVERED` flag / `metaPrefix` like "SARAH" / "LISA") is rendered in mono uppercase below the bubble. **Not** built on `TicketThreadMessage` because the meta-row vocabulary (AUTO tag, DELIVERED, channel) diverges enough that composition wouldn't simplify the call site.
- **`ConversationComposer`** (`leads/ConversationComposer.tsx`) — `'use client'` reply composer at the bottom of the conversation card. Two channel-control modes: `channels: ['SMS', 'Email']` renders a top pill-tab strip (client variant); `channelToggle: 'SMS ↕'` renders an inline pill button to the left of the textarea (admin variant — single-line, matches the prototype's compact admin row). Optional `helpers` row beneath the textarea renders rust-light affordance chips with a right-aligned `Spell check ✓`. Send button is rust-filled.

### `lib/leads/` — leads stub data + types

- **`types.ts`** — single source of truth for lead shapes: `LeadStatus` (`new | contacted | booked | completed | lost`), `LeadUrgency`, `LeadClientTone`, `LEAD_STATUS_LABEL` + `LEAD_URGENCY_LABEL` maps, `LeadTab`, `LeadFilterChip`, inbox-row shapes (`ClientLeadRow`, `AdminLeadRow`), `LeadTimelineEvent` + `LeadTimelineDot`, `LeadRailRow` + `LeadRailCard` + `LeadQuickAction`, the top-level `LeadDetail`, and the conversation shapes (`ConversationBubbleKind`, `ConversationMessage`, `ConversationDay`, `ConversationChannelTab`, `ConversationQuickReply`, `LeadConversation`).
- **`client-leads.tsx`** — `clientLeadsHero` (props for `PageHeader`), `clientLeadsTabs` (5 tabs · New / Contacted / Booked / Lost / All), `clientLeads: ClientLeadRow[]` (8 rows from client Screen 2 — Voltline's inbox), `voltlineLeadDetail` (Sarah Davies full 4-event timeline + 2 rail cards + 4 quick actions), `voltlineConversation` (Mark↔Sarah 5-message SMS thread + composer config). `.tsx` because titles / subtitles / metric numbers / timeline bodies all carry inline `<em>` / `<strong>` JSX.
- **`admin-leads.tsx`** — `adminLeadsHero` (props for `LeadsHero`), `adminLeadsClientFilters` (5 chips · All clients + 4 clients), `adminLeadsTabs` (6 tabs · New / Contacted / Booked / Completed / Lost / Spam), `adminLeads: AdminLeadRow[]` (8 rows from admin Screen 15 — Webnua Perth's cross-client inbox), `freshhomeLeadDetail` (Sarah Davies via FreshHome with 5 timeline events incl. scheduled future ones + 3 rail cards), `freshhomeConversation` (Lisa↔Sarah 7-message thread + status-change system row + quick-reply rail). `.tsx` for the same JSX-in-fields reason.

### `shared/calendar/` + `admin/calendar/` — week calendar (Phase 5 · Cluster 2 · Session 1)

> **Architectural note — calendar lives outside the role route groups**, same reason as settings / tickets / leads / dashboard. Single shared route `app/calendar/` with `'use client'` layout (reads `useRole()`, picks `ClientSidebar` vs `AdminSidebar`, mounts `DevRoleSwitcher`) + `'use client'` dispatcher `page.tsx` + `_client-content.tsx` / `_admin-content.tsx` siblings. The grid itself is identical in both roles; the admin variant adds a client-filter row, a colour legend, and a today-summary panel.

- **`CalendarGrid`** (`shared/calendar/CalendarGrid.tsx`) — the week-grid surface. White card with a `70px + repeat(6, 1fr)` header (day labels) and body (time column + 6 day columns). Each day is 12 hour-slots tall, 50px per hour (= 600px). Renders `BookingPill`s positioned by `top`/`height` px from the booking data, plus an optional `CalendarNowLine` on the today column. Takes `week: CalendarWeek` and renders. Tone of the booking pills comes from the data (`tone?: CalendarClientTone`) — client view leaves it unset (defaults to rust); admin view passes `freshhome` / `keyhero` / `voltline` / `neatworks` and gets per-client tinting.
- **`BookingPill`** (`shared/calendar/BookingPill.tsx`) — single positioned booking. Absolute-positioned inside its day column (`top: Npx; height: Npx`). Renders mono time / Inter Tight title / customer line, all paper-on-tone. Renders as a `next/link` when `href` is set; otherwise a click-target `<div>` (will lift to a real callback when the booking detail wires up in Session 2). `tone: CalendarClientTone` controls the background fill — `voltline` → `bg-rust`, the others use inline hex tokens (`#4a7ba6` / `#8a5cb8` / `#2d8a4e`) matching the prototype.
- **`CalendarNowLine`** (`shared/calendar/CalendarNowLine.tsx`) — the pulsing rust horizontal line + leading dot + "NOW · 10:35" pill at a given `top` px inside the today column. Pointer-events disabled — purely visual.
- **`CalendarToolbar`** (`shared/calendar/CalendarToolbar.tsx`) — white-card control strip: prev/next nav buttons + period label (`Week of <em>May 11</em> — May 16, 2026`, ReactNode so `<em>` segments render rust) on the left, `CalendarViewTabs` on the right.
- **`CalendarViewTabs`** (`shared/calendar/CalendarViewTabs.tsx`) — `'use client'` Day/Week/Month pill toggle. Local `useState` active state; optional `onChange` (not wired for the stub — Day/Month views ship in a later session).
- **`CalendarClientFilterBar`** (`admin/calendar/CalendarClientFilterBar.tsx`) — `'use client'` admin-only client-filter chip row (`// CLIENT` label + N chips). Rust-active / paper-inactive, optional count badges. Same visual recipe as `LeadFilterChips` (second use of this pattern — see parked decisions).
- **`CalendarLegend`** (`admin/calendar/CalendarLegend.tsx`) — admin-only horizontal legend row: per-client colour swatches in a paper-2 mono uppercase bar, with an optional right-aligned `meta` ReactNode (e.g. `28 bookings · 11 today`). Tone → swatch colour mapping is the same as `BookingPill` (single source of truth lives in each component for now; if a third surface uses the same tone vocab, extract to `lib/calendar/tones.ts`).
- **`CalendarTodayPanel`** (`admin/calendar/CalendarTodayPanel.tsx`) — admin-only summary card below the grid. Heading + meta line (`<strong>` = rust) + list of `CalendarTodayJob` rows. Each row is a 5-column grid (`100px 36px 1fr auto auto`) with a colour-coded left border (per-client tone), mono time, single-letter client logo on ink, title + customer, status pill (`completed` → good-soft; `scheduled`/`in_progress` → rust-soft), and a rust "Open →" affordance. Renders as a `next/link` when `href` is set.

### `lib/calendar/` — calendar stub data + types

- **`types.ts`** — single source of truth for calendar shapes: `CalendarClientTone` (`voltline | freshhome | keyhero | neatworks | generic`), `CalendarBookingStatus` + `CALENDAR_BOOKING_STATUS_LABEL`, `CalendarBooking` (id / time / title / customer / `top` + `height` px / optional tone + href), `CalendarDay` (id / name / num / `isToday` / `bookings` / optional `nowTopPx` + `nowLabel`), `CalendarWeek` (corner label / period label ReactNode / time slots / days), plus admin extras (`CalendarClientFilter`, `CalendarLegendItem`, `CalendarTodayJob`, `CalendarTodayPanel`) and the top-level `ClientCalendar` + `AdminCalendar`.
- **`client-calendar.tsx`** — `voltlineCalendar`: Mark's Voltline week (Mon 11 – Sat 16 May 2026) from client Screen 4. 17 bookings across 6 days, Wed = today with a 10:35 now-line. `.tsx` because the period label + hero copy carry inline `<em>` / `<strong>` JSX.
- **`admin-calendar.tsx`** — `adminCalendar`: Webnua Perth cross-client week from admin Screen 13. 23 bookings tinted across 4 clients, the 5-chip client filter, the 4-item legend, and the 4-row today panel (one completed, one in-progress, two scheduled). `.tsx` for the same JSX-in-copy reason.

### `shared/bookings/` — booking detail (Phase 5 · Cluster 2 · Session 2)

> **Architectural note — bookings live outside the role route groups**, same reason as calendar. Single shared route `app/bookings/[id]/` with `'use client'` layout (reads `useRole()`, picks `ClientSidebar` vs `AdminSidebar`, mounts `DevRoleSwitcher`) + `'use client'` dispatcher `page.tsx` + `_client-content.tsx` / `_admin-content.tsx` siblings. The `[id]` slug is decorative for the stub layer (both roles render their single canonical booking regardless of the actual id — Voltline's "Ceiling fan + RCD replacement" on the client; FreshHome's "Fortnightly clean · 3-bed" on the admin). Reached from any `BookingPill` with `href` set on the calendar grid.

- **`ClientBookingHero`** (`bookings/ClientBookingHero.tsx`) — **ink-bg** hero for client Screen 8. `1fr auto` grid: left half carries the rust-light mono `tag` + 26px Inter Tight `title` (ReactNode, `<em>` = rust-light) + meta line (`{ customer, suburb, price, duration }`, `·`-separated; first segment renders ink-bold via the customer prop). Right half is a rust-bg paper-text dot pill rendering `statusLabel` (e.g. `Scheduled · 2.5h away`). Inverse chrome to `AdminBookingHero` — kept as a separate component because the structures invert (ink surface vs white card with tone left-border).
- **`AdminBookingHero`** (`bookings/AdminBookingHero.tsx`) — **white-card** hero for admin Screen 18. `tone: CalendarClientTone` drives a 6px-wide left border tint matching the calendar booking pill colours. Renders mono `timeRow` (ReactNode, `<strong>` = ink) + 28px Inter Tight `jobTitle` + customer row (name strong + phone + suburb + rust-soft client pill) + an open `actions` slot (caller supplies the `Button` row — typically Mark complete / Reschedule / Open lead / Cancel booking).
- **`BookingSection`** (`bookings/BookingSection.tsx`) — section block with a mono `// HEADING`. `variant: 'card' | 'inline'`. **Card** (default, admin): standalone white card with its own border + padding (`px-6.5 py-5.5`). **Inline** (client): plain block separated from the next section by a paper-2 bottom rule (`border-b border-paper-2 pb-5.5 mb-5.5`), auto-suppressed on `:last-child`. Use inline when stacking sections inside an outer wrapper card.
- **`BookingJobGrid`** (`bookings/BookingJobGrid.tsx`) — 2-column key/value grid. `cells: BookingJobCell[]` (`{ label, value }`, value is ReactNode so `<em>` renders rust). `surface: 'paper' | 'plain'`. **Paper** (client): each cell sits in its own paper-bg tile (`rounded-lg bg-paper px-3.5 py-3`). **Plain** (admin): cells are inline label/value pairs with no tile surface (`gap-x-6 gap-y-4`).
- **`BookingNotesBox`** (`bookings/BookingNotesBox.tsx`) — paper-bg notes container with a rule-coloured 3px left border. Renders children at 14px ink-soft, with `<strong>` segments switching to bold ink. Identical chrome in both roles.
- **`BookingHistoryRow`** (`bookings/BookingHistoryRow.tsx`) — discriminated by `variant: 'compact' | 'grid'`. **Compact** (client): a single-line paper-bg pill with `<strong>{date}</strong> · {body}`; `body` is ReactNode so the price + review meta inline. **Grid** (admin): `100px 1fr 80px auto` grid with mono date / title / price / status (`done` = good-green; optional `statusLabel` override for star ratings).
- **`BookingActionBtn`** (`bookings/BookingActionBtn.tsx`) — client-rail stacked icon+label button. `tone: 'primary' | 'secondary' | 'danger'`. **Primary** = rust-filled paper-text (Mark job complete). **Secondary** = paper bg + rule border, hovers to ink-fill (Call / Reschedule / etc.). **Danger** = warn text on paper, hovers to warn-fill (Cancel booking). Renders as `next/link` when `href` is set, else a `<button>`. `mb-2 last:mb-0` auto-spaces within a stack.

### `lib/bookings/` — booking detail stub data + types

- **`types.ts`** — single source of truth for booking shapes: `BookingJobCell` (label/value), `BookingRailRow` (label/value/`accent`), `BookingHistoryItemCompact` (date + ReactNode body), `BookingHistoryItemGrid` (date / title / price / `status: 'done'|'scheduled'` / optional `statusLabel`), `ClientBookingActionTone` (`primary | secondary | danger`), `ClientBookingAction` + `ClientBookingActionGroup`, plus the top-level `ClientBookingDetail` and `AdminBookingDetail` (the latter carries `tone: CalendarClientTone` so the hero border tint pairs with the calendar pill colour).
- **`client-booking.tsx`** — `voltlineBooking`: Liam Reilly's "Ceiling fan + RCD replacement" stub from client Screen 8. Customer block + 4 job-grid cells + notes paragraph + 2-row history + 2 action groups (On arrival / Manage, 3 buttons each) + the "// NEXT" tail explainer. `.tsx` because titles / values / notes / next-note all carry inline `<em>` / `<strong>` JSX.
- **`admin-booking.tsx`** — `freshhomeBooking`: Anna Larsen's "Fortnightly clean · 3-bed" stub from admin Screen 18. Hero (eyebrow / title / subtitle) + FreshHome tone + time row + 8 job-grid cells + customer notes + 4-row history (last carries 5★ rating) + 3 rail data sets (customer value 4 rows, location address, automations 2 rows). `.tsx` for the same JSX-in-fields reason.
- **`recurring-setup.tsx`** — `voltlineRecurring`: Emma Petrov's "Building inspection · electrical" recurring stub from client Screen 16. Customer header + 4 frequency options (`fortnightly` default) + 7 day options (`thu` default) + time + service/price + 4-row preview (Thu 14 May → Thu 25 Jun) + ink summary bar copy + bottom footnote. Re-exports `RecurringSetup`, `RecurringFrequencyOption`, `RecurringDayOption`, `RecurringPreviewRow`. `.tsx` for the same JSX reason.
- **`new-booking-modal.tsx`** — `freshhomeNewBooking`: stub for the admin Screen 21 modal. Customer (pre-matched Emma Petrov) + date + time + 7 service chips (`deep_clean` default) + price + duration + notes + assigned cleaner + 2 toggle fields (`send_sms` on, `add_to_invoice` off, each with `onText`/`offText` strings). Re-exports `NewBookingModalData`, `NewBookingServiceOption`, `NewBookingToggleField`. `.tsx` because the headline + footer copy carry inline `<strong>` JSX.

### `shared/bookings/` — recurring setup + new-booking modal (Phase 5 · Cluster 2 · Session 3)

> **Architectural note — these two screens have different home shapes.** Client Screen 16 (recurring setup) is a **full page**, not a modal — lives at `app/(client)/recurring/new/page.tsx` since it's client-only (no admin equivalent in the prototype). Admin Screen 21 (new booking) is a **Dialog-based modal** invoked from a "+ New booking" button on the admin calendar — no route of its own. The shared primitive that unifies both surfaces is `ChipSelector` (extracted to `shared/`) — used by the recurring day picker (`mono` variant), the modal service chips (`pill` variant), and any future single-select pill row.

- **`RecurringCustomerHeader`** (`bookings/RecurringCustomerHeader.tsx`) — 56px paper-2 avatar circle + 22px Inter Tight customer name + 2-line meta. `<strong>` segments render ink-bold (contact details + previous-booking emphasis). Sits at the top of the recurring-setup white card, with a paper-2 bottom-border separator.
- **`FrequencyGrid`** (`bookings/FrequencyGrid.tsx`) — `'use client'` 4-column option grid for the recurring frequency picker. Each card carries `{ id, name, meta }`; selected state = rust border + rust-soft bg + rust meta line; hover = rust border only. Local `useState` active state — lift to `value`/`onChange` when real persistence wires up.
- **`RecurringPreviewList`** (`bookings/RecurringPreviewList.tsx`) — paper-bg card listing the next-N visits. Mono eyebrow at the top (`<strong>` = rust) + `120px 1fr 90px` rows (mono date / time + visit sub / rust right-aligned price). Dotted bottom rules between rows, auto-suppressed on the last.
- **`RecurringSummaryBar`** (`bookings/RecurringSummaryBar.tsx`) — ink-bg summary footer with the configured frequency on the left (line 1 — `<strong>` = paper-bold) + secondary detail line + 22px rust-light `totalLabel` line, and a rust CTA button on the right. Renders the CTA as `next/link` when `ctaHref` is set, else as a click button.
- **`NewBookingModal`** (`bookings/NewBookingModal.tsx`) — `'use client'` admin booking modal (admin Screen 21). Built on the canonical `Dialog`/`DialogContent` (size `lg` = 920px) but overrides the default `p-10` padding with a custom header / body / footer rhythm (`px-7` band, paper footer with `border-t`). Header: rust mono tag pill (with leading rust dot) + 24px rust-em title + subtitle + custom paper-2 close button. Body: summary banner (ink-bg single-letter logo + headline ReactNode + muted detail) + customer Input + date/time split row + service chip row (uses `ChipSelector` pill variant) + price/duration split + notes Textarea + 3-col row (assigned-to Input + 2 `ToggleField`s). Footer: muted info text (`<strong>` = ink) + Cancel/Save buttons. Stubbed — closes on either Cancel or Save without persisting.

### `shared/` — new generic primitive added in Session 3

- **`ChipSelector`** (`shared/ChipSelector.tsx`) — `'use client'` generic single-select pill row. `options: ChipOption<T>[]` (`{ id: T, label }`) + `defaultId`/controlled `value`/`onChange`. `variant: 'pill' | 'mono'`. **Pill** (default) — Inter Tight 13px pill chip, ink-active on white card bg, hover-rust border. Used by the new-booking modal's service-chip row. **Mono** — small mono uppercase pill stretched flush via `flex-1`, ink-active on paper bg, hover-rust border. Used by the recurring day-picker row. Different from `LeadFilterChips` / `CalendarClientFilterBar`, which are **multi-toggle filter** chips (rust-active with count badges); `ChipSelector` is a single-select pick (ink-active, no badges). The two patterns share visual chrome but are semantically distinct — see parked decisions.

### `admin/calendar/` — added in Session 3

- **`AddBookingButton`** (`admin/calendar/AddBookingButton.tsx`) — `'use client'` rust primary button that opens the `NewBookingModal`. Holds local `open` state. Mounted on the admin calendar page in a `flex justify-between` row alongside the `CalendarClientFilterBar`. The button is the only entry point for the new-booking modal until a real calendar-cell-click flow lands.

---

## Deferred / out of scope until end

The admin **Proof Page / prospecting tool** (the audit → proof-page → outreach
pipeline, sourced from `reference/webnua-proof-page-tool.html` and
`reference/webnua-finding-library.json`) is a real platform feature **but is
deferred until the full platform — front and back end — is working.**

Until then:
- **Do not** scaffold routes, components, lib/types, or data for it.
- **Do not** add it to nav, sidebar, or any role's settings.
- **Do not** treat the prototype HTML or the finding-library JSON as current spec.
- The files stay in `/reference` — they are the spec for the future build, not for now.

If a session has a reason to touch this area, stop and confirm with the user
first.

---

## Open decisions / parked

> Things deliberately not decided yet. Don't silently resolve these — flag them.

- Backend wiring (Supabase) — frontend-first, backend later.
- Error-handling pattern — decide on first real use, document above.
- ~~**`SettingsPanel` — second-use trigger.**~~ **Resolved** (Phase 5 session B): every settings tab page now uses the extracted `components/shared/settings/SettingsPanel`. Don't re-inline the `Card`+`CardContent` pattern in new tab pages — use `SettingsPanel`.
- **`InkHero` — 5 ink-hero-style components exist** (`IntegrationProgressHero`, `BillingPlanCard`, `TicketsHero`, `FunnelHero`, `LeadsHero`). `LeadsHero` is the 5th data point — it's visually a near-twin of `TicketsHero` (rust-tag pill + 30px headline + paper/70 subtitle + polymorphic `right` slot) but kept separate so the leads file structure mirrors tickets and the `right` slot is constrained to the lead-inbox vocabulary. The other three still have meaningfully different shapes (progress bar / plan-meta / agg-card + back-link). **Two are now nearly structurally identical (`TicketsHero` + `LeadsHero`), but the other three are still divergent — extracting now would still produce a grab-bag of optional slots.** Hold pattern: when a 6th ink-hero lands AND at least three are visibly the same shape, that's the extract signal. Until then, consider a shared Tailwind recipe (a `cn(...)` helper for the ink-bg + rust-mono-tag chrome).
- **`LeadRailCard` vs `TicketSideCard` vs booking rail — third use of the white-card-rail pattern fired (Phase 5 · Cluster 2 · Session 2).** The admin + client booking-detail rails reuse `TicketSideCard` light tone directly + `TicketPropertyRow` for the customer-value / automations rows — they fit without modification. **Extract pending.** The trigger has fired but extraction was deferred to avoid mid-cluster scope creep (would touch tickets/leads detail pages). Next housekeeping pass: rename `TicketSideCard` → `RailCard` and `TicketPropertyRow` → `RailPropertyRow` under `shared/`, migrate the 3 surfaces (tickets / leads / bookings), and absorb `LeadRailCard`'s `tone` + `accent` row vocabulary into the new `RailPropertyRow`. Do this as its own session — not bundled with feature work.
- **`CalendarClientFilterBar` vs `LeadFilterChips` — second use of the rust-active filter-chip recipe.** Same chrome (mono `//` label + pill chips with optional count badge, rust-active / paper-inactive). Built separately because the type signature is leads-specific (`LeadFilterChip`) and calendar carries its own `CalendarClientFilter`. **Hold pattern: a third surface needs the same shape → extract `shared/FilterChips.tsx` with a generic `{ id, label, count? }` type, then migrate both callers.** Note: the new `shared/ChipSelector` (Session 3) is a **different** pattern (single-select / ink-active / no count badges) so it doesn't subsume this trigger — keep filter-chips separate from pick-chips.
- **`CalendarClientTone` vs `LeadClientTone` / `AdminTicketClientTone` — three separate client-tone vocabularies now exist.** Leads/tickets pills use muted backgrounded tones (`bg-rust/[0.12]` etc.); calendar uses solid prototype hex colours (`#4a7ba6` etc.) on booking pills + legend swatches + today-panel left borders. The token sets aren't interchangeable (one is a pill background-tint vocabulary, the other is a solid identity-colour vocabulary), so they live separately. **Hold pattern: when the booking-detail screen (Cluster 2 Session 2) lands and needs the same solid-tone vocabulary, extract `lib/calendar/tones.ts` and import from both calendar + booking detail.**

- **Auth/role-resolution mechanism — STUB in place.** The current role boundary is a localStorage-backed React context with a floating dev role switcher. **Three deletion points** when real auth ships:
  1. `src/lib/auth/role-stub.tsx` — the provider + hook + landing-map (delete the file).
  2. `src/app/layout.tsx` — the `<RoleProvider>` import + wrapper (remove from root layout).
  3. `src/components/shared/DevRoleSwitcher.tsx` and its two mounts in `src/app/(client)/layout.tsx` + `src/app/(admin)/layout.tsx` (delete the component + the two `<DevRoleSwitcher />` JSX nodes).
  Also: `src/app/page.tsx` (root landing) and `src/app/(auth)/login/page.tsx` both call `useRole()` — replace those with the real auth-resolution flow.
