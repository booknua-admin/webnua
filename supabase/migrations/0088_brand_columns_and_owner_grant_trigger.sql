-- =============================================================================
-- Pattern B critical fixes · Session 2.
--
-- Three changes that ship together:
--
--   1. brands table — add the optional columns that previously lived in the
--      localStorage `brand-style-stub` overlay (the parked decision the
--      brand-editor session was waiting on). brand_colors / heading_font /
--      body_font / heading_color / body_color / background_color / tagline.
--      All NULLABLE so older brand rows keep working unchanged. The new
--      /settings/brand surface reads + writes these directly; brand-style-stub
--      stays in place as a backwards-compat read overlay until every
--      in-editor color/font picker is migrated to write directly to the
--      brands table.
--
--   2. funnels_update RLS widening — same shape as the 0087 clients_update
--      widening. A user holding the `publish` capability workspace-wide can
--      update a funnels row they belong to (currently funnels_update is
--      operator-only, which means a client clicking "Unpublish" on their
--      own funnel would 403 even after Session 1's CLIENT_OWNER_DEFAULTS
--      grant).
--
--   3. Auto-grant CLIENT_OWNER_DEFAULTS on first client user — covers the
--      operator-concierge invite acceptance path the brief asks for. A DB
--      trigger fires on `public.users INSERT`: if the new row is a client-
--      role user AND no other client-role user exists for the same
--      client_id (i.e. this user IS the workspace owner), insert the same
--      workspace-wide capability_grants row that signup-workspace.ts now
--      writes manually. Subsequent client users for the same workspace
--      (teammates) keep the CLIENT_DEFAULTS floor — the owner manages their
--      grants via /settings/access.
--
--      The signup-workspace.ts explicit insert is left in place (idempotent
--      via ON CONFLICT DO NOTHING in this session) — defence in depth.
-- =============================================================================

-- -- 1. brands columns -----------------------------------------------------

alter table public.brands
  add column if not exists brand_colors text[] not null default '{}',
  add column if not exists heading_font text,
  add column if not exists body_font text,
  add column if not exists heading_color text,
  add column if not exists body_color text,
  add column if not exists background_color text,
  add column if not exists tagline text;

comment on column public.brands.brand_colors is
  'Optional brand palette (1-3 hex). brand_colors[0] mirrors accent_color when set. Empty array = generator falls back to [accent_color].';
comment on column public.brands.heading_font is
  'Curated Google Font id for display headings (see lib/website/google-fonts.ts). NULL = platform default (inter-tight).';
comment on column public.brands.body_font is
  'Curated Google Font id for body copy. NULL = platform default.';
comment on column public.brands.heading_color is
  'Brand-level heading colour default. Sections inherit when no override. NULL = section-level hardcoded default.';
comment on column public.brands.body_color is
  'Brand-level body colour default. NULL = section-level default.';
comment on column public.brands.background_color is
  'Brand-level background colour default. NULL = section-level default.';
comment on column public.brands.tagline is
  'Short business tagline (optional). Shown on the brand editor; the generator may consume it as a section-copy hint.';

-- -- 2. funnels_update RLS — owner can unpublish their own funnel ----------

drop policy if exists funnels_update on public.funnels;
create policy funnels_update on public.funnels
  for update to authenticated
  using (
    private.is_operator()
    or (
      client_id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'publish'::public.capability)
    )
  )
  with check (
    private.is_operator()
    or (
      client_id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'publish'::public.capability)
    )
  );

-- -- 2b. brands_update RLS — owner can edit their own brand -----------------
--
-- Same shape as clients_update (0087) / funnels_update (above). The
-- brand-editor surface at /settings/brand reads + writes this row directly
-- from the browser through the supabase client; the cap-gated UPDATE means
-- only owners with the `editTheme` cap can write. We gate on `editTheme`
-- (the cap the editor's theme picker uses) rather than `publish` because
-- editing the brand is a content/design action, not a publish action.

drop policy if exists brands_update on public.brands;
create policy brands_update on public.brands
  for update to authenticated
  using (
    private.is_operator()
    or (
      client_id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'editTheme'::public.capability)
    )
  )
  with check (
    private.is_operator()
    or (
      client_id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'editTheme'::public.capability)
    )
  );

-- -- 3. Auto-grant CLIENT_OWNER_DEFAULTS on first client user --------------

create or replace function private.grant_owner_caps_on_first_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only client-role users with a workspace get auto-granted owner caps.
  if new.role = 'client' and new.client_id is not null then
    -- "First user" = no other client-role user already exists for this
    -- client. Teammates invited later stay at CLIENT_DEFAULTS unless the
    -- owner grants them explicitly via /settings/access.
    if not exists (
      select 1 from public.users
      where client_id = new.client_id
        and role = 'client'
        and id <> new.id
    ) then
      insert into public.capability_grants (user_id, website_id, capabilities)
      values (
        new.id,
        null,
        array[
          'viewBuilder',
          'editCopy',
          'editMedia',
          'editSEO',
          'editLayout',
          'editSections',
          'editTheme',
          'editPages',
          'editForms',
          'useAI',
          'publish',
          'rollback',
          'manageDomain'
        ]::public.capability[]
      )
      on conflict (user_id, website_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_grant_owner_caps_on_first on public.users;
create trigger users_grant_owner_caps_on_first
  after insert on public.users
  for each row execute function private.grant_owner_caps_on_first_user();
