# Webnua Platform — Project Setup Checklist

**The order matters.** Each phase makes the next one safe. Do not start feature work
until Phase 4 is done — features built before the skeleton exists is exactly how you
get duplicate components and inconsistent structure.

Work through this with Claude Code, roughly one phase per session.

---

## Phase 0 — Before you open Claude Code

- [ ] Put both HTML prototypes into a `/reference` folder in the repo
- [ ] Put the spec docs (finding library JSON, cadence doc, this checklist) in `/reference` too
- [ ] Put `CLAUDE.md` at the project root
- [ ] `git init` — first commit is the reference material + CLAUDE.md, nothing else yet

**Why first:** Claude Code reads CLAUDE.md every session. Having it there before any
code means Claude has its standing orders from session one. The prototypes in `/reference`
mean Claude can *see* the spec without you pasting it every time.

---

## Phase 1 — Scaffold + tooling

- [ ] `create-next-app` — App Router, TypeScript, Tailwind, ESLint
- [ ] Confirm **TypeScript strict mode** is on in `tsconfig.json` — non-negotiable
- [ ] Set up Prettier + ESLint, format-on-save config committed to the repo
- [ ] Add the directory structure from CLAUDE.md as empty folders with `.gitkeep` —
      `components/ui`, `components/shared`, `components/client`, `components/admin`,
      `lib`, `lib/types`
- [ ] Commit: "scaffold + tooling"

**Why:** the structure existing as empty folders means Claude places things correctly
from the first component. An empty `src/` invites invented structure.

---

## Phase 2 — Design tokens

- [ ] Extract the prototype's tokens into `tailwind.config` — the full palette
      (paper, paper-2, paper-3, ink, accent `#d24317`, good, warn, info), the fonts
      (Inter Tight, JetBrains Mono), radii, spacing scale
- [ ] Set up the fonts (next/font)
- [ ] Global CSS — the CSS variables, base styles, the light-theme defaults
- [ ] Build one throwaway test page that renders the palette + type scale, eyeball it
      against the prototype, then delete it
- [ ] Commit: "design tokens"

**Why:** every component built after this inherits the right look automatically.
Tokens first means "looks like the prototype" is structural, not per-component effort.

---

## Phase 3 — Primitive component layer

- [ ] Install shadcn/ui, point it at the tokens
- [ ] Bring in + theme the primitives you know you need: Button, Input, Textarea,
      Select, Dialog, Card, Badge, Tabs, Tooltip — match them to the prototype's styling
- [ ] Any prototype-specific primitive that shadcn doesn't cover (e.g. the mono eyebrow
      tag, the severity pill) — build it once in `components/ui/`
- [ ] Add each primitive to the **Known component inventory** in CLAUDE.md as you go
- [ ] Commit: "primitive component layer"

**Why:** this is the anti-duplication foundation. After this, there is a canonical
Button. Claude has no reason to build a second one — and CLAUDE.md tells it to check first.

---

## Phase 4 — The app shell + role architecture

- [ ] Route groups: `(auth)`, `(client)`, `(admin)`
- [ ] The shared layout shell, then the client layout and admin layout that extend it
- [ ] A **stubbed** role boundary — a simple role switch (hardcoded/mocked for now) that
      proves the client/admin split works. Real auth comes with the backend.
- [ ] The client sidebar/nav and admin sidebar/nav as shared-structure components
- [ ] An empty placeholder page in each route group, navigable end to end
- [ ] Commit: "app shell + role architecture"

**Why:** this physically establishes "one platform, two roles, shared components" in
the repo. After this, every feature is *filling in a structure that exists*, not
creating structure. This is the last phase before features.

---

## Phase 5 onward — Features, one screen at a time

Now, and only now, build screens. For each one:

1. Claude looks at the relevant prototype screen in `/reference`
2. Claude **searches `components/` for anything reusable** before building (CLAUDE.md rule)
3. Claude explains the plan + files it'll touch — you confirm
4. Build the screen from existing primitives + shared components
5. Any genuinely new shared component → built in `shared/`, added to CLAUDE.md inventory
6. Commit when it works

