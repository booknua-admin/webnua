# Client access audit

> Read-only walk of the codebase to enumerate every gap between
> "client (Mark from Voltline) signs up, pays €299, lands on `/dashboard`"
> and "client can fully self-serve their workspace." Three-tier model:
> OPERATOR (Webnua staff), **CLIENT** (the paying business — this audit),
> CUSTOMER (their end users — out of scope here). Every classified row is
> the CLIENT tier specifically. No source code was modified.

Reference for the underlying pattern: `reference/client-context-pattern.md`.

---

## 1. The "what should a client be able to do" inventory

Status legend: **A** = Accessible (wired end-to-end for clients) · **B** =
Blocked (surface exists, client rejected by auth/role) · **MUI** = Missing
client UI (works for operators, no `_client-content.tsx` or it is a stub) ·
**BR** = Broken · **U** = Unknown.

> Cross-cutting blocker for almost every WRITE row below — see §3 finding 1:
> the cap layer (`src/lib/auth/capabilities.ts:71`) gives every new client
> only `CLIENT_DEFAULTS = ['viewBuilder']`. Pattern B's signup flow does NOT
> insert any `capability_grants` for the new owner. So almost every "edit"
> capability gate (`editCopy`, `editMedia`, `editLayout`, `editSections`,
> `editForms`, `editPages`, `editSEO`, `useAI`, `publish`, `approve`,
> `rollback`, `manageDomain`) silently hides the affordance unless the
> operator manually grants it via `/settings/access`. Marked **B (cap)**
> below.

### WEBSITE — `/website`, `/website/[pageId]`, `/website/header`, `/website/footer`, `/website/review`, `/website/new`

| Capability | Status | Where it lives / why |
|---|---|---|
| View current draft / pages | A | `src/app/website/page.tsx:96` — role-shared route, resolves the client's website via `useWebsiteForClient` with RLS scoping. |
| Edit copy on a section | B (cap) | Gated by `editCopy` inside `CopyField` (`src/lib/website/sections/_shared/CopyField.tsx`); client default has no `editCopy`. The field renders as request-change affordance via `CapabilityGate mode="request"`. |
| Edit media on a section | B (cap) | Same shape, `editMedia` gate inside `MediaField`. |
| Add a new section | B (cap) | `editSections` cap; `SectionHoverToolbar` / `AddSectionDialog` only appear if granted. |
| Reorder sections | B (cap) | `editLayout` cap on the section hover-toolbar. |
| Delete a section | B (cap) | `editSections` cap. |
| Switch template / section variant | B (cap) | `editLayout` cap (variant-cycle fields). |
| Preview live site | A | View-live link in `WebsiteHero` (`src/components/shared/website/WebsiteHero.tsx:75`) is unconditional. |
| Publish (Pattern B pay-to-publish) | A (preview state only) | `PublishToGoLiveCTA` mounts ONLY during `pending_verification` / `preview` lifecycle (`src/app/dashboard/page.tsx:36`). Once the client is `active`, the editor's publish/submit buttons are gated by `publish` cap OR any edit cap (`src/components/shared/website/EditorToolbar.tsx:251`). Client default → both `false` → neither button renders. **B (cap)**. |
| Subsequent publish after first | B (cap) | See above — no edit caps means even "Submit for review" hides. |
| Unpublish website | MUI | `unpublishWebsite` mutation does NOT exist. `grep` for `unpublishWebsite` returns zero hits. (Funnels have `unpublishFunnel` in `src/lib/funnel/mutations.ts`; websites do not.) |
| Connect custom domain | A | `/settings/domains` `_client-content.tsx:56` mounts the real `CustomDomainSection` against `clientUuid`; the Phase-9 attach flow accepts client-role. |
| Restore prior version | B (cap) | `VersionHistoryCard` (`src/app/website/page.tsx:283`) renders "↺ Restore" — `restoreVersionAsDraft` is wired but the button is gated by `rollback` cap (per inventory entry). No `rollback` in `CLIENT_DEFAULTS`. |
| "+ New page" (Q&A flow) | B (cap) | `NewPageEntry` (`src/components/shared/website/NewPageEntry.tsx`) requires both `editPages` and `useAI`. Client has neither. |
| "Scaffold a new website" CTA | BR | `src/app/website/page.tsx:449` — `<Button>Scaffold a new website</Button>` has NO `onClick` and is wrapped in `<CapabilityGate capability="editPages">`. Dead button even if the cap were granted. |

