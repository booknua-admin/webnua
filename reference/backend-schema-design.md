# Webnua Backend — schema design

> **Status:** design pass only. No code, no migrations, no Supabase project.
> This document is the reviewable gate before Phase 1 (project setup +
> migrations). Baselined against `main` (`4c2e989`, all cluster work merged
> through Cluster 9 + completion + tidying).
>
> **Reading order:** this doc answers to `webnua-vision.md` §7 (operator
> surfaces are data-capture surfaces — every decision a typed, attributable
> event), `builder-design.md` §2/§3/§7/§10, and `builder-generation-design.md`
> §4.4a. The codebase inventory (stub types, capability/policy layers,
> dispatchers) is the brief — the schema satisfies what the front end already
> assumes. Where it can't, §5 records the disagreement.
>
> **Conventions used below:**
> - All primary keys are `uuid` (`gen_random_uuid()`), all timestamps
>   `timestamptz`. "ISO timestamp" stub fields map to `timestamptz`.
> - **Timestamp columns.** Mutable entities carry `created_at` + `updated_at`
>   (both `default now()`; `updated_at` bumped by a trigger). Append-only
>   audit/event tables (`lead_events`, `force_publish_audit_log`,
>   `campaign_activity_events`, `seat_limit_changes`, `generation_log`) carry
>   only their event timestamp (`occurred_at` / `changed_at` / `created_at`) —
>   an event is never "updated," so no `updated_at`.
> - **Soft vs hard delete.** Three classes: (a) **state-only** — `clients`
>   (lifecycle `paused`/`churned`, never row-deleted) and versions (`archived`
>   status); (b) **soft delete** — content rows that may need recovery
>   (`pages`, `sections`) carry `deleted_at timestamptz null`; (c) **hard
>   delete** — everything else (an unsent invite, a notification, a draft
>   ticket message) is genuinely removed. Audit/event tables are never deleted
>   from at all.
> - `[JC]` tags a judgement call I want confirmed rather than silently picked
>   (collected in §10).
> - 🔴 marks a **load-bearing** decision — wrong here propagates widely.
> - Stub-type provenance is cited as `file → Type` from the inventory.

---

## §1 — The entity map

Tables grouped by concern. For each: what it represents, its stub provenance,
and whether it **satisfies an A-tier stub directly** (the stub type is already
a clean contract) or **needs restructure** (the stub is presentation-shaped —
see §5) or is **invented** (no meaningful stub — see §2).

### 1.1 Identity & org

#### `users` 🔴
The signed-in person. With Supabase Auth this is a profile table 1:1 with
`auth.users` (shared `id`). `capabilities` is **never stored** — it is derived
at read time from `role` defaults + `capability_grants` (see §1.2).
Provenance: `lib/auth/user-stub.tsx → User`. Needs restructure (the stub's
`capabilities: Set` is derived, not a column).

```
users
  id               uuid PK   -- = auth.users.id
  display_name     text not null
  email            text not null unique
  role             user_role not null            -- enum: 'admin' | 'client'
  team_role        team_role null                -- enum: 'owner'|'operator'|'junior'; null for clients
  client_id        uuid null FK→clients(id)       -- the user's home client; null for operators
  avatar_initial   text null                      -- optional; UI also derives from display_name
  created_at       timestamptz not null default now()
  updated_at       timestamptz not null default now()
  CHECK (role = 'client' AND client_id IS NOT NULL AND team_role IS NULL)
     OR (role = 'admin'  AND client_id IS NULL    AND team_role IS NOT NULL)
```

`user_role` and `team_role` are the two role axes from the inventory: `role`
drives sidebar/route shape, `team_role` is the operator org tier whose
capability bundle is derived (`owner`/`operator` = all caps, `junior` = the
5-cap subset). They are **not** the capability layer — that's `capability_grants`.

The `CHECK` encodes a hard rule: **an operator has no home client.**
`users.client_id` is exclusively a *client user's* home business — operators
are unscoped at this column and reach any client (including Webnua's own
marketing account, should it ever become a managed sub-account) through the
workspace picker, never through `client_id`.

#### `clients` 🔴 — **invented, see §2.1**
The client business / sub-account. Central FK target for nearly every table.

#### `brands` 🔴
One brand per client (V1). Kept as its own table rather than columns on
`clients` — it is a cohesive sub-object, edited under a distinct capability
(`editTheme`), and both `websites` and `funnels` resolve it via `client_id`.
Provenance: `lib/website/types.ts → BrandObject`. A-tier (clean).

```
brands
  client_id              uuid PK FK→clients(id)   -- 1:1 with client
  accent_color           text not null            -- hex
  logo_url               text null
  favicon_url            text null
  voice_formality        smallint not null CHECK (1..5)
  voice_urgency          smallint not null CHECK (1..5)
  voice_technicality     smallint not null CHECK (1..5)
  audience_line          text not null
  industry_category      text not null
  top_jobs_to_be_booked  text[] not null default '{}'
  updated_at             timestamptz not null default now()
```

Voice tone is stored as the slider triple — builder-design §2.3: presets are
storage-equivalent to their slider state, no preset id persists.

#### `team_invites`
Operator-side org invite. Provenance: `lib/team/types.ts → TeamInvite`. A-tier.

```
team_invites
  id            uuid PK
  email         text not null
  full_name     text not null
  role          team_role not null
  invited_by    uuid not null FK→users(id)        -- attribution (vision §7)
  invited_at    timestamptz not null default now()
  expires_at    timestamptz not null
  magic_link    text not null
  status        invite_status not null default 'pending'  -- 'pending'|'accepted'|'expired'|'revoked'
  personal_note text not null default ''
```

`TeamInvite.assignedClientIds: string[]` (junior-operator scoping) →
**join table** `team_invite_clients(invite_id FK, client_id FK, PK(both))`.
On acceptance these become `user_client_access` rows (§1.2). `[JC-3]`

#### `client_user_invites`
Client owner inviting a teammate into their own client account. Deliberate
sibling of `team_invites`, not a generalisation. Provenance:
`lib/invites/client-invite.ts → ClientUserInvite`. A-tier.

```
client_user_invites
  id            uuid PK
  email         text not null
  full_name     text not null default ''
  client_id     uuid not null FK→clients(id)      -- fixed to inviter's own client
  invited_by    uuid not null FK→users(id)        -- a client user
  invited_at    timestamptz not null default now()
  expires_at    timestamptz not null
  magic_link    text not null
  status        invite_status not null default 'pending'
  personal_note text null
```

#### `seat_limit_changes`
Audit log of per-client seat-limit changes. The *effective* limit is resolved
through the policy layer (`defaultSeatLimit` key); this table is only the
history the override store doesn't track. Provenance:
`lib/clients/seat-limit.ts → SeatLimitChange`. A-tier.

```
seat_limit_changes
  id             uuid PK
  client_id      uuid not null FK→clients(id)
  changed_by     uuid not null FK→users(id)
  changed_at     timestamptz not null default now()
  previous_limit integer null     -- null = uncapped
  new_limit      integer null
```

> **Agency entity.** There is **no `agencies` table** in V1 — see §9. The
> agency (HQ) is the implicit operator org, represented by `users` with
> `role='admin'`. `agency_policy` (§1.3) is a global singleton.

### 1.2 Capability layer

#### `capability_grants` 🔴
Per-user, per-website (or workspace-wide) capability grants. The resolved
capability set = role/team-role defaults ∪ all grant capabilities. Provenance:
`lib/auth/capabilities.ts → CapabilityGrant`. A-tier (shape is already
backend-ready and forward-compat per builder-design §1.4).

```
capability_grants
  id            uuid PK
  user_id       uuid not null FK→users(id)
  website_id    uuid null FK→websites(id)    -- NULL = workspace-wide ('*' sentinel in the stub)
  capabilities  capability[] not null        -- enum array; 13-value `capability` enum
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
  UNIQUE (user_id, website_id)
```

`website_id NULL` replaces the stub's `'*'` sentinel — a real nullable FK
instead of a magic string. `capabilities` as a Postgres enum array keeps the
`Capability[]` shape 1:1; the alternative (a `capability_grant_caps` join) is
heavier with no V1 benefit. `[JC-5]` The forward-compat `presetId?` layer
(builder-design §1.4) is **not** added now — the shape stays additive-friendly.

#### `user_client_access` 🔴 — **RLS-supporting join**
Which clients a **junior operator** may see. Owner/operator team-roles see all
clients (no rows needed — RLS short-circuits on `team_role`). Junior operators
are scoped to an explicit list. Clients don't need rows here — `users.client_id`
covers them. This table exists purely so RLS can express junior-operator
scoping as a join rather than a capability check. No direct stub — implied by
`TeamInvite.assignedClientIds`. **Invented (RLS-driven).**

