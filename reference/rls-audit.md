# RLS resource audit

> Comprehensive inventory of every RLS-protected resource in the Webnua
> Supabase schema, the policies on each, and the test-coverage status.
> Companion to `reference/rls-test-suite.md`.
>
> Produced by the A1 Phase-7/8 cross-tenant RLS validation pass. Re-run any
> time RLS shape changes; the harness's per-category coverage report is the
> live regression signal.

---

## 1. Helper functions (the gating spine)

Every tenant-scoped policy resolves through one of two `private` helpers; the
table-by-table summary below references them by name.

| Function | Returns | Behaviour |
|---|---|---|
| `private.accessible_client_ids()` | `setof uuid` | The set of client ids the current `auth.uid()` may reach. **Operator (admin)** → every client. **Junior operator** (admin + `team_role='junior'`) → only the clients in `user_client_access` for that user. **Client** (`role='client'`) → that user's own `client_id`. |
| `private.is_operator()` | `boolean` | `users.role = 'admin'` for the current `auth.uid()`. |
| `private.is_senior_operator()` | `boolean` | `is_operator() AND team_role <> 'junior'`. |
| `private.has_capability(website_id, cap)` | `boolean` | True if the current user's capability set (role defaults + grants) holds `cap` for the given website. A workspace-wide grant (`website_id IS NULL` in `capability_grants`) returns true for **any** website. **Not a tenant check** — capability-gated INSERT policies must AND a tenant clause; see the Hole-2/3 fixes in `rls-test-suite.md` §4. |

---

## 2. Tenant-scoped tables — `accessible_client_ids()` gating

Reads gated on `client_id in accessible_client_ids()`. Operators see every
tenant; clients see only their own.

| Table | Origin | SELECT | INSERT | UPDATE | DELETE | Test suite |
|---|---|---|---|---|---|---|
| `clients` | 0002 | acl | operator | operator (own writes) | none | `identity` |
| `users` | 0002 | acl | (handle_new_user) | own + trigger-guarded¹ | none | `identity` |
| `brands` | 0024 | acl | operator | `editTheme` cap | operator | `identity` |
| `capability_grants` | 0002 | own user | operator | operator | operator | `identity` |
| `user_client_access` | 0002 | operator | operator | operator | operator | `identity` |
| `team_invites` | 0002 | operator | operator | operator | operator | `agency` |
| `team_invite_clients` | 0002 | operator | operator | operator | operator | `agency` |
| `client_user_invites` | 0002 | acl | acl | acl | acl | `agency` |
| `seat_limit_changes` | 0002 | acl | operator | operator | none | `agency` |
| `plan_assignments` | 0002 | acl | operator | operator | operator | `agency` |
| `policy_overrides` | 0002 | acl | operator | operator | operator | `agency` |
| `customers` | 0007 | acl | acl | acl | acl | `operational` |
| `leads` | 0007 | acl | acl² | acl | acl | `operational` |
| `lead_events` | 0007 | parent FK | parent FK | parent FK | parent FK | `operational` |
| `lead_reads` | 0007 | own `user_id` | own `user_id` | n/a | own `user_id` | `operational` |
| `bookings` | 0008 | acl | acl | acl | acl | `operational` |
| `recurring_booking_schedules` | 0008 | acl | acl | acl | acl | `operational` |
| `job_completions` | 0008 | parent FK | parent FK | parent FK | parent FK | `operational` |
| `tickets` | 0009 | acl | acl | acl | acl | `operational` |
| `ticket_messages` | 0009 | parent FK + draft-gated³ | parent FK | parent FK | parent FK | `operational` |
| `reviews` | 0010 | acl | acl | acl | acl | `operational` |
| `campaigns` | 0010 | acl | acl | acl | acl | `operational` |
| `campaign_activity_events` | 0010 | parent FK | parent FK | parent FK | parent FK | `operational` |
| `automations` | 0010/0076 | acl | operator | operator | operator | `operational` |
| `automation_actions` | 0076 | parent FK | operator | operator | operator | `operational` |
| `automation_runs` | 0076 | acl SELECT | service-role only | service-role only | service-role only | `automation-engine` |
| `notifications` | 0011 | own `recipient_user_id`⁴ | operator | n/a | own | `isolation` |
| `notification_reads` | 0011 | own `user_id` | own `user_id` | n/a | own | `isolation` |
| `generation_log` | 0011 | operator | operator | n/a | none | `builder` |
| `websites` | 0013 | acl | operator | operator | operator | `builder` |
| `website_versions` | 0013 | parent FK | parent FK + capability + tenant⁵ | service-role only | service-role only | `builder` |
| `funnels` | 0014 | acl | operator | operator | operator | `builder` |
| `funnel_versions` | 0014 | parent FK | parent FK + capability + tenant | service-role only | service-role only | `builder` |
| `content_drafts` | 0015 | parent FK | parent FK + own `updated_by` | parent FK + own | parent FK + own | `builder` |
| `website_approval_submissions` | 0015 | parent FK | parent FK + capability + tenant⁵ | operator | operator | `builder` |
| `funnel_approval_submissions` | 0015 | parent FK | parent FK + capability + tenant | operator | operator | `builder` |
| `force_publish_audit_log` | 0015 | operator + parent FK | `is_operator() AND actor_user_id = auth.uid()`⁶ | none | none | `builder` |
| `analytics_events` | 0035 | acl | revoked | revoked | revoked | `isolation` |
| `analytics_funnel_daily` | 0035 | acl | revoked | revoked | revoked | `isolation` |
| `analytics_page_daily` | 0035 | acl | revoked | revoked | revoked | `isolation` |
| `sms_messages` | 0059 | acl | service-role only | service-role only | service-role only | `integrations` |
| `sms_templates` | 0060 | acl | service-role only | service-role only | service-role only | `integrations` |
| `email_messages` | 0061 | acl | service-role only | service-role only | service-role only | `integrations` |
| `email_templates` | 0062 | acl | service-role only | service-role only | service-role only | `integrations` |
| `notification_preferences` | 0063 | acl | service-role only | service-role only | service-role only | `integrations` |
| `client_gbp_locations` | 0066 | acl | service-role only | service-role only | service-role only | `integrations` |
| `gbp_reviews` | 0067 | acl | service-role only | service-role only | service-role only | `integrations` |
| `gbp_review_requests` | 0068 | acl | service-role only | service-role only | service-role only | `integrations` |
| `client_meta_ad_accounts` | 0070 | acl | service-role only | service-role only | service-role only | `integrations` |
| `meta_lead_forms` | 0071 | acl | service-role only | service-role only | service-role only | `integrations` |
| `meta_campaigns` | 0072 | acl | service-role only | service-role only | service-role only | `integrations` |
| `meta_ads_insights` | 0073 | acl | service-role only | service-role only | service-role only | `integrations` |

