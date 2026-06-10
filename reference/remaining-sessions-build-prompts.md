# Remaining sessions — Business-in-a-Box completion prompts

> Written June 2026, immediately after the approval-first session (commits
> `9ab8cf8`…`155fac6` — suggested_actions spine, conversation intelligence,
> ads autopilot, social calendar, SEO/compliance, mobile polish; migrations
> 0119–0122 applied to production). Each section below is a **ready-to-paste
> session prompt**. Run them roughly in order — Sessions 1–3 are the highest
> business value; 5–6 are credential-gated and can start whenever the
> operator accounts are ready.
>
> **Every session inherits these standing rules (don't restate them in the
> prompt — they live in CLAUDE.md, but verify the session honours them):**
>
> 1. **Approval-first.** Anything AI-drafted and customer-facing lands as a
>    `suggested_actions` row (see `lib/actions/server.ts`
>    `createSuggestedAction` + the CLAUDE.md "Approval-first action spine"
>    section) or an explicit draft status the owner approves. Never invent a
>    parallel "pending things" surface; extend the spine's kind union +
>    the approve route's dispatch switch instead.
> 2. **Anti-fabrication.** AI never invents reviews, prices, availability,
>    credentials, certifications, or statistics. Same banned-corporate-speak
>    discipline as `/api/generate-offer`.
> 3. **Jobs spine.** Async work = `registerJobHandler` + one side-effect
>    import in `lib/integrations/job-handler-manifest.ts` + (if scheduled) a
>    `pg_cron` block following migration 0075/0120/0122's
>    insert-into-integration_jobs pattern.
> 4. **RLS + tests.** Every new table: RLS day one (`accessible_client_ids()`
>    for tenant scope; `revoke … from authenticated` for service-role-only
>    writes) AND a suite in `tests/rls/` in the same PR (fixtures in
>    `seedPhase7Tenant`, table added to `TEARDOWN_ORDER` — see
>    `suites/approval-actions.mjs` for the current pattern).
> 5. **Migration numbering.** Check `ls supabase/migrations | tail` — next
>    free number at time of writing is **0123**. Apply to the production
>    project via the Supabase MCP (`ynfnjskylwlbmgyeeiot`) AND commit the
>    file. Postgres enum additions must commit before anything references
>    them (the 0090/0091 precedent).
> 6. **Auth at routes.** `requireClientAccess` (customer-or-operator) vs
>    `requireOperatorForClient` (operator governance) — pick deliberately and
>    say why in the route header comment.
> 7. **Customer-facing sends** go through the `send_email` / `send_sms` job
>    handlers (they carry the unsubscribe gate + footer). Never bypass them
>    for automated customer messaging.
> 8. **Mobile-first.** New surfaces stack at <md; no fixed-pixel grids
>    without responsive prefixes. Webnua palette tokens, not shadcn role
>    tokens (the bright line).
> 9. **Finish the session** with: typecheck + `next build`, CLAUDE.md
>    inventory + migration-log update, commit per working state, push.

---

## Session 1 — Quotes (Module 5a: quote builder + hosted accept page)