```
user_client_access
  user_id    uuid not null FK→users(id)
  client_id  uuid not null FK→clients(id)
  granted_by uuid not null FK→users(id)
  granted_at timestamptz not null default now()
  PRIMARY KEY (user_id, client_id)
```

#### `force_publish_audit_log`
Break-glass force-publish audit trail (builder-design §2.4 — force-publish is
*not* a capability, it is `publish` + audit discipline). Provenance:
`lib/auth/audit-stub.ts → ForcePublishEntry`. A-tier; the stub's
`target.{clientName,pageTitle}` denormalised strings become FK lookups.

```
force_publish_audit_log
  id              uuid PK
  actor_user_id   uuid not null FK→users(id)
  website_id      uuid not null FK→websites(id)
  new_version_id  uuid not null FK→website_versions(id)
  reason          text not null                 -- required free-text, vision §7
  created_at      timestamptz not null default now()
```

### 1.3 Policy layer

The three-layer resolution stack (`override ?? plan.policy[key] ?? agency`).
Policy values are heterogeneous per key, so all three stores hold the value as
`jsonb` keyed by the closed `policy_key` enum (6 values). `[JC-9]`

#### `agency_policy` — Layer 2 (global singleton)
```
agency_policy
  policy_key  policy_key PK     -- enum: 6 keys
  value       jsonb not null
  updated_at  timestamptz not null default now()
```
Seeded from `AGENCY_POLICY_SEED`. Provenance: `lib/agency/agency-policy-stub.ts`.

#### `plan_catalog` — Layer 2.5 catalog
```
plan_catalog
  id             uuid PK
  name           text not null
  description    text not null default ''
  price          numeric(10,2) not null
  currency       text not null              -- ISO 4217
  billing_cycle  billing_cycle not null     -- 'monthly' | 'yearly'
  policy         jsonb not null default '{}'  -- Partial<PolicyValueMap>
  created_at     timestamptz not null default now()
  updated_at     timestamptz not null default now()
```
Provenance: `lib/billing/types.ts → Plan`. A-tier.

#### `plan_assignments` — Layer 2.5 assignment
```
plan_assignments
  client_id  uuid PK FK→clients(id)
  plan_id    uuid not null FK→plan_catalog(id)
  assigned_by uuid null FK→users(id)
  assigned_at timestamptz not null default now()
```
A client with no row is on the no-plan path (resolver skips Layer 2.5).
Provenance: `lib/billing/types.ts → PlanAssignment`.

#### `policy_overrides` — Layer 3
```
policy_overrides
  client_id   uuid not null FK→clients(id)
  policy_key  policy_key not null
  value       jsonb not null
  updated_at  timestamptz not null default now()
  PRIMARY KEY (client_id, policy_key)
```
A `(client_id, policy_key)` row absent = inherit. Provenance:
`lib/agency/override-stub.ts`. The seat-limit override seed migrates here.

> The resolver itself (`override → plan → agency`) is **application code**, not
> a table. The schema only stores the three layers; resolution stays in
> `lib/agency/resolver.ts`. Real payment/Stripe is **out of scope** (§9) —
> `plan_catalog.price` is display/policy metadata only.

### 1.4 Content model — website & funnel

See §3 for the section-storage decision (the load-bearing call here).

#### `websites`
```
websites
  id                   uuid PK
  client_id            uuid not null FK→clients(id)
  name                 text not null
  domain_primary       text not null
  domain_aliases       text[] not null default '{}'
  domain_ssl_status    ssl_status not null default 'pending'  -- 'pending'|'live'|'error'
  header_section_id    uuid null FK→sections(id)   -- website-level singleton
  footer_section_id    uuid null FK→sections(id)   -- website-level singleton
  draft_version_id     uuid null FK→website_versions(id)
  published_version_id uuid null FK→website_versions(id)
  created_at           timestamptz not null default now()
  updated_at           timestamptz not null default now()
```
Provenance: `lib/website/types.ts → Website`. A-tier. `nav` (NavLink[], capped
6) → child table `website_nav_links(website_id, position, label, target_kind,
target_page_id null, target_href null)`. `pageOrder` → `pages.position`.
Domain management is V2 (§9) — the `domain_*` columns are shaped for it but
DNS/SSL work is deferred.

#### `pages`
```
pages
  id          uuid PK
  website_id  uuid not null FK→websites(id)
  slug        text not null
  title       text not null
  type        page_type not null            -- 'home'|'about'|'services'|'contact'|'generic'
  position    integer not null              -- drives pageOrder
  seo_title         text null
  seo_description   text null
  seo_og_image_url  text null
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()
  UNIQUE (website_id, slug)
```
Provenance: `lib/website/types.ts → Page`. A-tier.

#### `sections` 🔴 — see §3
Live, individually-editable sections for pages, funnel steps, and website
singletons. `Section.data` storage is the §3 decision.

```
sections
  id              uuid PK
  page_id         uuid null FK→pages(id)
  funnel_step_id  uuid null FK→funnel_steps(id)
  -- header/footer singletons are referenced FROM websites.header/footer_section_id;
  -- such a row has page_id = funnel_step_id = NULL.
  type            section_type not null         -- 11-value enum
  enabled         boolean not null default true
  position        integer not null default 0
  data            jsonb not null default '{}'
  schema_version  integer not null default 1     -- see §3 evolution story
  ai              jsonb null                     -- { draftedFields: text[], lastRegenAt }
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  CHECK (num_nonnulls(page_id, funnel_step_id) <= 1)  -- 0 = website singleton
```
The polymorphic-parent shape (two nullable FKs + a website back-reference for
singletons vs a `(container_kind, container_id)` pair) is an **open item folded
into the §7 builder pass** — see §10.

#### `website_versions`
```
website_versions
  id                uuid PK
  website_id        uuid not null FK→websites(id)
  status            version_status not null    -- 'draft'|'pending_approval'|'published'|'archived'
  snapshot          jsonb not null             -- frozen { pages, header, footer, nav, pageOrder }
  created_by        uuid not null FK→users(id)
  created_at        timestamptz not null default now()
  published_at      timestamptz null
  published_by      uuid null FK→users(id)
  notes             text null
  parent_version_id uuid null FK→website_versions(id)
```
Provenance: `lib/website/types.ts → Version` + `VersionSnapshot`. A-tier. The
`snapshot` is a **frozen denormalised JSONB blob** — see §3 for why versions
denormalise while live `sections` normalise. `archived` versions are kept for
the rollback window (builder-design §2.4 — 90-day default).

#### `funnels`, `funnel_steps`, `funnel_versions`
Direct mirror of the website triple, from `lib/funnel/types.ts` (the
**singular** `lib/funnel/` build model — canonical; see §5 for the
`lib/funnels/` collision). A-tier.

```
funnels         -- id, client_id FK, name, domain_*, draft_version_id, published_version_id, created/updated_at
funnel_steps    -- id, funnel_id FK, slug, title, type (funnel_step_type: landing|schedule|thanks|optin|upsell),
                --   position, seo_*, created/updated_at
funnel_versions -- id, funnel_id FK, status, snapshot jsonb, created_by, created_at, published_*, notes, parent_version_id
```
Funnel sections live in the shared `sections` table via `funnel_step_id`.

### 1.5 Operational entities

#### `customers` 🔴 — **invented, see §2.3**
The person a client deals with — the shared identity behind leads, bookings,
recurring schedules, and review authors. Per-client scoped.

#### `leads`
```
leads
  id                  uuid PK
  client_id           uuid not null FK→clients(id)
  customer_id         uuid null FK→customers(id)    -- linked at creation via phone match; null = unmatchable raw lead
  customer_name_snapshot  text not null             -- enquiry name, frozen (§2.3 snapshot convention)
  customer_phone_snapshot text null                 -- enquiry contact number, frozen
  status              lead_status not null default 'new'   -- new|contacted|booked|completed|lost
  urgency             lead_urgency not null default 'none' -- asap|today|soon|none
  source              text null
  assigned_operator_id uuid null FK→users(id)
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
```
Provenance: `lib/leads/types.ts` (`ClientLeadRow`/`AdminLeadRow`/`LeadDetail`
are projections — see §5). The stub's `email`/`suburb` are **not lead
columns** — they live on `customers` (§2.3), resolved via `customer_id`.
`unread`/`age`/`preview`/`meta` are **not columns** (per-viewer or
computed — §5); lead "unread" is the `lead_reads` join (below).

