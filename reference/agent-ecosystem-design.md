# Agent Ecosystem Design — the autonomous marketing team

> Status: **vision + architecture** (no code yet). This doc maps the proposed
> autonomous "agent team" onto the substrate that exists today, names the
> structural gaps, and proposes the build shape. It is a standing reference —
> when an agent layer ships, fold the as-built detail back into this file and
> into `CLAUDE.md`'s inventory.
>
> Companion docs: `automation-architecture.md` (the Phase 8 rule-based engine
> this builds on), `backend-schema-design.md` (data shapes), `build-roadmap.md`
> (phase sequencing).

---

## 1. What this is

The agent ecosystem is **a digital marketing agency rendered as software** — a
team of AI workers, organised with junior and senior tiers, coordinating toward
one goal:

> **More customers for each client, at the lowest cost possible to them, while
> delivering the best-quality content and marketing materials possible.**

This is the brain and backend ecosystem intended to fuel the business's revenue
streams. It is **human-in-the-loop**: a human operator is the editor-in-chief
and final approver, scaling to ~100 client accounts by reviewing *exceptions and
flagged proposals* rather than every action.

### The non-obvious thesis

**The org metaphor is also the cost-control architecture.** Seniority maps
directly onto model tier + escalation policy:

- A *junior copywriter* drafting 40 ad variants → **Haiku** (cheap, high-volume).
- A *senior copywriter* writing the hero page that defines the brand voice →
  **Opus** (expensive, low-volume, high-stakes).

You do not run Opus on everything — that is how "lowest cost" stays honest.
Junior/senior is therefore a literal routing policy:
**task stakes → model tier → escalate up a tier on low confidence, high spend,
or repeated failure.** Get this right and a hundred clients' worth of marketing
runs on a margin that works.

---

## 2. The objective function

"More customers, lowest cost, best quality" is three goals in tension. To
*optimise* it (rather than just perform tasks), the team is graded against a
**per-client scorecard**:

| Dimension | Metric | Data source today |
|---|---|---|
| More customers | leads × lead→customer conversion | `leads`, `source_kind`, `lead_events`, `bookings` |
| Lowest cost (client's) | CPA = ad spend ÷ customers won | `meta_ads_insights` + conversions |
| Lowest cost (Webnua's) | compute + labour per client/month | **nothing tracks this yet** |
| Best quality | brand-safe, on-voice, no fabrication, converting | analytics (CTR / scroll / form completion) + guardrails |

### Two economic layers (this is what makes it a business)

1. **The client's economics** — what the team optimises *for* the client (their CPA).
2. **Webnua's economics** — the client pays **€299 flat/month**. If their agents
   burn €180 of Opus calls that month, the margin is gone. The system therefore
   optimises the client's CPA **subject to a Webnua compute budget per client.**
   The **cost governor** is a first-class component, not an afterthought — treat
   compute spend like ad spend: metered, budgeted, attributed.

The **Account Manager agent** holds this scorecard and is graded on it.
Everything else serves it.

---

## 3. The org chart (= the routing + escalation policy)

```
        Human Operator   ← editor-in-chief / final approver
               │            (reviews exceptions + flagged proposals, not every action)
               │
       Account Manager (GM)  ← holds the goal, budget, scorecard; decomposes
       ╱       │       ╲        into briefs; orchestrates; reports
  Strategy  Production  Client GM (always-on ops)
  (senior,  (junior,    ├─ messaging / follow-ups / reviews   ← automation engine (LIVE)
   Opus)     Haiku/      └─ inbound responder                 ← NEW loop on handoff layer
  ├ SEO       Sonnet)
  │ Strategist  ├ Jr Copywriter (drafts)
  ├ Media Buyer ├ Jr Designer (variants)
  └ CRO Lead    └ Jr Ads operator (builds to spec)
```

- **Strategy (senior)** — sets direction; low volume, high stakes, Opus.
  Keyword strategy, media plan, CRO hypotheses.
- **Production (junior)** — executes briefs; high volume, low stakes, cheap
  models. Drafts, variants, campaign builds.
- **Review** — its own gate. A senior (or a dedicated *critic* agent) critiques
  junior output before it ships. Then the human approves senior-reviewed work.
  This is a **three-tier quality gate**; the autonomy dial decides which gates
  auto-pass per client (`off → propose-only → auto-below-threshold → full-auto`).
- **The human is the senior partner**, not the worker — which is what lets one
  person supervise 100 accounts.

---

## 4. The seven roles — expanded, mapped, gapped

Legend: ✅ wired · ⚠️ partial · ❌ absent · 🗓️ planned-not-built.

### 4.1 Copywriter (junior + senior)

| Capability | Status | Maps to |
|---|---|---|
| Website copy | ✅ | `/api/generate-site` → `generate-live.ts` (Opus, single-shot, `generation_log`) |
| Landing page copy | ✅ | `/api/generate-funnel` → `generate-funnel-live.ts` (two-step) |
| Ad copy (Meta) | ✅ | `/api/integrations/meta_ads/generate-angles` + `draft-creatives` |
| Ad copy (Google) | ❌ | no Google Ads integration exists |
| Blog writing | ❌ | no table, route, editor, section type, or publish lane |

**Gaps:** blog is fully greenfield (needs `blog_posts`, an editor surface, a
publish lane, SEO meta, public render). Google ad copy is blocked on the Google
Ads integration. No copy-*refresh* loop — every route is one-shot and
human-triggered; a real agent reads performance and proposes rewrites.
Brand-voice memory is just the 3 voice axes + audience line.

### 4.2 SEO Strategist (mostly senior)

| Capability | Status | Maps to |
|---|---|---|
| Initial local SEO audit | ❌ | — |
| Keyword strategy | ❌ | — |
| Website SEO audit | ⚠️ | `preflight.ts` exists but it is *publish-readiness*, not SEO |
| Ongoing optimisation | ❌ | `generate-seo` writes meta tags once; no feedback loop |
| Data collection | ⚠️ | `analytics_funnel_daily` exists; **no search/ranking data**, GBP insights stubbed |

**~90% greenfield — the biggest gap.** Dependency order:
1. **External data sources** (the gating dependency) — Google Search Console API
   (CTR / position / queries) + a keyword API (DataForSEO / SerpApi) for
   volume/intent. None wired.
2. Ranking-tracking table + sync job (slots into `integration_jobs` + pg_cron).
3. Local SEO audit module (GBP completeness + NAP/citation consistency).
4. Real SEO website audit (titles, headings, internal links, schema, speed).
5. Optimisation loop — GSC CTR/position → propose rewrites → Copywriter → approval.

### 4.3 Media Buyer / Ads (junior + senior, Meta + Google)

| Capability | Status | Maps to |
|---|---|---|
| Performance tracking | ✅ | `meta_sync_insights` → `meta_ads_insights` |
| Data collection | ✅ | `meta_sync_campaigns` / `meta_sync_leads` |
| Publish / kill | ⚠️ | launch orchestrator + pause/activate; **no auto-kill** |
| A/B testing | ⚠️ | matrix launch builds M×N copy×image test; **no winner-detection / loser-pruning** |
| Audience building | ⚠️ | targeting search in wizard; no autonomous iteration |
| Account / budget optimisation | ❌ | — |
| Ad review | ❌ | — |
| **Google Ads (all)** | ❌ | not built |

**The Meta half maps to the already-planned Phase 7.5 Sessions 2–5** (anomaly
detection → "Today's actions" queue → creative refresh → AI digest), which are
**planned, not built**. No `meta_campaign_flags` table, no anomaly scan, no
auto-pause-on-high-CPL, no budget reallocation, no matrix winner logic.
Budget optimisation needs the parked `meta_max_daily_budget_cents` policy key as
a clamp. **Highest-ROI agent to build first — the data already flows.**

### 4.4 Graphic Designer (junior)

| Capability | Status | Maps to |
|---|---|---|
| Image collection | ⚠️ | `injectStockImages` (industry stock) + operator upload; no autonomous sourcing |
| Headline injection | 🗓️ | Session 1.4b browser-canvas compositor — designed, not built |
| Develop variants | ⚠️ | matrix makes copy×image combos but images are operator-uploaded |

**Gaps:** no AI image generation, no stock-photo API search, no canvas
compositor for headline-over-image, no creative-fatigue → refresh loop (Phase
7.5 Session 4). Depends on the Ads agent — sequence after it.

### 4.5 CRO Lead (senior)

| Capability | Status | Maps to |
|---|---|---|
| Landing page audits | ❌ | (preflight ≠ conversion audit) |
| Ad audits | ❌ | — |
| Correlation reporting | ❌ | — |
| Suggest improvements | ❌ | — |
| A/B test headlines & CTAs | ⚠️ | section variants + AI alternatives exist; **no experiment framework** |
| Funnel testing (LP vs LP+Schedule) | ❌ | funnels are single-variant |

**Strong foundation, no framework.** The analytics substrate is genuinely good
— `analytics_funnel_daily` carries visits, scroll depth (25/50/75/90), per-CTA
clicks (`element_label`), form started/abandoned/submitted, and per-funnel-step
breakdown (`page_ref`). Missing: a **website/funnel experiment framework**
(variant definition → traffic split → measure → statistical conclusion), a CRO
**audit module** that reads the analytics and proposes specific changes, and
**correlation reporting** (ad → LP → conversion; the `source_kind` /
`source_funnel_id` join exists, the reporting doesn't). Second-highest leverage
— data exists, just needs the framework.

### 4.6 Client GM (always-on ops)

| Capability | Status | Maps to |
|---|---|---|
| Automation messages to leads | ✅ | the **automation engine** (Phase 8) — this agent largely *is* it |
| Follow-ups | ✅ | `lead_inactive` / 24h-follow-up automations |
| Review requests | ✅ | GBP review-request automation (`job_completed` → 2h → SMS/email) |
| Schedule management | ⚠️ | bookings + recurring schedules exist; no autonomous scheduling |

**Most-built agent.** Engine, suppression (frequency caps / quiet hours /
priority tiers), and human-takeover (`takeoverLead` / `resumeAutomations`) are
live. **Gaps:** it is rule-based, not reasoning-based — templated messages, no
personalised re-engagement. The high-value upgrade is an **inbound-conversation
responder** (lead replies "what's your price?" → contextual answer) — a new
reasoning loop on top of the existing handoff infrastructure; start in
"draft-for-approval" mode before "auto-reply".

### 4.7 Account Manager (the keystone / orchestrator)

| Capability | Status | Maps to |
|---|---|---|
| Assign tasks / manage other agents | ❌ | no agent-task model, no orchestrator |
| Review & build reports | ⚠️ | digest *templates* exist; **no metric-computation service to fill them** |
| Engage client via tickets | ⚠️ | tickets system exists; no autonomous responder |
| Send updates | ⚠️ | digest email job handler exists; content generation doesn't |
| General orchestration | ❌ | — |

The Account Manager is simultaneously the **orchestrator** (decomposes the
client goal, dispatches specialists, sequences pipelines) and the **human-loop
interface** (assembles proposals into a reviewable queue, reports to the
client). Nothing here works without the missing substrate (§5).

---

## 5. The missing substrate

The existing platform is a strong **execution tier** with **no agent tier**.
What is wired: the `integration_jobs` queue + pg_cron poller + executor route;
the automation engine; single-shot generation routes; Meta sync + launch; the
publish-approval queues. What is absent is everything that makes these a *team*.

### 5.1 What "agents" needs (vs the seven-tools framing)

1. **Agent-task model** — an `agent_tasks` / `agent_runs` table, sibling to
   `automation_runs`:
   `{ agent_type, seniority, client_id, status (proposed|approved|running|done|rejected), input_context, proposed_action, reasoning_trace, confidence, created_by (cron|operator|agent), reviewed_by, decision, compute_cost }`.
   The unit of human-in-the-loop work.
2. **A reasoning runtime** — the genuine net-new. Every AI call today is
   single-shot. Agents need a **tool-use loop**: gather context → reason →
   propose → on approval, act. This is what the Claude Agent SDK is built for.
   Specialists become *configs* over one runtime (system prompt + tool-set +
   model tier + output schema).
3. **Proposal → review → execution** — generalise the existing publish-approval
   queue into a cross-agent **"Agent proposals" queue** (the Phase 7.5 "Today's
   actions" queue is the same pattern scoped to ads — build it once, cross-agent,
   cross-client). This is the trust spine.
4. **Execution via the existing job queue** — once approved, actions dispatch
   through `integration_jobs`. **No new execution plumbing needed.**
5. **Guardrails / autonomy policy** — extend the agency-policy resolver (Layer
   2/2.5/3) with per-agent per-client autonomy keys + thresholds (spend change
   > X needs approval). Reuses the resolver already built.
6. **Audit & confidence** — `agent_tasks.reasoning_trace` + `integration_call_log`
   answer "why did the agent propose this." Low-confidence forces human review
   regardless of autonomy setting.

### 5.2 What "team" adds on top of "agents"

1. **A shared client brain (per-client memory).** The biggest net-new. Today
   every generation is stateless — the Copywriter doesn't know what the Media
   Buyer tried last month. A team needs durable shared context: brand, goal,
   budget, **what's been tried, what worked, what failed, and why.** Without it
   you have seven contractors who've never met. The runtime's read/write memory.
2. **The feedback loop is the whole point.** "Optimise CPA" requires outcomes
   to inform the next decision. The measurement substrate exists (analytics,
   insights, conversions); **nothing closes it back to agent behaviour.** The
   loop — *act → measure → learn → next brief* — is what turns the team from
   "produces content" into "produces *better, cheaper* content over time." Makes
   the CRO experiment framework + clean attribution load-bearing.
3. **Inter-agent workflows (pipelines, not isolated calls).** The Account
   Manager runs **DAGs of agent tasks** — SEO brief → junior copy drafts →
   senior review → CRO A/B → media buyer promotes winner → results post back to
   the brain. The `integration_jobs` queue executes steps; the workflow layer
   that sequences them and passes artifacts is missing.

---

## 6. UI / UX gaps (the human loop is mostly missing)

| Surface | Status | Why it matters |
|---|---|---|
| **Operator Command Center / Today's Actions** | ❌ | The #1 missing UI. Cross-agent, cross-client: "Agent X proposes Y for client Z — approve / edit / reject." Generalises the `/tickets` approvals tab. |
| **Per-client agent activity feed** | ⚠️ | `ActivityFeed` + hub insight bands exist; extend to "what your AI team did." |
| **Agent autonomy settings** | ❌ | Per-agent per-client dial (off / propose / auto). Maps to policy keys. |
| **Report review surface** | ❌ | Agent drafts the weekly report; operator approves/edits before send. |
| **Client-facing transparency** | ⚠️ | Some exists (campaign activity, managed bands); the "you have an AI team" story needs a home on the client dashboard. |
| **Confidence + escalation cues** | ❌ | Agent flags low-confidence work for mandatory review. |

---

## 7. Tensions to hold while designing

- **Cost runaway** — agents looping on Opus is the failure mode. Seniority
  routing + a per-client compute budget + the escalation policy *are* the
  control. Meter compute like ad spend.
- **Quality compounds silently at full-auto** — at 100 clients, a bad pattern
  shipped autonomously damages 100 brands before anyone looks. The critic agent
  + the existing no-fabrication guardrails (placeholder-testimonial detection,
  no-invented-prices, no-fake-stats) are what make autonomy safe. Don't raise
  the autonomy dial faster than the critic earns trust.
- **Attribution is the hard science** — "did the rewrite cause the CPA drop?"
  needs experiment discipline (the CRO framework), or the loop learns from noise.

---

## 8. Recommended sequencing

1. **Agent runtime (tool-use loop) + the shared client brain** — build together;
   the brain is the runtime's memory.
2. **The scorecard + cost governor** — the objective function made real,
   including Webnua's own compute spend per client. Without it "optimise" has no
   gradient.
3. **Proposal → review → approval queue** with the three-tier quality gate and
   seniority routing (stakes → model tier → escalation).
4. **Workflows** sequencing agents into pipelines.
5. **Ads agent autonomy** (Phase 7.5 Sessions 2–5) — highest ROI, data flows,
   validates the spine via the "Today's actions" queue.
6. **CRO agent** — analytics substrate exists; build the experiment framework.
7. **Account Manager orchestrator + report-generation** — once the spine is proven.
8. **Client GM inbound-responder** — high-value upgrade on the mature handoff layer.
9. **SEO agent** — gated on external data sources; biggest greenfield.
10. **Copywriter blog + Google Ads + Graphic Design (image gen / compositor)** —
    new feature surfaces.

Specialists become configs once 1–4 exist: system prompt + tool-set + model tier
+ output schema, with junior and senior variants of each role.

---

## 9. Feasibility & the build-vs-run distinction

The recurring question — "can this be built with Claude Code alone?" — needs the
term split three ways, because the answer differs for each:

| "Claude Code" means… | Verdict | Reality |
|---|---|---|
| The CLI / dev tool — to **build** the system | ✅ Yes | It's building this platform already. Schema, runtime, routes, UI, integrations all in scope. |
| The CLI — as the production **runtime** | ❌ No | You do not run 100 clients' nightly loops by spawning CLI sessions. It's a developer harness, not a multi-tenant server. |
| The underlying **Claude Agent SDK / API** | ✅ Yes — for the runtime | What the CLI is built on. Agents run as the **Agent SDK invoked as a library inside the existing `integration_jobs` queue** — same model family, library form. |

**Claude Code builds it; the Agent SDK runs it; the queue schedules it.**

### The reframe that makes or breaks it: LLM vs deterministic

The biggest failure mode is treating the whole loop as "AI." It is ~50%
deterministic software, ~30% existing infrastructure, ~20% third-party
integrations Claude cannot conjure.

| Part of the vision | Engine | Why |
|---|---|---|
| Strategy, briefs, copy, creative direction, **review/critique**, report narratives, inbound replies | **Claude (judgment)** | Genuine reasoning. The Agent SDK's home turf. |
| Scorecard maths, cost governor, the **decision trees** (§3), priority scoring, approval state machine, scheduling | **SQL + code** | An LLM computing CPL or deciding *when* to act is slow, costly, unreliable. **Code decides *when*; Claude decides *what the copy says*.** The §3 decision trees are pseudocode for deterministic rules, NOT prompts. |
| Execute (Meta API, CMS write, send SMS) | **Existing executors + queue** | Already built. Agents propose; the queue runs. |

### Feasibility caveats that are real (none are "can Claude do it")

- **Cost governor is existential, not nice-to-have** (see §10). The €20/client
  budget is achievable but a naive daily-Opus-everywhere build blows it instantly.
- **Don't over-decompose the org chart into model calls.** Each agent's 4–5
  "sub-agents" are a *mental model*, not a 1:1 map to model calls. Many
  ("Creative Fatigue Detector", "Budget Optimiser", "Form Friction Analyst") are
  **deterministic functions**, not LLMs. More sub-agents = more cost, latency,
  failure surface. Map the chart to *responsibilities*, not *processes*.
- **The learning loop is statistically weak at single-client scale.** A roofing
  client gets ~20 leads/month; an A/B test rarely reaches significance in two
  weeks. Per-client "learnings" are **hypotheses, not conclusions**. The real
  signal is **cross-client** (pool insights across similar trades) — so build
  `agent_learnings` cross-client from day one (raises the data/ToS question
  already parked in `CLAUDE.md`).
- **Human-review budget only holds if the queue is exception-based.** 20
  min/client/month × 100 clients ≈ one FTE — but only if most actions
  auto-execute below threshold. If everything routes to approval, the headcount
  math breaks. The autonomy dial is what makes the human scale.

### What to prove before the full build

Ship **Workflow A (cheaper leads) end-to-end for one client, instrumented for
cost**, on the Phase-1 spine: measure → detect → brief → draft (Haiku) → review
(Opus) → human approve → launch → measure → learn, every token costed. That one
proof tells you whether €20/client holds and whether the loop produces lift.
Everything else is replication.

---

## 10. Cost model (the governor is the business)

Two economic layers, both metered:

1. **Client's economics** — what the team optimises *for* the client (their CPA).
2. **Webnua's economics** — client pays a flat fee; if their agents burn €18 of
   compute that month, the margin is gone. The system optimises client CPA
   **subject to a per-client compute budget.**

**Per-client envelope (illustrative):** ~€20/month AI compute, ~20 min human
review. Order-of-magnitude routing (verify against live pricing):

| Work | Tier | Cadence | Rough cost |
|---|---|---|---|
| Account-Manager daily health check | Sonnet | daily | ~€1.5/mo |
| (same on Opus daily — **avoid**) | Opus | daily | ~€8/mo (40% of budget!) |
| Junior copy/design drafts | Haiku | high-volume | fractions of a cent each |
| Senior review / strategy | Opus | weekly/monthly | ~€1–3/mo total |

**Conclusion: €20 is feasible only with disciplined routing** — Sonnet (or
cheaper) on the daily loop, Haiku for production, Opus reserved for weekly
strategy + final review. The junior/senior tiering is not org theatre; it is the
margin-control mechanism, enforced in code from day one (routing + per-client
budget + batching + prompt caching). If compute trends high, the governor's
levers: cheaper models, fewer senior reviews, batch tasks, pause low-impact
experiments, reduce generation volume.

---

## 11. Business model & go-to-market

> The agent ecosystem is the *cost structure*, not the product. The product is an
> **outcome** (booked jobs) sold to a market human agencies can't serve
> profitably. This section is the commercial half of the design.

### 11.1 Positioning — sell the outcome, hide the AI

A local tradesperson does not want "AI" or "agency services" — they want the
phone to ring. Three rules:

- **Never sell "AI agents."** Sell *"your marketing team"* / *"more local jobs,
  one price, we handle everything."* The platform's existing "managed by Webnua"
  framing is correct — lean in.
- **Never sell "agency services" as a retainer.** Agencies are opaque, expensive,
  churny. The whole edge is delivering the *same outcome* at ~1/10th the cost.
- **The uniqueness is the market, not the tech.** A human agency's marginal cost
  per client is a person's time (→ €1,500–3,000/mo, top-of-market only). Webnua's
  marginal cost is ~€20 compute + minutes of review, which **unlocks the local-
  business long tail that human delivery economics permanently exclude.** That is
  the YC-shaped story: *services-as-software collapses agency delivery cost ~10×
  and opens a market that was never addressable.*

### 11.2 The defensibility ladder (honest — near-term is thin)

1. **Unit economics + outcome pricing** — real and immediate; no human agency can
   match it without becoming Webnua.
2. **Full-stack delivery, not a tool** — competitors sell a copilot the customer
   operates; Webnua does the work and owns the whole loop (and its data).
3. **Cross-client data flywheel — the only durable moat.** Vertical density
   (1,000 plumber campaigns) beats any human agency or horizontal tool. Race
   toward it; make `agent_learnings` cross-client from day one.
4. **Human-in-the-loop as a trust feature** — "AI does the work, a real marketer
   approves it" beats pure-AI (untrusted) and pure-human (expensive). Sell the
   human; don't hide them.

Edges 1–2 are replicable in ~12 months; the moat is 3 + distribution. **Speed to
vertical density is the strategy.**

### 11.3 GTM motion — free wedge → guided expansion

**Wedge: the free website.** Not merely a CAC reducer — it *manufactures the next
purchase*. A new site with no traffic creates the ache (*"how do people find
me?"*) that justifies every upsell: no traffic → ads; invisible on Google → SEO;
visits-but-no-calls → lead follow-up. The free product creates the need the paid
products cure.

**It maps onto what's already built.** The generator, publish flow, `.webnua.dev`
hosting, and the **`preview → publish-to-go-live → active` lifecycle** exist — the
`preview` state *is* the free tier; the conversational onboarding *is* the
qualifying conversation. The main net-new is the **commerce layer**, not the
product.

**Expansion: guided bundles, NOT raw "build your own plan."** À la carte is the
classic SMB pricing mistake — choice paralysis (a plumber can't self-architect a
marketing plan), ARPU suppression, and data-moat dilution (cherry-pickers anchor
low; the flywheel needs the *whole* funnel). Fix: same modular delivery
underneath (each service = an agent switched on), presented as **2–3 recommended
plans** (e.g. *Get Found* / *Get Leads* / *Full Growth*) with customisation
available, not required. The platform can do any combination; the *sale* is "for a
business like yours we recommend Growth." Modularity's flexibility without the
menu's friction.

**The expansion engine: data-triggered, AM-surfaced upsell.** Tie every upgrade
to the customer's own performance, surfaced by the Account Manager agent:

- *"240 visits last month, 2 calls — add Lead Follow-up, €X/mo."*
- *"Invisible for 'emergency electrician Dublin' (~90 searches/mo) — add SEO, €99/mo."*
- *"Ads converting at €0.40/click — scale the budget? Move to the €399 tier."*

That is an account manager advising on real data — except it is the AM agent on
data the platform already collects. **Performance-justified, in-product upsell is
the land-and-expand engine and the most agency-feeling thing in the product.** It
is also defensible: nobody can make that pitch without owning the whole funnel,
which the free site secured.

**Proof-first top-of-funnel.** Service sales are trust sales. Break "agencies are
hard to sell" with proof before commitment — the deferred **Proof Page tool**
(audit a prospect's online presence → show the gap → hand them proof) is both the
wedge and an SEO-able acquisition channel. It is more important to the business
than the 6th agent.

**Retention = the weekly report.** Agencies churn on opaque results. *"Here's what
we did, your 9 leads, €14 cost-per-lead, what we're testing next"* makes the price
feel like a steal. The Account-Manager report (§4.7 / sequencing #7) is the
retention product, not a nicety.

### 11.4 Indicative pricing

| Tier | Price | Notes |
|---|---|---|
| Free website | €0 | `.webnua.dev` subdomain, capped regen, no ongoing agent spend. The wedge + qualified top-of-funnel. |
| SEO | +€99/mo | Strong first upsell — cheap to deliver (content + GBP + metadata, mostly built), sticky (rankings compound). |
| Ads management | €199–499/mo | **Management fee only — ad spend is separate and goes to Meta/Google. State this loudly.** Tier by something legible (channels / spend band / campaign count), **not "strategy"** — customers can't self-select that. |

### 11.5 Commercial watch-outs

- **Free attracts zero-intent signups.** Measure free→paid conversion, not
  signups. Qualify through the onboarding conversation; let the AM gate the warm
  upsell.
- **Cap the cost of free, hard.** Subdomain only, capped regenerations, no agent
  spend until paying. An agent starts working only when they're on a plan.
- **Modular billing is the real build.** Stripe today is a single flat plan; the
  `lib/billing/` catalog is agency-policy bundles, not customer-facing add-ons.
  Multi-product subscriptions + add-on proration is genuine commerce work — the
  main thing standing between the platform and this motion.
- **Outcome promises must scope to what Webnua controls.** "More customers"
  depends on the tradie answering the phone. Promise on what's owned (leads
  delivered, cost-per-lead, reviews), not what isn't (jobs closed) — which is
  *why* owning lead follow-up + booking matters (it closes the controllable part
  of the funnel).

### 11.6 One-sentence thesis

Webnua is **the first marketing department the local-business long tail can
afford** — AI is the cost structure that makes flat/modular outcome pricing
profitable, the free website is the wedge that manufactures demand, the Account
Manager's data-triggered recommendations are the expansion engine, and
cross-client data density is the moat. Sell booked jobs, lead with a free
proof-audit, hide the AI, prove value weekly, and win distribution before
features.