**Phase 5 build order — live, clustered** (replaces the older suggested screen-list).
Group screens by the shared component surface they create, so each session feeds the next.
Within a cluster, build the shared shape once, then the role variants.

Foundation already shipped: auth/login, app shell + role architecture, settings (all tabs
both roles), integrations matrix, tickets (inbox + detail both roles), client funnel
detail, admin client-onboarding wizard, admin dashboard (`/dashboard`).

**Cluster 1 — Lead / conversation surface.** Client Screens 2/3/9, admin 15/16/19.
One shared `LeadRow`, `LeadDetailLayout`, `ConversationThread` (reuses existing
`TicketThreadMessage` / `TicketReply` shapes where they fit). Replaces the
`/leads` placeholder.

**Cluster 2 — Calendar + booking surface.** Client 4 + admin 13, booking detail
(client 8 / admin 18), booking/reschedule modals (admin 21/23, client 16/17).

**Cluster 3 — Automations.** Client 5 + admin 10/17 + modal 22. Reuse the
existing `AutomationCard` from onboarding.

**Cluster 4 — Reviews + campaigns.** Client 6/18 + admin 11/12 + negative-review
modal 24.

**Cluster 5 — Website + page builder** (one component, role-gated). Admin gets
the editor; client view is read-only for now (future-proofed for client edit
access). Build order inside the cluster:
1. `/websites` (admin cross-client list — Screens 9 + 46 merged) and
   `/website` (client single-site view — Screen 19). Replaces the existing
   `/website` placeholder.
2. The single `PageBuilder` component, role-gated — covers Screens 20, 32,
   41–43, 47. Also fed by a future "edit funnel" entry from `/funnels/[id]`.
3. Gallery (client 21), Request-change modal (client 22), Version history
   (admin 33), Variable picker (admin 34) hang off the builder.

**The page-builder cluster needs its own dedicated plan-review when reached** —
the role-gating + builder/editor/preview surface is complex enough that "next
cluster" is not a safe shortcut into it.

**Cluster 6 — Operator secondaries.** Admin Screen 20 (single-client overview)
**lands here, after clusters 1–4**, because it's a hub that assembles their
components — it can't be built first. Also: team invite 37–39, GBP connect flow
25, global search 35, notification panel (client 10), job completion (client 11).

**Cluster 7 — Client dashboard** (Screen 1). Last, because the stat/list shapes
it needs all come from the lead, calendar, and reviews clusters. Replaces the
`/dashboard` client placeholder.

The deferred Proof Page pipeline (see "FINAL (deferred)" below) sits after
everything above — only once the full platform incl. backend is working.

---

## Ongoing discipline — the habits that keep it clean

- **CLAUDE.md is living.** Every time Claude does something wrong, correct it AND add a
  line to CLAUDE.md. Every shared component built → added to the inventory.
- **Commit at every working state.** The git history is your undo button and your
  "this is already done" memory.
- **One focused scope per session.** When a session sprawls, stop and start fresh.
- **If Claude proposes something that contradicts CLAUDE.md** — that's the signal CLAUDE.md
  needs a clearer line, not that the rule should be broken.
- **Periodically ask Claude to audit for duplication** — "are there components doing the
  same thing that should be merged?" — and act on it early, before duplicates get
  load-bearing.

---

## The one-line summary

Tokens → primitives → shell → features, in that order. Structure before features.
CLAUDE.md is the standing orders and it's alive. Commit constantly. Search before building.

---

## FINAL (deferred)

- [ ] **Admin Proof Page pipeline** — the audit → proof-page → outreach prospecting
      tool (spec lives in `webnua-proof-page-tool.html` + `webnua-finding-library.json`).
      **Only after the full platform — including backend — is working.** Out of scope
      until then. No earlier session should route, scaffold, or wire any part of it.
