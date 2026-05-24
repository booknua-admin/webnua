# Automation architecture

> Phase 8 · Session 1.
> Data model, execution engine, handoff logic, cold-lead detection.

## Why this exists

Until now, every automated message in Webnua was a **hardcoded trigger** — the
public form-submit route enqueued a `send_sms` + `send_email` directly, the
0063 leads-INSERT DB trigger enqueued the operator notification, the 0069
booking-completion trigger enqueued the GBP review request, the Stripe webhook
enqueued the payment-failed alert. Each was a one-off; there was no way to
configure, disable, or even *see* what would fire when.

This session replaces that with a single configurable engine. The lead inbox,
the cold-lead surface, and the automation editor (Session 2) all read from the
same three tables.

## Tables

Three new tables (migration 0076) replace the previous `automations` +
`automation_steps`:

| Table                 | Role                                                  |
|-----------------------|-------------------------------------------------------|
| `automations`         | Definition: trigger, filters, metadata, enabled.      |
| `automation_actions`  | Ordered steps inside one automation (one row each).   |
| `automation_runs`     | One row per fired trigger. Tracks position + status.  |

Plus columns on `public.leads`:

- `automation_state` — `automated` / `taken_over` / `completed` / `archived`
- `taken_over_at`, `taken_over_by`
- `needs_followup_at`, `followup_dismissed_at`, `followup_nudge_count`
- `last_outbound_at`, `last_inbound_at`

### Why one `automation_runs` row per fired trigger

Each run is an attributable event (vision §7) — what fired, when, what
happened, where it currently is. The engine reads `current_action_position`
to know which step to execute next; the API reads `status` + `paused_reason`
to know what to show.

## Trigger types

Six closed values (Postgres enum `automation_trigger_type`):

| Trigger              | Fired by                                       |
|----------------------|------------------------------------------------|
| `lead_created`       | `leads` INSERT trigger (migration 0078)        |
| `job_scheduled`      | `bookings` INSERT trigger (migration 0078)     |
| `job_status_changed` | `bookings` UPDATE trigger (not to 'completed') |
| `job_completed`      | `bookings` UPDATE → 'completed' trigger        |
| `payment_failed`     | Stripe webhook (application code)              |
| `lead_inactive`      | Cold-lead scanner (pg_cron daily)              |

DB triggers enqueue an `automation_trigger` job; the job's handler calls
`engine.onTrigger()`. Application code (Stripe webhook) calls onTrigger
directly via `lib/automations/triggers.ts`.

## Action types

Six closed values:

| Action                       | Pauses on human activity | Notes                          |
|------------------------------|--------------------------|--------------------------------|
| `send_sms_to_lead`           | **yes**                  | Wraps the Phase 7 `send_sms` job |
| `send_email_to_lead`         | **yes**                  | Wraps the Phase 7 `send_email` job |
| `send_operator_notification` | no                       | Wraps `send_lead_notification` or `stripe_payment_failed_notify` |
| `wait_for_duration`          | no                       | Defers the next action; no work |
| `update_lead_field`          | no                       | Inline UPDATE — `status` / `urgency` only |
| `create_followup_task`       | no                       | Sets `leads.needs_followup_at` |

The "pauses on human activity" flag is stored explicitly on each action row
(redundant with the action_type but column-cheap and code-cheap to read).

## Execution flow

```
DB trigger / cold-lead scanner / Stripe webhook
    │
    ▼
enqueue automation_trigger job
    │
    ▼
job handler → engine.onTrigger(clientId, triggerType, event)
    ├── fetch matching enabled automations
    ├── evaluate trigger_filters (requires_phone, requires_gbp_location, …)
    ├── for each match:
    │     ├── insert automation_run
    │     └── enqueue first automation_action job
    ▼
job handler → engine.processNextAction(runId)
    ├── load run + current action
    ├── if action.pauses_on_human_activity:
    │     ├── load lead.automation_state + last_inbound_at + last_outbound_at
    │     └── if taken_over OR inbound newer than last_automation_message OR
    │           recent manual outbound:
    │             → mark run paused, exit
    ├── dispatch to action handler (send_sms / send_email / wait / …)
    ├── advance current_action_position
    └── enqueue next action job (with run_after for waits)
    │
    ▼
end-of-actions → mark run completed
```

Each step is one `integration_jobs` row, so retries, observability, and
deferral all reuse the Phase 7 jobs spine.

## Handoff logic

**The lead inbox is the handoff surface.** When a client manually sends a
message, automation on that lead pauses. Five operations (`lib/automations/handoff.ts`):

| Operation                  | Effect                                                  |
|----------------------------|---------------------------------------------------------|
| `takeoverLead(leadId)`     | Flip state to `taken_over`. Pause running runs (`client_took_over`). |
| `resumeAutomations(leadId)`| Flip state back to `automated`. Paused runs stay paused (operator decision). |
| `markLeadCompleted(leadId)`| Flip state to `completed`. Cancel running + paused runs. |
| `dismissFollowupTask(leadId)` | Set `followup_dismissed_at`. Drops off the cold-lead surface. |
| `recordInboundOnLead(leadId)` | Set `last_inbound_at`. Pause any running comm-action run (`lead_replied`). |

