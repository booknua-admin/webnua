-- =============================================================================
-- Webnua backend — Phase 5 · seed the agency billing + policy layer.
--
-- The Phase 5 frontend wiring reads the plan catalog, plan assignments, and
-- per-sub-account policy overrides from real tables. This migration seeds the
-- starting state the stub layer carried in code (PLAN_CATALOG_SEED,
-- PLAN_ASSIGNMENT_SEED, SUB_ACCOUNT_OVERRIDE_SEED) so the wired surfaces are
-- not empty on day one.
--
-- agency_policy is intentionally NOT seeded — an empty agency_policy table
-- resolves identically to AGENCY_POLICY_SEED in the frontend (the seed IS the
-- platform default), and the first operator edit on /settings/defaults writes
-- the row. Seeding it would only duplicate the code default.
--
-- ON CONFLICT DO NOTHING throughout — seed-once semantics; an operator who
-- later edits the catalog is not overwritten if this somehow re-runs.
-- =============================================================================

-- --- plan_catalog — three tiers, each a packaged policy bundle ---------------
insert into public.plan_catalog (id, name, description, price, currency, billing_cycle, policy)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'Basic',
    'A single managed funnel and website. View-only builder access for the client team.',
    149, 'AUD', 'monthly',
    '{"defaultSeatLimit":2,"defaultClientCapabilities":["viewBuilder"],"integrationDefaults":{"sharedProviders":{"resend":true,"twilio":false,"meta-ads":false,"gbp":false,"vercel":true,"anthropic":true}}}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'Pro',
    'Managed funnels plus self-serve copy and media editing, ad campaigns, and review automation.',
    349, 'AUD', 'monthly',
    '{"defaultSeatLimit":5,"defaultClientCapabilities":["viewBuilder","editCopy","editMedia"],"integrationDefaults":{"sharedProviders":{"resend":true,"twilio":true,"meta-ads":true,"gbp":true,"vercel":true,"anthropic":true}}}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'Enterprise',
    'Uncapped seats, full builder access including SEO and AI drafting, and every integration.',
    899, 'AUD', 'monthly',
    '{"defaultSeatLimit":null,"defaultClientCapabilities":["viewBuilder","editCopy","editMedia","editSEO","useAI"],"integrationDefaults":{"sharedProviders":{"resend":true,"twilio":true,"meta-ads":true,"gbp":true,"vercel":true,"anthropic":true}}}'::jsonb
  )
on conflict (id) do nothing;

-- --- plan_assignments — Voltline→Basic, FreshHome→Pro, KeyHero→Pro -----------
-- NeatWorks intentionally unassigned — exercises the no-plan resolution path.
insert into public.plan_assignments (client_id, plan_id, assigned_by)
values
  ('c0000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000001')
on conflict (client_id) do nothing;

-- --- policy_overrides — the migrated per-client seat limits ------------------
-- Voltline is capped tighter than its plan default; KeyHero + NeatWorks are
-- explicitly uncapped. value is jsonb — a JSON `null` is a non-NULL jsonb.
insert into public.policy_overrides (client_id, policy_key, value)
values
  ('c0000000-0000-4000-8000-000000000001', 'defaultSeatLimit', '3'::jsonb),
  ('c0000000-0000-4000-8000-000000000003', 'defaultSeatLimit', 'null'::jsonb),
  ('c0000000-0000-4000-8000-000000000004', 'defaultSeatLimit', 'null'::jsonb)
on conflict (client_id, policy_key) do nothing;
