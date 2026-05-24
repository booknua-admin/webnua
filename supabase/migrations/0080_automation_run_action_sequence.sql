-- =============================================================================
-- Webnua backend — Phase 8 · Session 3 follow-up · in-flight run isolation.
--
-- Adds `automation_runs.action_sequence uuid[]` — the per-run snapshot of
-- `automation_actions.id`s in position order, captured at run creation.
--
-- The contract:
--   • A run walks its OWN snapshotted sequence, not the live `automation_actions`
--     table. Reorders / inserts / removals to the underlying actions only
--     affect runs created AFTER the edit.
--   • `current_action_position` is 1-indexed and is treated as an index into
--     `action_sequence` (position N = action_sequence[N-1]).
--   • An action in `action_sequence` whose row has been deleted is skipped at
--     execution time — the engine resolves the next still-existing action id
--     in the sequence.
--   • An empty `action_sequence` (legacy run created before this migration
--     OR a run for an automation with zero actions) is treated by the engine
--     as "use the live query" so existing in-flight runs keep working until
--     they finish — explicit backwards-compat path.
--
-- The unique constraint on `(automation_id, position)` on `automation_actions`
-- is unaffected; `action_sequence` is a per-run snapshot, not a replacement
-- for the actions table.
--
-- Backfill: for every existing in-flight run (`status in ('running', 'paused')`),
-- populate `action_sequence` from the current ordered action ids on that
-- automation. Terminal-status runs (completed / failed / cancelled) are left
-- empty — they won't be walked again.
-- =============================================================================

alter table public.automation_runs
  add column if not exists action_sequence uuid[] not null default array[]::uuid[];

-- --- backfill in-flight runs only ------------------------------------------
-- A run in a terminal status is never walked again, so leaving its
-- action_sequence empty is fine. Backfilling only the live runs keeps the
-- migration cheap on a hot system.

update public.automation_runs r
set action_sequence = coalesce(seq.ids, array[]::uuid[])
from (
  select
    a.automation_id,
    array_agg(a.id order by a.position) as ids
  from public.automation_actions a
  group by a.automation_id
) seq
where r.automation_id = seq.automation_id
  and r.status in ('running', 'paused')
  and array_length(r.action_sequence, 1) is null;

comment on column public.automation_runs.action_sequence is
  'Snapshot of automation_actions.id values in position order at run creation. '
  'The engine walks THIS sequence, not the live actions table — so mid-run '
  'reorders / inserts / removals only affect later runs. Empty array means '
  '"use live query" (legacy / pre-0080 runs).';
