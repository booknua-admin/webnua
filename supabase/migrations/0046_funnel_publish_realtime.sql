-- =============================================================================
-- Webnua backend — A3 · funnel publish + approval lane Realtime.
--
-- The builder approval lanes (website + funnel) need cross-tab / cross-user
-- liveness: when a submitter hits "Submit for review" the operator's queue
-- must light up, and when an operator approves/rejects the submitter's editor
-- lock banner must clear — without a poll. The notification write path
-- (migration 0032) added notifications / tickets / ticket_messages to the
-- supabase_realtime publication; the builder tables were left out then because
-- the funnel publish lane was deferred (CLAUDE.md parked decision).
--
-- This migration closes that: the two approval-submission tables (editor-side
-- + queue-side liveness) plus the two version tables (publication-side — a
-- published version surfacing on the funnel detail / roster) join the
-- publication. RLS still scopes which change events each user receives.
--
-- `RealtimeProvider` subscribes to all four and fans a BUILDER_EVENT, so every
-- dependent builder query refetches. No backfill — postgres_changes only fire
-- forward.
-- =============================================================================

do $$
begin
  alter publication supabase_realtime add table public.website_approval_submissions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.funnel_approval_submissions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.website_versions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.funnel_versions;
exception when duplicate_object then null;
end $$;
