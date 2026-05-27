-- =============================================================================
-- 0111 — Per-client editable response-time promise.
--
-- The {{client.responseTime}} variable in every default automation body used
-- to be hardcoded to '1 hour' in the SMS + email render-context builders.
-- That meant a customer who set their response time to "30 minutes" or
-- "same business day" couldn't change what their automated messages
-- promised — and the variable was effectively cosmetic.
--
-- This column makes it editable. The setting surfaces on /settings/profile;
-- buildRenderContext (Twilio + Resend job handlers) reads it and falls
-- through to '1 hour' when blank or unset. NULL behaviour and the in-app
-- empty-string fallback both resolve to '1 hour' so existing rows + the
-- pre-launch UX both stay correct.
--
-- This is a customer-facing text field with no enum constraint — operators
-- type the promise verbatim ("1 hour", "30 minutes", "Same business day").
-- A future tier may switch this to a structured value the dashboard can
-- show "live promise tracking" against; for now plain text is enough.
-- =============================================================================

alter table public.clients
  add column if not exists response_time_promise text default '1 hour';

comment on column public.clients.response_time_promise is
  'The response-time language used as {{client.responseTime}} in automation '
  'bodies. Editable on /settings/profile. Falls back to ''1 hour'' at render '
  'time when blank.';
