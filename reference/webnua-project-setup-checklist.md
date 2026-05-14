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

**Suggested screen order** — shared-heavy things first, so the shared library builds up
early and later screens have more to reuse:

- [ ] Auth / login / role resolution screen
- [ ] The shared dashboard shell + whichever dashboard is simpler
- [ ] Settings + integrations (heavily shared between client and admin)
- [ ] Tickets — inbox + detail (client and admin versions share most structure — build
      the shared core, branch the role-specific bits)
- [ ] The client funnel views
- [ ] The admin Proof Page pipeline (audit → build → generate) — the most complex, do it
      once the shared library is mature
- [ ] Websites / page editor
- [ ] The cross-client admin views (integrations matrix, internal automations)

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