```
Build the QUOTES half of Module 5 for the Webnua platform. Read CLAUDE.md
first (the approval-first spine section + the standing rules in
reference/remaining-sessions-build-prompts.md).

MISSION
An owner (or the conversation AI, later) creates a branded quote with line
items, sends it to the customer via email/SMS, the customer accepts on a
hosted page, and acceptance auto-creates a booking. Pipeline visibility:
Lead → Quoted → Accepted → Scheduled.

DELIVERABLES
1. Migration (check next number): `quotes` (id, client_id, lead_id nullable
   FK, customer_id FK, reference 'QTE-NNNN' like tickets' TKT allocation,
   status enum draft|sent|viewed|accepted|declined|expired, title, notes,
   currency, expires_at, accepted_at, accepted_name, sent_at, token —
   HMAC-style opaque accept token, unique) + `quote_items` (quote_id FK,
   position, description, qty numeric, unit_price_cents, line_total_cents).
   RLS: tenant full-CRUD for quotes + items (owners build their own quotes —
   same shape as social_posts); status flips to accepted/viewed come from
   the public accept route via service-role. RLS tests mandatory.
2. lib/quotes/: types.ts, queries.tsx (useQuotesForLead, useClientQuotes,
   useCreateQuote, useUpdateQuote, useSendQuote), server.ts (token mint —
   reuse the lib/email/unsubscribe.ts HMAC pattern OR an opaque DB token
   like lib/invites/token.ts; DB-token is simpler since the row exists).
3. Quote builder UI: /quotes (shared route, canonical layout pattern —
   copy /social) listing quotes with status pills; /quotes/new + /quotes/[id]
   editor — line items (description/qty/price, running total), customer
   picker (reuse shared/bookings/CustomerPicker), link-to-lead when arrived
   from a lead. Mobile-first. Also mount a "Quotes" rail card on the lead
   detail showing that lead's quotes + a "+ New quote" deep link.
4. Send path: "Send quote" → send_email job with a NEW customer-facing
   template key `quote_delivery` (add to the email template seeds — keep
   DEFAULT_EMAIL_TEMPLATES + the seed migration in lockstep per CLAUDE.md)
   containing the hosted link. SMS variant optional V1. Mark status sent.
   The unsubscribe gate must NOT block quote delivery — a quote the
   customer asked for is transactional; send it via the direct sendEmail
   wrapper (the lib/integrations/resend/client.ts path the reply route
   uses), not the gated automation handler. Say this in a comment.
5. Hosted accept page: app/(public or top-level) /q/[token]/page.tsx on the
   APP host (no tenant-host routing needed — the middleware passes the app
   host through). Server component: resolve token via service-role, render
   the branded quote (client name, brand accent, items, total, expiry),
   Accept + Decline buttons POSTing /api/quotes/[token]/respond (public,
   token IS the auth — unsubscribe-route precedent). First GET stamps
   viewed. Accept stamps accepted + accepted_name (a typed-name
   "e-signature" field, required) and — when the quote has a lead —
   advances the lead to 'booked'? NO: do not mutate lead status enums;
   instead write a lead_events row (kind 'status' payload note) and create
   a suggested_actions card "Quote QTE-0012 accepted — schedule the job"
   (kind generic, payload { leadId, quoteId }) so scheduling stays an
   explicit owner action via the existing NewBookingModal.
6. Quote follow-up automation: extend the automation library is OUT OF
   SCOPE this session (trigger types are a closed seeded set) — instead add
   a `quote_followup_scan` daily job (cron) that finds sent-not-accepted
   quotes >72h old and drafts a followup suggested_action with an email
   draft body (reuse the existing quote_followup template copy). Approving
   sends via the reply route when a lead exists, else direct sendEmail.

CONSTRAINTS
- No PDF generation V1 — the hosted page IS the artifact (print stylesheet
  is enough). Note PDF as the V1.1 follow-up in CLAUDE.md.
- No payments on quotes — deposits arrive with Session 2 (invoices).
- Reference allocation: copy the tickets TKT-NNNN unique-retry pattern.
VERIFY: build + RLS tests; walk the flow with a seeded quote end to end
(create → send (skipped-no-key is fine) → GET accept page → accept →
suggested_action appears).
```

---

## Session 2 — Invoices + Stripe Connect (Module 5b: get-paid)