¹ `users_update` lets a user edit their own row, but a `BEFORE UPDATE` trigger
  (`private.guard_user_identity_columns`, migration `0045`) makes
  `role` / `client_id` / `team_role` immutable to non-operators — the only way
  to close the SQL-side privilege-escalation hole.

² `leads_insert` is open to `anon` (revoked from `authenticated`-only via 0007)
  for public form submission. Server route validates `client_id` + sanitises.

³ `ticket_messages_select` hides operator drafts (`is_draft=true`) from
  client viewers (migration `0020`).

⁴ Even an operator sees only their own notifications — `notifications` is
  strictly per-recipient.

⁵ `*_versions_insert` and `*_approval_submissions_insert` historically gated
  only on `has_capability()` — see Hole 2/3 in `rls-test-suite.md` §4. Now
  ANDs `EXISTS (… AND client_id in acl)`.

⁶ `force_publish_audit_log_insert` has **no website/tenant check** — a junior
  operator could in theory write an audit row for a website outside their
  workspace scope. Operator-internal, low severity; flagged as a structural
  gap, not a cross-tenant client-data exposure. See §4.

---

## 3. Operator-only tables — `is_operator() AND acl` gating

A client cannot see these even within their own tenant. The
`accessible_client_ids()` clause still applies so a junior operator only
sees rows for their workspace clients.

