# Webnua — strategic vision

> The strategic spine. This is the *why* behind the platform — the document the
> build docs (`builder-design.md`, the cluster checklists) answer to. When a
> build decision and this doc disagree, that's a conversation, not a silent
> override. Kept short on purpose; read it at the start of strategic work.

---

## 1. What Webnua is

Webnua is a done-for-you growth platform for small service businesses —
electricians, cleaners, locksmiths, the trades. A Webnua customer is a business
owner who wants more of the right jobs and none of the marketing work. Webnua
gives them a funnel, a booking flow, lead capture, review collection, and the
automations that tie those together — built, launched, and managed *for* them.

It is one product with two faces. The **client** sees their own business —
their leads, their calendar, their funnel, their reviews. The **operator** (the
Webnua team) sees every client at once, plus the build pipeline that turns a new
sign-up into a live funnel. One codebase, one design system, role-based routing.

## 2. The low-ticket position

Webnua is deliberately **low-ticket**. The customer is a sole trader or a small
crew, not an enterprise marketing department. They will not pay agency retainers
and they will not run software themselves. The price has to sit where a tradie
signs up without a meeting — which forces two things:

- **Acquisition and delivery must be cheap to run.** A high-touch onboarding
  call per customer does not survive at this price. Onboarding has to compress
  to minutes, and the marginal cost of running an account has to trend toward
  zero as volume grows (see §6).
- **The product has to feel like more than its price.** A tradie paying
  low-ticket money should still feel they have a marketing team. That gap —
  between what it costs and what it feels like — is the whole game (§3).

Low-ticket is not "cheap." It is a discipline: every operator hour the model
spends per customer is a tax on how far it scales.

## 3. The promise — "feels human, AI delivers"

The customer relationship feels human. There is a named person, plain-English
updates, a real reply when they text. What the customer should never feel is
that they are being handled by software.

Behind that surface, **AI does the delivery work** — drafting funnel copy,
generating page sections, writing automation sequences, triaging leads. The
human warmth is the interface; the AI is the engine room. The platform is built
so the seam never shows: the operator surfaces are designed for a human to add
judgement on top of AI output fast, not to do the work from scratch.

This is the bet: a customer who *feels* personally looked after, delivered at a
cost structure that only AI makes possible.

## 4. The trajectory — operator-led, then agent-installed

Today Webnua is **operator-mediated**. A Webnua operator drives the onboarding
wizard, reviews AI-generated funnels, approves changes, manages the cross-client
pipeline. The operator is the quality gate and the human voice.

The trajectory is to **install agents underneath the operator, role by role**,
not to replace the operator wholesale. Each operator task — generate a draft,
triage a lead, draft a reply, run a preflight check — graduates in three stages:
operator does it by hand → operator reviews an AI draft → an agent does it and
the operator only sees exceptions. The operator's job moves up the stack from
*doing* to *supervising* to *handling what the agent flags*.

A self-serve tier — where the business owner onboards themselves — sits on the
near horizon and rides the same machinery. The wizard's Q&A flow and guided
draft-walk were built operator-initiated but onboarding-agnostic for exactly
this reason.

## 5. The data flywheel

Every operator decision is **training data for the agent that will eventually
make that decision**. When an operator edits an AI-drafted headline, picks one
funnel reframe over two others, force-publishes with a reason, rejects a
submission, or marks a job complete — that is a labelled example of expert
judgement on a real account.

The flywheel: more customers → more operator decisions captured → better agents
→ operators handle more accounts each → cheaper delivery → lower price / wider
market → more customers. The data captured today is what lets §4's
operator-to-agent graduation actually happen. A platform that only *executes*
operator decisions and does not *record* them throws the flywheel's fuel away.

This is why §7 matters: the capture is not a backend afterthought, it is the
strategic point of the operator surfaces.

## 6. The capability ladder and the scaling curve

**The capability ladder** is how trust is granted incrementally. Access is not
all-or-nothing — it is a graded set of capabilities (view, edit copy, edit
layout, publish, approve, manage domains, …). A new client starts low on the
ladder; an operator can grant rungs per client, per surface. The same ladder
governs internal roles — a junior operator gets a subset, scoped to assigned
clients. The ladder is what lets one mechanism serve "read-only client,"
"DIY-tier client," "junior operator," and "full operator" without four separate
systems.

**The scaling curve** is the economic shape Webnua is chasing: the cost to serve
the Nth customer should fall as N rises. Operator hours per account must bend
down over time — driven by §4's agent installation and §5's flywheel — while
quality holds or improves. If cost-per-account stays flat, Webnua is an agency
with software; if it bends down, Webnua is a platform. Every architecture
decision is measured against which curve it puts us on.

## 7. Platform implications — operator surfaces are data-capture surfaces

The central architectural consequence of §5: **an operator surface is not just
operator tooling — it is a data-capture surface.** Wherever an operator exercises
judgement, the surface must be designed so that judgement lands as structured,
recordable data, not as an untracked side effect of a click.

Concretely, when building any operator (or operator-adjacent client) surface:

- **Model the decision, not just the action.** A "publish" button that mutates
  state is tooling; a publish that records *who, what, why, against which
  alternative* is a capture surface. The force-publish reason field is the
  pattern — make the structured-capture version the default, not the deluxe one.
- **Prefer discrete, attributable events** over free-form blobs. An activity
  feed whose rows each correspond to a typed event is a clean backend target;
  a rendered paragraph is not.
- **Surfaces with the most operator judgement deserve the most capture care** —
  the single-client overview hub, anything involving approve/reject, job
  completion, lead triage. These are where the flywheel's highest-value
  examples are generated.
- **Capture-readiness is a design constraint now; the capture layer itself is a
  backend-pass concern.** We are not building the data pipeline during the
  frontend phase. We *are* obliged to design every operator surface so the
  backend pass has clean, obvious targets — typed events, attributable
  decisions, structured reasons — rather than having to reverse-engineer intent
  out of UI state later.

A surface that captures nothing still "works." It just doesn't feed the
flywheel — and a platform that doesn't feed the flywheel is, over time, just an
agency. Design operator surfaces accordingly.