#### `lead_events` 🔴
The lead activity timeline — the canonical typed-event log (vision §7). Every
row is a discrete attributable event.
```
lead_events
  id              uuid PK
  lead_id         uuid not null FK→leads(id)
  kind            lead_event_kind not null   -- sms_in|sms_out|email_in|email_out|form_submitted|
                                             --   status_changed|booking_created|automation_fired
  occurred_at     timestamptz not null
  scheduled_for   timestamptz null           -- set for future/scheduled events (stub `pending`)
  actor_user_id   uuid null FK→users(id)       -- human actor; null = customer / system
  automation_id   uuid null FK→automations(id) -- automation actor; null = not automation-driven
  payload         jsonb not null default '{}'  -- typed per `kind` — see below
  created_at      timestamptz not null default now()
```
Provenance: `lib/leads/types.ts → LeadTimelineEvent` + `ConversationMessage` —
**needs restructure**. `[JC-4]` **resolved: messages collapse into
`lead_events`** — there is no separate `messages` table. An SMS / email is one
event row, not two. `kind` already encodes channel + direction
(`sms_in`/`sms_out`/`email_in`/`email_out`), so no separate channel/direction
columns are needed. `actor_user_id` (human) and `automation_id` (automation)
are the two non-exclusive actor FKs — the stub's `is_automated` boolean is
dropped (derivable: `automation_id IS NOT NULL`).

`payload` is typed by `kind`:
- message kinds (`sms_*`, `email_*`) → `{ body, senderName, delivered }`
- `form_submitted` → `{ fields: {label,value}[] }`
- `status_changed` → `{ from, to }`
- `booking_created` → `{ bookingId }`
- `automation_fired` → `{ stepId }`

The conversation view (`/leads/[id]/conversation`) is `lead_events` filtered to
the message kinds; the timeline view is unfiltered. Same table, no JOIN.

> **No `messages` table.** `[JC-4]` collapsed the conversation thread into
> `lead_events` (above). `ConversationMessage`'s verbatim `body` is the message
> event's `payload.body`; its `metaPrefix`/`time` ReactNode fields drop.

#### `bookings`, `recurring_booking_schedules`, `job_completions` 🔴 — **invented, see §2.2**

#### `tickets`
```
tickets
  id                  uuid PK
  reference           text not null unique        -- display id, e.g. 'TKT-0247'
  client_id           uuid not null FK→clients(id)
  title               text not null               -- verbatim user input
  category            ticket_category not null    -- 7-value enum incl. 'website-approval'
  status              ticket_status not null default 'open'
  urgency             ticket_urgency not null default 'none'
  awaiting            ticket_awaiting null         -- 'operator'|'client'|null
  created_by          uuid not null FK→users(id)
  assigned_operator_id uuid null FK→users(id)
  -- structured request-change context (builder-design §1.3) — all nullable
  context_website_id  uuid null FK→websites(id)
  context_page_id     uuid null FK→pages(id)
  context_section_id  uuid null FK→sections(id)
  context_field_key   text null
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
```
Provenance: `lib/tickets/types.ts` + `client-detail.tsx`/`admin-detail.tsx`
(detail types are projections — §5). `statusLabel`/`statusHeadline`/`metaLine`
are **not columns** (§5).

#### `ticket_messages`
```
ticket_messages
  id              uuid PK
  ticket_id       uuid not null FK→tickets(id)
  author_user_id  uuid not null FK→users(id)
  body            text not null               -- verbatim
  is_draft        boolean not null default false
  created_at      timestamptz not null default now()
```

#### `website_approval_submissions`
Lane B pending-review submissions (builder-design §3.3/§3.4). Provenance:
`lib/tickets/website-approval-stub.ts → WebsiteApprovalSubmission`. A-tier,
with **one §5 improvement**: the stub duplicates the full `snapshot` — the
backend drops the copy and references `pending_version_id` (the version
already holds the snapshot).
```
website_approval_submissions
  id                  uuid PK
  website_id          uuid not null FK→websites(id)
  pending_version_id  uuid not null FK→website_versions(id)
  submitter_id        uuid not null FK→users(id)
  submitted_at        timestamptz not null default now()
  status              approval_status not null default 'pending'  -- pending|approved|rejected|recalled
  note                text null
  diff                jsonb not null   -- { pagesChanged, sectionsChanged, fieldsChanged } — computed at submit
  rejection_reason    text null
  resolved_at         timestamptz null
  resolved_by         uuid null FK→users(id)
```

#### `funnel_approval_submissions`
Pre-aligned mirror of the above (CLAUDE.md parked decision — funnel publish
lanes are deferred but the shape is pinned now so the future lift is typing).
Same columns, `funnel_id` / `pending_funnel_version_id` FKs. **Invented
(shape pre-aligned, no stub yet — funnel publish is unbuilt).**

#### `reviews`
```
reviews
  id            uuid PK
  client_id     uuid not null FK→clients(id)
  customer_id   uuid null FK→customers(id)   -- best-effort link; GBP reviews often unmatchable
  author_name   text not null               -- GBP-verbatim; kept (not renamed) — see §2.3
  job           text null
  body          text not null            -- verbatim review text
  stars         smallint not null CHECK (1..5)
  reviewed_at   timestamptz not null     -- replaces the stub's relative `age`
  source        text not null default 'gbp'
  external_id   text null                -- GBP review id
  created_at    timestamptz not null default now()
```
Provenance: `lib/reviews/types.ts → ReviewItem`. Near-A-tier (`age`→`reviewed_at`).
The connected/empty card state is derived from whether the client has a GBP
integration — not a column.

#### `campaigns`
```
campaigns
  id            uuid PK
  client_id     uuid not null FK→clients(id)
  name          text not null
  status        campaign_status not null default 'pending'  -- active|paused|pending
  budget        numeric(10,2) null
  starts_at     timestamptz null
  ends_at       timestamptz null
  external_ref  text null               -- Meta Ads campaign id
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
```
Provenance: `lib/campaigns/types.ts` — **needs restructure** (the file is all
view projections; no clean entity). Metrics (`cells`, sparkline) are computed
aggregates over ad-platform data, **not stored**.

#### `campaign_activity_events`
```
campaign_activity_events
  id            uuid PK
  campaign_id   uuid not null FK→campaigns(id)
  category      campaign_activity_category not null  -- creative|audience|budget|tune
  actor_user_id uuid null FK→users(id)
  payload       jsonb not null default '{}'  -- structured event detail; prose composed at render
  occurred_at   timestamptz not null
  created_at    timestamptz not null default now()
```
Provenance: `lib/campaigns/types.ts → CampaignActivityItem` — needs restructure
(stub `body`/`desc` are prose; here typed event + payload).

#### `automations`, `automation_steps`
```
automations
  id            uuid PK
  client_id     uuid not null FK→clients(id)
  name          text not null
  trigger_type  text not null            -- e.g. 'lead_status_unchanged'
  trigger_config jsonb not null default '{}'
  enabled       boolean not null default false
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()

automation_steps
  id            uuid PK
  automation_id uuid not null FK→automations(id)
  position      integer not null
  channel       automation_channel not null   -- 'sms' | 'email'
  delay_amount  integer not null default 0    -- §5: stub's "Delay: 24 hrs" string → {amount,unit}
  delay_unit    delay_unit not null default 'hours'  -- 'minutes'|'hours'|'days'
  name          text not null
  subject       text null                     -- email only
  body          text not null                 -- template with {variable} placeholders, not JSX
  created_at    timestamptz not null default now()
  updated_at    timestamptz not null default now()
```
Provenance: `lib/automations/types.ts → AutomationEditorStep` (canonical — see
§5 for the `lib/onboarding/` collision). Needs restructure (`delay` string,
`body` JSX). Template variables (`{first_name}` etc.) are reference data —
a small `automation_variables(code, description)` table or a code constant;
`[JC]`-free, implementer's call.

#### `notifications`
```
notifications
  id                 uuid PK
  recipient_user_id  uuid not null FK→users(id)
  kind               notification_kind not null   -- lead|review|auto|booking|alert
  title              text not null                -- §5: stub's ReactNode title → templated plain text
  source_entity_type text null                     -- e.g. 'lead','booking' — for the action deep-link
  source_entity_id   uuid null
  created_at         timestamptz not null default now()
```
`read` is **not a column** — see `notification_reads` below. Provenance:
`lib/notifications/types.ts → NotificationItem` — needs restructure. `[JC-7]`

#### `notification_reads`
Per-viewer read state, a join not a column (a notification can fan out to
multiple recipients in future; even today read-state is per-user).
```
notification_reads (notification_id FK, user_id FK, read_at timestamptz, PK(both))
```