### FUNNEL — `/funnels`, `/funnels/[id]`, `/funnels/[id]/edit/[stepId]`, `/funnels/[id]/review`

| Capability | Status | Where it lives / why |
|---|---|---|
| List funnels | A | `src/app/funnels/page.tsx:62` — context-aware, resolves the client's funnel list. |
| Open funnel detail | A | `src/app/funnels/[id]/page.tsx` — role-shared. |
| Edit step content | B (cap) | Same `editCopy` / `editMedia` cap gates via `CopyField` / `MediaField` per section. |
| Publish funnel | B (cap) | `src/app/funnels/[id]/review/page.tsx:87` — `useCan('publish')` + `useCanAny('editCopy'…)`; both false for clients. |
| Unpublish funnel | B (role) | `FunnelSlugEditor` (`src/components/client/funnels/FunnelSlugEditor.tsx`) gates the unpublish/publish-toggle button on `role === 'admin' + publish` cap (CLAUDE.md inventory + file comment line 11). **Clients cannot unpublish their own funnel.** |
| View per-funnel analytics | A | `/funnels/[id]` is role-shared and resolves real data. |
| Create a SECOND funnel | MUI | No "+ New funnel" surface exists anywhere — `grep -rn "create.*funnel\|CreateFunnel\|+ New funnel"` returns zero hits. Pattern B creates exactly one funnel at signup; there is no path to add another (neither operator nor client). |

### LEADS — `/leads`, `/leads/[id]`, `/leads/[id]/conversation`

| Capability | Status | Where it lives / why |
|---|---|---|
| Inbox | A | `src/app/leads/_client-content.tsx:16` — wired `useClientLeadsInbox` with RLS. |
| Read lead detail | A | `src/app/leads/[id]/_client-content.tsx` — role-shared, RLS-bounded. |
| Read full conversation | A | `src/app/leads/[id]/conversation/_client-content.tsx`. |
| Reply via email | A | `/api/leads/[id]/reply` uses `requireLeadAccess` (lib `automations/lead-access`) — accepts client-or-operator. `LeadConversationComposer` mounts for both roles. |
| Reply via SMS from inbox | MUI | CLAUDE.md "SMS from inbox is a Phase 8 concern" — the SMS channel in `LeadConversationComposer` stays inert. |
| Manually update status | A | `useUpdateLeadStatus` (`src/lib/leads/queries.tsx`) backs `LeadStatusSwitcher`; works for both roles. |
| See source attribution | A | `LeadSourcePill` from migration 0043; column rendered for both roles. |
| Export leads | MUI | No `Export`/`CSV`/`download` surface in `_client-content.tsx`. |

### AUTOMATIONS — `/automations`, `/automations/[id]`

