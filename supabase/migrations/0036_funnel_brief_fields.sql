-- =============================================================================
-- Webnua backend — funnel brief fields.
--
-- Adds the funnel-specific brief inputs the wizard now captures. These feed
-- the AI funnel offer generator wired in a later session — for now they are
-- captured + persisted only. The four fields live on `funnels` rather than a
-- separate briefs table because they describe the funnel (one funnel, one
-- offer / pain / guarantee / testimonial set) and existing brief data is
-- already split across the entity tables it semantically belongs to
-- (business identity on clients, brand voice on brands).
--
-- funnel_testimonials renders as placeholders when empty — never as
-- AI-generated fake testimonials. See CLAUDE.md "Open decisions / parked".
-- =============================================================================

alter table public.funnels
  add column funnel_service text,
  add column funnel_customer_pain text,
  add column funnel_guarantee text,
  add column funnel_testimonials jsonb not null default '[]'::jsonb;

comment on column public.funnels.funnel_service is
  'Which one service the funnel is built around. Feeds AI funnel offer generation.';
comment on column public.funnels.funnel_customer_pain is
  'The urgent moment that drives a customer to search for the service. Feeds AI offer copy.';
comment on column public.funnels.funnel_guarantee is
  'Risk-reversal promise the business is willing to make. Feeds AI offer copy.';
comment on column public.funnels.funnel_testimonials is
  'Array of {quote, author, context}. Empty array renders placeholders, never AI-invented testimonials.';
