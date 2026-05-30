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