**Wiring points:**

- `useReplyToLead` (operator inbox) → server route `/api/leads/[id]/reply`
  calls `takeoverLead(leadId, userId)` before sending, and
  `recordOutboundOnLead(leadId)` after.
- Resend inbound webhook → calls `recordInboundOnLead(leadId)` for every
  non-auto-responder inbound.
- Comm action handlers (`send_sms_to_lead`, `send_email_to_lead`) →
  call `recordOutboundOnLead(leadId)` after enqueueing the underlying send.

### The "first manual reply = take over" V1 rule

A manual reply is the canonical signal. The brief says the next-comm-action
pre-flight ALSO catches this via three independent checks (defence in depth):

1. `automation_state == 'taken_over'` → `client_took_over`
2. `last_inbound_at > last_automation_message_at` → `lead_replied`
3. `last_outbound_at > last_automation_message_at` AND within the configurable
   `AUTOMATION_PAUSE_AFTER_MANUAL_HOURS` window (default 4h) → `client_took_over`

Check 3 is belt-and-braces for any future inbox surface that forgets to call
`takeoverLead`. It is intentional that the comm-action pre-flight on the
*next* action catches the takeover — that mirrors what the brief asked for.

## Cold-lead detection

`pg_cron` runs at **09:00 UTC daily**. The schedule enqueues one
`cold_lead_scan` job per enabled `cold_lead_nudge` automation (one per client).

The handler in `lib/automations/cold-lead-scanner.ts`:

1. Loads the automation's `trigger_config` (`days_after_last_outbound`,
   `max_nudges`).
2. Queries candidate leads:
   - `client_id` matches
   - `automation_state NOT IN ('completed', 'archived')`
   - `status NOT IN ('completed', 'lost')` (V1 — `archived` is not a status
     enum value, treated as a no-op)
   - `last_outbound_at IS NOT NULL`
   - `last_outbound_at < (now - days_after_last_outbound)`
   - `followup_nudge_count < max_nudges`
   - (NOT already surfaced) `needs_followup_at IS NULL OR followup_dismissed_at IS NOT NULL`
3. For each candidate, filters out leads with inbound newer than outbound
   (in JS — too awkward in PostgREST), then fires
   `onTrigger('lead_inactive', { leadId, automationId })` targeted to the
   triggering automation (`{ automationId }` in OnTriggerOptions).
4. The `cold_lead_nudge` automation's only action is `create_followup_task`,
   which sets `needs_followup_at = now()` and increments `followup_nudge_count`.

### Why surface only, never message

The brief is explicit: Webnua never autonomously messages cold leads. The
client decides the wording. The surface is "you have stalled leads; here
they are." This is `GET /api/leads/needs-followup`.

The 4-day default + 3-nudge cap come from the brief. Both are
`trigger_config` jsonb on the automation row — change them per-client by
editing the automation, no code change needed.

## API endpoints

| Endpoint                                | Caller                  |
|----------------------------------------|-------------------------|
| `GET  /api/leads/[id]/automation-state` | operator / own-client   |
| `POST /api/leads/[id]/take-over`        | operator / own-client   |
| `POST /api/leads/[id]/resume-automations` | operator / own-client |
| `POST /api/leads/[id]/dismiss-followup` | operator / own-client   |
| `GET  /api/leads/needs-followup`        | operator / own-client   |

Auth: bearer token → user → `accessible_client_ids()` check against the
lead's tenant. Cross-tenant access returns 403/404.

## Default automations

Seeded for every existing client (migration 0077) AND for every new client
(via the `clients` INSERT trigger):

| Key                                | Trigger             | Enabled by default | Notes                          |
|------------------------------------|---------------------|--------------------|--------------------------------|
| `lead_acknowledgment_sms`          | lead_created        | **yes**            | Phone-only. Replaces hardcoded |
| `lead_acknowledgment_email`        | lead_created        | **yes**            | Email-only. Replaces hardcoded |
| `operator_lead_notification`       | lead_created        | **yes**            | Replaces the 0063 DB trigger   |
| `job_scheduled_confirmation_sms`   | job_scheduled       | no                 | NEW. Opt-in                    |
| `job_arrival_notification_sms`     | job_status_changed  | no                 | NEW. Opt-in                    |
| `review_request_sms`               | job_completed       | **yes**            | Replaces 0069 trigger. 2h delay. |
| `review_request_email`             | job_completed       | **yes**            | No-phone fallback              |
| `payment_failed_notification`      | payment_failed      | **yes**            | Replaces Stripe-webhook direct |
| `cold_lead_nudge`                  | lead_inactive       | **yes**            | NEW. Safe — never messages.    |

The two NEW message-sending automations (`job_scheduled_confirmation_sms`,
`job_arrival_notification_sms`) are default-OFF — opt-in. The cold-lead
nudge is default-ON because it never sends a message (only writes a follow-up
task).