#### `lead_reads`
Per-viewer lead read state — same shape, same reasoning. `AdminLeadRow.unread`
is per-user, not a lead column (§5 #12).
```
lead_reads (lead_id FK, user_id FK, read_at timestamptz, PK(both))
```

### 1.6 Generation

#### `generation_log`
The fallback/validation log from `builder-generation-design.md §4.4a`.
```
generation_log
  id            uuid PK
  generation_id uuid not null            -- groups all rows from one generation run
  client_id     uuid not null FK→clients(id)
  page_id       uuid null FK→pages(id)   -- the generated page, once created
  section_type  section_type not null
  field_name    text not null
  reason        generation_fallback_reason not null  -- 'missing' | 'invalid'
  model_value   text null
  created_at    timestamptz not null default now()
```
Provenance: `builder-generation-design.md §4.4a`. Invented (no stub — the stub
keeps this in-memory). Used for prompt tuning, not user-facing.

### 1.7 Enum inventory (closed unions to create as Postgres enums)

`user_role`(2), `team_role`(3), `capability`(13), `policy_key`(6),
`billing_cycle`(2), `ssl_status`(3), `page_type`(5), `funnel_step_type`(5),
`section_type`(11), `version_status`(4), `invite_status`(4),
`lead_status`(5), `lead_urgency`(4), `lead_event_kind`(8),
`booking_status`(4), `recurrence_frequency`(4), `payment_method`(4),
`ticket_category`(7), `ticket_status`(4), `ticket_urgency`(3),
`ticket_awaiting`(2 + null), `approval_status`(4),
`campaign_status`(3), `campaign_activity_category`(4),
`automation_channel`(2), `delay_unit`(3),
`notification_kind`(5), `generation_fallback_reason`(2).

All map directly to inventory unions. The `[JC-4]` collapse dropped
`message_channel`/`message_direction`/`message_kind` — `lead_event_kind`
already encodes channel + direction; `customers` adds no enum. CLAUDE.md's
rule holds: widening any of these is a deliberate amendment, not an ad-hoc add.

---

## §2 — The entities that require invention

Most tables above satisfy an A-tier stub. Three do not — `clients`, the
booking family, and `customers`. These get the most design space and the most
uncertainty.

### 2.1 `clients` 🔴

**The problem.** `AdminClient` (`lib/nav/admin-clients.ts`) is a sidebar
display stub: `{ id, initial, name, meta: string, badge?, status? }`. `meta`
(`"Electrical · in setup"`) packs an industry label and a derived count blurb
into one string; `initial`/`badge` are pure presentation. Yet `clients` is the
FK target for `users`, `brands`, `websites`, `funnels`, `leads`, `bookings`,
`tickets`, `reviews`, `campaigns`, `automations`, every invite, every grant,
`plan_assignments`, `policy_overrides`, `seat_limit_changes`. The real entity
must be designed from what those consumers need, not from the sidebar stub.

**Proposed shape.**
```
clients
  id                  uuid PK
  name                text not null
  slug                text not null unique          -- stub ids are slugs ('voltline'); keep as a stable handle
  industry             text not null                 -- real field — replaces the "Electrical" half of `meta`
  lifecycle_status    client_lifecycle not null default 'onboarding'
                       -- enum: 'onboarding' | 'live' | 'paused' | 'churned'
  service_area        text null                      -- "Perth outer suburbs" — feeds brand.audience too
  primary_contact_name  text null
  primary_contact_email text null
  primary_contact_phone text null
  onboarded_by        uuid null FK→users(id)         -- the operator who created it (attribution)
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
```

**Reasoning, point by point.**
- `industry` is a proper column. The stub's `meta` blurb's first half
  (`"Electrical"`, `"Cleaning"`, `"Locksmith"`) is a real attribute that the
  brand object also needs (`industry_category`) and that AI generation reads.
  Whether it should be a free-text field or a closed `industry` enum is `[JC-2a]`
  — V1 leans free text (the trades are open-ended), enum is a V2 tightening.
- The count blurb half of `meta` (`"12 new leads"`) is **derived** — a
  `count(*)` over `leads` — and is never stored.
- `lifecycle_status`: the stub has `'active' | 'setup'`; the hub
  (`hub-types.ts`) has `'onboarding' | 'live'`. I propose the superset
  `onboarding | live | paused | churned` — `paused`/`churned` are obvious
  near-term needs (a client stops paying, a client leaves) and cost nothing to
  include now. `[JC-2b]`
- **Brand** is a separate `brands` table (§1.1), FK'd by `client_id`, not
  inlined here — keeps the §3 capability boundary (`editTheme`) clean.
- **Plan** is *not* a column — it lives in `plan_assignments` (§1.3), because
  plan assignment is a policy-layer concern with its own attribution and the
  resolver already reads it there.
- **Seat limit** is *not* a column — it is the `defaultSeatLimit` policy key,
  resolved through the three layers. (CLAUDE.md already retired
  `AdminClient.seatLimit` for exactly this reason.)
- **No `is_agency` flag.** The parked decision says Webnua-as-sub-account must
  drop in "as just another client row with no special-casing." A flag would be
  the special-casing. Webnua's own marketing account is simply a normal
  `clients` row. The agency *HQ* is not a `clients` row at all (§9).
- **`customers` is a real entity (§2.3).** A lead, a booking customer, and a
  review author are all "a person who deals with this client." `[JC-2c]`
  resolved to **extract** rather than denormalise — the V1 cost is small (one
  table, a few FKs) and it removes the V2 identity-backfill problem entirely.
  See §2.3.

### 2.2 The booking family 🔴

**The problem.** `CalendarBooking` (`lib/calendar/types.ts`) is pixel layout —
`{ id, time: "9:00 — 10:30", title, customer, top: number, height: number }`.
No `starts_at`/`ends_at`, no FK to a lead or client, no numeric price, no real
status beyond a calendar-cell tone. `ClientBookingDetail`/`AdminBookingDetail`
are ReactNode-heavy presentation. The inventory flagged this as the **single
biggest schema gap** — the Booking entity is invented essentially from scratch.

**`bookings`.**
```
bookings
  id                   uuid PK
  client_id            uuid not null FK→clients(id)
  lead_id              uuid null FK→leads(id)        -- a booking may or may not come from a lead
  recurring_schedule_id uuid null FK→recurring_booking_schedules(id)
  title                text not null                 -- job title
  service_type         text not null
  starts_at            timestamptz not null          -- replaces pixel `top` + display `time`
  ends_at              timestamptz not null          -- replaces pixel `height` + display `time`
  customer_id              uuid not null FK→customers(id)  -- identity (see §2.3)
  customer_name_snapshot   text not null                   -- display name, frozen at booking time
  customer_phone_snapshot  text null                       -- contact number, frozen at booking time
  address                  text null                      -- job-site address (booking-specific, not customer data)
  price                numeric(10,2) null            -- real number, not "$220"
  status               booking_status not null default 'scheduled'
                        -- enum: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes                text null                     -- verbatim (the stub's `notesText` is the real field)
  assigned_operator_id uuid null FK→users(id)
  created_by           uuid not null FK→users(id)
  created_at           timestamptz not null default now()
  updated_at           timestamptz not null default now()
```

**Reasoning.**
- `top`/`height`/`nowTopPx` are **pure layout** — never persisted. The calendar
  view computes pixel offsets from `starts_at`/`ends_at`. (§5.)
- `status` adds `'cancelled'` to the calendar's 3-value set — the booking
  detail has a "Cancel booking" `ConfirmDialog`, so cancellation is a real
  state the calendar enum just never surfaced.
- `lead_id` is nullable: the calendar's "+ New booking" modal creates bookings
  directly. When a booking *does* come from a lead, that link is what lets a
  `lead_event` of kind `booking_created` reference it.
- Customer identity is the `customers` FK + name/phone display snapshot (§2.3).
  `address` stays on `bookings` — it is the job-site address, booking-specific,
  not customer data.
- The job-completion stub implies completion is a transition + a payment
  record — see `job_completions` below.

**`recurring_booking_schedules`.** From `recurring-setup.tsx → RecurringSetup`.
```
recurring_booking_schedules
  id              uuid PK
  client_id       uuid not null FK→clients(id)
  lead_id         uuid null FK→leads(id)
  frequency       recurrence_frequency not null  -- 'weekly'|'fortnightly'|'monthly'|'custom'
  day_of_week     smallint null                  -- 0–6; null for 'custom'
  start_time      time not null
  duration_minutes integer not null
  service_type    text not null
  price           numeric(10,2) null
  customer_id              uuid not null FK→customers(id)
  customer_name_snapshot   text not null
  customer_phone_snapshot  text null
  active          boolean not null default true
  created_by      uuid not null FK→users(id)
  created_at      timestamptz not null default now()
```
Individual `bookings` rows are generated from a schedule and carry
`recurring_schedule_id` back to it — so a single visit can be rescheduled or
cancelled without touching the series.

**`job_completions`.** From `job-completion.tsx → JobCompletion`. A booking is
completed once; this is the record of *how*.
```
job_completions
  id              uuid PK
  booking_id      uuid not null unique FK→bookings(id)   -- one completion per booking
  completed_by    uuid not null FK→users(id)
  completed_at    timestamptz not null default now()
  payment_method  payment_method not null   -- 'card'|'cash'|'invoice_7'|'invoice_14'
  amount_charged  numeric(10,2) not null
  materials_cost  numeric(10,2) null
  review_requested boolean not null default false
  notes           text null
```
Real payment processing is **out of scope** (§9) — `payment_method`/
`amount_charged` record what the operator marked, not a Stripe transaction.

### 2.3 `customers` 🔴

**The problem.** No stub models a customer as an entity — `leads` carry
contact fields inline, `bookings` carry a customer snapshot, `reviews` carry an
author name. They are three denormalised views of one concept: *a person who
deals with this client*. `[JC-2c]` resolved to extract the entity in V1: the
V1 cost is small (a table + a few FKs); the cost of *not* extracting is a V2
identity-backfill problem — "is 'Sarah M' in booking #347 the same person as
'Sarah Mitchell' in lead #112" — that simply does not exist if customers are
entities from the first row.

**Proposed shape.**
```
customers
  id          uuid PK
  client_id   uuid not null FK→clients(id)   -- per-client; see scoping note
  name        text not null
  phone       text null
  email       text null
  suburb      text null
  address     text null
  notes       text null
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()
```

**Per-client scoping.** A customer belongs to exactly one client — a customer
of Voltline is not a customer of FreshHome, even if the same human.
Cross-client customer identity is a much harder problem (RLS, consent,
privacy) and is not needed for the V1 value: *repeat-business identification
within one client*. It is explicitly out of scope — naming it here prevents
future drift.

**Consumers and the FK pattern.**
- `bookings.customer_id` — **NOT NULL** (the repeat-business spine).
- `recurring_booking_schedules.customer_id` — **NOT NULL**.
- `leads.customer_id` — **nullable** (linked at lead creation via exact phone
  match; null only for an unmatchable raw/spam lead).
- `reviews.customer_id` — **nullable** (GBP reviews arrive as an author name;
  matching is best-effort and often impossible).

**The snapshot convention — denormalise *display*, not *everything*.** The FK
answers *who this is* (live, current — resolved by join). A snapshot column
answers *what they were called when this row was created*. A customer can be
renamed (typo fix, married name); a booking from last year must still display
the name as it was then. So `bookings` / `leads` /
`recurring_booking_schedules` each carry **two** snapshot columns alongside the
FK:

```
  customer_id              uuid FK→customers(id)   -- identity: who (live lookup)
  customer_name_snapshot   text                    -- display: name at row-creation
  customer_phone_snapshot  text                    -- contact number at time of event
```

**Only `name` and `phone` are snapshotted** — name because the row must
display the as-of-then name; phone because "what number was *this job*
arranged on" is historically meaningful (the customer may since have changed
numbers). **Everything else** — `email`, `suburb`, `address`, `notes` — is
**never snapshotted**: it is a live FK lookup through `customers`. This is the
explicit policy, and the reason the snapshot is **two named columns, not a
`customer_snapshot jsonb`**: a JSON blob invites "we'll snapshot one more field
later" rot, where named columns force the next contributor to consciously
decide whether a third frozen field crosses the *denormalise-display* line — it
should be hard to cross by accident.

