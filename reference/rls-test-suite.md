# RLS cross-tenant test suite

A negative-test harness that systematically probes every Row-Level-Security
boundary in the Webnua Supabase schema for cross-tenant exposure. It signs in
as real Supabase Auth users and exercises RLS exactly as the browser does.

- **Code:** `tests/rls/`
- **Run:** `pnpm test:rls` (or `npm run test:rls`)
- **Created by:** the Section-A cross-tenant RLS validation pass. See the
  *Findings* section for the holes it caught on first run.

---

## 1. Running the suite

```bash
pnpm test:rls
```

The harness reads the same connection vars the app uses. Put them in
`.env.local` (git-ignored) or the environment:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | no | enables the service-role-bypass tests and the ephemeral junior-operator fixture; those tests `SKIP` without it |
| `RLS_TEST_PASSWORD` | no | shared test-user password (default `webnua-dev-2026`) |

**Network:** the harness must be able to reach the Supabase project over
HTTPS. It cannot run from a sandbox whose egress allow-list excludes the
project host — run it locally, in CI, or anywhere with normal outbound
access.

**Test users** (seeded in the project, password `webnua-dev-2026`):

| User | Role | Tenant |
|---|---|---|
| `craig@webnua.com` | operator (admin / owner) | — (agency) |
| `mark@voltline.com.au` | client | Voltline |
| `liam@voltline.com.au` | client | Voltline (2nd seat) |
| `anna@freshhome.com.au` | client | FreshHome |

The harness exits non-zero if any scenario fails, and prints a per-category
coverage summary (positive vs negative assertion counts).

---

## 2. How the harness works

- **One client per identity.** A separate `supabase-js` client for anon, each
  test user, and (optionally) the service-role and an ephemeral junior
  operator.
- **Disposable fixtures.** Before the suites run, the operator seeds one
  throwaway row in *every* tenant-scoped table, for *two* tenants (Voltline +
  FreshHome). Tests target only these rows — a cross-tenant write that slips
  through can therefore only ever touch a throwaway row, never seed data.
  Everything is torn down at the end.
- **State, not error codes.** Supabase RLS denies a `SELECT` by returning
  **zero rows**, not an error. And a blocked write can still *look* like an
  error while the row was in fact written — an `INSERT` whose `WITH CHECK`
  passes but whose `RETURNING` row fails the `SELECT` policy raises `42501`
  even though the row persisted (see migration `0028`). So every write
  assertion **verifies the actual persisted state** through an
  operator/service-role verifier client rather than trusting the attacker's
  error. Probe rows carry harness-generated ids so persistence is checked by
  primary key.

### Test categories

The six categories the brief names, plus the unauthenticated baseline:

| Category | What it checks |
|---|---|
| `own` | **Positive** — an actor reaching a resource it legitimately owns/manages works. |
| `tenant` | **Negative** — a client reaching *another tenant's* resource is blocked (read, insert, update, delete). The core of the suite. |
| `agency` | Cross-agency isolation. **N/A** on the current single-agency deployment — there is no second agency. The operative boundaries are `tenant` (client isolation) and `workspace` (junior-operator scoping). The category is kept so the structure is ready if multi-agency lands. |
| `workspace` | A junior operator sees only the clients in `user_client_access`. Needs `SUPABASE_SERVICE_ROLE_KEY` to mint the junior fixture; `SKIP`s without it. |
| `capability` | A capability-gated or operator-only path attempted *without* the capability/role — including the privilege-escalation probes. |
| `service` | Service-role intentionally bypasses RLS. Needs `SUPABASE_SERVICE_ROLE_KEY`; `SKIP`s without it. |
| `anon` | An unauthenticated client is denied everywhere (the one exception: the intentionally-public `section-media` storage bucket). |

---

## 3. RLS-protected resource inventory

Every table below has RLS enabled. Policies target the `authenticated` role
(`anon` matches none and is denied; `service_role` bypasses RLS). Tenant
scoping resolves through `private.accessible_client_ids()` — operator → all
clients; junior operator → their `user_client_access` set; client → their own
client.

**Identity & policy** — `clients`, `users`, `brands`, `capability_grants`,
`user_client_access`, `team_invites`, `team_invite_clients`,
`client_user_invites`, `seat_limit_changes`, `agency_policy`, `plan_catalog`,
`plan_assignments`, `policy_overrides`, `signup_submissions`.

**Operational** — `customers`, `leads`, `lead_events`, `lead_reads`,
`bookings`, `recurring_booking_schedules`, `job_completions`, `reviews`,
`campaigns`, `campaign_activity_events`, `automations`, `automation_steps`,
`tickets`, `ticket_messages`, `notifications`, `notification_reads`,
`generation_log`.

**Builder** — `websites`, `website_versions`, `funnels`, `funnel_versions`,
`content_drafts`, `website_approval_submissions`,
`funnel_approval_submissions`, `force_publish_audit_log`.

**Analytics** — `analytics_events`, `analytics_funnel_daily`,
`analytics_page_daily` (SELECT-only for `authenticated`; writes revoked).

**Storage** (`storage.objects`) — `section-media` (public read; authenticated
write), `lead-attachments` (tenant-private, path-prefixed by client id).

Policy shapes worth knowing:

- Directly client-scoped tables gate every command on
  `client_id in accessible_client_ids()`.
