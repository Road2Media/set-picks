# Leadership Ops Crew

**Epic:** [#695](https://github.com/pat792/set-picks/issues/695)  
**Surfaces:** CrewAI (`crew/`) + Cursor skills (`.cursor/skills/`)  
**Sits above:** Comms execution squad — `comms-analyst` → `comms-triggers` → `comms-drafter` → `comms-architect`  
**Status:** **L1** research + **L2** human-gated social/BD publish queue; affiliate inject still **L3**

---

## Flexibility & learning (operating principles)

This org is a **living operating system**, not a frozen chart. As the product and team mature:

1. **Roles are hypotheses.** Add, merge, rename, or retire agents when RACI or pipeline runs prove the structure wrong. Prefer small edits to this doc + agent JSON over big-bang rewrites.
2. **Maturity is explicit (L0–L3).** Promote a capability only with evidence and guardrails; **demote** if live actions create risk or noise.
3. **Pipelines are experiments.** After each meaningful run, capture: what worked, what blocked, what to change next — comment on [#695](https://github.com/pat792/set-picks/issues/695) and/or append § [Changelog](#changelog).
4. **Dotted lines beat org politics.** Bridge roles (CoS, GPM, RevOps, Brand Systems) exist so peer chiefs do not fork truth.
5. **No premature automation.** Default is draft-only. L2 publish and L3 affiliate/sponsor e2e require explicit enablement and Phase 3 gates where in-product commercial applies.
6. **Execution stays in the squad.** Leadership briefs and oversees; the existing Cursor comms skills still open draft PRs to `staging`. Leadership agents do not replace them.

---

## Maturity ladder

| Level | Meaning | Live side effects |
|-------|---------|-------------------|
| **L0** | Agents, skills, RACI, pipelines, dry-run tool stubs | None |
| **L1** | Allowlisted public-web research → structured intel | Read-only HTTP |
| **L2** | Human-gated social / BD publish | Post/send only after approval |
| **L3** | Affiliate/sponsor e2e + in-product slots | Requires [COMMERCIAL_PHASE3.md](./comms-triggers/COMMERCIAL_PHASE3.md) |

**Current:** L1 research + L2 social/BD queue + LLM runner. **Optimize** requires a GA4 snapshot ([#697](https://github.com/pat792/set-picks/issues/697)) — facts-only; no invented metrics. Affiliate inject remains L3.

---

## Why four chiefs

Maps to **TTDMOM** ([FRAMEWORK.md](./comms-triggers/FRAMEWORK.md)):

| Chief | Owns | Failure if missing |
|-------|------|--------------------|
| **CCO** | Intent, voice, Optimize goals, demand-gen social | Wrong message, brand drift |
| **CTO** | Deliver systems, UI/design, integrations | Nowhere safe to land copy |
| **CDO** | Measure, insights, data architecture, intel quality | Optimize on vibes |
| **CRO** | Monetize framework, BD, affiliates, lead gen | Premature or unmeasured monetization |

**Architecture split:** CDO = data/event contracts; CTO = product/system + UI. They co-own boundary schemas (e.g. `comms_delivered`).

---

## Hierarchy

```text
C-suite (peers):  CCO · CRO · CDO · CTO

CCO ── Editor in Chief
    ├── Marketing Specialist
    ├── Social Media Specialist → Social Demand Gen Operator
    └── Comms Orchestration Lead → existing Cursor comms squad

CRO ── Business Analyst
    ├── Sponsor BD Orchestrator
    ├── Affiliate Program Manager
    ├── Lead Gen Specialist
    └── Monetization Strategist

CDO ── Customer Insights Analyst
    ├── Reporting Lead
    ├── Data Architect
    └── Market Intelligence Operator

CTO ── Software Architect
    ├── Product Design Lead
    └── Integrations Architect

Bridges (dotted): Chief of Staff · Growth Program Manager · RevOps Lead · Brand Systems Partner
```

### RACI (high-signal)

| Work | A | R | C |
|------|---|---|---|
| Optimize pack | Growth Program Manager | EiC, Reporting, Insights | CCO (goal), Software Architect |
| Campaign / demand gen | EiC (publish gate) | Marketing, Social Demand Gen | Brand Systems, Market Intel |
| Revenue framework v0 | CRO | BA, Monetization Strategist, RevOps | CDO, CCO, CTO, EiC |
| Sponsor BD plan | CRO | Sponsor BD, Lead Gen | Monetization Strategist, EiC |
| Affiliate e2e proposal | RevOps (coherence) | Affiliate Program Manager | Integrations, Data Architect, CCO |
| Market intel sweep | CDO | Market Intelligence Operator | Insights, Marketing |
| SEO Optimize scored pack (#926 / #934) | Growth Program Manager | Marketing Specialist | EiC (public SEO copy), CDO (GSC/GA4/`public_tour_stats` facts) |

**Guardrails:** draft-only default; PR base `staging`; never merge/deploy from agents; no ad-hoc Resend; no live social/BD without L2 approval; commercial/affiliate in-product only after Phase 3; night `show_recap` ≠ tour `tour_recap`; scrape allowlist only; facts-only setlists. SEO scored loop: [`docs/SEO_OPTIMIZE_AUTONOMY.md`](./SEO_OPTIMIZE_AUTONOMY.md).

### Draft artifacts (required)

Crew and Cursor skill runs that produce drafts, briefs, packs, or other structured deliverables **must write a reference document**. Chat-only output is not enough.

| Kind | Durable path |
|------|----------------|
| Marketing / SEO page copy | `content/marketing/` |
| Lifecycle email/push/inbox | `content/comms/` |
| Campaign / revenue / BD / affiliate briefs | Pipeline `Output` column below, under `crew/output/` or `docs/` as appropriate |
| Ephemeral Optimize / intel runs | `crew/output/<pipeline>/` |

Cursor rule: `.cursor/rules/crew-draft-artifacts.mdc`.

---

## Pipelines

| Id | Default agents (subset) | Output |
|----|-------------------------|--------|
| `optimize` | CoS → GPM → CCO → Reporting/Insights → EiC → Software Architect | PM pack + squad kickoff language |
| `campaign` | CCO → Insights → Marketing ∥ Social Demand Gen → Brand Systems → EiC → Reporting | `campaign-brief.md` |
| `revenue` | CRO → RevOps → BA + Monetization → CDO → CCO → Integrations → EiC | `revenue-framework-v0.md` |
| `market_intel` | Market Intel → Insights → Marketing digest | `intel/…` |
| `sponsor_bd` | Lead Gen + Sponsor BD → Monetization → CRO → EiC | `bd/sponsor-plan.md` |
| `affiliate_e2e` | Affiliate PM → RevOps → Data Architect → Integrations → Design → CCO/EiC | `affiliate/program-spec.md` |

Default CrewAI run: **`optimize`**.

### Kickoff prompts

**Optimize (terminal — MCP snapshot embed, #697):**

```bash
crew/.venv/bin/python -m crew.scripts.ga4_snapshot --from-file path/to/mcp-export.md
crew/.venv/bin/python -m crew.scripts.run_pipeline optimize \
  --input optimize_for=picks_lock --input window=last_7_days \
  --ga4-snapshot crew/output/intel/ga4-….md
```

Details: `docs/GA4_MCP_SETUP.md` §5.

**Cursor (Optimize with GA4 MCP):**

```text
Using docs/LEADERSHIP_CREW.md, docs/comms-triggers/OPTIMIZE_AUTONOMY.md, and GA4 MCP
(property 527619709), run Optimize for goal picks_lock covering the last 7 complete days.
Cite only real GA4 numbers; mark gaps unknown. Draft-only; do not merge or deploy.
```

---

## Mapping to existing skills

| Leadership role | Invokes when executing |
|-----------------|------------------------|
| Comms Orchestration Lead | Structured `SQUAD_KICKOFF` → `comms-analyst` → `comms-triggers` → `comms-drafter` → `comms-architect` |
| Software Architect | `comms-architect` for delivery review |
| Reporting Lead / Insights | `comms-analyst` + GA4 MCP for numbers |
| Data Architect | Optimize `challenge_evidence` (falsify cliffs; MCP follow-ups) |
| Editor in Chief | Player-facing UI copy sweep. Voice gate on a new marketing page. `content/marketing/voice-guide.md` |
| Marketing Specialist | New marketing or SEO page. Draft in `content/marketing/`, then landing UI + `seoRoutes.js` |

---

## How to adapt (playbook)

When something feels wrong:

1. Run or simulate the pipeline once with the current roles.
2. Write a short learning note (blocker, duplicate ownership, missing seat).
3. Propose a minimal change: merge two agents, add a dotted line, or split a pipeline step.
4. Update this doc § Changelog + agent JSON / skill frontmatter in the same PR.
5. Comment on [#695](https://github.com/pat792/set-picks/issues/695).

Do **not** wait for a perfect org before shipping L1 research tools.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-11-10 | Intent router names a player-facing UI copy sweep and a new marketing or SEO page. Skill descriptions carry those phrases so an agent-queue ticket opens them. |
| 2026-09-25 | Social art is copy-and-replace from named Canva sources. Skills read `content/marketing/social-brand-approach.md` before any Canva call. `generate-design` is not a social layout tool. |
| 2026-09-03 | SEO Optimize scored pack RACI (#934 / epic #926): GPM accountable, Marketing Specialist responsible, EiC + CDO consulted. Playbook: `docs/SEO_OPTIMIZE_AUTONOMY.md` |
| 2026-09-03 | #933 E2: allowlisted SEO title/H1 scan (`seo_title_h1_scan`) + refuse list; brief `content/marketing/933-competitor-title-h1-gap-brief.md` |
| 2026-08-08 | Draft artifacts required on disk (`content/marketing/`, `content/comms/`, `crew/output/`); Cursor rule `crew-draft-artifacts.mdc` |
| 2026-07-20 | L0 scaffold: doc, `crew/`, Cursor skills, epic #695 — flexibility/learning principles documented |
| 2026-07-20 | L1: allowlisted HTTP fetch + `market_intel_sweep` script; tests; status promoted for research only |
| 2026-07-20 | L2: human-gated social/BD draft→approve→publish queue (`social_demand_gen`); optional webhook |
| 2026-07-20 | LLM runner: `crew.scripts.run_pipeline` + `smoke` pipeline; venv install notes |
| 2026-07-20 | #697: `ga4_snapshot` + Optimize fails closed without evidence; per-task run artifacts |
| 2026-07-20 | Optimize learning: channel planes + email UTM recipe; pipeline `challenge_evidence`; CommsLead `SQUAD_KICKOFF` router (#573 correction) |
