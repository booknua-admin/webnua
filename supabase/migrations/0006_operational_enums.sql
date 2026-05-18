-- =============================================================================
-- Webnua backend — Phase 1 Session B · operational enums.
--
-- backend-schema-design.md §1.7. The closed unions the operational entities
-- (leads / bookings / tickets / reviews / campaigns / automations /
-- notifications / generation) reference. Builder enums (page_type /
-- section_type / version_status / funnel_step_type) land in Phase 1b.
--
-- Enum labels are the verbatim TypeScript union strings so generated types
-- match the front-end types 1:1 with no mapping layer. The `[JC-4]` collapse
-- means there is no message_channel/direction/kind enum — lead_event_kind
-- already encodes channel + direction.
-- =============================================================================

create type lead_status as enum ('new', 'contacted', 'booked', 'completed', 'lost');

create type lead_urgency as enum ('asap', 'today', 'soon', 'none');

create type lead_event_kind as enum (
  'sms_in',
  'sms_out',
  'email_in',
  'email_out',
  'form_submitted',
  'status_changed',
  'booking_created',
  'automation_fired'
);

create type booking_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

create type recurrence_frequency as enum ('weekly', 'fortnightly', 'monthly', 'custom');

create type payment_method as enum ('card', 'cash', 'invoice_7', 'invoice_14');

create type ticket_category as enum (
  'website',
  'website-approval',
  'marketing',
  'campaigns',
  'reviews',
  'billing',
  'other'
);

create type ticket_status as enum ('open', 'in_progress', 'blocked', 'done');

create type ticket_urgency as enum ('rush', 'soon', 'none');

-- The `tickets.awaiting` column is nullable; the enum itself carries the two
-- non-null values ('operator' | 'client'), null = awaiting nobody.
create type ticket_awaiting as enum ('operator', 'client');

create type approval_status as enum ('pending', 'approved', 'rejected', 'recalled');

create type campaign_status as enum ('active', 'paused', 'pending');

create type campaign_activity_category as enum ('creative', 'audience', 'budget', 'tune');

create type automation_channel as enum ('sms', 'email');

create type delay_unit as enum ('minutes', 'hours', 'days');

create type notification_kind as enum ('lead', 'review', 'auto', 'booking', 'alert');

create type generation_fallback_reason as enum ('missing', 'invalid');
