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
`[JC-8]` covers the polymorphic-parent shape (two nullable FKs + a website
back-reference vs a `(container_kind, container_id)` pair).

#### `website_versions`
```
website_versions
  id                uuid PK
  website_id        uuid not null FK→websites(id)
  status            version_status not null    -- 'draft'|'pending_approval'|'published'|'archived'
  snapshot          jsonb not null             -- frozen { pages, sections, header, footer, nav, pageOrder, brand }
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

#### `leads`
```
leads
  id                  uuid PK
  client_id           uuid not null FK→clients(id)
  name                text not null
  phone               text null
  email               text null
  suburb              text null
  status              lead_status not null default 'new'   -- new|contacted|booked|completed|lost
  urgency             lead_urgency not null default 'none' -- asap|today|soon|none
  source              text null
  assigned_operator_id uuid null FK→users(id)
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
```
Provenance: `lib/leads/types.ts` (`ClientLeadRow`/`AdminLeadRow`/`LeadDetail`
are projections — see §5). `unread`/`age`/`preview`/`meta` are **not columns**
(per-viewer or computed — §5).

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
  actor_user_id   uuid null FK→users(id)     -- null = customer / system
  is_automated    boolean not null default false
  message_id      uuid null FK→messages(id)  -- set when the event IS a message
  payload         jsonb not null default '{}' -- form fields {label,value}[], status {from,to}, etc.
  created_at      timestamptz not null default now()
```
Provenance: `lib/leads/types.ts → LeadTimelineEvent` — **needs restructure**
(the stub packs channel/direction/phone/time as JSX `meta`; here it is typed
columns + `payload`). `[JC-4]` covers the `lead_events` ↔ `messages` boundary.

#### `messages`
The conversation thread — the subset of activity that is actual messages.
```
messages
  id            uuid PK
  lead_id       uuid not null FK→leads(id)
  channel       message_channel not null    -- 'sms' | 'email' | 'form'
  direction     message_direction not null  -- 'inbound' | 'outbound'
  kind          message_kind not null       -- 'incoming'|'outgoing'|'auto'|'system'
  body          text not null               -- verbatim content
  sender_name   text null
  sent_at       timestamptz not null
  delivered     boolean not null default false
  is_automated  boolean not null default false
  automation_id uuid null FK→automations(id)
  created_at    timestamptz not null default now()
```
Provenance: `lib/leads/types.ts → ConversationMessage`. `body` is verbatim
input (acceptable as `text`); `metaPrefix`/`time` ReactNode fields drop.

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
  author_name   text not null
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
`message_channel`(3), `message_direction`(2), `message_kind`(4),
`booking_status`(4), `recurrence_frequency`(4), `payment_method`(4),
`ticket_category`(7), `ticket_status`(4), `ticket_urgency`(3),
`ticket_awaiting`(2 + null), `approval_status`(4),
`campaign_status`(3), `campaign_activity_category`(4),
`automation_channel`(2), `delay_unit`(3),
`notification_kind`(5), `generation_fallback_reason`(2).

All map directly to inventory unions. CLAUDE.md's rule holds: widening any of
these is a deliberate amendment, not an ad-hoc add.

---

## §2 — The two entities that require invention

Most tables above satisfy an A-tier stub. Two do not — `clients` and the
booking family. These get the most design space and the most uncertainty.

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
- **`customers` is deliberately not introduced.** A lead, a booking customer,
  and a review author are all "a person who deals with this client," and a
  normalised `customers` table is the tidy long-term shape — but no stub models
  it, and three surfaces denormalise the person's name/phone inline. V1
  denormalises (lead carries contact fields; booking carries a customer
  snapshot). `[JC-2c]` flags the `customers`-table normalisation as a V2 call.

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
  customer_name        text not null                 -- denormalised snapshot (see §2.1 — no customers table V1)
  customer_phone       text null
  customer_suburb      text null
  address              text null
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
  customer_name   text not null
  customer_phone  text null
  customer_suburb text null
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
`data` payload either way.

### 3.4 Section-registry schema evolution (builder-design §10)

The flagged sharp edge: when `HeroData` changes shape in V2 (rename
`headline`→`title`, split `cta`→`ctaPrimary`+`ctaSecondary`, …), what happens
to (a) live `sections.data` rows on the old shape, (b) frozen `snapshot` blobs?

**Proposed story — `schema_version` + per-type migration functions, applied
asymmetrically:**

- Each section type carries a current `schema_version` in the registry plus an
  ordered list of **migration functions** (`vN → vN+1`), pure transforms over
  `data`. This is the front-end registry's job to own — it already owns
  `defaultData()` and validation.
- **Live `sections` rows — migrate-and-persist (lazy).** On read, if
  `sections.schema_version < registry current`, run the chain, persist the
  upgraded `data` + bumped `schema_version`. The live tree converges to current
  over normal use; a one-off backfill migration can force it.
- **Frozen `snapshot` blobs — migrate-on-read only, never rewrite.** An
  archived version is a historical record; rewriting it would corrupt the audit
  trail and the rollback guarantee. When a snapshot is *read* (rollback,
  diff, display), each section's `data` is run through the migration chain
  **in memory** to today's shape. The stored blob is never touched.
