-- =============================================================================
-- Webnua backend — Phase 3 · two more automation library types.
--
-- Adds the appointment-reminder and win-back / re-engagement flows to the
-- library, instantiated per client (8 automations, 16 steps). Same step-
-- template-per-type pattern as migration 0021.
--
--   booking_upcoming  — Appointment reminder    (2 SMS steps)
--   customer_dormant  — Win-back re-engagement  (SMS + email)
-- =============================================================================

insert into public.automations (id, client_id, name, enabled, trigger_type) values
  ('2a000000-0000-4000-8000-000000000014','c0000000-0000-4000-8000-000000000001','Appointment reminder',   true, 'booking_upcoming'),
  ('2a000000-0000-4000-8000-000000000015','c0000000-0000-4000-8000-000000000001','Win-back re-engagement', true, 'customer_dormant'),
  ('2a000000-0000-4000-8000-000000000016','c0000000-0000-4000-8000-000000000002','Appointment reminder',   true, 'booking_upcoming'),
  ('2a000000-0000-4000-8000-000000000017','c0000000-0000-4000-8000-000000000002','Win-back re-engagement', true, 'customer_dormant'),
  ('2a000000-0000-4000-8000-000000000018','c0000000-0000-4000-8000-000000000003','Appointment reminder',   true, 'booking_upcoming'),
  ('2a000000-0000-4000-8000-000000000019','c0000000-0000-4000-8000-000000000003','Win-back re-engagement', true, 'customer_dormant'),
  ('2a000000-0000-4000-8000-000000000020','c0000000-0000-4000-8000-000000000004','Appointment reminder',   true, 'booking_upcoming'),
  ('2a000000-0000-4000-8000-000000000021','c0000000-0000-4000-8000-000000000004','Win-back re-engagement', false,'customer_dormant');

-- --- appointment reminder: 2 SMS steps ---------------------------------------
insert into public.automation_steps
  (automation_id, position, channel, delay_amount, delay_unit, name, subject, body)
select a.id, t.position, t.channel::automation_channel, t.delay_amount,
       t.delay_unit::delay_unit, t.name, t.subject, t.body
from public.automations a
cross join (values
  (1, 'sms', 24, 'hours', 'Day-before reminder', null::text,
   $b$Hi {first_name}, friendly reminder — {business} is booked to see you tomorrow. Reply CHANGE if you need a different time.$b$),
  (2, 'sms', 2, 'hours', 'Same-day heads-up', null,
   $b$Hi {first_name}, {business} here — we are on track to arrive shortly. See you soon!$b$)
) as t(position, channel, delay_amount, delay_unit, name, subject, body)
where a.trigger_type = 'booking_upcoming';

-- --- win-back re-engagement: SMS + email -------------------------------------
insert into public.automation_steps
  (automation_id, position, channel, delay_amount, delay_unit, name, subject, body)
select a.id, t.position, t.channel::automation_channel, t.delay_amount,
       t.delay_unit::delay_unit, t.name, t.subject, t.body
from public.automations a
cross join (values
  (1, 'sms', 60, 'days', 'Win-back check-in', null::text,
   $b$Hi {first_name}, it has been a while! {business} would love to help again — reply YES and we will sort a time.$b$),
  (2, 'email', 7, 'days', 'Win-back offer', 'A little something from {business}',
   $b$Hi {first_name},

We have not seen you in a bit. As a thank-you for being a past customer of {business}, we would love to get you booked back in.

Reply to this email or give us a call and we will look after you.

— {business}$b$)
) as t(position, channel, delay_amount, delay_unit, name, subject, body)
where a.trigger_type = 'customer_dormant';