`reviews` is the exception — it keeps its existing `author_name` rather than
renaming to `customer_name_snapshot`. GBP reviews are a different source class
(the name is GBP-verbatim, authored externally); artificially unifying the
naming would imply a freeze convention that does not apply. `reviews` simply
gains the nullable `customer_id`.

**Dedup is app logic, not schema.** V1 find-or-create on **exact phone match**
(cheap, good enough — a populated `customer_id` on every booking is what makes
V2 dedup tractable). **Fuzzy dedup is V2.** Stated here so a future implementer
neither over-engineers V1 nor skips dedup entirely and re-creates the
prose-matching problem this extraction exists to kill.

---

## §3 — Section data storage 🔴

This is the load-bearing storage decision and (per §7) it deserves its own
deeper pass before any builder migration is written. What follows is a
**recommendation with reasoning**, not a final lock.

### 3.1 The shape

`Section.data: Record<string, unknown>`, typed per `SectionType` at the
registry boundary (`HeroData`, `OfferData`, … — 11 types, each a flat
plain-string object). Section data lives in **two places**:
- **Live, editable** — the working draft a user edits in `SectionEditor`.
- **Frozen** — embedded inside every `website_versions.snapshot` /
  `funnel_versions.snapshot` (the snapshot embeds whole pages incl. sections).

### 3.2 The three options

| Option | DB enforcement | Schema weight | Evolution |
|---|---|---|---|
| **A — JSONB column** | none (app validates via registry) | 1 column | hard — old shapes silently linger |
| **B — normalised per-type tables** | full | 11+ tables, grows per V2 type | a migration per type, per change |
| **C — hybrid: JSONB + `schema_version`** | none at DB, but versioned | 1 column + 1 int | tractable — versioned migration funcs |

### 3.3 Recommendation — hybrid (C), split by liveness

**Live sections normalise into a `sections` table; the `data` payload is JSONB
with a `schema_version`. Version snapshots stay a single frozen JSONB blob.**

- A `sections` **table** (one row per section — §1.4) is right for *live* data:
  sections are individually toggled, reordered, and autosaved; per-row storage
  gives autosave its natural granularity and lets RLS gate a section without
  parsing a blob. But `data` *within* a row is JSONB — 11 heterogeneous shapes
  (12+ in V2) as 11 typed tables is schema churn with no query benefit (nobody
  queries "all heroes with headline LIKE …").
- Option B is rejected: the front end **already** validates `data` per-type at
  the registry boundary (`registry.ts` — every section module exports its
  `*Data` type and `defaultData()`). DB-level column enforcement duplicates a
  guarantee the app already makes, at the cost of a migration every time a
  section's shape moves.
- `website_versions.snapshot` / `funnel_versions.snapshot` stay a **frozen
  JSONB blob** — a version is an immutable point-in-time record, never queried
  piecemeal, never edited. Normalising it would mean reconstructing a whole
  page tree on every publish. Denormalised-immutable is correct here.

This is "hybrid" in a specific sense: **normalised rows for the live tree,
denormalised JSONB for the frozen history**, and JSONB-with-version for the
`data` payload either way. `[JC-8]`

### 3.4 Section-registry schema evolution `[JC-8a]`

When a section type's `*Data` shape changes in V2 (rename `headline`→`title`,
split `cta`→`ctaPrimary`+`ctaSecondary`), two populations hold the old shape:
live `sections.data` rows, and the `data` embedded in every frozen
`website_versions` / `funnel_versions` snapshot.

The mechanism, common to all options: each section type carries a current
`schema_version` in the registry plus an ordered list of pure **migration
functions** (`vN → vN+1`) over `data`. The registry already owns
`defaultData()` and validation; it owns these too. The question is *when the
functions run*.

| Strategy | Migration runs | Read path | Storage |
|---|---|---|---|
| **migrate-on-read** | every read, in memory | carries migration code forever | never rewritten |
| **lazy migrate-and-persist** | first read after a bump, then persisted | carries migration code; converges slowly | rewritten piecemeal, unpredictably |
| **eager bulk** | once, at the deploy shipping the change | zero migration code | rewritten once, all at once |

**Picked: eager bulk, applied uniformly to live rows and snapshots.** A V2
deploy that changes a section shape includes a deploy-time data-migration step
that walks every `sections.data` row and every snapshot blob, applies the
migration chain, and persists the upgraded `data` with a bumped
`schema_version`. After the deploy the whole corpus is on the current shape;
the read path carries no migration logic.

Reasoning:
- **Simplest read path, everywhere.** Editor, preview, rollback, diff all see
  one shape — no "which version is this" branching. migrate-on-read and lazy
  both spread migration code across every reader *permanently*; that is the
  cost they never stop paying.
- **The prior draft's asymmetry was wrong.** "Never rewrite a snapshot — it
  corrupts the audit trail" conflated the *meaning* of a version (immutable —
  genuinely the audit guarantee) with its *byte representation* (not required
  to be immutable). A faithful representation migration — `headline` becomes
  `title`, same value — does not change what the version says the page was.
  Audit integrity is preserved by the migration functions being **pure and
  faithful**, not by freezing bytes.
- **One reviewable place.** The bulk migration is versioned alongside the
  schema migration that caused it, runs once, is testable against a copy.