- Child tables (`lead_events`, `ticket_messages`, `automation_steps`,
  `campaign_activity_events`, `job_completions`, `website_versions`,
  `funnel_versions`, `content_drafts`, the approval tables) resolve the tenant
  through a parent FK.
- Per-viewer tables (`lead_reads`, `notification_reads`, `notifications`) gate
  strictly on `user_id = auth.uid()` — even operators see only their own.
- Operator-only tables (`team_invites`, `agency_policy`, `generation_log`, the
  audit log) gate reads/writes on `is_operator()` / `is_senior_operator()`.
- Builder version/approval inserts are *capability*-gated via
  `private.has_capability()`.

---

## 4. Findings — the holes caught on first run

The pass found **three** cross-tenant holes. All three are closed by migration
`0045_rls_cross_tenant_fixes.sql`; the harness's negative tests for them are
now permanent regression guards.

### Hole 1 — `users`: a client could escalate its own role / switch tenant

`users_update` (migration `0004`) lets a user update their own row but its
`WITH CHECK` only re-asserts ownership — it does not constrain *which* columns
change. A client could run `update public.users set role='admin',
client_id=null, team_role='owner' where id = auth.uid()`, satisfying the
policy and the `users_role_shape` CHECK, and become a full operator
(`is_operator()` then reads `role='admin'`). The same self-update could move
`client_id` to another tenant. **Verified live before the fix.**

**Fix:** a `BEFORE UPDATE` trigger (`private.guard_user_identity_columns`).
RLS `WITH CHECK` cannot compare OLD vs NEW; a trigger can. Non-operators may
still edit their own display name / avatar, but `role`, `client_id` and
`team_role` are immutable to them.

### Hole 2 — `website_versions`: cross-tenant write via a workspace-wide grant

`website_versions_insert` gated `INSERT` solely on
`has_capability(website_id, …)`. `has_capability()` returns true for a
workspace-wide (`website_id IS NULL`) capability grant on *any* website — it
is a capability check, not a tenant check. A client holding a workspace-wide
`editSections` grant could `INSERT` a version row for another client's
website. **Verified live before the fix.**

**Fix:** the `WITH CHECK` now ANDs a tenant-membership `EXISTS` clause onto the
capability check.

### Hole 3 — `website_approval_submissions`: the same gap

`website_approval_submissions_insert` gated on
`submitter_id = auth.uid() AND has_capability(website_id, 'editSections')` —
again no tenant check. **Verified live before the fix.** Fixed with the same
tenant-membership AND-clause.

The funnel-side equivalents (`funnel_versions_insert`,
`funnel_approval_submissions_insert`) were authored *with* the tenant `EXISTS`
check already and were not affected.

### Structural notes (not fixed — flagged for a future session)

- **`force_publish_audit_log_insert`** gates on `is_operator() AND
  actor_user_id = auth.uid()` with no website/tenant check. A *junior*
  operator could insert an audit row for a website outside their
  `user_client_access` scope. Operator-internal and low-severity (the SELECT
  side *is* tenant-checked); left for a future tightening rather than widened
  here.
- **`signup_submissions`** exists in the database with RLS policies but has
  **no migration in `supabase/migrations/`** — migration drift. Its policies
  are safe (operator-only, no anon read) but the table should be captured in
  a migration.

---

## 5. Adding tests for a new RLS-protected resource

When a PR adds a table with RLS, add its tests in the same PR (see the parked
decision in `CLAUDE.md`). The mechanical path:

1. **Seed a disposable row.** In `tests/rls/lib/context.mjs`, add the table to
   `seedTenant()` (a row per tenant) and to `TEARDOWN_ORDER` (FK-safe
   position).
2. **Pick the builder.**
   - Directly client-scoped (`client_id` column) → `clientScoped()` in the
     relevant suite. It emits own-read, cross-read, own-insert, cross-insert,
     cross-update, cross-delete.
   - Child table (tenant via a parent FK) → `childCrossTenant()`. It emits
     own-read, cross-read, cross-insert.
   - Operator-only / per-viewer / capability-gated → write explicit tests in
     the suite (see `agency.mjs` / `isolation.mjs` / `builder.mjs` for
     patterns).
3. **Tag every test** with `{ table, policy, category, kind, scenario }`.
   `category` is one of the seven above; `kind` is `'positive'` or
   `'negative'`. Each category should carry at least one of each.
4. **Verify state, never the error.** Use `expectAbsent` / `expectPresent` /
   `expectUnchanged` / `expectStillExists` (they re-check through a verifier
   client) — not just `expectWriteRejected`.
5. Run `pnpm test:rls` and confirm green.

### File map

| File | Responsibility |
|---|---|
| `tests/rls/run.mjs` | entry point |
| `tests/rls/lib/env.mjs` | env loading |
| `tests/rls/lib/harness.mjs` | runner, assertions, reporter |
| `tests/rls/lib/context.mjs` | clients, fixture seeding, teardown |
| `tests/rls/lib/scenarios.mjs` | `clientScoped` / `childCrossTenant` builders |
| `tests/rls/suites/anonymous.mjs` | unauthenticated baseline |
| `tests/rls/suites/identity.mjs` | clients, users, brands, grants, access |
| `tests/rls/suites/agency.mjs` | agency policy + billing + invites |
| `tests/rls/suites/operational.mjs` | leads / bookings / tickets / reviews / … |
| `tests/rls/suites/builder.mjs` | websites / funnels / versions / approvals |
| `tests/rls/suites/isolation.mjs` | per-viewer, analytics, workspace/service/agency |
