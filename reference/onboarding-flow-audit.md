# Onboarding flow audit — stranger to first-lead-replied

> Read-only audit produced 2026-05-24. Walks the actual code under
> `src/app/`, `src/components/`, `src/lib/` and verifies CLAUDE.md
> claims against what is mounted, gated, and wired today.
>
> **Framing question:** can a real tradie sign up at webnua.com, pay,
> connect their accounts, and reply to their first lead — entirely
> through the product, without an operator handholding every step?
>
> **Headline answer:** no. The platform today is built assuming an
> operator-driven concierge flow. The client-facing surfaces that
> would be needed for self-serve (a sign-up route, a Stripe Checkout
> CTA, real-OAuth integration cards, a workspace identity that reads
> the signed-in user) are **either missing or visually present but
> non-functional stubs.**

---

## 1. The full client journey — step-by-step walkthrough

The journey below assumes a fresh-off-the-street tradie. Each step
documents the surface, the expected interaction, the success path,
and the failure path that actually exists in the code today.

### Step 0 — Discover Webnua (webnua.com)
- **Surface needed.** A public marketing landing page with a "Get
  started" CTA.
- **In code today.** There is no marketing page. `src/app/page.tsx`
  is a `'use client'` redirect: `role` resolves → `ROLE_LANDING[role]`;
  no session → `router.replace('/login')`. There is no `/` content,
  no pricing page, no "how it works", no contact form.
- **Failure mode.** A stranger landing on webnua.com is dropped
  straight onto the sign-in screen with no context.
- **Reference:** `src/app/page.tsx:8-24`.

### Step 1 — Sign up
- **Surface needed.** A `/sign-up` route that captures business name +
  email + password + (probably) trade/service area, creates a
  Supabase Auth user, creates a `clients` row, and lands them.
- **In code today.** **No sign-up route exists.** `src/app/(auth)/`
  contains only `login/`. Search for "signup", "register", "sign-up"
  across `src/app` and `src/components` returns zero relevant
  matches (only Twilio/Resend `sender registration`).
- **A `signup_submissions` table exists in DB types** (`src/lib/types/database.ts:2801-2877`)
  — a real schema with `business_name`, `trade`, `service_area`,
  `monthly_price`, `setup_fee`, `contact_email/name/phone`, etc. **It
  has NO migration file** (RLS test suite §4 flags this) and **is
  referenced nowhere in `src/lib` or `src/app`.** The intended
  marketing-landing signup-capture surface clearly existed in spec
  and was never built (or was built and deleted).
- **Client creation is operator-only.** `src/lib/clients/create-client.ts`
  runs `supabase.auth.getUser()`, fails if no user, then inserts a
  `clients` row with `onboarded_by: user.id` (an operator user). The
  `clients` table RLS requires `role = 'admin'` to insert. There is
  no path for a client-role user to create their own client.
- **Failure mode.** A stranger cannot sign up. Period. They must be
  manually created by a Webnua operator using `CreateClientModal`
  somewhere off-channel (presumably after an email or sales call).
  Login credentials would then be emailed to them out of band.
- **Reference:** `src/app/(auth)/login/page.tsx`, `src/lib/clients/create-client.ts:46-98`,
  `src/lib/types/database.ts:2801`.

### Step 2 — Sign in
- **Surface.** `/login` — real Supabase Auth (`signInWithPassword`).
- **What works.** The email + password form authenticates against
  Supabase. On success, the route pushes `/dashboard`; `UserProvider`'s
  `onAuthStateChange` listener picks up the session and resolves
  the user profile.
- **What's broken.** The "Forgot password?" `Button` is a `type="button"`
  with **no `onClick` handler**. Clicking does literally nothing.
  There is no `/forgot-password` route, no `resetPassword` call,
  nothing. A user who has forgotten their password is locked out
  permanently until an operator manually resets via the Supabase
  admin console.
- **Reference:** `src/app/(auth)/login/page.tsx:87-95`.

### Step 3 — First landing post-sign-in
- **Expected.** The dashboard for their workspace, or an onboarding
  wizard if they're brand new.