- **`schema_version` stays — as a safety net, not the mechanism.** After a bulk
  run every row is at vN. If a vN-1 row ever surfaces (a restored backup, a
  delayed write) `schema_version` lets a reader detect it and migrate
  defensively or fail loudly. Detection, not primary strategy — a reader who
  skims only this far should leave knowing `schema_version` is *not* consulted
  on every normal read.

**Honest failure mode.** Eager bulk fails when the corpus is too large to
migrate in a deploy window, or when a shape change is not mechanically faithful
(needs per-row human judgement or external data). Then you are forced back to
lazy (amortise the cost) or migrate-on-read (never pay it in bulk). This does
not bite at Webnua's scale: a managed-agency platform is tens-to-low-hundreds
of clients, bounded version history (90-day rollback window — builder-design
§2.4 — older archived versions prunable), and section-shape changes are rare V2
events, not routine writes. If the platform ever grows to where a bulk run is a
multi-hour operation, revisit — the registry's migration functions are equally
the building block for lazy migration, so the escape hatch is already in hand.

**One wrinkle for the §7 builder pass.** The migration functions are
TypeScript, in the front-end registry. A bulk migration of snapshots therefore
cannot be pure SQL — it is a deploy-time script (Node / edge function) that
loads snapshots, runs the TS functions, writes back. A standard data-migration
pattern, but it means "the migration" is a script paired with the `.sql`, not a
`.sql` file alone. §7 must pin where that script lives and how it sequences
against the DDL migration. This `[JC-8a]` recommendation is ratified there
before any builder migration is written.

### 3.5 Image storage — flagged, not decided

`BrandObject.logoUrl`/`faviconUrl`, `Page.seo.ogImageUrl`, and hero/media
section fields are all URL strings today. Where the bytes live — Supabase
Storage vs S3 vs Cloudinary — is a **separate decision** (builder-design §10,
§9 below). The schema only ever stores a URL; the storage backend is
independent of every table above.

---

## §4 — Role-based access (RLS)

The front end has a fully-built capability model; RLS expresses the **same
model at the data layer** so a compromised or buggy client can never read
across the tenant boundary. Policies below are described as **predicate
intent**, not final SQL — the migration session writes the SQL.

### 4.1 The primitives RLS leans on

- `auth.uid()` → the current `users.id`.
- **`is_operator()`** — `users.role = 'admin'`. Operators with team-role
  `owner`/`operator` see everything; `junior` is scoped (4.4).
- **`current_client_id()`** — `users.client_id` for a client user.
- **`accessible_client_ids()`** — for an operator: all clients if
  `team_role IN ('owner','operator')`, else the `user_client_access` set for a
  junior. For a client: just `current_client_id()`.
- **`has_capability(website_id, cap)`** — `is_operator()` OR an `EXISTS` over
  `capability_grants` where `user_id = auth.uid()`, `cap = ANY(capabilities)`,
  and `(website_id = grants.website_id OR grants.website_id IS NULL)` (the NULL
  = workspace-wide grant). This is the SQL form of the resolver's role-default
  ∪ grants union, restricted to the website in scope.

These wrap as `SECURITY DEFINER` SQL functions so every policy stays a
one-liner. **Performance note:** RLS evaluates `has_capability()` /
`accessible_client_ids()` **once per candidate row** — on a large `sections`
or `lead_events` scan that is significant. Mitigations (mark the functions
`STABLE` so the planner caches per-statement; index `capability_grants
(user_id, website_id)` and `user_client_access (user_id)`) belong in the
**migration session**, not this design pass — flagged here so they are not
forgotten.

### 4.2 The simple cases (tenant isolation)

Every client-scoped table (`clients`, `brands`, `customers`, `leads`,
`lead_events`, `bookings`, `recurring_booking_schedules`, `job_completions`,
`tickets`, `ticket_messages`, `reviews`, `campaigns`,
`campaign_activity_events`, `automations`, `automation_steps`,
`notifications`):

