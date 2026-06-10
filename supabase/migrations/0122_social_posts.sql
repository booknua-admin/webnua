-- =============================================================================
-- Webnua backend — Social media calendar (Module: social posts).
--
-- AI drafts a rolling calendar of posts per client (the generate_social_
-- calendar job, Sonnet-backed); the owner approves / edits / dismisses from
-- /social. Approved posts auto-publish at their scheduled time via the
-- every-15-min cron → social_publish_due job → the client's connected
-- Facebook Page (the Meta OAuth grant's Page token). Nothing publishes
-- without approval — the platform's approval-first principle.
--
-- channels is a text[] so Instagram + GBP can join without a migration;
-- V1 publishes to Facebook Pages only (the Meta integration's Page token
-- is already on file).
-- =============================================================================

do $$ begin
  create type public.social_post_status as enum (
    'draft', 'approved', 'published', 'failed', 'dismissed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.social_posts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  status         public.social_post_status not null default 'draft',
  scheduled_for  timestamptz not null,
  caption        text not null,
  hashtags       text not null default '',
  image_url      text,
  channels       text[] not null default '{facebook}'::text[],
  -- The content angle the generator used — tip / offer / seasonal /
  -- review_highlight / behind_scenes / before_after.
  post_kind      text not null default 'tip',
  created_via    text not null default 'ai' check (created_via in ('ai', 'manual')),
  approved_at    timestamptz,
  approved_by    uuid references public.users(id) on delete set null,
  published_at   timestamptz,
  publish_error  text,
  -- The Facebook post id once published (audit + future delete/edit).
  meta_post_id   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists social_posts_client_sched_idx
  on public.social_posts (client_id, scheduled_for);

create index if not exists social_posts_due_idx
  on public.social_posts (scheduled_for)
  where status = 'approved';

alter table public.social_posts enable row level security;

-- Owners + operators manage their own calendar end-to-end (create manual
-- posts, edit captions, approve, dismiss). The publish-state flips
-- (published / failed + meta_post_id) come from the service-role worker —
-- which bypasses RLS anyway.
create policy social_posts_select on public.social_posts
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

create policy social_posts_insert on public.social_posts
  for insert to authenticated
  with check (client_id in (select private.accessible_client_ids()));

create policy social_posts_update on public.social_posts
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));

create policy social_posts_delete on public.social_posts
  for delete to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- --- publish cron -------------------------------------------------------------
-- Every 15 minutes, one sweep job publishes every approved post that is due.
-- The job itself is client-agnostic (the handler groups by client); skip the
-- enqueue entirely when nothing is due so the queue stays quiet.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping social publish schedule.';
    return;
  end if;

  perform cron.unschedule('webnua_social_publish_due')
   where exists (
     select 1 from cron.job where jobname = 'webnua_social_publish_due'
   );

  perform cron.schedule(
    'webnua_social_publish_due',
    '*/15 * * * *',
    $cron$
      insert into public.integration_jobs (
        job_type, payload, provider, run_after, max_attempts
      )
      select 'social_publish_due', '{}'::jsonb, 'meta_ads', now(), 2
      where exists (
        select 1 from public.social_posts
        where status = 'approved' and scheduled_for <= now()
      );
    $cron$
  );
end;
$$;
