# Webnua — Phase 2: real authentication

> **Status:** handoff spec for the next session. No code in this doc — it is the
> brief. The work it describes is the **"Phase 2 (real auth)"** that
> `backend-schema-design.md` §6 / `[JC-10]` specified and the build skipped.
> Read this in full, then read `backend-schema-design.md` §6 and the CLAUDE.md
> parked-decision "Auth sequencing — data was wired before real auth" before
> starting.

---

## 1. The problem — confirmed in production

The deployed app returns **`401 permission denied for table …`** on every
Supabase query (`clients`, `users`, `agency_policy`, `plan_catalog`, every
table). The whole data layer is dead deployed.

This was diagnosed directly against the live project (`ynfnjskylwlbmgyeeiot`,
"webnua"):

- **All 31 migrations are applied.** Not a migration problem.
- **Table grants are correct:** the `authenticated` role has `SELECT` /
  `INSERT` / `UPDATE` / `DELETE`; the `anon` role does **not**. This is the
  intended security model — anonymous users must not read tenant data.
- **The app has no login.** It runs on the localStorage dev stub
  (`src/lib/auth/user-stub.tsx`), so the browser's Supabase client carries **no
  session** and every request hits the database as the **`anon`** role — which
  the grants correctly refuse.

So: nothing is broken. The database is doing its job. The app simply never
authenticates anyone. **The fix is to wire real Supabase Auth.** Do **not**
grant `anon` access — that would expose every client's data publicly.

## 2. Current state — what exists vs what's missing

**Already in place (the DB side is largely done):**
- 4 real users in `auth.users`, and 4 matching rows in `public.users` —
  the `handle_new_user` trigger (migration `0017`) is live and provisioned them.
- The trigger reads signup metadata: `display_name`, `role` (`user_role`),
  `client_id` (uuid, null for operators), `team_role` (`team_role`, null for
  clients). The `users_role_shape` CHECK enforces: a client has `client_id` +
  null `team_role`; an operator has `team_role` + null `client_id`.
- RLS policies + helper functions (`is_operator()`, `current_client_id()`,
  `accessible_client_ids()`, `has_capability()`) exist on every table.
- The browser client (`src/lib/supabase/client.ts`) is plain
  `@supabase/supabase-js` `createClient` with default **localStorage session
  persistence** — once `signInWithPassword` succeeds, the JWT auto-attaches to
  every REST call. No `@supabase/ssr` / middleware needed for the unblock.
- 7 `clients` rows (4 seed + 3 created through the create-client flow).

**Missing (all frontend):**
- A real login page. `app/(auth)/login/page.tsx` is a stub that calls the dev
  `useRole()`.
- User resolution from the Supabase session. `user-stub.tsx`'s `UserProvider`
  reads localStorage; it must read `supabase.auth`.
- An auth guard — an unauthenticated visitor should land on `/login`.

## 3. The work — sequenced

**The core unblock is steps 1–4.** Do them first; they make the app usable
deployed. Steps 5–6 are validation / cleanup that follow.

### Step 1 — Real login page
`app/(auth)/login/page.tsx`: an email + password form →
`supabase.auth.signInWithPassword({ email, password })`. On success, route to
`/dashboard`. Surface auth errors (`AppError` `kind: 'auth'`). Keep it simple —
no signup/magic-link yet (invites are a later increment).

### Step 2 — Resolve the user from the Supabase session
Rework `src/lib/auth/user-stub.tsx`'s `UserProvider` so it resolves the current
user from `supabase.auth.getSession()` + `supabase.auth.onAuthStateChange`,
then fetches the `public.users` profile row for `auth.uid()` and builds the
`User` object. **Keep `capabilities.ts`, `explainers.ts`, `resolver.ts` — they
are product code, not stub.** Capabilities are still *derived* (role/team-role
defaults ∪ `capability_grants`); only the *source of the user* changes.