- The "shadow registry" alternative (keep every old shape's reader forever) is
  rejected as the default — it grows unbounded and every consumer must know
  which shape it's looking at. Migration functions collapse to one current
  shape at the read boundary; that is simpler everywhere downstream.

**This §3.4 story is the part I am least certain of and most want reviewed**
(`[JC-8]`). It interacts with: how migrations are versioned alongside DB
migrations, whether a snapshot read can afford an in-memory migration pass on a
large page tree, and whether `data`-level validation should also live in the DB
as a `CHECK` against a JSON schema. The §7 follow-up pass should settle it
before builder migrations are written.

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
one-liner.

### 4.2 The simple cases (tenant isolation)

Every client-scoped table (`leads`, `lead_events`, `messages`, `bookings`,
`recurring_booking_schedules`, `job_completions`, `tickets`, `ticket_messages`,
`reviews`, `campaigns`, `campaign_activity_events`, `automations`,
`automation_steps`, `notifications`, `clients`, `brands`):

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
| 2 | `LeadTimelineEvent.meta`/`body`/`snippet` — JSX packing channel/direction/phone/time + composed sentences | **Stub bends.** `lead_events` stores typed columns + `payload` jsonb; the timeline component composes the meta line and body sentence at render. Form Q&A pairs go in `payload` as `{label,value}[]`. |
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
message/ticket-message `body`, `bookings.notes`, `reviews.body`, invite
`personal_note`, `automation_steps` `name`/`subject`/`body`-template,
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
2. **Schema evolution (§3.4)** — `schema_version` + migration functions, applied
   asymmetrically (persist on live, migrate-on-read for snapshots). This is the
   builder-design §10 sharp edge handed explicitly to the backend pass; it is
   genuinely hard and under-specified above.
3. **Image storage backend** — a **separate decision** (Supabase Storage vs S3
   vs Cloudinary). It does not touch any table (everything stores a URL) but it
   gates the media-section and brand-asset work, and has cost/CDN implications
   the schema pass shouldn't bury.

**Recommendation:** after this document is approved and the *non-builder*
tables are migrated (Phase 1), run a dedicated **"page builder data model"**
session that ratifies §3, locks the evolution story, and decides image storage
— *before* the `websites`/`pages`/`sections`/`*_versions` migrations are
written. The rest of the schema (identity, policy, operational entities) does
not depend on that ratification and can proceed.

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

## §10 — Open questions for review `[JC]`

Judgement calls made above that I want confirmed rather than treated as locked.

- **`[JC-1]` Agency modelling.** §9: no `agencies` table V1; agency = operators
  + a global `agency_policy` singleton; Webnua-as-sub-account = a plain
  `clients` row. Confirm this over a single-row `agencies` table now.
- **`[JC-2a]` `clients.industry` — free text vs enum.** Proposed free text V1
  (the trades are open-ended). An enum is a V2 tightening. Confirm.
- **`[JC-2b]` `client_lifecycle` values.** Proposed superset
  `onboarding|live|paused|churned` over the stub's `active|setup`. Confirm the
  two extra states are wanted now.
- **`[JC-2c]` No `customers` table V1.** Customer identity is denormalised onto
  `leads` and `bookings` (name/phone/suburb snapshots). A normalised
  `customers` table is the obvious V2 shape once "same person, repeat
  business" reporting is needed. Confirm V1 denormalisation.
- **`[JC-3]` Invite client-scoping as join tables.** `team_invites` →
  `team_invite_clients` join; accepted invites → `user_client_access`. Confirm
  over a JSONB `assigned_client_ids` array on the invite.
- **`[JC-4]` `lead_events` ↔ `messages` boundary.** Proposed: `messages` is its
  own table (real content); `lead_events` is the typed activity log, and a
  message-kind event carries a `message_id` FK. Alternative: fold messages into
  `lead_events.payload`. The split keeps the timeline a clean typed-event log
  (vision §7) — but it does mean an SMS is represented in two rows. Confirm the
  split. **Load-bearing.**
- **`[JC-5]` `capability_grants.capabilities` as an enum array.** Proposed
  `capability[]` column over a `capability_grant_caps` join table. Array is 1:1
  with the stub's `Capability[]`; join is more "normalised." Confirm array.
- **`[JC-6]` `brands` as a separate table** (1:1 with `clients`) vs brand
  columns inlined on `clients`. Proposed separate table (capability boundary,
  cohesion). Confirm.
- **`[JC-7]` Read-state as join tables** (`notification_reads`, `lead_reads`)
  vs a boolean column. Proposed joins (per-viewer, future fan-out). Confirm.
- **`[JC-8]` Section storage + evolution (§3) — LOAD-BEARING.** The hybrid
  (normalised live `sections`, frozen-JSONB snapshots, `data` JSONB +
  `schema_version`, asymmetric migration: persist-on-live / migrate-on-read for
  snapshots). This is the §7 follow-up's core agenda — flagging that §3 is a
  *recommendation pending that pass*, not a lock.
- **`[JC-9]` Policy values as JSONB keyed by `policy_key`** (`agency_policy`,
  `policy_overrides`, `plan_catalog.policy`) vs a typed column per key. JSONB
  keeps the 6 heterogeneous value types uniform and mirrors the stub stores;
  typed columns would give DB-level type safety on 6 keys. Confirm JSONB.
- **`[JC-10]` Auth timing (§6).** Recommendation: real auth early (Phase 2),
  before data wiring. Stated as the user's lean; confirming it is the user's
  call — flagged so it is an explicit sign-off, not an assumption.
- **Open, not a `[JC]`:** the `sections` polymorphic-parent shape — two
  nullable FKs (`page_id`, `funnel_step_id`) + a website back-reference for
  singletons, with a `CHECK`, vs a `(container_kind, container_id)` pair.
  Proposed the nullable-FK form (real FKs, real cascade). Folded into the §7
  builder pass.

---

*End of document. This is a design pass — no migrations, no Supabase project.
Sections §1–§4 are the substance to push back on; §3 + the page-builder data
model (§7) are flagged as the parts most warranting a dedicated follow-up
before builder migrations are written. Awaiting review before commit.*
