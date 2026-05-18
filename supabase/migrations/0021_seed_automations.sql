-- =============================================================================
-- Webnua backend — Phase 3 · seed the full automation library.
--
-- The frontend shows an automation per type per client (instant-confirm,
-- 24-hour follow-up, review request loop, no-show recovery). Phase 1 seeded
-- only one automation, so wiring `/automations` to live data would surface
-- just that one. This reseed inserts the full library — 13 automations across
-- the four clients, with their step templates — so every automation the UI
-- shows is a real, editable row.
--
-- Step bodies are plain-text templates with {placeholder} variables (design
-- §5 #6 — the editor parses placeholders for highlighting; the DB stores
-- text). The four automation types share a step template, instantiated per
-- client — which is how the real platform's automation library works.
-- =============================================================================

delete from public.automation_steps;
delete from public.automations;

-- --- automations -------------------------------------------------------------
insert into public.automations (id, client_id, name, enabled, trigger_type) values
  ('2a000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Instant confirm SMS',       true,  'lead_created'),
  ('2a000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','24-hour follow-up sequence',true,  'lead_stale_24h'),
  ('2a000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000001','Review request loop',      true,  'job_completed'),
  ('2a000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000001','No-show recovery',         false, 'booking_no_show'),
  ('2a000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000002','Instant confirm SMS',       true,  'lead_created'),
  ('2a000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000002','24-hour follow-up sequence',true,  'lead_stale_24h'),
  ('2a000000-0000-4000-8000-000000000007','c0000000-0000-4000-8000-000000000002','Review request loop',      true,  'job_completed'),
  ('2a000000-0000-4000-8000-000000000008','c0000000-0000-4000-8000-000000000003','Instant confirm SMS',       true,  'lead_created'),
  ('2a000000-0000-4000-8000-000000000009','c0000000-0000-4000-8000-000000000003','24-hour follow-up sequence',true,  'lead_stale_24h'),
  ('2a000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000003','Review request loop',      true,  'job_completed'),
  ('2a000000-0000-4000-8000-000000000011','c0000000-0000-4000-8000-000000000003','No-show recovery',         true,  'booking_no_show'),
  ('2a000000-0000-4000-8000-000000000012','c0000000-0000-4000-8000-000000000004','Instant confirm SMS',       true,  'lead_created'),
  ('2a000000-0000-4000-8000-000000000013','c0000000-0000-4000-8000-000000000004','24-hour follow-up sequence',false, 'lead_stale_24h');

-- --- instant-confirm: 1 SMS step ---------------------------------------------
insert into public.automation_steps
  (automation_id, position, channel, delay_amount, delay_unit, name, subject, body)
select id, 1, 'sms', 0, 'minutes', 'Instant confirmation', null,
  $b$Hi {first_name}, thanks for getting in touch with {business}! We have your enquiry and will be back to you within 90 minutes. — {business}$b$
from public.automations where trigger_type = 'lead_created';

-- --- 24-hour follow-up: 3 steps (SMS / email / SMS) --------------------------
insert into public.automation_steps
  (automation_id, position, channel, delay_amount, delay_unit, name, subject, body)
select a.id, t.position, t.channel::automation_channel, t.delay_amount,
       t.delay_unit::delay_unit, t.name, t.subject, t.body
from public.automations a
cross join (values
  (1, 'sms', 24, 'hours', 'Soft follow-up · check-in', null::text,
   $b$Hi {first_name} — still after a hand with {job_type}? I have a couple of slots free this week. Reply YES and I will lock one in. — {business}$b$),
  (2, 'email', 48, 'hours', 'Story + social proof', 'Still need a hand, {first_name}?',
   $b$Hi {first_name},

Just checking in. We helped another customer near {suburb} last week with the same job — sorted quickly and within budget.

Happy to swing past this week if you are still looking. Reply with a time that suits.

— {business}$b$),
  (3, 'sms', 5, 'days', 'Last attempt · no pressure', null,
   $b$Last one from me, {first_name} — just checking you got sorted? If not, I still have room this week. — {business}$b$)
) as t(position, channel, delay_amount, delay_unit, name, subject, body)
where a.trigger_type = 'lead_stale_24h';

-- --- review request loop: 2 SMS steps ----------------------------------------
insert into public.automation_steps
  (automation_id, position, channel, delay_amount, delay_unit, name, subject, body)
select a.id, t.position, t.channel::automation_channel, t.delay_amount,
       t.delay_unit::delay_unit, t.name, t.subject, t.body
from public.automations a
cross join (values
  (1, 'sms', 2, 'hours', 'Review request', null::text,
   $b$Hi {first_name}, thanks for choosing {business}! If you have 30 seconds, a quick Google review really helps us out: {review_link}$b$),
  (2, 'sms', 5, 'days', 'Review reminder', null,
   $b$Hi {first_name} — no rush, but if you were happy with {business} a quick review would mean a lot: {review_link}$b$)
) as t(position, channel, delay_amount, delay_unit, name, subject, body)
where a.trigger_type = 'job_completed';

-- --- no-show recovery: 1 SMS step --------------------------------------------
insert into public.automation_steps
  (automation_id, position, channel, delay_amount, delay_unit, name, subject, body)
select id, 1, 'sms', 0, 'minutes', 'No-show rebook', null,
  $b$Hi {first_name}, sorry we missed you today! No worries at all — grab a new time that suits here: {rebook_link}. — {business}$b$
from public.automations where trigger_type = 'booking_no_show';
