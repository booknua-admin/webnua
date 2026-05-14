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

- **Colours:** paper `#f5f1ea`, paper-2 `#ebe5d9`, paper-3 `#e0d8c8`, ink `#0a0a0a`, accent/rust `#d24317` (the Perth landing page uses `#d24317`; the tools used `#d45b1a` — **standardise on `#d24317`**), good `#1e6b3a`, warn `#c44444`, info `#2d7d8a`.
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
- `tailwind.config` tokens and `tsconfig` strict settings — these are deliberate. Changing them needs a conversation.
- Any config that's clearly intentional — ask first.

---

## Known component inventory

> Keep this list current. When a shared component is built, add it here so future sessions
> find it instead of rebuilding it. This is the map that prevents duplication.

*(empty — populate as components are built)*

- `ui/` —
- `shared/` —
- `client/` —
- `admin/` —

---

## Open decisions / parked

> Things deliberately not decided yet. Don't silently resolve these — flag them.

- Backend wiring (Supabase) — frontend-first, backend later.
- Error-handling pattern — decide on first real use, document above.
- Auth/role-resolution mechanism — stub the role boundary now, wire real auth with the backend.