| Table | Origin | SELECT | Writes | Why operator-only | Test suite |
|---|---|---|---|---|---|
| `agency_policy` | 0002 | operator | operator | HQ-wide policy bundle — clients are subject to it, not party to it | `agency` |
| `plan_catalog` | 0002 | operator | operator | The billing-plan catalog the agency sells | `agency` |
| `integration_call_log` | 0047 | operator + acl | service-role only | Audit log of every external call; contains redacted but operator-sensitive bodies | `integrations` |
| `client_sms_senders` | 0050 | operator + acl | service-role only | Assignment of Twilio alphanumeric senders (Webnua-owned Twilio account; clients don't need to see) | `integrations` |
| `client_email_senders` | 0051 | operator + acl | service-role only | Per-client Resend sender slug (Webnua-owned domain) | `integrations` |
| `client_stripe_customers` | 0052 | operator + acl | service-role only | Stripe customer + subscription posture — clients see billing via the Stripe Customer Portal, not this row | `integrations` |
| `notifications_outbound` | 0053 | operator + acl | service-role only | Operator-notification email audit + throttle log | `integrations` |
| `integration_connections` | 0055 | operator + acl | service-role only | **Per-tenant OAuth tokens.** Cached access tokens are plaintext; persistent refresh tokens live in Vault. Clients must not see this row at all. | `integrations` |
| `platform_email_templates` | 0079 | operator | operator UPDATE; INSERT/DELETE service-role | Platform-level notification templates (one body for all clients) | `agency` |

---

## 4. Service-role-only tables (no `authenticated` policy)

Privileges revoked outright from the `authenticated` role; only `service_role`
can touch them. A client SELECT returns a permission error (`42501`).

| Table | Origin | Why | Test suite |
|---|---|---|---|
| `integration_jobs` | 0048 | The async-work queue. Job payloads include lead ids, customer phone numbers, etc. — operator infrastructure, not a user-facing concept. | `integrations` |

---

## 5. Per-viewer tables (gated on `auth.uid()`)

| Table | Visibility | Test suite |
|---|---|---|
| `notifications` | `recipient_user_id = auth.uid()` — even operators see only their own | `isolation` |
| `notification_reads` | `user_id = auth.uid()` — strictly the viewer's read-state | `isolation` |
| `lead_reads` | `user_id = auth.uid()` — strictly the viewer's read-state | `operational` |

---

## 6. Vault wrappers (`public.webnua_vault_*`)

Migration `0054` defines four `SECURITY DEFINER` SQL wrappers that bridge to
`vault.secrets` (the `vault` schema is not PostgREST-reachable directly). All
four explicitly `revoke all … from public, anon, authenticated` and `grant
execute … to service_role` only. A client / operator calling `select
public.webnua_vault_read_secret(uuid)` via PostgREST receives a permission
error.

| Function | Purpose |
|---|---|
| `webnua_vault_create_secret(text, text)` | mint a secret, return the uuid |
| `webnua_vault_read_secret(uuid)` | decrypt + return |
| `webnua_vault_update_secret(uuid, text)` | re-encrypt in place |
| `webnua_vault_delete_secret(uuid)` | drop |

**Cross-client OAuth token isolation** flows from two layers: (a)
`integration_connections.token_secret_id` is opaque to anyone without
operator role (RLS, §3), and (b) even if leaked, decrypting it requires a
`service_role` JWT (the wrappers reject every other role). Tested in the
`integrations` suite.

---

## 7. Storage buckets (`storage.objects`)

| Bucket | Origin | Read | Write | Test suite |
|---|---|---|---|---|
| `section-media` | 0027 | public (anon allowed) | `authenticated` | `anonymous` (positive) + `storage` (positive) |
| `lead-attachments` | 0031 | `{clientId}/` prefix in `acl` | `{clientId}/` prefix in `acl` | `storage` |
| `email-attachments` | 0064 | `{clientSlug}/` prefix maps to `acl` | service-role only | `storage` |

---

## 8. Categorical findings (from this audit pass)

### 8.1 — Documentation drift in CLAUDE.md (no security impact)

CLAUDE.md describes `notification_preferences` as "operator-only RLS". The
actual policy in migration `0063` is `client_id in accessible_client_ids()` —
the same shape as other tenant-scoped reads. Clients **can** SELECT their own
notification preferences (and they should be able to — those preferences
configure which operator emails fire on the client's behalf); they cannot
write (writes are service-role only). The CLAUDE.md inventory line should
read "tenant-scoped SELECT for `accessible_client_ids()`; writes service-role
only" to match. **No fix needed in code or policy** — just a doc update next
time the inventory is touched.

### 8.2 — Structural gaps flagged for a future session (not closed here)

The two structural gaps the **previous** A1 pass flagged remain open. They
are intentionally **NOT** addressed in this Phase-7/8 extension — both predate
this session and broadening the scope risks unrelated regressions.

1. **`force_publish_audit_log_insert`** still gates only on `is_operator()
   AND actor_user_id = auth.uid()` — a junior operator could insert an audit
   row for a website outside their workspace. Operator-internal, low severity
   (the SELECT side IS tenant-checked). Fix would be a `WITH CHECK` clause
   adding `website_id IN (select private.accessible_client_ids())` joined
   through `websites`.
2. **`signup_submissions`** exists in the live database with RLS policies
   but has **no migration in `supabase/migrations/`**. The policies are safe
   (operator-only, no anon read) but the table should be captured in a
   migration for parity. The harness still negative-tests it (`anonymous`
   suite includes it in the anon-deny baseline).

### 8.3 — Phase-7/8 tables: structurally no new holes

Every Phase-7+ table the audit covered follows one of two safe patterns:

1. **Tenant-scoped via `acl`** — SELECT uses
   `client_id in (select private.accessible_client_ids())`; INSERT / UPDATE /
   DELETE are `revoke …, …, … from authenticated` (no policy for those
   commands). The revoke is doubly safe — RLS only applies when the
   table-level privilege is granted; revoking the privilege hard-stops the
   command before RLS is consulted. The 0045-class hole (capability-based
   INSERT without an AND-tenant clause) **cannot** recur on these tables
   because they don't have a capability-gated INSERT path at all.
2. **Operator-only via `is_operator() AND acl`** — same write story as (1);
   the SELECT additionally requires the admin role. Clients see nothing.

The `integration_jobs` table goes further (`revoke all … from
authenticated` — no SELECT either); only the service-role client can read
or write it. The harness negative-tests this.

### 8.4 — Recommendation: keep the audit + tests in lockstep with migrations

The CLAUDE.md "parked decisions" section already carries the rule:
**any PR that adds or changes an RLS-protected resource MUST add or update
the corresponding tests in `tests/rls/` in the same PR.** The audit table in
§2 / §3 above is the cross-check: each row maps a (table, policy) pair to a
test suite. If a new migration adds a row, the suite column must be
populated in the same PR.

A future hardening pass could add a CI check that greps migrations for
`create policy` directives and fails the build when a new policy lacks a
matching `meta` entry in `tests/rls/suites/*.mjs`. Out of scope here.