| Capability | Status | Where it lives / why |
|---|---|---|
| List automations | A | `src/app/automations/_client-content.tsx:15` via `useClientAutomations`. |
| Enable / disable a flow | A | `useToggleAutomation` is gated by GBP guard but not by role (`_client-content.tsx:46`). Persists. (CLAUDE.md PR #106 confirms "clients edit copy + cadence".) |
| Edit message body | A | `useUpdateActionBody` in editor — wired for clients (`src/app/automations/[id]/page.tsx:82` mounts `EditorBody` with `isOperator={false}`; per-action body field is editable for both per PR #106 split). |
| Edit cadence | A | Same editor, `// CADENCE` section. |
| Add / move / remove action | B (role) | Per PR #106 (CLAUDE.md): operator-only. Clients see editor in read-only-for-structure mode. |
| Clone an automation | B (role) | Operator-only per PR #106. |
| Test-send | B (role) | `AutomationTestSendCard` "mounts only when `role === 'admin'`" (CLAUDE.md inventory). |
| See run history per lead | A | `LeadAutomationPanel` mounted on both `_admin-content` and `_client-content`; `/api/leads/[id]/runs` uses `requireLeadAccess`. |
| Per-lead automation state | A | Same panel + `/api/leads/[id]/automation-state` (`requireLeadAccess`). |

### INTEGRATIONS — `/settings/integrations`, `/settings/sms`, `/settings/email`, `/settings/domains`

| Capability | Status | Where it lives / why |
|---|---|---|
| `/settings/integrations` — connect GBP / Meta after going live | **MUI (critical)** | `src/app/settings/integrations/_client-content.tsx:7` is a HARDCODED Voltline stub: imports `clientIntegrations` from `src/lib/settings/client-integrations.tsx`, renders demo `IntegrationCard`s whose `action.kind` opens the in-app `ConnectIntegrationModal` (a UI-only demo, not the real OAuth flow). The real `IntegrationConnectionsSection` is mounted ONLY in `_sub-account-content.tsx:91`. After a client moves out of `preview` lifecycle, they have NO path to manage their own integrations. (During preview, `IntegrationOnboarding` mounts the real surface — see §3 finding 4.) |
| `/settings/sms` — provision sender | B (route) | Tab not in `clientSettingsNav` (`src/lib/nav/client-settings-nav.ts`); `SmsSenderSection` is sub-account operator-only per CLAUDE.md inventory. If client direct-URLs `/settings/sms`, the settings layout's `SUB_ACCOUNT_ONLY` guard (`src/app/settings/layout.tsx:24-29`) only redirects OPERATORS, not clients — client may see a half-mounted operator surface or 404 silently. **U** for the actual landing behaviour without runtime test. |
| `/settings/email` — sender + templates | Same as `/settings/sms` — B (route) for clients; not in their nav; layout guard misses them. |
| `/settings/domains` — custom domain | A | Wired per Phase 9 (`_client-content.tsx:56`). |

### SETTINGS

| Capability | Status | Where it lives / why |
|---|---|---|
| Profile (business name, owner, mobile, email, service area, licence) | **MUI** | `src/app/settings/profile/page.tsx:8` — server component reading hardcoded `clientProfileBusiness` / `clientProfileManagedByWebnua` from `src/lib/settings/client-profile.ts`. EVERY value is the literal Voltline stub ("Voltline Pty Ltd", "Mark Cassidy", "0411 567 234"…). No read against the client's real `clients` row; no write. Every "Edit ✎" / "Request change ✎" affordance is a span with no `onClick`. |
| Branding (colors, logo, fonts) | **MUI** | No `BrandEditor` route exists. `grep -rn "BrandEditor\|/settings/brand"` returns zero hits except a `SiteFontsMenu` for the editor toolbar. The `brands` table backs the website renderer; clients cannot view OR edit theirs from settings. |
| Team — invite teammates | A | `src/app/settings/team/_client-content.tsx` — real `InviteTeammateButton` + seat meter + real `client_user_invites` write. |
| Notifications — channel prefs / quiet hours | **MUI** | `src/app/settings/notifications/page.tsx:117` `ClientContent` renders `clientNotifications` (hardcoded `lib/settings/client-notifications.ts` stub) inside `NotificationRow`. Switches default-checked, "Edit ✎" affordance inert. No write path for client-side notification preferences. (Quiet hours WOULD be `clients.quiet_hours_*` from migration 0083 but `QuietHoursSection` is wired only inside `OperatorContent`.) |
| Billing — view plan, update card, see invoices, cancel | A | `src/app/settings/billing/_client-content.tsx:38` mounts the real `StripeSubscriptionSection`. Stripe Portal handles update-card / invoices / cancel; the `/checkout` + `/portal` routes were widened to `requireClientAccess` per CLAUDE.md. |
| Cancel subscription (the entry-point in our UI) | A | Via Stripe Portal — opened from `StripeSubscriptionSection`'s "Manage billing" button. |
| Login + security — password / 2FA / sessions | **MUI** | `src/app/settings/security/page.tsx` reads `clientSecurityCredentials` / `clientSecurityTwoFactor` / `clientSecuritySessions` from `lib/settings/client-security` — every value hardcoded stub. `SecurityRow` action button onClick is unwired; `SignOutOtherSessionsButton` is a stub per CLAUDE.md inventory ("confirming just dismisses (no backend)"). No password change, no 2FA enrol, no session list against the real `auth.users`. |
| Domains | A | See above. |
| Help | **MUI** | `src/app/settings/help/page.tsx:9` reads hardcoded `clientHelpFaqs` + `SUPPORT_PHONE = '0411 234 567'`. Static FAQ + hardcoded operator contact. (Not catastrophic — content is OK for V1, but the operator name/contact is hardcoded to one person/number.) |

### Other (not in the original inventory but found while walking)

| Capability | Status | Where it lives / why |
|---|---|---|
| Calendar — view + add booking | A | `src/app/calendar/_client-content.tsx:39` mounts `AddBookingButton`. |
| Reviews — view + reply to GBP review | A | `src/app/reviews/_client-content.tsx` — `ReviewItem` wires inline reply via `useReplyToGbpReview(review.clientId)`. |
| GBP connect | A | `GbpConnectPanel` and `IntegrationConnectionsSection` both accept client-role via `requireClientAccess` per CLAUDE.md Phase 7 GBP UI consolidation. (Only reachable today via `_sub-account-content`'s real section OR the `/reviews` empty state.) |
| Tickets — submit + read | A | `/tickets/new` is a real submit flow accepting both roles. |
| Campaigns | A (read-only) | Client view is intentionally reassurance-band + read-only deep dive ("Webnua handles your strategy"). No CLIENT mutations expected here. |
| Search | A | `/search` 3-way dispatch. |

---

## 2. Operator agency-view bug investigation

**Reported symptom:** "Adding a new site from operator agency view fails."

### Repro path

Three plausible operator-side "add a website/site" entry points:

1. **Sidebar `AdminClientPicker` → "+ Add new client"** (`src/components/admin/AdminClientPicker.tsx:172`)
   — links to `/clients/new`.
2. **`/(admin)/websites` matrix → "Build →"** on a no-website client row
   (`src/app/(admin)/websites/page.tsx:281`) — links to `/clients/new`.
3. **`/website` agency empty state → "Scaffold a new website"**
   (`src/app/website/page.tsx:449`) — `<Button>` with **no `onClick`**.

Paths 1 and 2 route to `/clients/new`, which mounts `CreateClientButton`
(`src/app/(admin)/clients/new/page.tsx:48`) → opens `CreateClientModal`
→ calls `createClientWithGeneration` (`src/lib/clients/create-client.ts:46`).
That function calls `supabase.auth.getUser()` and inserts a `clients` row
with `lifecycle_status: 'active' as never` (line 96). The `clients_insert`
policy requires `is_operator()` (`supabase/migrations/0004_rls_policies.sql`)
which is satisfied. **The end-to-end flow looks intact.**

**Path 3 is broken at the file level** — `src/app/website/page.tsx:449`
literally has `<Button>Scaffold a new website</Button>` with no `onClick`
or `asChild`. Confirmed via `grep -n "Scaffold\|onClick" src/app/website/page.tsx`.
A click does nothing.

### Root cause (most likely)

If the bug is path 3 (the agency `/website` view's empty-state Scaffold
button), the root cause is **literally a missing `onClick`** on line 449
of `src/app/website/page.tsx`. The CTA is also wrapped in
`<CapabilityGate capability="editPages" mode="hide">` so an admin without
`editPages` (admins have `ADMIN_DEFAULTS` = all caps, so this is non-blocking
for operators).

If the bug is path 1 or 2 (the `/clients/new` flow), I could not reproduce
without running it. Two latent risks worth probing first:

- The `lifecycle_status: 'active' as never` typed-cast bypass on
  `src/lib/clients/create-client.ts:96`. Migration `0084` adds `'active'`
  to the enum, so this should resolve at runtime. If the deployed DB is
  pre-`0084`, the insert fails with `invalid input value for enum`.
- The `funnel_offer` insert at `src/lib/clients/create-client.ts:197` —
  if `brief.funnel.offer` is `null` it inserts `null`; if Stripe / Claude
  cost paths choke mid-generation the modal lands on the review step with
  the error inline (per `CreateClientModal` inventory entry).

### Fix complexity

- **Path 3 (likely):** trivial. Either remove the dead Scaffold button
  entirely (the modal-based flow on `/clients/new` is canonical and the
  sidebar / matrix already route there), OR wire it to navigate to
  `/clients/new`. ~10 minutes.
- **Path 1/2 (if the reported bug is here):** needs live repro. The data
  layer looks correct from static read — first move is to capture the
  real network error in `CreateClientModal`'s error pane (already wired
  per CLAUDE.md inventory entry on the modal) and walk from there. The
  flow's existing error-surfacing is good; root cause will be specific.

**The agency view itself isn't structurally broken** — the operator can
add a client (= a new website) from the sidebar picker. The bug is the
*third entry point* the agency-`/website` empty-state advertises.

---

## 3. Common patterns in the gaps

Cross-cutting causes that explain most of the table above:

1. **No capability grants on signup.** The single highest-leverage cause:
   `Pattern B` provisions a workspace, creates an `auth.users` + `public.users`
   row, attaches a Stripe customer, flips the lifecycle — but never inserts
   a `capability_grants` row. The new client owner inherits
   `CLIENT_DEFAULTS = ['viewBuilder']` (`src/lib/auth/capabilities.ts:71`).
   That is one view capability and nothing else. Every `editCopy`,
   `editMedia`, `editSections`, `editLayout`, `editForms`, `editPages`,
   `editSEO`, `useAI`, `publish`, `approve`, `rollback`, `manageDomain`
   gate silently hides its affordance. This is the root cause for ~70% of
   the website/funnel rows above. **Pattern B's promise of "client self-
   serves" is contradicted by the cap layer's default of "client can only
   look."**

2. **Static-stub settings pages were left as Voltline-themed display copy.**
   `/settings/profile`, `/settings/notifications` (client branch),
   `/settings/security`, `/settings/integrations` (client branch),
   `/settings/help` all read hardcoded data from
   `src/lib/settings/client-*.ts`. The settings dispatch pattern brought
   `/settings/billing`, `/settings/team`, `/settings/domains`,
   `/settings/integrations` (operator side), `/settings/notifications`
   (operator side) into live data — but the client-side pages were not
   refit. The settings nav (`clientSettingsNav`) still lists them, so a
   client reaches a page that says "Voltline Pty Ltd" even if they're
   Anna at FreshHome.

3. **Brand editor doesn't exist.** Brand data lives on `brands` table,
   feeds the website renderer's tokens, and is captured at signup — but
   no `/settings/brand` route exists. The client cannot update their
   colours / logo / fonts post-signup without operator intervention. The
   only brand-style affordance is `SiteFontsMenu` inside the website
   editor toolbar (which is `editTheme`-gated, so a client owner can't
   use it either).

4. **Onboarding state masks the integrations gap.** During Pattern B's
   `pending_verification` / `preview` lifecycle, `IntegrationOnboarding`
   (`src/components/shared/onboarding/IntegrationOnboarding.tsx`) mounts
   on `/dashboard` with the REAL `IntegrationConnectionsSection`. So a
   client connecting GBP/Meta during onboarding has a working surface.
   The moment they hit "Publish to go live" and the lifecycle flips to
   `active`, `/dashboard` switches to `_client-content.tsx`, the onboarding
   surface unmounts, and `/settings/integrations` becomes the static
   Voltline stub. **Reconnecting an expired token, swapping GBP locations,
   or connecting a new integration post-launch is impossible from the
   client UI.**

5. **`SUB_ACCOUNT_ONLY` settings guard only protects operators.** The
   layout guard in `src/app/settings/layout.tsx:47-53` only redirects
   `role === 'admin'`. A client-role user direct-URL-ing
   `/settings/api`, `/settings/sms`, `/settings/email`, `/settings/seats`,
   `/settings/platform-templates`, `/settings/danger`, etc. is NOT
   redirected. What they see depends on whether the page's body crashes
   on a client-role `useUser()`. Without runtime testing the per-page
   behaviour is **U**.

6. **The dispatcher pattern was applied unevenly.** Per CLAUDE.md, the
   "client context routing" pattern is settled across feature routes
   (`/dashboard`, `/leads`, `/tickets`, etc.). But the entire
   `/settings/*` subtree was given different treatment: the layout
   resolves nav per-role, but per-tab pages mostly skipped the role
   dispatch and stayed as static client/operator pages. So the pattern
   is "settled for features, opt-in for settings."

7. **Funnel write surface is admin-biased.** `unpublishFunnel` is gated
   on `role === 'admin'`. There is no client-side path to take their own
   funnel offline. `unpublishWebsite` doesn't exist at all.

8. **No "create another funnel" path exists** for either role. Pattern B
   creates exactly one funnel at signup. If a client launches a seasonal
   promo or a second offer, they cannot have a second funnel built
   without operator intervention (and even the operator has no in-app
   create-second-funnel flow — they'd have to spin up a new `clients`
   row).

---

## 4. Critical path vs nice-to-have

Each gap classified for V1. Critical = ships before charging anyone; Important
= before scale; V1.1 = follow-up session.

### Critical (V1 — block launch on Mark/Anna actually using their workspace)

- **No capability grants on signup.** All website/funnel edit & publish gates
  silently hide. Without this fix Pattern B is sell-and-frustrate: the
  customer can pay €299, see their generated site, and then discover they
  cannot change a typo, swap an image, or republish. **(Source:
  `src/lib/auth/signup-workspace.ts`, `src/lib/clients/create-client.ts`,
  `src/lib/auth/capabilities.ts:71`.)**
- **Client `/settings/integrations` post-activation.** Once the client
  pays and goes `active`, they lose the only path to connect GBP / Meta
  / reconnect expired tokens. (Source: `src/app/settings/integrations/_client-content.tsx`.)
- **Client `/settings/profile`.** Hardcoded Voltline data shown to every
  client. A FreshHome owner sees "Mark Cassidy". Cosmetic on first hit;
  loss-of-trust on second. (Source: `src/app/settings/profile/page.tsx`.)
- **Client `/settings/security`.** No password change, no 2FA enrol, no
  real session list. Required for a "controls leads, bookings, customer
  data" account.

### Important (V1 — before more than a handful of clients)

- **Client `/settings/notifications`.** Static stub; client can't choose
  channels or quiet-hours preferences from their own surface.
- **Brand editor.** No surface to update brand colours / logo / fonts.
- **Dead button:** `Scaffold a new website` on `/website` agency empty
  state (`src/app/website/page.tsx:449`).
- **Funnel client-side unpublish.** Currently admin-only; clients need
  a "take my offer page offline" affordance.
- **`SUB_ACCOUNT_ONLY` guard covers clients.** Direct-URL exposure to
  operator-only settings tabs.
- **Client `/settings/help` hardcoded contact.** "Craig at 0411 234 567"
  is a literal string; bake it into env or a `support_contact` setting.

### V1.1 (follow-up session)

- **Lead export (CSV).** Client cannot pull their leads out.
- **Website unpublish.** No surface exists for either role.
- **"Create another funnel".** Currently zero paths.
- **SMS-from-inbox.** Already parked decision (Phase 8).
- **Branding editor capabilities.** Once the editor exists, gate via
  a future `editBrand` cap.

---

## 5. Recommended fix order (top 5 leverage)

> Ordered by leverage / urgency / dependency, not by complexity.

### Fix 1 — Grant `CLIENT_OWNER_DEFAULTS` at signup (the unblocker)

**Complexity:** **Medium** (1–2 days).
**Where:** `src/lib/auth/signup-workspace.ts` (Pattern B path) + the
operator concierge path in `src/lib/clients/create-client.ts`.
**What:** when the workspace's owner user is created, insert
`capability_grants` rows for a new `CLIENT_OWNER_DEFAULTS` set
(probably `editCopy + editMedia + editSEO + editLayout + editSections +
editPages + editForms + useAI + publish + rollback + manageDomain`
— matches what a self-serve owner needs; `approve` stays operator since
Pattern B is "you publish your own"). **Decision needed (§6):** does the
client get `publish` or only `editX` + `approve`-via-operator? Pattern B
implies `publish`; the existing cap layer implies "edits go through
review unless granted." Need an explicit call.
**Dependencies:** none. **Unblocks:** 8+ rows in the table above.

### Fix 2 — Refit client `/settings/integrations` to mount `IntegrationConnectionsSection`

**Complexity:** **Small** (½ day).
**Where:** `src/app/settings/integrations/_client-content.tsx` — replace
the static `IntegrationCard` list with the same `IntegrationConnectionsSection`
the sub-account view uses, scoped to `user.clientId`.
**Decision needed:** none — `requireClientAccess` already wired per
CLAUDE.md Phase 7.

### Fix 3 — Refit client `/settings/profile`, `/settings/notifications`, `/settings/security` to live data

**Complexity:** **Medium** (2 days — three pages, plus the mutations).
**Where:** the three `page.tsx` files. Profile reads from the `clients`
row + the signed-in `users` row; writes via Supabase update; mirrors
patterns already in `CreateClientModal`. Notifications writes to
`clients.quiet_hours_*` + a new client-side notification-prefs table
(or scope reduce to "operator handles notifications"). Security reads
real `auth.users` data; password change via `supabase.auth.updateUser`.
**Decision needed:** does the client edit `clients.primary_contact_*` or
does that stay operator-managed (and the client edits only their own
`users` row)? Affects the field set on `/settings/profile`.

### Fix 4 — Build a brand editor + route at `/settings/brand`

**Complexity:** **Medium-Large** (2–3 days).
**Where:** new `src/app/settings/brand/page.tsx` + extend
`clientSettingsNav`. Read/write `brands` row; logo upload to existing
section-media bucket. Reuse the swatches from `CreateClientModal`'s
design step.
**Decision needed:** which caps does this need? Probably new `editBrand`
+ refactor of `editTheme` semantics.

### Fix 5 — Add the agency-view bug fixes (the trio)

**Complexity:** **Trivial** (~½ day).
**Where:**
- `src/app/website/page.tsx:449` — either delete the dead Scaffold
  button or wire it to navigate to `/clients/new`.
- `src/app/settings/layout.tsx:47` — extend the `role === 'admin'`
  guard to also redirect clients off operator-only tabs (`SUB_ACCOUNT_ONLY`
  applies, plus `AGENCY_ONLY`).
- Add a client-side path to unpublish their own funnel
  (`FunnelSlugEditor` ungate, with a `publish`-cap check — already
  inside `Fix 1`).

---

## 6. Decisions needing operator input

1. **Does a client owner get `publish` by default, or do their edits
   land in the operator approval queue (Lane B) unless granted?**
   Pattern B's "pay-to-publish" framing implies `publish` is part of
   the owner's bundle (they hit Publish, it goes live). The cap layer
   was designed assuming `publish` is operator-granted. This is the
   single biggest unanswered question — affects Fix 1's set, affects
   how the editor's "Submit for review" path works for a self-serve
   client.

2. **Branding — does the client edit it themselves, or is it a
   "request change" through tickets?** The existing brand is captured
   once at signup and never edited. Pattern B's framing suggests the
   client owns their own brand and can iterate; the platform's framing
   ("Webnua manages your design") suggests operator-only. Pick one.

3. **Client profile fields — which are editable vs read-only?**
   Business name + email + phone are obvious editables. Service area
   + licence + ABN are "reflected on funnel + invoices" — should those
   propagate automatically or trigger a Webnua review?

4. **Notification preferences — do clients have a real prefs table,
   or do they only see what Webnua sends and the operator-side
   `notification_preferences` table is the only knob?** The current
   schema only has the operator-side table. Either build a client-side
   prefs table or repackage the existing one with a client-visible
   edit surface.

5. **Funnel unpublish — should clients be able to take their own
   funnel offline?** Pulling a live ad-funded funnel offline mid-flight
   has business consequences. Either let them with a confirm dialog,
   or keep it operator-only and surface a "Request takedown →" ticket
   CTA in the funnel detail.

6. **"Create another funnel" — is this a V1 need?** A tradie with a
   summer pool-cleaning sub-offer wants a second funnel. Today neither
   role can do it. If Yes-V1, design the second-funnel flow; if
   No-V1, just confirm and add to V1.1.

---

## 7. Estimated session count

**4 sessions** to bring the client tier up to "actually self-serve V1."

- **Session 1:** Fix 1 (capability grants on signup) + Fix 5 (agency-view
  trio + guard). 1 session because Fix 1 is the unblocker and Fix 5 is
  small enough to bundle. **Cannot be split or deferred** — without
  Fix 1, all later sessions ship features the client can't actually use.
- **Session 2:** Fix 2 + Fix 3 (integrations + profile/notifications/
  security). Three static-stub pages + one real-mount swap — natural
  bundle.
- **Session 3:** Fix 4 (brand editor). New route, real shape, deserves
  its own session.
- **Session 4:** Cleanup pass — lead export, funnel unpublish for
  clients, help-page contact-via-env, the operator second-funnel path
  if decided V1, dead-button audit across the rest of the codebase.

Pre-session blocker: decisions §6.1 (publish bundle) and §6.2 (brand
editor existence) must be made before Session 1 starts — they shape the
cap set that Session 1 grants.

**The onboarding-wizard session should ship AFTER these fixes**, not
before. Otherwise a freshly-onboarded client lands in a workspace they
can't manage, and the wizard's "now you're set up" framing reads false.
The fixes above turn that promise into a real one; only then does the
wizard polish make sense.