## What Session 2 needs

Session 2 builds the editor UI and adds:

1. **Templates editor surface** — `automation_actions.action_config.template_key`
   references `sms_templates` / `email_templates`. The editor needs to edit
   the template body and surface variable placeholders. (Today's editor read
   path is wired but the save path throws `AppError.validation` pointing here.)
2. **Multi-action automations** — the UI builder for assembling
   `wait_for_duration` between two `send_sms_to_lead` actions, etc.
3. **Cold-lead surface** — UI that consumes `GET /api/leads/needs-followup`
   and `POST /api/leads/[id]/dismiss-followup`. The data is there now.
4. **Per-run history** — `automation_runs` has the trail. The editor needs
   "last fired N times, paused M times by handoff" rollups.

## Adding new action types

Each future action type touches four places:

1. Add a value to the `automation_action_type` Postgres enum (migration).
2. Add a value to `AutomationActionType` in `engine-types.ts`.
3. Set the pauses-on-human-activity flag in `ACTION_PAUSES_ON_HUMAN_ACTIVITY`.
4. Add a handler file under `lib/automations/actions/` + register in
   `dispatch.ts`.

The engine itself is shape-stable — no new code paths needed.

## Adding new trigger types

Similar shape:

1. Add to `automation_trigger_type` enum.
2. Add to `AutomationTriggerType` union.
3. Either a new DB trigger that enqueues an `automation_trigger` job, OR a
   server-side `fire*` helper in `triggers.ts`.

## Edge cases the engine handles

- **Lead in terminal automation state** (`completed` / `archived`) — `onTrigger`
  skips automations matching that lead. No new runs on terminal leads.
- **Lead replied between trigger and first action** — the pre-flight on the
  first action's run catches it; the run pauses immediately.
- **In-flight automation when the manual reply lands** — `takeoverLead`
  flips state AND moves all running runs on the lead to `paused`. Defensive
  pre-flight on next action will see `automation_state='taken_over'` either
  way.
- **Cold lead with no outbound at all** — the scanner's
  `last_outbound_at IS NOT NULL` filter excludes them. A lead must have been
  contacted at least once before it can go cold.
- **Already-surfaced lead going cold AGAIN** — `followup_dismissed_at` is
  the watermark. Once dismissed, the scanner can re-pick it up if it stays
  quiet for another `days_after_last_outbound` and the nudge cap isn't hit.
- **Race: scanner running while lead status changes mid-scan** — the SQL
  query reads `automation_state NOT IN (...)` at scan time; a status change
  between query and `onTrigger` is harmless: the engine re-checks state at
  trigger time AND on each pre-flight, so a closed lead won't fire.

## Observability

- `automation_runs` is the run log.
- `integration_jobs.payload` carries the trigger event + runId.
- `integration_call_log` carries every outbound integration call from the
  underlying send_sms / send_email / etc. handlers.

A future "automations debug" surface could read these three together.

## Configuration

| Env var                              | Default | What it does                          |
|--------------------------------------|---------|---------------------------------------|
| `AUTOMATION_PAUSE_AFTER_MANUAL_HOURS` | `4`     | Window for the belt-and-braces pause-on-recent-manual-outbound check. |
| `COLD_LEAD_SCAN_TIME_UTC`            | `09:00` | Cron line carries 09:00 UTC at the moment. Change the migration to change the cron line. |

## Where this lives in code

```
src/lib/automations/
  engine-types.ts       — row + event types
  engine.ts             — onTrigger, processNextAction, shouldPauseForHumanActivity
  handoff.ts            — takeoverLead, dismissFollowupTask, recordInboundOnLead, …
  triggers.ts           — fire* helpers for server code (Stripe webhook)
  cold-lead-scanner.ts  — runColdLeadScan
  job-types.ts          — AUTOMATION_TRIGGER_JOB, AUTOMATION_ACTION_JOB, COLD_LEAD_SCAN_JOB
  job-handlers.ts       — register all three with the jobs spine
  lead-access.ts        — shared bearer-token auth helper for /api/leads/[id]/...
  actions/
    dispatch.ts         — switch on action_type → handler
    send-sms.ts         — wraps send_sms job + GBP audit
    send-email.ts       — wraps send_email job + GBP audit
    operator-notification.ts — wraps send_lead_notification / stripe_payment_failed_notify
    wait.ts             — returns delayMs to defer the next action
    update-field.ts     — inline UPDATE leads.{status,urgency}
    create-followup-task.ts — sets needs_followup_at + bumps count
  queries.tsx           — UI hooks (existing, retargeted to new schema)

src/app/api/leads/
  [id]/automation-state/route.ts
  [id]/take-over/route.ts
  [id]/resume-automations/route.ts
  [id]/dismiss-followup/route.ts
  needs-followup/route.ts

supabase/migrations/
  0076_automation_engine_schema.sql      — drops old, creates new
  0077_seed_default_automations.sql      — seed + new-client INSERT trigger
  0078_automation_triggers_and_cron.sql  — DB trigger refactor + cold-lead cron
```
