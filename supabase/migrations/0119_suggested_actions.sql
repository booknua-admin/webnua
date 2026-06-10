-- =============================================================================
-- Webnua backend — Suggested actions spine (approval-first UX).
--
-- The platform's core product principle: AI drafts everything, the owner
-- approves with one tap. This table is the single queue every AI module
-- writes its drafted work into — conversation-intelligence reply drafts,
-- ads anomaly actions (pause / budget), review reply drafts, follow-up
-- nudges. The owner dashboard renders it as an action-first card feed
-- (Approve / Edit / Dismiss); approving dispatches the underlying side
-- effect via /api/actions/[id]/approve.
--
-- Writes are service-role only (job handlers + routes); the one
-- authenticated write is UPDATE (dismiss from the browser + the approve
-- route's status flip runs service-role anyway). SELECT is tenant-scoped
-- via accessible_client_ids — operators see their accessible clients'
-- queues, a client sees their own.
-- =============================================================================

do $$ begin
  create type public.suggested_action_kind as enum (
    'reply_draft',          -- AI-drafted reply to an inbound customer message
    'ads_budget',           -- drafted Meta budget change (payload carries cents)
    'ads_pause',            -- drafted Meta campaign pause
    'ads_creative_refresh', -- drafted creative-refresh recommendation
    'review_reply_draft',   -- AI-drafted reply to a Google review
    'followup_nudge',       -- "this lead has gone quiet" follow-up prompt
    'generic'               -- escape hatch for future modules
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.suggested_action_status as enum (
    'pending', 'approved', 'dismissed', 'expired'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.suggested_actions (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  kind               public.suggested_action_kind not null,
  status             public.suggested_action_status not null default 'pending',
  -- Card copy. title is the headline ("Reply drafted — Sarah M."), body is
  -- the draft content itself (the reply text / the plain-English ads
  -- recommendation), explanation is the detection chip ("Detected: price
  -- request — 3-bed deep clean, Clontarf").
  title              text not null,
  body               text not null default '',
  explanation        text not null default '',
  -- Everything the approve dispatcher needs to execute the action.
  payload            jsonb not null default '{}'::jsonb,
  -- The entity this action is about (lead / campaign / review) so detail
  -- surfaces can filter their own queue.
  source_entity_type text,
  source_entity_id   uuid,
  -- One OPEN action per dedupe_key per client — a fresh analysis replaces
  -- the stale pending draft instead of stacking duplicates.
  dedupe_key         text,
  urgency            text not null default 'normal' check (urgency in ('normal', 'high')),
  created_at         timestamptz not null default now(),
  expires_at         timestamptz,
  resolved_at        timestamptz,
  resolved_by        uuid references public.users(id) on delete set null,
  -- Result of the approve dispatch (message id sent, campaign updated, …).
  resolution         jsonb not null default '{}'::jsonb
);

create unique index if not exists suggested_actions_open_dedupe
  on public.suggested_actions (client_id, dedupe_key)
  where status = 'pending' and dedupe_key is not null;

create index if not exists suggested_actions_client_status_idx
  on public.suggested_actions (client_id, status, created_at desc);

create index if not exists suggested_actions_source_idx
  on public.suggested_actions (source_entity_type, source_entity_id)
  where source_entity_id is not null;

alter table public.suggested_actions enable row level security;
revoke insert, delete on public.suggested_actions from authenticated;

create policy suggested_actions_select on public.suggested_actions
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- Dismiss runs browser-direct; approve's status flip runs service-role in
-- the route after the side effect succeeds. The WITH CHECK keeps the row
-- inside the caller's tenant (column-level transitions are enforced by the
-- UI + route, not RLS — same trust shape as notifications read-state).
create policy suggested_actions_update on public.suggested_actions
  for update to authenticated
  using (client_id in (select private.accessible_client_ids()))
  with check (client_id in (select private.accessible_client_ids()));

-- Realtime — the dashboard feed refreshes when a job handler drafts a new
-- action or another device resolves one.
do $$ begin
  alter publication supabase_realtime add table public.suggested_actions;
exception when duplicate_object then null;
end $$;
