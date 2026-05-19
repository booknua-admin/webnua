-- =============================================================================
-- Webnua backend — funnel URL slug.
--
-- Funnels are served at {websiteHost}/{slug} — path-based, on the client's
-- website host, no per-funnel subdomain (a `*.webnua.dev` wildcard cert only
-- covers one label, so book.{client}.webnua.dev could never get a cert). The
-- public-render pipeline resolves a funnel by (client_id, slug):
-- see src/lib/public-site/resolve.ts.
--
-- slug is unique per client — voltline can have /offer and freshhome can too.
-- =============================================================================

alter table public.funnels add column slug text;

-- Backfill: 'offer' for each client's first funnel, 'offer-N' for any extras.
with ranked as (
  select id,
    row_number() over (partition by client_id order by created_at, id) as rn
  from public.funnels
)
update public.funnels f
set slug = case when r.rn = 1 then 'offer' else 'offer-' || r.rn end
from ranked r
where r.id = f.id;

alter table public.funnels alter column slug set not null;
create unique index funnels_client_slug_idx on public.funnels (client_id, slug);
