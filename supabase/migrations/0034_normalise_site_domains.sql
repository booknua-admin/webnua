-- =============================================================================
-- Webnua backend — normalise published-site domains to `{slug}.webnua.dev`.
--
-- The platform's public wildcard is `*.webnua.dev` (PUBLIC_SITE_DOMAIN; the
-- middleware rewrite + resolve.ts slug fallback both key off it). Seed
-- migration 0023 wrote websites + funnels with a `.webnua.app` host, and the
-- create-client path briefly wrote `.webnua.site` — neither is the canonical
-- domain, so the editor / review surface displayed a host the site is not
-- actually served on.
--
-- This is a pure data normalisation: every website + funnel `domain_primary`
-- is rewritten to `{client slug}.webnua.dev`. No schema change.
-- =============================================================================

update public.websites w
set domain_primary = c.slug || '.webnua.dev'
from public.clients c
where w.client_id = c.id
  and w.domain_primary is distinct from c.slug || '.webnua.dev';

update public.funnels f
set domain_primary = c.slug || '.webnua.dev'
from public.clients c
where f.client_id = c.id
  and f.domain_primary is distinct from c.slug || '.webnua.dev';