- **In code today.** `/dashboard` dispatches:
  - `activeClient?.status === 'setup'` → `<IntegrationOnboarding>`
  - else → `<ClientHubContent>` / `<ClientDashboardContent>`
- A freshly-created client carries `lifecycle_status = 'onboarding'`
  (`supabase/migrations/0002_identity_policy_tables.sql:32`), which
  `rowToAdminClient` maps to `status: 'setup'`. So a brand-new client
  hits the integration onboarding flow. **This is the only piece of
  client-facing onboarding chrome that exists.**
- **What works on the dashboard side.** `ClientDashboardContent`
  handles empty state cleanly — zero leads renders "no new leads yet
  this week"; the hero count is real; the activity feed populates
  from actual lead events.
- **What's badly broken on the sidebar side.** `ClientSidebar.tsx`
  uses **HARDCODED** identity:
  - `clientWorkspace = { initial: 'V', name: 'Voltline', status: 'Live · day 14' }`
  - `clientUser = { initial: 'M', name: 'Mark Cassidy', role: 'Voltline · Owner' }`
  - Nav badges `{ text: '5' }`, `{ text: '2' }`, `{ text: '+2' }`
    are hardcoded strings, not live counts.
- A real client signing in **sees the words "Voltline" and "Mark Cassidy"
  in their own sidebar**, with permanent fake "5 leads, 2 tickets" badges.
- The `ClientSupportCard`'s "☏ Message us" CTA points to `/support`,
  which **does not exist** (404). The footer comment in CLAUDE.md
  calls support a "global/static" tab but it has no route.
- **Reference:** `src/app/dashboard/page.tsx`, `src/components/client/ClientSidebar.tsx`,
  `src/lib/nav/client-nav.ts:7-46`, `src/lib/clients/clients-store.ts:43-60`.

### Step 4 — Onboarding integrations
- **Surface.** `IntegrationOnboarding` — the only post-sign-in
  onboarding screen. Lists 5 integrations as `IntegrationCard`s:
  Google Business Profile, Meta, Google Analytics 4, Google Ads, Stripe.
- **Critical failure.** Every "Connect" button on this screen opens
  the **stub** `ConnectIntegrationModal` — explicitly documented as
  "STUB: no real OAuth — the footer actions just close the modal"
  (`src/components/shared/settings/ConnectIntegrationModal.tsx:9`).
  The cards have `action: { label: 'Connect', kind: 'connect' }`;
  setting `kind` opens this stub modal, NOT the real OAuth flow.
- **Real OAuth flows EXIST** for GBP (`/api/integrations/[provider]/connect`
  with `requireClientAccess` — clients CAN call it) and Meta
  (same auth), but they are mounted in `IntegrationConnectionsSection`
  which is **operator-sub-account only** (`_sub-account-content.tsx`).
- **Real Stripe Checkout flow EXISTS** at `/api/integrations/stripe/checkout`
  but is gated by `requireOperatorForClient` — **a client cannot
  start their own subscription.**
- **A client clicking any Connect button on their own onboarding
  page sees a fake 4-step "Authorize Webnua / Select account /
  Review permissions / Confirm + sync" modal that closes without
  doing anything.** The integration stays `missing`.
- The page footer message tells the client: *"Once your accounts are
  connected, your operator activates your workspace."* But the
  operator has to drill into sub-account mode (`/settings/integrations`,
  `/campaigns`, `/reviews`) to do the real connect — the client's
  clicks on this screen produce no audit trail and no DB write.
- **Reference:** `src/components/shared/onboarding/IntegrationOnboarding.tsx:33-74`,
  `src/components/shared/settings/ConnectIntegrationModal.tsx:1-90`,
  `src/components/shared/settings/IntegrationConnectionsSection.tsx`,
  `src/app/settings/integrations/_sub-account-content.tsx`,
  `src/app/api/integrations/stripe/checkout/route.ts`.

### Step 5 — Waiting for activation
- **Surface.** Same onboarding screen, indefinitely, until an
  operator clicks "Mark client active →" in `OperatorActivatePanel`
  (visible only when `isOperator=true`).
