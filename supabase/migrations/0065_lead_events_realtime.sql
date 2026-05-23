-- =============================================================================
-- Webnua backend — Phase 7 Resend follow-up · 0065_lead_events_realtime.sql
--
-- Adds `public.lead_events` to the supabase_realtime publication so the
-- leads-inbox / lead-detail / lead-conversation queries refetch the moment
-- a new event lands (inbound email reply, outbound send, status change).
--
-- Without this, the conversation view stays stale until the user navigates
-- away and back — particularly visible on the inbound reply path: Resend
-- POSTs the inbound webhook → the route inserts a `email_in` lead_event,
-- but the conversation hook reads from a cached query and never sees it.
--
-- Idempotent: the `alter publication` is wrapped in a duplicate-object
-- tolerant DO block, matching the pattern in 0032 / 0046.
-- =============================================================================

do $$
begin
  alter publication supabase_realtime add table public.lead_events;
exception when duplicate_object then
  null;
end;
$$;
