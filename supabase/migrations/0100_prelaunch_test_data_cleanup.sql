-- 0100_prelaunch_test_data_cleanup.sql
-- Pre-launch production data cleanup. Deletes every client EXCEPT the 4
-- hardcoded seed rows (Voltline / FreshHome / KeyHero / NeatWorks) and their
-- attached auth.users + public.users. Cascades through every child table that
-- carries an on-delete CASCADE from public.clients (~40 tables: brands,
-- websites, funnels, leads, bookings, tickets, automations, customers,
-- integration_connections, sms_messages, email_messages, gbp_*, meta_*, etc.).
--
-- See the launch-readiness audit (2026-05-26) and the operator decision
-- recorded in the same session: approved deletion of Categories A + B and
-- explicitly preserved the 4 hardcoded seed clients so the editor /
-- generation surfaces that fall back to them still work.
--
-- FK constraint topology made the deletion order non-obvious:
--   * users.client_id is RESTRICT -> cannot delete a client referenced by
--     any user.
--   * 11 RESTRICT FKs point INTO public.users (bookings.created_by,
--     content_drafts.updated_by, website_versions.created_by,
--     funnel_versions.created_by, *_approval_submissions.submitter_id,
--     ticket_messages.author_user_id, force_publish_audit_log.actor_user_id,
--     job_completions.completed_by, recurring_booking_schedules.created_by)
--     -> cannot delete a user with activity recorded against them.
--   * BUT every one of those 11 cascade-deletes when their parent client
--     is deleted. So if we drop ONLY users_client_id_fkey, the client
--     delete cascades through all child tables and frees every RESTRICT
--     FK on users in one motion. Then user deletion is unblocked. After,
--     we re-add the FK with identical semantics.
--   * The users_guard_identity_columns trigger (migration 0045) protects
--     against application-layer privilege escalation; for a one-shot
--     service-role cleanup it is correct to bypass.
--   * The users_role_shape CHECK constraint forbids client-role users
--     with NULL client_id. We avoid touching it by deleting users
--     entirely instead of NULL-ing client_id.
--   * Vault secrets referenced by integration_connections.token_secret_id
--     are NOT garbage-collected -- the rows go but the Vault entries leak.
--     Acceptable for V1 (zero connected integrations among doomed rows).
--   * auth.users CASCADE removes auth.identities / sessions /
--     refresh_tokens / mfa_factors automatically.

alter table public.users disable trigger users_guard_identity_columns;
alter table public.users drop constraint users_client_id_fkey;

do $$
declare
  preserve_ids uuid[] := array[
    'c0000000-0000-4000-8000-000000000001'::uuid, -- Voltline
    'c0000000-0000-4000-8000-000000000002'::uuid, -- FreshHome
    'c0000000-0000-4000-8000-000000000003'::uuid, -- KeyHero
    'c0000000-0000-4000-8000-000000000004'::uuid  -- NeatWorks
  ];
  doomed_user_ids uuid[];
  clients_before int;
  clients_remaining int;
  clients_deleted int;
  users_deleted int;
  authusers_deleted int;
begin
  select count(*) into clients_before from public.clients;

  -- Capture doomed user ids before clients are deleted (so we can clean
  -- them up after the cascade clears their RESTRICT FKs).
  select coalesce(array_agg(id), array[]::uuid[]) into doomed_user_ids
  from public.users
  where client_id is not null
    and client_id <> all(preserve_ids);

  -- Step 1: Delete doomed clients. Cascades through ~40 child tables,
  -- removing brands / websites / funnels / leads / bookings / tickets /
  -- automations / customers / sms_messages / email_messages / gbp_* /
  -- meta_* / integration_connections / content_drafts / website_versions /
  -- funnel_versions / etc.
  delete from public.clients where id <> all(preserve_ids);
  get diagnostics clients_deleted = row_count;
  select count(*) into clients_remaining from public.clients;

  -- Step 2: Delete the now-orphan public.users rows. The 11 RESTRICT FKs
  -- INTO users have all been cleared by step 1's cascade.
  if coalesce(array_length(doomed_user_ids, 1), 0) > 0 then
    delete from public.users where id = any(doomed_user_ids);
    get diagnostics users_deleted = row_count;
  else
    users_deleted := 0;
  end if;

  -- Step 3: Delete matching auth.users (cascades to auth.* tables).
  if coalesce(array_length(doomed_user_ids, 1), 0) > 0 then
    delete from auth.users where id = any(doomed_user_ids);
    get diagnostics authusers_deleted = row_count;
  else
    authusers_deleted := 0;
  end if;

  raise notice 'Pre-launch cleanup complete';
  raise notice '  clients: % -> % (deleted %)', clients_before, clients_remaining, clients_deleted;
  raise notice '  public.users deleted: %', users_deleted;
  raise notice '  auth.users  deleted: %', authusers_deleted;

  -- Safety assertion: only the 4 seed clients should remain.
  if clients_remaining <> 4 then
    raise exception 'Expected 4 surviving clients after cleanup, got %', clients_remaining;
  end if;
end $$;

-- Restore the users.client_id FK with identical semantics. Every surviving
-- users row has client_id either NULL (operators) or pointing at one of the
-- 4 preserved seed clients, so the FK validates cleanly.
alter table public.users
  add constraint users_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete restrict;

alter table public.users enable trigger users_guard_identity_columns;
