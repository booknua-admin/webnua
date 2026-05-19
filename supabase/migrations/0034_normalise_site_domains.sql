-- =============================================================================
-- Webnua backend — normalise published-website domains to `{slug}.webnua.dev`.
--
-- The platform's public wildcard is `*.webnua.dev` (PUBLIC_SITE_DOMAIN; the
-- middleware rewrite + resolve.ts slug fallback both key off it). Seed
-- migration 0023 wrote websites with a `.webnua.app` host, and the
-- create-client path briefly wrote `.webnua.site` — neither is the canonical
-- domain, so the editor / review surface displayed a host the site is not
-- actually served on.
--
-- Pure data normalisation, no schema change. Scoped two ways:
--   • websites only — funnel `domain_primary` is vestigial (funnels resolve
--     by path on the website host) and may hold a real custom domain.
--   • only platform-default hosts (`.webnua.app` / `.webnua.site` / null) are
--     rewritten — a genuine custom domain is left untouched.
-- =============================================================================

update public.websites w
set domain_primary = c.slug || '.webnua.dev'
from public.clients c
where w.client_id = c.id
  and (
    w.domain_primary is null
    or w.domain_primary like '%.webnua.app'
    or w.domain_primary like '%.webnua.site'
  )
  and w.domain_primary is distinct from c.slug || '.webnua.dev';
