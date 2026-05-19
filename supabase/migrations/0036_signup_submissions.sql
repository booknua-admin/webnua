-- Cold-traffic signup flow: prospect lead capture.
-- Rows are written ONLY by the `submit-signup` edge function (service role),
-- never by anon directly. Operators read/convert them via the admin pipeline.

create type signup_submission_status as enum ('new', 'contacted', 'converted', 'dismissed');

create table public.signup_submissions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  status              signup_submission_status not null default 'new',

  -- business brief (captured progressively through the flow)
  trade               text not null,
  service_area        text not null,
  business_name       text,
  main_service        text,
  brand_colors        text[] not null default '{}',

  -- prospect contact (the lead). email is the minimum; name/phone fill in
  -- at the contact gate, but an exit-intent capture may land email-only.
  contact_name        text,
  contact_email       text not null,
  contact_phone       text,

  -- offer + guarantee snapshot, frozen at submit time
  guaranteed_leads    integer,
  base_leads_estimate integer,
  ad_spend_min        numeric,
  ad_spend_max        numeric,
  monthly_price       numeric not null default 347,
  setup_fee           numeric not null default 997,
  setup_fee_waived    boolean not null default true,

  -- lifecycle: signed_up_at set when the prospect completes the final CTA
  signed_up_at        timestamptz,

  -- light abuse-control + attribution
  ip_hash             text,
  user_agent          text,
  meta                jsonb not null default '{}'::jsonb
);

create index signup_submissions_created_at_idx on public.signup_submissions (created_at desc);
create index signup_submissions_status_idx on public.signup_submissions (status);

alter table public.signup_submissions enable row level security;

-- Operators only. No anon policy: the edge function writes with the service
-- role (RLS-bypassing); cold traffic never touches the table directly.
create policy signup_submissions_select on public.signup_submissions
  for select using (private.is_operator());

create policy signup_submissions_update on public.signup_submissions
  for update using (private.is_operator()) with check (private.is_operator());

create policy signup_submissions_delete on public.signup_submissions
  for delete using (private.is_operator());

create trigger signup_submissions_set_updated_at
  before update on public.signup_submissions
  for each row execute function public.set_updated_at();
