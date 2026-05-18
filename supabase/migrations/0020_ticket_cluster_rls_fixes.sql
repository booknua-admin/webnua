-- =============================================================================
-- Webnua backend — Phase 3 · tickets-cluster RLS fixes.
--
-- Two corrections surfaced while wiring the tickets cluster to live data:
--
--  1. users_select hid operator (admin) rows from client users. But the
--     managed-service relationship makes the operator a named, visible party
--     to the client — the ticket thread shows "Craig · Webnua" replying, the
--     detail meta line reads "managed by Craig". A client must be able to read
--     an operator's identity (display_name / avatar_initial / email). Operator
--     rows carry no tenant-private data, so they are visible to every
--     authenticated user.
--
--  2. ticket_messages_select exposed operator *draft* replies (is_draft=true)
--     to the client. A staged-but-unsent draft must stay operator-only. The
--     read policy now hides drafts from non-operators; the same ticket query
--     therefore serves both roles — RLS drops the drafts for a client viewer
--     and keeps them for an operator.
-- =============================================================================

-- --- 1. operator rows are visible to every authenticated user ----------------
drop policy users_select on public.users;
create policy users_select on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or client_id in (select private.accessible_client_ids())
    or private.is_operator()
    or role = 'admin'
  );

-- --- 2. draft ticket messages are operator-only ------------------------------
drop policy ticket_messages_select on public.ticket_messages;
create policy ticket_messages_select on public.ticket_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_messages.ticket_id
        and t.client_id in (select private.accessible_client_ids())
    )
    and (is_draft = false or private.is_operator())
  );
