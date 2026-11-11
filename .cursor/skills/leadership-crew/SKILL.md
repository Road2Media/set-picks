---
name: leadership-crew
description: >-
  Meta router for Setlist Pick'em Leadership Ops Crew (epic #695). Use when
  invoking C-suite, functional, or bridge leadership roles; Optimize oversight;
  campaign/revenue/BD/affiliate pipelines; or adapting the living org chart.
  Also the intent router for an agent-queue ticket: a player-facing UI copy
  sweep, or a new marketing or SEO page. Canon: docs/LEADERSHIP_CREW.md.
  L0 draft-only.
---

# Leadership Crew (router)

**Epic:** [#695](https://github.com/pat792/set-picks/issues/695)  
**Canon:** [`docs/LEADERSHIP_CREW.md`](../../../docs/LEADERSHIP_CREW.md)  
**CrewAI:** [`crew/README.md`](../../../crew/README.md)

## Flexibility

This org **learns**. If ownership is wrong, propose a minimal change (merge role, new dotted line, pipeline tweak), update the doc Changelog, and comment on #695. Do not treat agent lists as permanent.

## Route by intent

| Intent | Start with |
|--------|------------|
| Optimize oversight | `growth-program-manager` → `chief-customer-officer` → `editor-in-chief` |
| Campaign / demand gen | `marketing-specialist` + `social-demand-gen-operator` → `editor-in-chief` |
| Social loop (“run the social loop”, next owned post) | [`974-social-post-loop.md`](../../../content/marketing/974-social-post-loop.md): Social → Brand Systems → Demand Gen → Editor in Chief. No live post. |
| Revenue / Phase 3 frame | `chief-revenue-officer` + `revops-lead` |
| Sponsor BD | `sponsor-bd-orchestrator` + `lead-gen-specialist` |
| Affiliate e2e proposal | `affiliate-program-manager` + `integrations-architect` |
| Market intel | `market-intelligence-operator` + `chief-data-officer` |
| Delivery feasibility | `software-architect` / `chief-technology-officer` |
| Measurement | `reporting-lead` / `chief-data-officer` |
| Comms execution | `comms-orchestration-lead` → existing `comms-*` skills |
| Player-facing UI copy sweep (internal language, tiebreak copy in the app, slot vs chair) | `editor-in-chief` + `content/marketing/voice-guide.md`. If an inbox, push, or email sentence moves, also `comms-drafter`. Then change the strings. Admin screens stay technical. |
| New marketing or SEO page | `marketing-specialist` → `editor-in-chief`. Draft in `content/marketing/`. Ship the strings in `src/features/landing/ui` and `seoRoutes.js`. Read `.cursor/rules/marketing-editorial-viewport.mdc` and `docs/SEO_GEO_PLAYBOOK.md`. |

The factory picks a skill by matching the ticket to that skill’s `description`. These two rows stay in this description so a UI sweep or a new page opens this router instead of skipping the voice skills.

A ticket that asks to sweep the UI or ship a page is an implementation ticket. Read the skills, then edit. The L0 brief-only stance is for a leadership pack, not for that ticket.

## Maturity

L0 default — no live scrape/post/BD send/affiliate inject. See maturity ladder in the canon doc.

## Guardrails

Leadership packs stay draft-only. An agent-queue ticket that asks to sweep copy or ship a page is executed in a `staging` PR. Never merge or deploy from the leadership role. Phase 3 before in-product commercial.

## Draft artifacts (required)

Any crew/skill run that produces a draft, brief, pack, or structured deliverable **must write a reference document** (not chat-only). Prefer:

| Kind | Path |
|------|------|
| Marketing / SEO page copy | `content/marketing/` |
| Lifecycle comms | `content/comms/` |
| Pipeline / ephemeral | `crew/output/<pipeline>/` or paths in `docs/LEADERSHIP_CREW.md` |

See `.cursor/rules/crew-draft-artifacts.mdc` and `docs/LEADERSHIP_CREW.md` § Draft artifacts.
