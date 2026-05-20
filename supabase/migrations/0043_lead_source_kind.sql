-- =============================================================================
-- Webnua backend — `leads.source_kind` — surface attribution for the inbox.
--
-- The existing `leads.source` column is free-text (label-style; "Form · hero"
-- etc.) and was being used as a humanised "Source" rail field. The operator
-- inbox needed a *categorical* axis instead — website vs funnel vs meta — to
-- render as a column. Free-text doesn't constrain the shape, so we add a
-- check-constrained text column rather than overloading `source`.
--
-- Values:
--   • 'website' — submitted from a website page form
--   • 'funnel'  — submitted from a funnel step form
--   • 'meta'    — Meta (Facebook/Instagram) lead-ad — wired in a later
--                 session, listed here so the enum doesn't churn when it
--                 lands.
--
-- Default 'website' so existing rows take the safest fallback. Writes from
-- /api/forms/submit propagate the real surface kind. Plain text + check
-- constraint (not a Postgres enum) — text is cheaper to extend later when
-- new sources (e.g. 'gbp', 'referral') are added.
-- =============================================================================

alter table public.leads
  add column if not exists source_kind text not null default 'website'
    check (source_kind in ('website', 'funnel', 'meta'));

create index if not exists leads_source_kind_idx
  on public.leads (client_id, source_kind);
