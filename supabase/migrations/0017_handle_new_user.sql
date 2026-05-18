-- =============================================================================
-- Webnua backend — Phase 2 · auth profile provisioning trigger.
--
-- backend-schema-design.md §6. When real Supabase Auth creates an `auth.users`
-- row (signup / invite acceptance), this trigger provisions the matching
-- `public.users` profile row from the signup metadata. Without it, a freshly
-- signed-up identity would have an auth row but no profile, and every
-- profile-resolving query (UserProvider) would return nothing.
--
-- Metadata contract — `raw_user_meta_data` carries:
--   display_name : text  — falls back to the email local-part
--   role         : user_role ('client' | 'admin') — defaults to 'client'
--   client_id    : uuid  — required for a client; null for an operator
--   team_role    : team_role — required for an operator; null for a client
--
-- The `users_role_shape` CHECK is enforced by the table itself: a malformed
-- signup (client without client_id, operator without team_role) fails the
-- INSERT and thus the signup — deliberate, the boundary stays honest.
--
-- SECURITY DEFINER so the insert runs with the function owner's rights (the
-- caller during signup is unauthenticated); empty search_path is the
-- hardening the Supabase advisors expect.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_display_name text;
begin
  meta_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, display_name, email, role, team_role, client_id, avatar_initial)
  values (
    new.id,
    meta_display_name,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client'),
    (new.raw_user_meta_data ->> 'team_role')::public.team_role,
    (new.raw_user_meta_data ->> 'client_id')::uuid,
    upper(left(meta_display_name, 1))
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
