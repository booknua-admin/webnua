-- =============================================================================
-- 0112 — Per-brand services list (the canonical full menu).
--
-- The wizard's Step 1 (and the conversational onboarding's services-picker
-- turn) captures the customer's full services list — typically 4–10 entries
-- depending on the industry. Until now only the top 3 landed on `brands`
-- (as `top_jobs_to_be_booked`) for use in AI prompts; the rest stayed in
-- `wizard_state.step_data.step1.services`, which is wizard scratch — not a
-- live SoT post-onboarding.
--
-- This column makes the FULL list a live column on `brands` so every
-- consumer can read it: the form builder's `service-select` field type
-- (which renders the list as a customer-facing dropdown), the operator
-- editor on /settings/profile, and any future surface (e.g. the booking
-- creation flow's "service" picker, the AI generator's service-section).
--
-- `top_jobs_to_be_booked` STAYS as-is — it's semantically the highlight
-- subset (the top jobs the brand wants to lead with in copy), distinct
-- from the full menu. Generators and copy that read it stay correct.
--
-- BACKFILL — for existing rows, seed `services` from `top_jobs_to_be_booked`
-- so the dropdown isn't empty for any customer who onboarded before this
-- migration. Operators can edit / add to the list at /settings/profile.
-- =============================================================================

alter table public.brands
  add column if not exists services text[] not null default '{}';

comment on column public.brands.services is
  'The brand''s full services menu — the canonical list the form-builder ' ||
  '''service-select'' field type renders, and the operator edits at ' ||
  '/settings/profile. Captured during onboarding (wizard Step 1 / ' ||
  'conversational services turn). Distinct from `top_jobs_to_be_booked`, ' ||
  'which is the AI-prompt highlight subset.';

-- Backfill from `top_jobs_to_be_booked` so the dropdown lights up for
-- existing customers. Only seed rows whose `services` column is still empty
-- (the default) — never overwrite a value an operator has set.
update public.brands
   set services = top_jobs_to_be_booked
 where array_length(services, 1) is null
   and array_length(top_jobs_to_be_booked, 1) is not null;