```
Build the INVOICES half of Module 5. Read CLAUDE.md (Stripe billing section
— the platform subscription uses the PLATFORM Stripe account; client
invoicing needs Stripe CONNECT so money lands in the CUSTOMER's account)
and reference/remaining-sessions-build-prompts.md.

OPERATOR PREREQS (document in CLAUDE.md as an "operator setup" block):
Stripe Connect must be enabled on the platform account (Express accounts).
No code works until then; everything must degrade honestly.

DELIVERABLES
1. Migration: `client_stripe_connect` (client_id unique, stripe_account_id,
   onboarding_status enum pending|complete|restricted, details jsonb) +
   `invoices` (client_id, quote_id nullable FK, booking_id nullable FK,
   customer_id, reference INV-NNNN, status enum draft|sent|paid|overdue|
   void, currency, amount_cents, deposit_for_quote bool, due_at, paid_at,
   stripe_payment_link_id, stripe_checkout_session_id, token for the
   hosted view) + items table OR reuse a jsonb lines column (decide: jsonb
   lines is fine — invoices are generated FROM quotes/bookings, rarely
   hand-edited; say so in the migration comment). RLS: tenant full-CRUD,
   payment-state flips service-role. RLS tests.
2. lib/integrations/stripe/connect.ts — SERVER-ONLY, every call through
   callExternal() like client.ts: createConnectAccount (Express),
   createAccountLink (onboarding URL), getAccount (status poll),
   createConnectCheckoutSession / createPaymentLink with
   `Stripe-Account: {acct}` header (direct charges) + optional
   application_fee_amount (leave 0 for V1, note the platform-fee parked
   decision). Webhook: extend the EXISTING stripe webhook route to also
   accept Connect events (checkout.session.completed with the connected
   account header → mark invoice paid) — Stripe Connect events arrive on a
   separate webhook endpoint configured for connected accounts; add
   /api/integrations/stripe/connect-webhook with its own signing secret
   env (STRIPE_CONNECT_WEBHOOK_SECRET, optional in env.ts).
3. Onboarding UI: a "Get paid by card" section on sub-account + client
   /settings/billing — Connect status + "Set up payouts →" (account link)
   via requireClientAccess routes. Degrades to an explainer card when
   Connect is unconfigured.
4. Invoice flow: "Convert to invoice" on an accepted quote + "Invoice this
   job" on a completed booking. Send = email with the hosted pay link
   (transactional — direct sendEmail, same reasoning as quotes).
   Hosted view /i/[token] mirroring /q/[token] with a Pay button →
   Stripe-hosted checkout on the connected account.
5. Payment reminders: daily `invoice_reminder_scan` job — unpaid invoices
   at day 3/7/14 draft a reminder suggested_action (approve = send). Paid
   invoice → if the invoice's booking is completed, enqueue the EXISTING
   gbp_send_review_request job (closes the prompt's "paid → review
   request" chain).
6. Pipeline view: extend the lead detail rail + /quotes list with the full
   Lead → Quoted → Accepted → Scheduled → Done → Paid → Reviewed strip —
   derived at read time from quote/booking/invoice/review-request rows
   (never a stored stage column; CLAUDE.md's derive-don't-store precedent).

CONSTRAINTS
- Webnua charges NO platform fee on customer payments in V1 (park it).
- Refunds/partial payments are V1.1 — full-amount checkout only; deposits
  are just an invoice for a partial amount flagged deposit_for_quote.
VERIFY: integration-tests/stripe.test.mjs still passes; add a gated
connect test that skips without keys.
```

---

## Session 3 — Onboarding "entire stack in one run" (drafted ads + social + goals)

```
Close the gap between the conversational onboarding's output (website +
funnel + automations) and the build vision ("the AI generates the ENTIRE
stack": + 30-day social calendar + drafted ad campaigns). Read CLAUDE.md
("Approval-first action spine", "Social media calendar", the conversational
onboarding + concierge parity sections).

DELIVERABLES
1. Social at onboarding: when generation completes (the wizard-assets
   commit path used by BOTH the conversation shell and the operator
   concierge — keep parity, see the concierge-parity audit), enqueue
   generate_social_calendar for the new client (best-effort). The /social
   empty state never shows for a fresh signup.
2. Drafted first campaign: after onboarding, create a suggested_actions
   card (kind generic) "Your first ad campaign is drafted — review and
   launch" deep-linking to /campaigns/launch. Do NOT auto-create Meta
   objects (no ad account is connected yet at signup); instead persist a
   DRAFT LaunchCampaignPayload built from the brand + industry template
   (templates.ts templateForIndustry + resolveTemplateCopy + the brand
   offer) onto a new `campaign_drafts` table (client_id, payload jsonb,
   consumed_at) and make /campaigns/launch hydrate its WizardState from an
   unconsumed draft when one exists. The operator/owner still walks the
   wizard — the AI just pre-filled every step.
3. Goals capture: add one conversation turn (and one wizard step field)
   capturing the primary goal (more leads / fill the calendar / raise
   prices / get reviews) into conversation_state.capturedFacts + a new
   clients.primary_goal text column (migration). Thread it into
   derive-brief.ts → the generation prompts' business context block, and
   into the social + ads draft prompts.
4. Onboarding integrations turn: the conversation shell's final turn
   offers GBP + Meta connect (reuse IntegrationConnectionsSection with
   returnTo, the Step6Integrations precedent) before the blueprint reveal.
5. Rolling social refresh: weekly cron — clients with < 4 future
   non-dismissed posts get a generate_social_calendar enqueue (keeps the
   calendar "always 30 days ahead" without manual taps). Respect a simple
   guard: skip clients who have never approved a post (don't pile drafts
   on someone ignoring the surface).

CONSTRAINTS
- Concierge parity: every behaviour added to the conversational path must
  fire on the operator concierge path too (or be explicitly documented as
  divergence in the parity section).
VERIFY: run a full conversational signup against dev; confirm posts +
campaign draft + goal all land.
```

---

## Session 4 — Local SEO autopilot (location pages + blog engine + report)