- **What works.** `activateClient(slug)` calls `UPDATE clients SET
  lifecycle_status = 'live'` and re-hydrates the cache; the dashboard
  re-renders out of onboarding into the hub.
- **Minor bug.** `clients-store.ts` `lifecyclePhrase` switch only
  knows `onboarding/active/paused/churned` — a client with
  `'live'` shows the raw word `"live"` in the admin client meta line
  (a cosmetic drift; should map to `'active'`).
- **Reference:** `src/components/shared/onboarding/IntegrationOnboarding.tsx:128-171`,
  `src/lib/clients/clients-store.ts:43-50`.

### Step 6 — Connect Google Business Profile (the one real client-self-serve integration)
- **Surface.** `/reviews` → `GbpConnectPanel` (the "Connect Google
  Business →" empty-state CTA when no location is wired).
- **What works.** This IS wired end-to-end. The connect flow calls
  `connectIntegration` → `/api/integrations/google_business_profile/connect`
  (auth: `requireClientAccess`) → returns `{ authorizationUrl }` →
  browser nav to Google → callback handles `state` verification → token
  storage in Vault → row in `integration_connections`. Post-OAuth,
  the user is redirected and `GbpLocationPickerModal` auto-opens.
- **This is the only working client-facing OAuth flow in the
  product today.**
- **Reference:** `src/components/shared/gbp/GbpConnectPanel.tsx`,
  `src/app/reviews/_client-content.tsx:55`, `src/app/api/integrations/[provider]/connect/route.ts`.

### Step 7 — Connect Meta Ads
- **Expected.** A client-facing entry point similar to GBP's, ideally
  on `/campaigns` for them.
- **In code today.** `MetaConnectPanel` exists (`src/components/shared/meta/MetaConnectPanel.tsx`)
  and is **only mounted on the operator sub-account `/campaigns`**.
  The client's own `/campaigns` (`_client-content.tsx`) renders
  `CampaignManagedBand` + `CampaignHeroCard` + a static "Awaiting
  Meta Ads" placeholder card if no trend data, with no Connect CTA.
- The OAuth route at `/api/integrations/meta_ads/...` does accept
  `requireClientAccess`, so technically the client COULD connect
  if there were a button — there isn't.
- **Failure mode.** A client cannot self-serve their Meta connection.
  An operator has to do it from `/campaigns` sub-account.
- **Reference:** `src/app/campaigns/_client-content.tsx`, `src/app/campaigns/_sub-account-content.tsx:74`.

### Step 8 — Set up billing / subscribe to Stripe
- **Expected.** A client-facing "Subscribe to Webnua" or "Set up
  billing" CTA that opens Stripe Checkout.
- **In code today.** Client `/settings/billing` (`_client-content.tsx`)
  is **pure stub** — hardcoded Voltline copy:
  - `clientBillingPlan` static plan card
  - `clientBillingMethod` fake card method
  - `clientBillingInvoices` six fake invoices
  - "Talk to Craig" CTA — inert
  - "Update" link on payment method — a plain `<span>` with no click handler
- The real `StripeSubscriptionSection` (the one that calls
  `/api/integrations/stripe/checkout` and `/portal`) is mounted ONLY
  on the operator sub-account `/settings/billing` (`_sub-account-content.tsx:47`).
- **Failure mode.** A client cannot subscribe themselves. Cannot
  open the Stripe portal. Cannot update their card. Cannot see real
  invoices. All they see is fictional Voltline data.
- **Reference:** `src/app/settings/billing/_client-content.tsx`,
  `src/app/settings/billing/_sub-account-content.tsx:20-47`,
  `src/app/api/integrations/stripe/checkout/route.ts` (operator-only).

### Step 9 — Connect custom domain
- **Surface.** `/settings/domains` IS in the client settings nav
  (`client-settings-nav.ts:5`). The `ClientDomainsContent` mounts
  `CustomDomainSection`, which is wired to the real Phase 9 attach
  flow (`useAttachDomain`, polling status, DNS records, etc.). The
  API routes accept `requireClientAccess` shape.
- **What works.** A client can add a domain, see DNS records, watch
  status, set primary, remove.
- **Minor issue.** `ConnectDomainButton` (`src/components/shared/website/ConnectDomainButton.tsx`)
  exists but **is not mounted anywhere** (orphan code from a previous
  iteration — superseded by `CustomDomainSection`). Dead code, not a
  user-facing bug.
- **Reference:** `src/app/settings/domains/page.tsx`, `src/app/settings/domains/_client-content.tsx`,
  `src/components/shared/settings/CustomDomainSection.tsx`,
  `src/components/shared/website/ConnectDomainButton.tsx` (orphan).

### Step 10 — See generated website + funnel
- **Surface.** `/website` (their site hub) + `/funnels` (their funnels).
- **What works.** Both surfaces read real data (`useWebsitesForClient`,
  `useFunnelsForClient`). Page grid renders, edit links work, the
  section editor is fully wired (autosave, publish lanes, preflight,
  approval).
- **Concern.** A newly-created client has a website + funnel only if
  the operator chose to generate them during `CreateClientModal`.
  If the operator skipped generation (or it failed and they fixed
  client data manually), the client lands on `/website` and sees the
  empty state — possibly confusing without context.
- **The full generation pipeline is wired** (real Claude via
  `/api/generate-site` and `/api/generate-funnel`) but is OPERATOR-TRIGGERED
  from the modal. The client cannot regenerate.
- **Reference:** `src/app/website/page.tsx`, `src/app/funnels/page.tsx`.

### Step 11 — First customer fills a form on the live site
- **Surface.** `/published/[host]/[[...slug]]` — the public renderer
  routed via middleware. Forms POST to `/api/forms/submit`.
- **What works.** The full pipeline is real: form submit creates a
  `customers` row + `leads` row + `lead_events`, triggers fan a
  notification + the operator-notification email (Resend) + the
  lead-acknowledgment SMS (Twilio, if a phone was captured) + the
  customer-facing follow-up email. Funnel step-1→step-2 threading
  via `?lead=` URL parameter works. The DB triggers (migrations
  `0032`, `0063`) fire notifications into `RealtimeProvider` so the
  client's inbox lights up live.
- **Caveat.** None of this fires unless real OAuth credentials are
  configured (the integrations gracefully `skip` with `console.warn`
  when keys are unset). If Stripe + Resend + Twilio are configured
  agency-wide but the client never connected their own Meta/GBP,
  basic SMS/email still fires; just no Meta-leads ingest, no review
  pull.
- **Reference:** `src/app/api/forms/submit/route.ts`, `src/app/published/[host]/[[...slug]]/page.tsx`,
  `src/lib/realtime/RealtimeProvider.tsx`.

### Step 12 — See lead in inbox + reply
- **Surface.** `/leads` (inbox) → `/leads/[id]` (detail) →
  `/leads/[id]/conversation` (reply composer).
- **What works.** Lead inbox is fully wired (`useClientLeadsInbox`),
  rows render with real data, status switcher persists, lead
  timeline shows real events, the email reply composer
  (`LeadConversationComposer` email channel) POSTs to
  `/api/leads/[id]/reply`, threads via `In-Reply-To`, writes
  `email_messages`. `RealtimeProvider` invalidates the inbox query
  when a new lead lands so the badge count updates without a
  refresh.
- **What's broken / not wired.**
  - SMS channel of the reply composer is **NOT wired** — the
    handler surfaces an honest "Sending SMS from the inbox is not
    wired yet" message (`LeadConversationComposer.tsx:86-90`).
  - The lead-inbox Search `<Input>` and Filters `<Button>` are
    **inert** (no `onChange`, no `onClick`). Decorative only.
  - The lead detail's Quick Actions sometimes render `href` links
    (Call number) but the Reschedule / Send review request actions
    only wire on operator-side per `GbpSendRequestButton`'s mounting
    pattern.
- **Reference:** `src/app/leads/_client-content.tsx:73-83`,
  `src/components/shared/leads/LeadConversationComposer.tsx:67-90`,
  `src/app/api/leads/[id]/reply/route.ts`.

---

## 2. What works today — by step

| Step | Surface | Status |
|------|---------|--------|
| 0 | webnua.com landing | **MISSING** (root redirects to /login) |
| 1 | /sign-up | **MISSING ENTIRELY** |
| 2 | /login | works (Supabase Auth) |
| 2b | Forgot password | **MISSING** |
| 3 | /dashboard for new client | works (dispatches to onboarding screen) |
| 3b | Sidebar identity | **HARDCODED Voltline / Mark Cassidy** for every client |
| 3c | Sidebar nav badges | **HARDCODED stub counts** |
| 3d | "Message us" sidebar CTA | **404 (/support doesn't exist)** |
| 4 | Onboarding integration cards | **STUB modals — no real OAuth from this surface** |
| 5 | Operator activation | works |
| 6 | Connect GBP (client self-serve via /reviews) | works |
| 7 | Connect Meta (client self-serve) | **MISSING** (operator-only) |
| 8 | Subscribe to Stripe (client self-serve) | **MISSING** (operator-only); /settings/billing is pure stub |
| 9 | Connect custom domain | works |
| 10 | View generated website/funnel | works (read + edit) |
| 11 | First customer submits form | works (end-to-end live) |
| 12 | View lead + email reply | works |
| 12b | SMS reply from inbox | **NOT WIRED** (honest stub message) |
| 12c | Lead inbox search/filter | **INERT** (no handlers) |

---

## 3. What's broken or missing — exhaustive

### Sign-up / auth
- **No `/sign-up` route** (Critical). No way for a stranger to become
  a client. `signup_submissions` table exists in DB types but no
  migration captures it and no UI writes to it.
- **No `/forgot-password` flow** (Major). Button on `/login` is a
  type=button with no onClick.
- **No marketing landing page at `/`** (Critical for self-serve).
  Root redirects unauthenticated users straight to `/login`.

### Client sidebar / identity
- **Hardcoded workspace name "Voltline"** in `ClientSidebar` (Critical).
  Every client sees "Voltline / Live · day 14" regardless of their
  real business.
- **Hardcoded user name "Mark Cassidy"** in `SidebarUser` (Critical).
- **Hardcoded nav badge counts** ("5", "2", "+2") in `client-nav.ts`
  (Major). Not driven by real unread counts.
- **`/support` route 404** — `ClientSupportCard`'s CTA dead-ends (Minor).

### Integration onboarding (post-sign-in, lifecycle=onboarding)
- **All 5 onboarding integration cards are STUBS** (Critical). GBP /
  Meta / GA4 / GAds / Stripe Connect buttons open the placeholder
  `ConnectIntegrationModal` and write nothing to the DB.
- The real Phase 7 OAuth/Stripe flows EXIST and are wired in their
  respective sub-account surfaces, but the onboarding screen does
  not use them.
- **The activation gate** (operator clicks "Mark client active") is
  the ONLY way out of onboarding — the client's clicks on this
  screen have zero effect.

### Settings / Integrations
- **Client `/settings/integrations` is pure stub** (Critical). Uses
  `clientIntegrations` static data keyed to Voltline copy and the
  stub `IntegrationCard`. No path to the real OAuth flows from a
  client's settings.

### Settings / Billing
- **Client `/settings/billing` is pure stub** (Critical). Hardcoded
  Voltline plan, fake card, fake invoices, inert "Update" + "Talk to
  Craig" CTAs. No `StripeSubscriptionSection` mounted. A client
  cannot subscribe, manage card, see real invoices, or cancel.

### Settings / Profile, Notifications, Security, Help, Team
- (Not deeply audited this session — flag for follow-up.) Most
  follow the same pattern: stub copy keyed to Voltline. The Team
  invite flow is the one client-side surface fully built out for
  this category (Phase 6 · Cluster 6).

### Campaigns
- **Meta connect inaccessible from client `/campaigns`** (Major).
  `MetaConnectPanel` exists but is operator-only. Client sees
  "Awaiting Meta Ads" placeholder with no CTA to fix it.

### Reviews
- Works end-to-end for the client (GBP connect, review list, inline
  reply on `/reviews`). This is the gold-standard client surface.

### Leads
- Inbox + detail + email reply work. SMS reply is not wired (honest
  stub). Search/filter UI inert.

### Website / Funnels
- All client-facing read + edit works. The "generate a new page"
  flow at `/website/new` works (real Claude). Funnel generation only
  triggered by operator from `CreateClientModal`.

---

## 4. Critical path issues vs nice-to-have

### CRITICAL — blocks the "self-serve tradie" promise entirely
1. No sign-up route (`/sign-up`) and no marketing site at `/`.
2. No password-reset flow.
3. Onboarding integration cards are non-functional stubs.
4. Client `/settings/billing` is pure stub; no path to Stripe Checkout.
5. Client sidebar shows "Voltline / Mark Cassidy" for every client.
6. Client cannot self-serve a Meta Ads connection.

### MAJOR — degrades the experience but doesn't block onboarding
7. Client `/settings/integrations` is pure stub (real flows live on
   the operator side; client has no path).
8. Client nav badges are hardcoded stub counts.
9. SMS reply from the lead inbox is not wired.
10. Lead inbox Search + Filters are inert.

### MINOR — cosmetic / drift / orphan code
11. `/support` route 404 from sidebar CTA.
12. `lifecyclePhrase` switch missing `'live'` mapping.
13. `ConnectDomainButton` is orphan code (superseded by
    `CustomDomainSection`).
14. "Forgot password?" button is `type=button` with no handler.

---

## 5. The first-customer experience risk

Where a real tradie would give up, get confused, or trash-talk Webnua:

- **Discovery → "where do I sign up?"** They cannot. There is no
  sign-up. The conversation must happen off-platform (Webnua reaches
  out, or vice versa) and an operator must manually create their row.
  This is fine for hand-crafted concierge sales but is **not**
  consistent with the marketing framing of the prototype landing
  page (`reference/webnua-platform-prototype.html` carries a
  signup-style flow that has no in-product home).
- **First login → "this isn't my business name."** The sidebar
  reads "Voltline / Mark Cassidy" for everyone. **This is the most
  damaging confidence-breaking moment in the entire product.** A
  paying tradie sees someone else's business name in their own
  workspace; they will assume the product is broken and either
  request a refund or churn silently. **This is the single highest-
  leverage fix in the audit.**
- **Onboarding screen → "I clicked Connect and nothing happened."**
  Five Connect buttons that open fake 4-step modals and close. The
  client has no idea their click had zero effect — and they're
  blocked behind operator activation that the screen tells them is
  coming.
- **Settings/Billing → "where do I update my card?"** They cannot.
  The "Update" affordance is plain styled text with no handler. The
  invoices are someone else's.
- **First lead → SMS the customer back.** They tap SMS in the
  composer and hit "Sending SMS from the inbox is not wired yet." A
  capable workaround (call from their phone, or use the SMS that
  fires from `job_completed`) exists, but the in-product moment is a
  dead-end.

---

## 6. The operator concierge gap — what requires manual intervention today

Each step below is something an operator must do manually for every new client:

1. **Receive the prospect's interest** (email, phone, referral) and
   capture their business details. The `signup_submissions` table
   exists in the schema but has no UI to capture into it — entirely
   off-platform today.
2. **Create the auth user** via Supabase admin console (no in-product
   user-create UI; capability grants flow is built but assumes user
   exists).
3. **Run `CreateClientModal`** to insert the `clients` + `brands` +
   `websites` + `funnels` rows + run AI generation. The modal is
   operator-only (admin role required).
4. **Email the client their login credentials.**
5. **Wait for the client to sign in.** They land on the onboarding
   screen and stare at fake Connect buttons.
6. **Drill into the client's sub-account** (sidebar picker) and run
   the REAL OAuth flows from `/settings/integrations`:
   - Connect GBP (or guide the client to do it on `/reviews`)
   - Connect Meta (operator must do this — client has no surface)
7. **Provision SMS sender** via `/settings/sms` sub-account mode.
8. **Provision email sender slug** via `/settings/email` sub-account mode.
9. **Configure notification recipients** on `/settings/notifications`
   sub-account mode.
10. **Start the Stripe subscription** via the operator sub-account
    `/settings/billing` `StripeSubscriptionSection` — client cannot
    self-serve.
11. **Activate the client** ("Mark client active →" on their
    onboarding dashboard view).
12. **Build the first Meta campaign** in Meta Ads Manager (per
    Phase 7 Meta Ads V1 model — no in-app builder), do the manual
    €200 ad-credit transfer.
13. **Handhold the client through their first lead reply** via
    ticket conversation (since they can't SMS from the inbox).

**Steps 1, 2, 4, 5, 6 (Meta half), 10, 12, 13 are forced concierge
today** — none of them can be self-serve even in principle without
new UI being built.

---

## 7. Recommended fix order — top 5

> Ordered by leverage (impact ÷ effort). Each entry includes
> approximate complexity and any prerequisite.

### Fix 1 — Sidebar identity reads the live user (CRITICAL, small)
Replace the hardcoded `clientWorkspace` / `clientUser` constants in
`lib/nav/client-nav.ts` with values resolved from `useUser()` +
`useAdminClients().find(c => c.id === user.clientId)`. The hooks and
the data are already there — just the component is hardcoded.
- **Files touched:** `ClientSidebar.tsx`, `ClientWorkspaceCard.tsx`,
  `SidebarUser.tsx`, drop the static constants from `client-nav.ts`.
- **Effort:** small (~1 session).
- **Dependencies:** none. `useUser()` already returns the right data.

### Fix 2 — Wire the onboarding-screen Connect buttons to the real OAuth flows (CRITICAL, medium)
Replace `IntegrationOnboarding`'s `IntegrationCard` action of
`kind: 'connect'` (which opens the stub modal) with the same
`connectIntegration()` helper that `IntegrationConnectionsSection`
already uses. GBP + Meta already accept `requireClientAccess`, so
the routes work for client-role callers.
- **Files touched:** `IntegrationOnboarding.tsx`, possibly extract a
  small `<ClientConnectButton provider={...}>` component to share.
- **Effort:** medium (~1-2 sessions, including post-callback location/account-picker
  modal mounting on the onboarding screen).
- **Dependencies:** Phase 7 OAuth is built; this is plumbing.

### Fix 3 — Build the client-self-serve billing surface (CRITICAL, medium)
Replace the stub `/settings/billing` `_client-content.tsx` with the
real `StripeSubscriptionSection`. The Stripe routes
(`/checkout`, `/portal`) currently gate on `requireOperatorForClient`
— widen to `requireClientAccess` so the customer can start their
own subscription and manage their own card.
- **Files touched:** `_client-content.tsx`, the two Stripe routes
  (auth widening), `StripeSubscriptionSection` (already generic).
- **Effort:** medium (~1-2 sessions). Some care needed: subscribing
  yourself probably warrants a different flow (e.g., a "first plan"
  picker if multiple tiers exist), but for V1 the single €299/mo
  plan needs only the Checkout entry point.
- **Dependencies:** decision on whether clients self-subscribe or
  remain operator-billed (see Section 8).

### Fix 4 — Build a `/sign-up` route (CRITICAL, medium)
Build a minimal `/sign-up` page that captures business name + email
+ password + trade + service area, creates the auth user via
`supabase.auth.signUp`, and (server-side) creates a `clients` row
with `lifecycle_status='onboarding'` plus the user row. Land on
`/dashboard` → onboarding screen.
- **Files touched:** `src/app/(auth)/sign-up/page.tsx`, a new
  server route `/api/sign-up` that runs with service-role to insert
  the `clients` + `users` rows (RLS won't let client-role insert a
  client row themselves), plus an `instrumentation` decision about
  whether the public surface needs a captcha / rate limit.
- **Effort:** medium (~2 sessions). The data layer is done; the new
  surface is small. The decisions around what to capture and
  whether to gate behind Stripe Checkout first are the time sink.
- **Dependencies:** decide whether sign-up triggers Stripe Checkout
  immediately or after onboarding (Section 8).

### Fix 5 — Forgot password flow (MAJOR, small)
Replace the inert `Button` with a real `<Link href="/forgot-password">`.
Build `/forgot-password` (email-only form) + `/reset-password`
(token-bound new-password form), both using `supabase.auth.resetPasswordForEmail`
and `supabase.auth.updateUser`. Standard Supabase pattern.
- **Files touched:** new pages, update `login/page.tsx`.
- **Effort:** small (~0.5-1 session).
- **Dependencies:** none.

### Honourable mentions (next 5 if there's appetite)
6. Wire the client sidebar nav badges to real unread counts.
7. Mount `MetaConnectPanel` on client `/campaigns`.
8. Wire SMS reply from the lead inbox (or hide the SMS channel
   with an explicit "ask your operator for now" hint).
9. Wire the lead-inbox Search + Filters.
10. Create a `/support` route (or remove the inert CTA).

---

## 8. Open questions for the operator — decisions needed before fixing

These are not technical questions; they're product calls that change
which fixes are right.

### Q1. Is Webnua a self-serve product, an operator-driven product, or both?
The current code points strongly to **operator-driven concierge.** If
that is the intended go-to-market for V1, then most of the "Critical"
findings above are not bugs — they're correct. The fix becomes
**making the operator workflow first-class** (e.g., a `/clients/new`
flow that captures everything in one sitting, emails credentials,
launches the first Meta campaign) rather than building self-serve
surfaces.
- **If self-serve:** Fixes 1, 4, 2, 3, 5 are all needed.
- **If concierge:** Fix 1 (identity) is still critical; fixes 4 + 5
  unnecessary; fix 2 + 3 only needed if the operator can hand the
  client off mid-flow.
- **If both:** fix 1 + 2 + 3 critical; 4 + 5 needed for the
  self-serve tier.

### Q2. Does a client subscribe-before-getting-a-workspace, or after?
Two natural flows:
- **(a) Subscribe first.** Sign-up form → Stripe Checkout → on
  payment success, the webhook creates the client row + emails
  login. Onboarding screen is "connect your accounts to finish setup."
- **(b) Free-trial-or-tour first.** Sign-up → workspace created
  immediately → onboarding screen → "start your subscription" CTA
  → Stripe Checkout. Subscription gates publishing or campaign launch.
This decision changes whether `/sign-up` ends at Checkout or at
`/dashboard`.

### Q3. Should clients self-serve Meta connection, or is this a hard
operator step?
Meta App Review / business verification + the customer-agreement
audit flow could plausibly remain operator-driven. If yes, then
client `/campaigns` should carry an inert "ask your operator to
connect Meta" affordance rather than nothing — currently the empty
state is silent.

### Q4. Is `signup_submissions` still on the roadmap?
The table exists in the generated `Database` types but has no
migration, no RLS, and no UI. Was this a sunset feature (intentional
removal) or unfinished work (the marketing landing's signup form was
never built)? If it's unfinished, Fix 4 should write to this table
(operator triages later) instead of creating the client row directly.

### Q5. Are the integration-onboarding stub modals worth keeping at all?
`ConnectIntegrationModal` is described as "STUB: no real OAuth" — it
showcases the visual flow without doing anything. Today it's the
only integration affordance a freshly-onboarded client sees. Either
swap it for the real flows (Fix 2) or replace it with a static "Your
operator will connect these for you" message. The current "looks
real, does nothing" state is the worst of both options — clients
think they've connected things they haven't.

### Q6. Sidebar identity — does a client see the operator's branding ("Managed by Webnua") or their own?
The `ClientSupportCard` ("Managed by Webnua") is the right answer for
the current concierge model. The hardcoded `clientWorkspace` /
`clientUser` are clearly drift from the prototype. But: should the
workspace card show "Voltline · Live · day 14" computed dynamically
(name from `clients`, "day N" computed from `clients.created_at`),
or simpler ("Voltline · Active")? Small product call needed before
Fix 1 lands.

---
