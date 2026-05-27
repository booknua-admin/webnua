-- =============================================================================
-- 0104 — Automation visibility column.
--
-- Adds `automations.visibility` so the client `/automations` UI can hide
-- platform-internal automations that are operator concerns (today:
-- `operator_lead_notification`, `payment_failed_notification` — both fire
-- when a sub-account event happens, but the EMAIL target is the operator,
-- not the lead). The client has no business toggling these on/off, and
-- showing them in the client UI makes the surface look cluttered + confusing
-- (per pre-launch screenshot, May 2026).
--
--   'client'             — Stream C automation: client edits + toggles + the
--                          send target is the lead. Default.
--   'platform_internal'  — Stream B automation: operator-owned, the send
--                          target is the operator. Hidden from the client UI,
--                          shown in the operator's birds-eye admin view only.
--
-- This is a schema-only migration. The accompanying re-seed lands in 0105.
-- =============================================================================

alter table public.automations
  add column if not exists visibility text not null default 'client'
    check (visibility in ('client', 'platform_internal'));

comment on column public.automations.visibility is
  'Two-value classifier: `client` automations are shown in the client /automations UI and editable by them. `platform_internal` automations are operator-owned (the EMAIL target is the operator, not the lead) and hidden from the client UI.';

create index if not exists automations_visibility_client_idx
  on public.automations (client_id, visibility);