```
Build Module 6's content engine. Read CLAUDE.md (website data model,
generation pipeline, registry-meta server/client boundary, the sitemap
handlers from the June 2026 session).

DELIVERABLES
1. Location pages: a generator that produces one website Page per
   service-area town ("House Cleaning in Swords") — type 'generic', slug
   'service-in-town' style, built from the EXISTING page-generation
   pipeline (composePrompt with a location-intent GenerationContext;
   sections: hero/services/trust/faq/cta with town-localised copy + the
   form). Towns come from a new `clients.service_towns text[]` column
   (migration) captured at onboarding (split the freeform service_area)
   + editable on /settings/profile. Generated pages land on the DRAFT
   version (the owner publishes via the normal review surface — approval-
   first). Cap: 5 towns V1. Surface: a "✦ Generate area pages" card on
   /website listing towns with checkboxes.
2. Blog engine: migration `blog_posts` (client_id, slug, title, body_md,
   status draft|published, published_at, seo jsonb) + tenant RLS + tests.
   Public render: /published/[host]/blog + /blog/[slug] route handlers
   (server components reading via resolve.ts's client resolution; add
   blog URLs to the sitemap handler). Monthly cron drafts 2 posts per
   ACTIVE client (Sonnet, keyword angle from trade + towns; anti-
   fabrication) as status draft + a suggested_actions card ("2 blog posts
   drafted — review & publish"; approve = publish both). Simple reader
   styling from the brand (accent + fonts via the SectionShell token
   approach — keep it minimal, no section registry needed for V1 prose).
3. Internal linking: published location pages + blog posts get appended to
   the website footer nav? NO — keep chrome untouched; instead the blog
   index links location pages and vice versa via a small "Areas we serve"
   block rendered by the blog/location templates. Note full internal-link
   automation as V1.1.
4. Monthly plain-English SEO report: a monthly cron composing a Sonnet
   summary (what published, what's drafted next — NO ranking claims; we
   have no rank tracker, say "rank tracking arrives later" honestly) sent
   to the client's notification recipients via send_email with a new
   operator-facing template key.

CONSTRAINTS
- The model never claims rankings/statistics. The report only states what
  the platform actually did.
- generation_log writes where clientId exists (the established pattern).
VERIFY: generate location pages for a dev client; check sitemap includes
them + blog; build passes.
```

---

## Session 5 — Two-way SMS (long codes, STOP, SMS in the inbox + AI)

```
Upgrade SMS from one-way alphanumeric to two-way. Read CLAUDE.md (Twilio
SMS section + the unsubscribe/compliance section + conversation
intelligence).

OPERATOR PREREQS (document): Twilio long-code numbers require per-country
regulatory bundles (IE/UK) — the operator buys numbers via Console or we
provision via API where the bundle allows. Everything degrades to the
existing alphanumeric one-way path when no number is assigned.

DELIVERABLES
1. Migration: `client_sms_senders` gains sender_kind enum
   alphanumeric|long_code + phone_number_e164 nullable. A client with a
   long_code sender becomes two-way.
2. Number provisioning: operator-only route + UI on /settings/sms — search
   available numbers (Twilio AvailablePhoneNumbers via callExternal), buy,
   attach to the Messaging Service, store on the sender row. Degrade
   honestly without credentials.
3. Inbound webhook: /api/integrations/twilio/inbound (signature-verified
   like the status webhook). Resolve the sender number → client; match the
   from-number to a customer/lead (normalizePhone both sides; unmatched →
   create customer + lead source_kind 'website'? NO — add 'sms' to the
   leads.source_kind check constraint via migration). Write a lead_events
   'sms_in' row (the timeline + conversation already render the kind),
   bump last_inbound_at via recordInboundOnLead, and enqueue
   analyze_inbound_message — REFACTOR: the conversation-ai handler
   currently loads email_messages; generalise its payload to
   { channel: 'email'|'sms', messageBody } so SMS rides the same intent +
   reply-draft path. Reply drafts for SMS-only leads should dispatch via a
   new sms branch on /api/leads/[id]/reply (body { channel: 'sms' } →
   send_sms-style direct send + 'sms_out' lead_event) — un-inert the
   composer's SMS channel in LeadConversationComposer.
4. STOP/HELP compliance: inbound body matching STOP/UNSUBSCRIBE (case-
   insensitive) stamps customers.unsubscribed_at (the existing flag) and
   replies once with a confirmation; HELP replies with the business
   contact line. Twilio Advanced Opt-Out can also handle this at the
   Messaging Service level — prefer enabling that and treat our handler
   as defence-in-depth (document which is authoritative).
5. The send_sms handler prefers the long_code sender when present (two-way
   beats alphanumeric); alphanumeric stays the fallback.

VERIFY: simulated inbound POST (signed) creates the lead_event + a reply
draft; STOP marks unsubscribed and the next automation SMS skips.
```