- **SELECT:** `client_id` (directly, or via the parent's `client_id`) `∈
  accessible_client_ids()`. A client sees only their own client's rows; an
  operator sees their accessible clients; **a client can never see another
  client's anything** — this is the hard tenant boundary.
- Child tables (`lead_events`, `ticket_messages`, `automation_steps`,
  `campaign_activity_events`) resolve `client_id` through their parent FK.
- `notifications`: SELECT gated on `recipient_user_id = auth.uid()` — strictly
  per-recipient, even for operators.

This backs the 14 content-sibling dispatchers + the internal-gate
`automations/[id]`: each `_client-content` view reads only `current_client_id()`
rows; each `_admin-content` view reads across `accessible_client_ids()`. The
dispatch *picks the component*; RLS *bounds the rows the component can read* —
the same query is safe whichever branch runs it.

### 4.3 The capability-gated cases (mutations)

Mutations on the content model are gated by `has_capability()`, not just
tenancy:

- `pages` / `sections` INSERT/UPDATE/DELETE → `has_capability(website_id,
  'editSections'|'editLayout'|'editCopy'|…)`. The cap checked depends on the
  mutation; at minimum *some* edit cap. `editPages` gates `pages` create/delete.
- `website_versions` — promoting `draft → published` requires
  `has_capability(website_id, 'publish')`. Creating a `pending_approval`
  version (Lane B submit) requires only an edit cap, **not** `publish` — that
  is the whole point of Lane B.
- `website_approval_submissions` — INSERT by the submitter (any edit cap);
  resolving to `approved`/`rejected` requires `approve`.
- `force_publish_audit_log` — INSERT only alongside a `publish` by an operator
  (`role = 'admin'`); the `reason` is `NOT NULL` so a force-publish that
  captures nothing is impossible at the DB level (vision §7).
- `brands` UPDATE → `has_capability(<any website of this client>, 'editTheme')`.
- Per-field caps (`editCopy` vs `editMedia`) are **not** an RLS concern — RLS
  works at row granularity; a section row UPDATE checks a section-level cap and
  the app enforces which *fields* within `data` the user may touch (the
  registry's `capabilityHints`). Documented so the migration session doesn't
  try to push field-level gating into RLS.

### 4.4 The grant-resolved & cross-client cases

- A client user with a workspace-wide grant (`capability_grants.website_id IS
  NULL`) for `editCopy` resolves `has_capability()` true for **every** website
  under their client — the NULL-website grant is the `'*'` case.
- A client user with a per-website grant resolves true only for that website.
- **Operators cross-client:** `is_operator()` short-circuits `has_capability()`
  to true and `accessible_client_ids()` to the full set (owner/operator) — they
  see and act across clients. **Junior operators** are bounded by
  `user_client_access`: `accessible_client_ids()` returns only their joined
  clients, so a junior physically cannot `SELECT` a non-assigned client's rows.
- **Policy/billing tables:** `agency_policy`, `plan_catalog` — SELECT for any
  operator, INSERT/UPDATE for `team_role IN ('owner','operator')` only.
  `policy_overrides`, `plan_assignments`, `seat_limit_changes`,
  `capability_grants` — operator-write; a client may SELECT rows for their own
  `client_id` (they can *see* their seat limit / plan, not change it).
- `team_invites` / `client_user_invites` — `team_invites` operator-only;
  `client_user_invites` SELECT/INSERT for client users of that `client_id`
  (a client owner invites their own teammates).

### 4.5 The Webnua-as-sub-account case

Because Webnua's own marketing account is just a `clients` row (§2.1 — no
`is_agency` flag, no special-casing), **every policy above already covers it**.
An operator sees it because it is in `accessible_client_ids()`. A grant against
its website resolves through the same `has_capability()`. There is nothing to
add — which is the test the parked decision asked for: the schema *allows*
Webnua to drop in, by virtue of not modelling "agency-ness" as a row attribute
at all.

### 4.6 `generation_log`

Operator-readable for the client in scope (`client_id ∈
accessible_client_ids()`); not surfaced to client users (it is a prompt-tuning
artefact). The `/dev/generation-preview` surface is a stub-era dev tool and is
deleted with the rest of the stub layer — no production RLS depends on it.

---

## §5 — Frontend stub / schema disagreements

Where a stub is presentation-shaped and the schema needs structure. Default
resolution: **the stub bends** (the schema is the source of truth; the front
end recomposes display from structured columns). Exceptions noted.

| # | Disagreement | Resolution — who bends |
|---|---|---|
| 1 | `AdminLeadRow.meta` — heterogeneous free-text activity blurb (`"Auto-replied"` / `"Tue 9am"` / `"Waiting reply"`) | **Stub bends.** No `meta` column. The row's last-activity line is derived from the lead's most recent `lead_events` row. |
| 2 | `LeadTimelineEvent.meta`/`body`/`snippet` + `ConversationMessage` — JSX packing channel/direction/phone/time + composed sentences | **Stub bends.** `lead_events` stores typed columns + `payload` jsonb; the timeline composes meta + body at render. `[JC-4]` collapsed messages in — for a message-kind event the `payload` schema is `{ body, senderName, delivered }`; `form_submitted` is `{ fields: {label,value}[] }`; `status_changed` is `{ from, to }`. |
| 3 | `ClientTicketDetail.statusLabel` **and** `statusHeadline` — the same data rendered twice (the code says so) | **Stub bends.** One source: `tickets.status` + `tickets.awaiting`. Both display strings are derived; no `status_label` column. |
| 4 | Lead / Ticket / Booking / Review / Campaign **attribution gap** — actor *names* denormalised into prose (`who`, `actor`, `operatorName`) | **Stub bends.** Proper `*_by` / `actor_user_id` / `assigned_operator_id` FKs to `users` on every entity (done throughout §1). Display name is a join, never stored prose. (Vision §7 — every decision attributable.) |
| 5 | `AutomationEditorStep.delay` — display string `"Delay: 24 hrs"` | **Stub bends.** `automation_steps.delay_amount:int` + `delay_unit:enum`. The string is formatted at render. |
| 6 | `automation_steps.body` — JSX with `<span data-slot="var">{first_name}</span>` tokens | **Stub bends.** Stored as a **plain-text template** with `{first_name}` placeholders. The editor parses placeholders for highlighting; the DB stores text. |
| 7 | `AdminCampaignRow.sparkPoints` — raw SVG polyline string | **Stub bends.** Not stored at all — the sparkline is a computed series over campaign metrics; the chart component builds the polyline. |
| 8 | `FunnelStep` / `FunnelVersion` exist in **both** `lib/funnel/` (build model) and `lib/funnels/` (analytics view) with incompatible shapes | **Schema picks `lib/funnel/` (singular) as canonical.** `funnel_steps` / `funnel_versions` are built from it. `lib/funnels/` is a **read-only analytics projection** — `/funnels/[id]` metrics are computed views over events, not tables. Not a table at all. |
| 9 | `Automation` / `AutomationStep` exist in both `lib/automations/` and `lib/onboarding/` | **Schema picks `lib/automations/AutomationEditorStep`** as canonical (§1.5). The onboarding `Automation` type is wizard-input shape, not a stored entity. |
| 10 | `WebsiteApprovalSubmission.snapshot` — the stub duplicates the full `VersionSnapshot` onto the submission | **Stub bends (improvement).** The submission references `pending_version_id`; the version already holds the snapshot. No duplicated blob. |
| 11 | Pixel layout — `CalendarBooking.top`/`height`/`nowTopPx` | **Stub bends.** Never persisted; computed from `bookings.starts_at`/`ends_at`. |
| 12 | `unread` / `read` flags on lead rows + notifications | **Stub bends.** Per-viewer state — `notification_reads` join (§1.5). Lead "unread" is similarly a per-user read-state join (`lead_reads`, same shape) rather than a column. `[JC-7]` |
| 13 | Relative timestamps everywhere (`age`, `time`, `when` — `"32m"`, `"Yesterday"`) | **Stub bends.** Every table stores absolute `timestamptz`; the front end computes relative labels. |
| 14 | `Hub*` / `ClientDashboard*` types (`hub-types.ts`, `client-dashboard-types.ts`) | **Neither — these are not tables.** They are aggregate read-models; the backend composes them from `leads`/`bookings`/`reviews`/`campaigns`/`funnels` at query time. The stub authors already wrote them §7-clean for this reason. |

One stub that **does not bend**: verbatim user input — `tickets.title`,
the message-event `payload.body` + `ticket_messages.body`, `bookings.notes`,
`reviews.body`, invite `personal_note`,
`automation_steps` `name`/`subject`/`body`-template,
`brands.audience_line`/`top_jobs_to_be_booked`, onboarding wizard answers. These
are legitimately free text and store as `text`. The `ReactNode` typing on them
in the stubs is incidental (inline `<strong>`), not structure to model.

---

## §6 — Auth timing recommendation

**Recommendation: real Supabase Auth lands *before* any data wiring.** Phase 2
= auth + RLS; Phase 3+ = wire clusters against real users. I agree with the
stated lean and have no stronger case for late auth — the case *for* early auth
is decisive:

1. **The role stub has seven distinct deletion points** spread across the
   codebase (CLAUDE.md's stub-deletion index: `user-stub.tsx`+`audit-stub.ts`,
   the publish/draft stub family, `app/layout.tsx`'s `<UserProvider>`,
   `DevRoleSwitcher` + mounts, `app/dev/*`, the agency-policy stores, the
   billing stores). Swapping auth in a **focused, isolated session** — one
   concern, one PR — is far safer than threading real-auth changes through
   every cluster-wiring session as a side-quest. The stub was *built* to be
   deleted at one seam; honour that.
2. **RLS cannot be validated against a stub.** The whole point of §4 is "Anna
   cannot read FreshHome's leads," "a junior operator cannot see an unassigned
   client," "a Lane B client cannot promote to published." None of these are
   testable without real `auth.uid()` values and real sessions. Wiring data
   first and adding RLS later means writing every policy blind and discovering
   the holes only when auth finally lands — which is the expensive-mistake
   class this whole gate exists to avoid.
3. RLS is **not optional polish** — it is the tenant boundary. It should exist
   from the first real row, not be retrofitted onto populated tables.

**Sequencing:** Phase 1 — Supabase project + migrations for the schema in §1
(tables + enums + the RLS-support functions, RLS policies authored alongside).
Phase 2 — real auth: replace the role stub at its seven seams, seed the four
real users, validate the §4 policies with actual cross-tenant negative tests.
Phase 3+ — wire clusters, each against real auth + live RLS.

One caveat to surface: the capability layer itself (`capabilities.ts`,
`explainers.ts`, `resolver.ts`) is **product code, not stub** and does not move
— only `user-stub.tsx`'s user *resolution* is replaced. `CapabilityOverrideProvider`
also survives (it is the wizard-frame lock, product behaviour). The auth swap
is narrower than "delete the auth layer" — it is "replace how the current user
is resolved." That makes the isolated-session approach even more attractive.

---

## §7 — The page builder data model needs its own pass

§3 gives a recommendation; it should **not** be treated as finalised here. The
page builder is the densest, most evolution-exposed corner of the schema, and
three of its decisions interact in ways that deserve a dedicated session before
any builder-specific migration is written:

1. **Section storage** — the §3.3 hybrid (normalised live `sections`,
   frozen-JSONB snapshots, JSONB `data`+`schema_version`). The normalise-vs-blob
   call for the *live* tree, and whether `data` should additionally carry a DB
   `CHECK` against a JSON schema, want a focused look.
2. **Schema evolution (§3.4 / `[JC-8a]`)** — `schema_version` + migration
   functions, run as an **eager bulk migration** at the deploy that ships a
   shape change. §3.4 settles the strategy and names its failure mode; the §7
   pass ratifies it and pins the deploy-time migration-script mechanics (the
   functions are TS in the registry — see §3.4's closing wrinkle).
3. **Image storage backend** — a **separate decision** (Supabase Storage vs S3
   vs Cloudinary). It does not touch any table (everything stores a URL) but it
   gates the media-section and brand-asset work, and has cost/CDN implications
   the schema pass shouldn't bury.
4. **Website-level singleton storage** — §1.4 proposes `websites.header_section_id`
   / `footer_section_id` FK columns, but the current `Website` model
   (`lib/website/types.ts`) has neither: header / footer are `Section` objects
   living *inside* `VersionSnapshot`. The §7 pass must decide where
   website-level singletons live — FK columns on `websites`, or inside the
   version snapshot — and reconcile §1.4 to it. Surfaced by the session-zero
   reconciliation pass.

**Recommendation:** after this document is approved and the *non-builder*
tables are migrated (Phase 1), run a dedicated **"page builder data model"**
session that ratifies §3, locks the evolution story, and decides image storage
— *before* the builder-family migrations (`websites`, `pages`, `sections`,
`website_versions`, `website_nav_links`, `funnels`, `funnel_steps`,
`funnel_versions`, `website_approval_submissions`, `funnel_approval_submissions`,
`force_publish_audit_log`) are written. **Phase 1 migrations exclude that
entire family.** The rest of the schema (identity, policy, operational
entities) does not depend on the §3 ratification and proceeds in Phase 1.

---

## §8 — Error-handling pattern

Parked since Phase 1 ("decide on first real use"). The backend pass forces it.
Proposed pattern — consistent, not elaborate:

- **A discriminated `Result<T>` at every data-access boundary.** Data functions
  return `{ ok: true, data } | { ok: false, error: AppError }` rather than
  throwing. Throwing is reserved for genuine programmer error (a failed
  invariant), not expected failures.
- **One `AppError` shape**, discriminated by `kind`:
  - `auth` — not signed in / session expired → front end routes to `/login`.
  - `forbidden` — signed in but RLS/capability rejected the action → the front
    end shows the existing `<CapabilityGate>` "request a change" affordance
    where one fits, else a toast. RLS rejections surface here.
  - `not_found` — row absent or invisible under RLS (the two are deliberately
    indistinguishable to the caller — RLS must not leak existence).
  - `validation` — input failed a schema/registry check → field-level messages.
    **Policy values** (`agency_policy`, `policy_overrides`, `plan_catalog.policy`
    — JSONB per `[JC-9]`) must pass a strict app-level validator against
    `PolicyValueMap` on **every read and write** — JSONB without app-level
    discipline rots. A policy value that fails the validator surfaces here as
    `kind: 'validation'`, never as a silent malformed read.
  - `conflict` — optimistic-concurrency clash (see below).
  - `unexpected` — anything else → generic toast + logged.
- **Optimistic-concurrency conflicts.** builder-design §3.1 is explicit:
  last-write-wins per field, no merge UI. Mechanism: editable rows
  (`sections`, `pages`, draft `*_versions`) carry `updated_at`; a write passes
  the `updated_at` it read; if the DB row moved, the write still applies
  (last-write-wins) but returns `kind: 'conflict'` carrying the other editor's
  identity, so the front end can raise the existing toast *"Mark also edited
  Headline · refreshed"*. The conflict is **reported, not blocked** — matching
  the design's stated concurrency model.
- **RLS rejections are not special-cased** — a policy failure surfaces as
  `forbidden` (mutation) or `not_found` (read), through the same `AppError`.

This pattern is documented here so it can be added to CLAUDE.md's "Code
conventions → Error handling" line (currently a `[decide on first real use]`
placeholder) once approved.

---

## §9 — What this design intentionally does not decide

Per the brief, the following are explicitly **out of scope** and no schema is
proposed for them:

- **The Proof Page tool** — the audit → proof-page → outreach prospecting
  pipeline. Deferred until the full platform is working (CLAUDE.md, setup
  checklist FINAL). No tables, no enums, no FKs anticipate it.
- **Real payment integration (Stripe etc.)** — billing is **policy-only**.
  `plan_catalog.price` and `job_completions.payment_method`/`amount_charged`
  are display/record metadata; no transactions, no payment-provider tables,
  no invoices-as-entities. V2.
- **Image storage backend** — Supabase Storage vs S3 vs Cloudinary. A separate
  decision (§7). The schema stores URLs only.
- **Real-time / live collaboration** — single-editor V1 with a soft presence
  indicator (builder-design §3.1). No presence/CRDT/cursor tables.
- **Multi-tenant template sharing** — section/page/funnel templates as shared
  marketplace artefacts. Architecture leaves room; no tables V1.
- **Internationalisation** — single-locale V1. No locale columns, no
  translation tables.
- **Section-registry V2 expansion** — the `section_type` enum is the current
  11; adding types is a deliberate future amendment.

**The agency-vs-sub-account modelling call (surfaced, not silently picked):**
The brief asks whether the agency is a `clients` row with a flag, a separate
`agencies` table, or something else. **Recommendation: "something else" — no
agency table in V1.** The agency (Webnua HQ, the operator org) is not a
data-layer entity; it is the set of `users` with `role='admin'`, and
`agency_policy` is a global singleton. Webnua's *own marketing account* —
should it ever become a managed sub-account — is simply a `clients` row, no
flag (this is exactly what the parked decision demands: drop-in with no
special-casing). The only thing a future **multi-agency / white-label** tier
needs is an `agencies` table that `clients`, `users`, and `agency_policy` then
FK to — a clean additive migration, not a V1 concern. Recorded as `[JC-1]`.

---

## §10 — Judgement calls — review status `[JC]`

All `[JC]`s below were reviewed and **signed off** (review round 2). Three were
*pushes* — re-argued before sign-off; the rest were confirmed as written. The
reasoning is kept so the decisions stay legible later.

- **`[JC-1]` Agency modelling — CONFIRMED.** No `agencies` table V1; agency =
  operators (`role='admin'`) + a global `agency_policy` singleton;
  Webnua-as-sub-account = a plain `clients` row, no flag. A multi-agency /
  white-label tier is a clean additive migration if it ever lands.
- **`[JC-2a]` `clients.industry` free text — CONFIRMED for V1.** The trades are
  open-ended; an `industry` enum is a V2 tightening.
- **`[JC-2b]` `client_lifecycle` superset — CONFIRMED.**
  `onboarding|live|paused|churned` over the stub's `active|setup` —
  `paused`/`churned` cost nothing now and have obvious near-term need.
- **`[JC-2c]` `customers` — RESOLVED: EXTRACT (push).** The original position
  (denormalise, defer the table to V2) was overturned in review. A real
  `customers` table lands in V1 (§2.3): small V1 cost, and it removes the V2
  identity-backfill problem entirely. Per-client scoped; display-snapshot
  convention (name + phone frozen, everything else live FK lookup);
  exact-phone-match dedup V1, fuzzy dedup V2.
- **`[JC-3]` Invite client-scoping as join tables — CONFIRMED.**
  `team_invite_clients` join + `user_client_access` on acceptance, over a JSONB
  FK-array (an anti-pattern).
- **`[JC-4]` `lead_events` ↔ `messages` — RESOLVED: COLLAPSE (push).** The
  original split (separate `messages` table, `message_id` FK) was overturned.
  Messages collapse into `lead_events`: an SMS is one event row; `kind` already
  encodes channel + direction; `payload` carries `{body,senderName,delivered}`.
  The collapse also drops three enums (`message_channel`, `message_direction`,
  `message_kind`) — a structure-earns-its-keep signal. `automation_id` becomes
  a real FK column; `is_automated` is derived and dropped.
- **`[JC-5]` `capability_grants.capabilities` enum array — CONFIRMED.**
  `capability[]` is 1:1 with the stub's `Capability[]`; a join table is heavier
  with no V1 benefit.
- **`[JC-6]` `brands` as a separate table — CONFIRMED.** Capability boundary
  (`editTheme`), cohesion, future brand-versioning cleanliness.
- **`[JC-7]` Read-state as join tables — CONFIRMED.** `notification_reads` +
  `lead_reads` — per-viewer correctness, future fan-out.
- **`[JC-8]` Section *storage* — CONFIRMED, pending §7 ratification.** Hybrid:
  normalised live `sections` rows, frozen-JSONB version snapshots, `data` as
  JSONB + `schema_version` either way (§3.3). The §7 page-builder pass ratifies
  before any builder migration is written.
- **`[JC-8a]` Section schema *evolution* — RESOLVED: EAGER BULK (push),
  pending §7 ratification.** Split out from `[JC-8]`. The prior asymmetric
  story (persist-on-live / migrate-on-read-only for snapshots) was overturned:
  migration runs **once, at the deploy that ships the shape change**, across
  live rows *and* snapshots; `schema_version` is a detection backstop, not a
  per-read mechanism. §3.4 carries the three-option comparison and the honest
  failure mode. §7 ratifies.
- **`[JC-9]` Policy values as JSONB keyed by `policy_key` — CONFIRMED, with a
  caveat.** JSONB keeps the 6 heterogeneous value types uniform. **Caveat
  accepted:** a strict app-level validator against `PolicyValueMap` runs on
  every policy read and write — surfaced as the `validation` error case in §8.
  JSONB without that discipline rots.
- **`[JC-10]` Auth timing — CONFIRMED.** Real Supabase Auth early (Phase 2,
  before data wiring). The §6 reasoning (one isolated swap seam; RLS is
  untestable against a stub; the tenant boundary is not retrofit polish) is
  decisive.
- **Open, not a `[JC]`:** the `sections` polymorphic-parent shape — two
  nullable FKs (`page_id`, `funnel_step_id`) + a website back-reference for
  singletons, with a `CHECK`, vs a `(container_kind, container_id)` pair.
  Proposed the nullable-FK form (real FKs, real cascade). Folded into the §7
  builder pass.

---

*End of document. This is a design pass — no migrations, no Supabase project.
Reviewed and signed off (round 2): §1, §2, §4, §5, §6, §8, §9, §10 are
approved; §3 + the page-builder data model (§7) hold pending the dedicated
page-builder follow-up pass, which ratifies §3 / `[JC-8]` / `[JC-8a]` and
decides image storage before any builder-family migration is written.*
