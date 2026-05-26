-- 0101_delete_hardcoded_seed_clients.sql
-- Removes the 4 hardcoded seed clients (Voltline / FreshHome / KeyHero /
-- NeatWorks) that 0100 preserved, per operator follow-up: "they are for the
-- platform to reference if needed not live or needed to be accessible by me
-- the operator." The TS-level stub constants in `lib/website/data-stub.tsx`
-- and `lib/funnel/data-stub.tsx` (and the `voltlinePassthrough` no-brief
-- fallback in `generation-stub.ts`) remain — those are file-level constants
-- with no DB dependency on these UUIDs, so deleting the DB rows does not
-- break any code path.
--
-- `supabase/seed.sql` is deliberately NOT modified: a future fresh project
-- setup via `supabase db reset` can still re-seed them if needed for local
-- platform reference work.
--
-- Same constraint-topology dance as 0100 (drop users_client_id_fkey + bypass
-- users_guard_identity_columns trigger so the cascade chain can fire, then
-- restore both). Self-asserts post-state: 0 clients remaining.

alter table public.users disable trigger users_guard_identity_columns;
alter table public.users drop constraint users_client_id_fkey;

do $$
declare
  doomed_client_ids uuid[] := array[
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

  -- Capture doomed user ids before clients are deleted.
  select coalesce(array_agg(id), array[]::uuid[]) into doomed_user_ids
  from public.users
  where client_id = any(doomed_client_ids);

  -- Step 1: Delete the 4 seed clients. Cascade clears every child row
  -- (brands, websites, funnels, leads, bookings, tickets, automations, etc.).
  delete from public.clients where id = any(doomed_client_ids);
  get diagnostics clients_deleted = row_count;
  select count(*) into clients_remaining from public.clients;

  -- Step 2: Delete the now-orphan public.users rows for the seed users
  -- (mark@voltline, liam@voltline, anna@freshhome). Operator users
  -- (role='admin', client_id IS NULL) are untouched.
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

  raise notice 'Seed-client removal complete';
  raise notice '  clients: % -> % (deleted %)', clients_before, clients_remaining, clients_deleted;
  raise notice '  public.users deleted: %', users_deleted;
  raise notice '  auth.users  deleted: %', authusers_deleted;

  if clients_remaining <> 0 then
    raise exception 'Expected 0 surviving clients after seed removal, got %', clients_remaining;
  end if;
end $$;

alter table public.users
  add constraint users_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete restrict;

alter table public.users enable trigger users_guard_identity_columns;