---

## Session 6 — WhatsApp Business (credential-gated)

```
Add WhatsApp as an inbox channel. HARD PREREQ: a Meta WhatsApp Business
Cloud API app with a verified business + a registered WABA phone number —
weeks of operator lead time; build only once test credentials exist.

SHAPE (mirror the SMS session): per-client WABA number assignment table;
send via Cloud API template messages (session messages within 24h window);
inbound webhook → lead_events kind 'whatsapp_in' (extend the
LeadTimelineDot + conversation bubble kinds) → analyze_inbound_message;
reply via the conversation composer (new channel pill). 24-hour window
rule: outside it only approved template messages may send — the send path
must check last_inbound_at and fall back to a template or an honest skip.
Opt-out: WhatsApp's own block/report plus our unsubscribed_at gate.
Every call through callExternal; tokens in Vault via the existing
oauth/tokens spine if per-tenant, or platform env if Webnua-owned WABA
(decide with the operator: platform-owned is V1-simplest, mirroring
Twilio).
```

---

## Session 7 — Daily digest + weekly scorecard

```
Close the "plain-English daily email" + "weekly scorecard" gaps. Read
CLAUDE.md (action spine, platform_email_templates, notification
preferences).

DELIVERABLES
1. Owner daily digest: a morning cron (per-client timezone, reuse the
   quiet-hours TZ + the social scheduleInstant approach) that collects the
   client's pending suggested_actions + overnight leads + today's bookings
   and sends ONE email ("3 things are waiting for your tap") via a new
   platform-level template — Sonnet writes a 3-sentence narrative ONLY
   from the structured rows (no invented numbers). Skip when nothing is
   pending (no empty digests). Recipient: the client's owner user email;
   per-client opt-out flag on notification_preferences.
2. Operator agency digest: one email per operator summarising open ads
   flags + pending approvals across clients (the Phase 7.5 Session 5
   parked item). Same skip-when-empty rule.
3. Weekly scorecard: a dashboard card (client + hub) showing leads /
   quotes sent / jobs booked / revenue invoiced / reviews gained for the
   trailing 7 days vs prior — all derived from existing tables (+ quotes/
   invoices when Sessions 1-2 have landed; render the columns that exist,
   placeholder the rest honestly).
```

---

## Session 8 — Instagram + GBP social publishing

```
Extend the social calendar's publish worker beyond Facebook. Read
CLAUDE.md ("Social media calendar" section; channels text[] is already
schema-ready).

DELIVERABLES
1. Instagram: requires the client's IG Business account linked to their
   FB Page. Discovery: GET /{page_id}?fields=instagram_business_account
   via the page token; store ig_user_id on client_meta_ad_accounts
   (migration). Publish = 2-step container flow (POST /{ig_user_id}/media
   with image_url+caption → POST /media_publish). IG REQUIRES an image —
   the publish worker skips IG (honest per-channel result) for text-only
   posts; the SocialPostCard shows a per-channel hint ("Instagram needs a
   photo").
2. GBP posts: implement the V1.1 stub createPost in gbp/client.ts (POST
   accounts/{a}/locations/{l}/localPosts via callWithToken — summary +
   CTA 'LEARN_MORE' to the site + optional photo). Channel available only
   when a GBP location is connected.
3. Schema: social_posts gains per-channel results jsonb
   ({ facebook: { id?, error? }, instagram: …, gbp: … }) — published =
   at least one channel succeeded; per-channel errors render on the card.
   Channel picker chips on SocialPostCard (default from what's connected).
4. The generator tags which channels suit each post (image-led → IG).
```

---

## Explicitly deferred (do not build without an operator decision)

- **Google Ads** — prior operator decision NOT to build; needs a developer
  token + OAuth verification. Revisit only on explicit instruction.
- **FB/IG DM + website chat widget channels** — after WhatsApp proves the
  multi-channel inbox shape.
- **14-day Stripe trial + usage caps with overage** — preview-before-pay IS
  the platform's trial; changing the billing model is an operator call.
- **Platform fee on Connect payments** (Session 2 parks it at 0).
- **PDF quote/invoice rendering** (hosted pages first; print CSS V1).
