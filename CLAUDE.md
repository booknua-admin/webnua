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

- **Colours (Webnua palette — source of truth):** paper `#f5f1ea`, paper-2 `#ebe5d9`, paper-3 `#e0d8c8`, ink `#0a0a0a` (with ink-soft `#2a2a28`, ink-mid `#4a4a45`, ink-quiet `#6e685c`), rust `#d24317` (with rust-deep `#8a3815`, rust-light `#e8743b`, rust-soft `#f4dccd` — the Perth landing page uses `#d24317`; the tools used `#d45b1a`, **standardise on `#d24317`**), good `#1e6b3a`, warn `#c44444`, info `#2d7d8a`, rule `#c9c0b0`.
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

### `lib/nav/` — nav + sidebar data (single source of truth for nav)

- **`types.ts`** — `NavItem` (`{ label, href, icon, badge? }`) + `NavSection`.
- **`client-nav.ts`** — `clientNav` (sections + items), `clientWorkspace`, `clientSupport` (used as the `contact` prop on `ClientSupportCard`), `clientUser`.
- **`admin-nav.ts`** — `adminOverviewNav`, `adminWorkspaceNav`, `adminWorkspace`, `adminUser`.
- **`admin-clients.ts`** — `adminClients` (stubbed client list) + `adminActiveClientId`. Replace with backend data when wired.

### `lib/dashboard/` — per-role dashboard stub data

- **`admin-dashboard.tsx`** — operator-dashboard stub data: `dashboardGreeting` (eyebrow), `dashboardStats` (4-tile stat row, `value` is `ReactNode` so the `<em>34</em>` rust highlight on "leads this week" lives in the data), `midSetupClient` (the Voltline continue-setup hero), `liveClients` (the live-client list rows). `.tsx` because the stat values are JSX. Re-shape into Supabase reads when the backend lands.

---

## Open decisions / parked

> Things deliberately not decided yet. Don't silently resolve these — flag them.

- Backend wiring (Supabase) — frontend-first, backend later.
- Error-handling pattern — decide on first real use, document above.
- **Auth/role-resolution mechanism — STUB in place.** The current role boundary is a localStorage-backed React context with a floating dev role switcher. **Three deletion points** when real auth ships:
  1. `src/lib/auth/role-stub.tsx` — the provider + hook + landing-map (delete the file).
  2. `src/app/layout.tsx` — the `<RoleProvider>` import + wrapper (remove from root layout).
  3. `src/components/shared/DevRoleSwitcher.tsx` and its two mounts in `src/app/(client)/layout.tsx` + `src/app/(admin)/layout.tsx` (delete the component + the two `<DevRoleSwitcher />` JSX nodes).
  Also: `src/app/page.tsx` (root landing) and `src/app/(auth)/login/page.tsx` both call `useRole()` — replace those with the real auth-resolution flow.
