-- =============================================================================
-- Webnua backend — Phase 1 Session C · seed data.
--
-- A representative seed translated from the front-end stub fixtures
-- (src/lib/nav/admin-clients.ts, auth/user-stub.tsx, leads/*, bookings/*,
-- tickets/*, reviews/*, campaigns/*, automations/*, notifications/*).
--
-- §5 stub-bend conventions applied: relative ages ("32m", "Yesterday") become
-- real timestamptz computed from now(); ReactNode/presentation fields are not
-- stored; customer identity is resolved to the customers table with frozen
-- name/phone display snapshots.
--
-- This is seed data, NOT a migration — it is idempotent-on-empty (run against
-- a fresh DB). Deterministic UUIDs are used for every cross-referenced parent
-- so children can FK to them without lookups.
--
-- auth.users rows are seeded here because public.users.id FK-references them.
-- The encrypted_password is a throwaway placeholder — real Supabase Auth lands
-- in Phase 2 and reconciles these identities.
-- =============================================================================

-- ===== auth.users ============================================================
-- Minimal auth identities for the 4 stub users. Phase 2 replaces these.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'craig@webnua.com',
   '$2a$10$seedplaceholderhashseedplaceholderhashseedplaceholderxx',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'mark@voltline.com.au',
   '$2a$10$seedplaceholderhashseedplaceholderhashseedplaceholderxx',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'liam@voltline.com.au',
   '$2a$10$seedplaceholderhashseedplaceholderhashseedplaceholderxx',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'anna@freshhome.com.au',
   '$2a$10$seedplaceholderhashseedplaceholderhashseedplaceholderxx',
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

-- ===== clients ===============================================================
insert into public.clients (id, name, slug, industry, lifecycle_status, service_area,
  primary_contact_name, primary_contact_email, primary_contact_phone)
values
  ('c0000000-0000-4000-8000-000000000001', 'Voltline',  'voltline',  'Electrical',
   'onboarding', 'Perth', 'Mark Sutton',  'mark@voltline.com.au',  '+61 8 9000 0001'),
  ('c0000000-0000-4000-8000-000000000002', 'FreshHome', 'freshhome', 'Cleaning',
   'live', 'Perth', 'Anna Becker', 'anna@freshhome.com.au', '+61 8 9000 0002'),
  ('c0000000-0000-4000-8000-000000000003', 'KeyHero',   'keyhero',   'Locksmith',
   'live', 'Perth', 'Dana Cole',   'dana@keyhero.com.au',   '+61 8 9000 0003'),
  ('c0000000-0000-4000-8000-000000000004', 'NeatWorks', 'neatworks', 'Cleaning',
   'live', 'Dublin', 'Sean Walsh', 'sean@neatworks.ie',     '+353 1 900 0004');

-- ===== users =================================================================
-- Craig is the operator (admin / owner); Mark + Liam belong to Voltline;
-- Anna belongs to FreshHome. The users_role_shape CHECK is honoured.
insert into public.users (id, display_name, email, role, team_role, client_id, avatar_initial)
values
  ('a0000000-0000-4000-8000-000000000001', 'Craig', 'craig@webnua.com',
   'admin', 'owner', null, 'C'),
  ('a0000000-0000-4000-8000-000000000002', 'Mark', 'mark@voltline.com.au',
   'client', null, 'c0000000-0000-4000-8000-000000000001', 'M'),
  ('a0000000-0000-4000-8000-000000000003', 'Liam', 'liam@voltline.com.au',
   'client', null, 'c0000000-0000-4000-8000-000000000001', 'L'),
  ('a0000000-0000-4000-8000-000000000004', 'Anna', 'anna@freshhome.com.au',
   'client', null, 'c0000000-0000-4000-8000-000000000002', 'A');

-- Backfill the clients.onboarded_by attribution now that Craig exists.
update public.clients set onboarded_by = 'a0000000-0000-4000-8000-000000000001';

-- ===== brands ================================================================
-- One brand per client (1:1). Voice tone is the slider triple (1..5).
insert into public.brands (client_id, accent_color, voice_formality, voice_urgency,
  voice_technicality, audience_line, industry_category, top_jobs_to_be_booked)
values
  ('c0000000-0000-4000-8000-000000000001', '#d24317', 2, 4, 3,
   'Perth homeowners who need an electrician fast.', 'Electrical',
   '{"Emergency call-out","Switchboard upgrade","Ceiling fan install"}'),
  ('c0000000-0000-4000-8000-000000000002', '#2d8a4e', 3, 2, 2,
   'Busy households wanting a reliable recurring cleaner.', 'Cleaning',
   '{"Fortnightly clean","Deep clean","End-of-lease clean"}'),
  ('c0000000-0000-4000-8000-000000000003', '#8a5cb8', 2, 5, 3,
   'Locked-out residents needing a locksmith now.', 'Locksmith',
   '{"Emergency lockout","Lock rekey","Security upgrade"}'),
  ('c0000000-0000-4000-8000-000000000004', '#4a7ba6', 3, 2, 2,
   'Dublin homes and offices wanting a tidy space.', 'Cleaning',
   '{"Office clean","Domestic clean","Carpet clean"}');

-- ===== customers =============================================================
-- Per-client identities behind leads / bookings / reviews (§2.3). Voltline
-- customers c-01..03; FreshHome c-10..12.
insert into public.customers (id, client_id, name, phone, email, suburb, address)
values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Sarah Davies', '+61 412 000 101', 'sarah.davies@example.com', 'Mt Hawthorn', null),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'Liam Reilly', '+61 412 000 102', 'liam.reilly@example.com', 'Highgate',
   '14 Bourke St, Highgate WA 6003'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'Emma Petrov', '+61 412 000 103', 'emma.petrov@example.com', 'Inglewood', null),
  ('d0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000002',
   'Anna Larsen', '+61 413 000 110', 'anna.larsen@example.com', 'Subiaco',
   '8 Rokeby Rd, Subiaco WA 6008'),
  ('d0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002',
   'James Whelan', '+61 413 000 111', 'james.whelan@example.com', 'Cottesloe', null),
  ('d0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002',
   'Priya Nair', '+61 413 000 112', 'priya.nair@example.com', 'Claremont', null);

-- ===== leads =================================================================
-- Voltline's funnel inbox (client Screen 2). Relative ages -> timestamptz.
-- customer_id links where a customer identity exists; null = unmatched raw lead.
insert into public.leads (id, client_id, customer_id, customer_name_snapshot,
  customer_phone_snapshot, status, urgency, source, assigned_operator_id, created_at)
values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000001', 'Sarah Davies', '+61 412 000 101',
   'new', 'asap', 'funnel', 'a0000000-0000-4000-8000-000000000001', now() - interval '32 minutes'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   null, 'Mark Kohli', '+61 412 000 201',
   'new', 'today', 'funnel', null, now() - interval '2 hours'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000003', 'Emma Petrov', '+61 412 000 103',
   'new', 'soon', 'funnel', null, now() - interval '4 hours'),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001',
   null, 'Tom Reilly', '+61 412 000 202',
   'new', 'none', 'funnel', null, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001',
   null, 'Jess Torres', '+61 412 000 203',
   'new', 'none', 'funnel', null, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001',
   null, 'Andrew Hassan', '+61 412 000 204',
   'booked', 'none', 'funnel', 'a0000000-0000-4000-8000-000000000001', now() - interval '2 days'),
  ('e0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001',
   'd0000000-0000-4000-8000-000000000002', 'Liam Reilly', '+61 412 000 102',
   'booked', 'none', 'funnel', 'a0000000-0000-4000-8000-000000000001', now() - interval '3 days');

-- ===== lead_events ===========================================================
-- The Sarah Davies lead timeline ([JC-4]: one event row per activity; message
-- kinds carry {body,senderName,delivered} in payload).
insert into public.lead_events (lead_id, kind, occurred_at, actor_user_id, automation_id, payload)
values
  ('e0000000-0000-4000-8000-000000000001', 'form_submitted',
   now() - interval '32 minutes', null, null,
   '{"fields":[{"label":"Job","value":"Powerpoint install + replace fittings"},{"label":"Suburb","value":"Mt Hawthorn"}]}'),
  ('e0000000-0000-4000-8000-000000000001', 'sms_out',
   now() - interval '31 minutes', null, null,
   '{"body":"Hi Sarah, thanks for your enquiry — we''ll call within 90 minutes.","senderName":"Voltline","delivered":true}'),
  ('e0000000-0000-4000-8000-000000000001', 'sms_in',
   now() - interval '20 minutes', null, null,
   '{"body":"Great, I''m home all afternoon.","senderName":"Sarah Davies","delivered":true}'),
  ('e0000000-0000-4000-8000-000000000001', 'status_changed',
   now() - interval '18 minutes', 'a0000000-0000-4000-8000-000000000002', null,
   '{"from":"new","to":"contacted"}');

-- ===== recurring_booking_schedules ===========================================
-- FreshHome — Anna Larsen's fortnightly clean (client Screen 16).
insert into public.recurring_booking_schedules (id, client_id, lead_id, frequency,
  day_of_week, start_time, duration_minutes, service_type, price,
  customer_id, customer_name_snapshot, customer_phone_snapshot, active, created_by)
values
  ('3a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   null, 'fortnightly', 4, '10:00', 150, 'Fortnightly clean · 3-bed', 180.00,
   'd0000000-0000-4000-8000-000000000010', 'Anna Larsen', '+61 413 000 110',
   true, 'a0000000-0000-4000-8000-000000000001');

-- ===== bookings ==============================================================
insert into public.bookings (id, client_id, lead_id, recurring_schedule_id, title,
  service_type, starts_at, ends_at, customer_id, customer_name_snapshot,
  customer_phone_snapshot, address, price, status, notes,
  assigned_operator_id, created_by)
values
  -- Voltline — Liam Reilly's ceiling-fan job, from a lead (client Screen 8).
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000007', null,
   'Ceiling fan + RCD replacement', 'standard',
   (now()::date + time '13:00'), (now()::date + time '15:30'),
   'd0000000-0000-4000-8000-000000000002', 'Liam Reilly', '+61 412 000 102',
   '14 Bourke St, Highgate WA 6003', 220.00, 'scheduled',
   'Customer has the fan unit on site. Park in the rear lane.',
   'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  -- FreshHome — Anna Larsen's recurring clean instance (admin Screen 18).
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   null, '3a000000-0000-4000-8000-000000000001',
   'Fortnightly clean · 3-bed', 'recurring',
   (now()::date + interval '2 days' + time '10:00'),
   (now()::date + interval '2 days' + time '12:30'),
   'd0000000-0000-4000-8000-000000000010', 'Anna Larsen', '+61 413 000 110',
   '8 Rokeby Rd, Subiaco WA 6008', 180.00, 'scheduled',
   'Spare key in the lockbox; code texted on arrival.',
   'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  -- FreshHome — a completed job (backs the job_completions row below).
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002',
   null, null, 'Deep clean · 2-bed apartment', 'one_off',
   (now()::date - interval '3 days' + time '09:00'),
   (now()::date - interval '3 days' + time '12:00'),
   'd0000000-0000-4000-8000-000000000011', 'James Whelan', '+61 413 000 111',
   '21 Marine Pde, Cottesloe WA 6011', 320.00, 'completed',
   'First-time deep clean ahead of an inspection.',
   'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001');

-- ===== job_completions =======================================================
-- The completion record for the deep-clean job (client Screen 11).
insert into public.job_completions (booking_id, completed_by, completed_at,
  payment_method, amount_charged, materials_cost, review_requested, notes)
values
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004',
   now() - interval '3 days' + interval '3 hours', 'card', 320.00, 24.50, true,
   'Paid on the spot by card. Review SMS armed.');

-- ===== tickets ===============================================================
insert into public.tickets (id, reference, client_id, title, category, status,
  urgency, awaiting, created_by, assigned_operator_id, created_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'TKT-0247',
   'c0000000-0000-4000-8000-000000000001',
   'Can we change the hero headline on the funnel landing page?',
   'website', 'in_progress', 'soon', 'client',
   'a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   now() - interval '2 days'),
  ('f0000000-0000-4000-8000-000000000002', 'TKT-0251',
   'c0000000-0000-4000-8000-000000000002',
   'Please pause the Saturday cleaning slot for the next two weeks.',
   'other', 'open', 'none', 'operator',
   'a0000000-0000-4000-8000-000000000004', null,
   now() - interval '6 hours');

-- ===== ticket_messages =======================================================
insert into public.ticket_messages (ticket_id, author_user_id, body, is_draft, created_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
   'The current headline feels a bit flat — can we make it punchier?',
   false, now() - interval '2 days'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Sure — I''ve drafted three options, take a look and pick one.',
   false, now() - interval '1 day'),
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Draft reply: published option B, let me know if that works.',
   true, now() - interval '2 hours');

-- ===== reviews ===============================================================
-- FreshHome's connected Google Business reviews (admin Screen 12). Voltline is
-- pre-launch and has none.
insert into public.reviews (client_id, customer_id, author_name, job, body, stars,
  reviewed_at, source, external_id)
values
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000010',
   'Anna Larsen', 'Fortnightly clean',
   'Always thorough and on time. The team is lovely.', 5,
   now() - interval '5 days', 'gbp', 'gbp-rev-0001'),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000011',
   'James Whelan', 'Deep clean',
   'Apartment looked brand new for the inspection. Highly recommend.', 5,
   now() - interval '2 days', 'gbp', 'gbp-rev-0002'),
  ('c0000000-0000-4000-8000-000000000002', null,
   'D. Marsh', null,
   'Good clean overall, missed the balcony though.', 4,
   now() - interval '9 days', 'gbp', 'gbp-rev-0003');

-- ===== campaigns =============================================================
insert into public.campaigns (id, client_id, name, status, budget, starts_at,
  ends_at, external_ref)
values
  ('1a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   '$99 emergency call-out', 'pending', 1200.00, null, null, null),
  ('1a000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
   'Fortnightly clean — Perth western suburbs', 'active', 1800.00,
   now() - interval '21 days', null, 'meta-camp-88421');

-- ===== campaign_activity_events ==============================================
insert into public.campaign_activity_events (campaign_id, category, actor_user_id,
  payload, occurred_at)
values
  ('1a000000-0000-4000-8000-000000000002', 'creative',
   'a0000000-0000-4000-8000-000000000001',
   '{"summary":"Swapped in a new before/after image set."}',
   now() - interval '4 days'),
  ('1a000000-0000-4000-8000-000000000002', 'budget',
   'a0000000-0000-4000-8000-000000000001',
   '{"summary":"Raised daily budget","from":50,"to":65}',
   now() - interval '2 days');

-- ===== automations ===========================================================
-- FreshHome 24-hour follow-up flow (admin Screen 17).
insert into public.automations (id, client_id, name, trigger_type, trigger_config,
  enabled)
values
  ('2a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
   '24-hour follow-up', 'lead_status_unchanged',
   '{"status":"new","afterHours":24}', true);

-- ===== automation_steps ======================================================
-- delay is the structured {amount,unit} (§5 #5); body is a plain-text template
-- with {variable} placeholders (§5 #6).
insert into public.automation_steps (automation_id, position, channel, delay_amount,
  delay_unit, name, subject, body)
values
  ('2a000000-0000-4000-8000-000000000001', 1, 'sms', 24, 'hours',
   'First nudge', null,
   'Hi {first_name}, just following up on your cleaning enquiry — still keen?'),
  ('2a000000-0000-4000-8000-000000000001', 2, 'email', 2, 'days',
   'Detailed follow-up', 'Your FreshHome quote',
   'Hi {first_name}, here is a quick rundown of what a {service} with us includes.'),
  ('2a000000-0000-4000-8000-000000000001', 3, 'sms', 4, 'days',
   'Final check-in', null,
   'Hi {first_name}, last check-in from us — reply STOP to opt out.');

-- ===== notifications =========================================================
-- Mark's (Voltline) notification feed (client Screen 10).
insert into public.notifications (id, recipient_user_id, kind, title,
  source_entity_type, source_entity_id, created_at)
values
  ('9a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
   'lead', 'New lead from Sarah Davies — Mt Hawthorn',
   'lead', 'e0000000-0000-4000-8000-000000000001', now() - interval '32 minutes'),
  ('9a000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002',
   'booking', 'Booking confirmed — Liam Reilly, today 1pm',
   'booking', 'b0000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  ('9a000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   'alert', 'Your funnel is almost ready to publish',
   null, null, now() - interval '3 days');

-- ===== notification_reads ====================================================
-- Mark has read the oldest notification only (the other two stay unread).
insert into public.notification_reads (notification_id, user_id, read_at)
values
  ('9a000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002',
   now() - interval '2 days');

-- ===== Phase 2 fixtures · capability grant + builder baseline ================
-- Mark (Voltline) is the platform's stub editor — a workspace-wide grant
-- (website_id NULL) gives him the Lane B editor capability set. Liam stays a
-- view-only client (no grant -> viewBuilder floor only). This is what makes
-- the §6 RLS negative tests meaningful.
insert into public.capability_grants (id, user_id, website_id, capabilities)
values (
  '11000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000002',
  null,
  '{editCopy,editMedia,editSEO,editSections,useAI}'::capability[]
);

-- A minimal Voltline website + draft baseline version so the builder-family
-- RLS policies have real rows to validate against (Lane B submit, publish gate).
insert into public.websites (id, client_id, name, domain_primary)
values (
  'e1000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000001',
  'Voltline website',
  'voltline.com.au'
);

insert into public.website_versions (id, website_id, status, snapshot, created_by, notes)
values (
  'f1000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000001',
  'draft',
  '{}'::jsonb,
  'a0000000-0000-4000-8000-000000000002',
  'Seed draft baseline'
);

update public.websites
set draft_version_id = 'f1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000001';