**Critical: keep the hook surface identical** — `useUser`, `useCapabilities`,
`useCan`, `useCanAny`, `useCanAll`, `useRole`, `useIsViewingAs`,
`useUserContext`, `CapabilityOverrideProvider`. Every consumer must keep working
unchanged. `useRole()` / `useUser()` keep returning the *actual* user (not the
view-as override). `CapabilityOverrideProvider` survives (it is the
wizard-frame lock — product behaviour). Rename the file off `-stub` when done.

### Step 3 — Auth guard
No session → redirect to `/login`. A guard in the root layout (or the shared
route-group layouts) is enough — the client is browser-side. Already-known
shape: CLAUDE.md notes "the shared-route layouts become the place to check the
JWT role."

### Step 4 — Remove the dev stub layer
- Delete `DevRoleSwitcher` + every mount (the `(client)`/`(admin)` layouts and
  every shared-route layout).
- Delete `app/dev/*` (the stub-era verification surfaces).
- Delete the 4 hardcoded stub users + the localStorage keys.
- The 4 real `auth.users` already exist — get their emails (`select email from
  auth.users`) and set passwords via the Supabase dashboard so you (and the
  user) can sign in. At minimum one operator (`role='admin'`) is needed.

### Step 5 — Validate RLS against a real `auth.uid()`
The RLS policies have **never been exercised by a real authenticated user**
(the re-anchoring finding). Once signed in as an operator, confirm the app
loads. Then run the cross-tenant negative tests from `backend-schema-design.md`
§4 / §6: a client cannot read another client's rows; a Lane B client cannot
promote to `published`; a junior operator is bounded by `user_client_access`.

### Step 6 — Reconcile the "stub" stores with reality
CLAUDE.md's inventory calls `lib/agency/*-stub.ts`, `lib/billing/*-stub.ts`,
and the invite stores "localStorage STUB" — but the production console shows
`agency_policy`, `policy_overrides`, `plan_assignments`, `plan_catalog`,
`seat_limit_changes`, `team_invites`, `client_user_invites` all hitting the
Supabase REST API. **CLAUDE.md is stale here — audit what is actually wired**
before assuming. Most of these likely just start working once Step 1–4 land
(grants pass for `authenticated`). Update CLAUDE.md to match reality.

`draft-stub.ts` / `publish-stub.ts` / `use-autosave.ts` / `audit-stub.ts` /
`website-approval-stub.ts` (the editor autosave + publish/approval layer) are
genuinely still localStorage — migrating them to the `website_versions` /
`content_drafts` / `*_approval_submissions` / `force_publish_audit_log` tables
is real work and can be its own follow-up; it does not block the auth unblock.

## 4. Must-nots

- **Do not grant `anon` any table access.** It would defeat every RLS policy.
- **Do not touch the migrations / grants** — they are correct.
- **Do not change `capabilities.ts` / `explainers.ts` / `resolver.ts`** — product code.
- **Do not break the hook surface** — consumers across the whole app depend on it.

## 5. Verification

- Sign in as a seeded operator → `/dashboard` loads with no `401`s in the console.
- Sign in as a client user → sees only their own client's data.
- Sign out → redirected to `/login`; no data loads.
- The create-client flow completes (it inserts as the `authenticated` operator).

## 6. Out of scope (later increments)

- Signup / magic-link / the invite-acceptance flow.
- Migrating the editor autosave + publish/approval localStorage stubs to their
  Supabase tables (Step 6, second paragraph).
- `@supabase/ssr` / middleware — only needed when a server component or route
  handler must read the session; not needed for this unblock.

---

*Files in play: `app/(auth)/login/page.tsx`, `src/lib/auth/user-stub.tsx`,
`src/app/layout.tsx`, `src/components/shared/DevRoleSwitcher.tsx` + its mounts,
`src/app/dev/*`, `src/app/page.tsx`. The seven stub-deletion points are listed
in CLAUDE.md's parked decisions — this plan covers points 1, 3, 4 (real auth)
fully; points 2, 5, 6, 7 are Step 6 / out-of-scope follow-ups.*
