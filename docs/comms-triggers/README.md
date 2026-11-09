# Comms triggers & squad operating system

This directory is the **canonical home** for triggered, templated communications on Setlist Pick'em. The Cursor **comms squad** (four project skills under `.cursor/skills/comms-*`) operates on these artifacts.

## Documents

| File | Purpose |
|------|---------|
| [FRAMEWORK.md](./FRAMEWORK.md) | **TTDMOM** operating model: Trigger → Template → Deliver → Measure → Optimize → Monetize |
| [ECOSYSTEM.md](./ECOSYSTEM.md) | **Flow diagram + process descriptions** — event → orchestrator → channels → measurement, and the develop/curate/deploy/optimize processes |
| [TRIGGER_CATALOG.md](./TRIGGER_CATALOG.md) | Human-readable v1 trigger inventory (status, channels, prefs, dedup) |
| [catalog.json](./catalog.json) | Machine-readable trigger specs for agents and future orchestration |
| [MEASUREMENT_PLAN.md](./MEASUREMENT_PLAN.md) | GA4 comms events, dimensions, funnels |
| [CTA_ROUTE_AUDIT.md](./CTA_ROUTE_AUDIT.md) | In-app/email CTA label ↔ destination matrix (#551) |
| [EXPERIMENT_PLAYBOOK.md](./EXPERIMENT_PLAYBOOK.md) | A/B rules, variant assignment, ship/kill criteria |
| [OPTIMIZE_AUTONOMY.md](./OPTIMIZE_AUTONOMY.md) | **Optimize autonomy** — cycle order, PM pack template, L2 schedule (#573 / #778) |
| [SHOW_RECAP_COMPOSER.md](./SHOW_RECAP_COMPOSER.md) | Night `show_recap` composer — arc + your card + relative rank (#985) |
| [COMMS_FACT_INVENTORY.md](./COMMS_FACT_INVENTORY.md) | Living shelf of facts comms may speak: show, personal / global / band stats, and game (lead changes, margins, crowd pulse) |
| [SHOW_RECAP_FACT_INVENTORY.md](./SHOW_RECAP_FACT_INVENTORY.md) | Night-paragraph message map: which shelf facts that paragraph says today and next (#1083) |
| [SHOW_RECAP_HIGHLIGHT_ADDENDUM.md](./SHOW_RECAP_HIGHLIGHT_ADDENDUM.md) | Gap wording for the night highlight: rarity, return, or heavy rotation (#1105) |
| [TOUR_RECAP_FACT_INVENTORY.md](./TOUR_RECAP_FACT_INVENTORY.md) | End-of-tour wrap message map: shared opening and one personal sentence (#1084) |
| [TOUR_RECAP_SAMPLE.md](./TOUR_RECAP_SAMPLE.md) | Fixture preview of the wrap. Nothing sent. |
| [ANNUAL_WRAP_FACT_INVENTORY.md](./ANNUAL_WRAP_FACT_INVENTORY.md) | End-of-year wrap message map: shared crowd pulse, one race fact, personal section (#1111) |
| [ANNUAL_WRAP_SAMPLE.md](./ANNUAL_WRAP_SAMPLE.md) | Fixture preview of the annual wrap. Nothing sent. |
| [STANDINGS_FACT_INVENTORY.md](./STANDINGS_FACT_INVENTORY.md) | Morning standings map: entered, stayed in, or left the top 5, and took or lost the lead (#1102) |
| [SHOW_RECAP_SAMPLE_2026-10-07.md](./SHOW_RECAP_SAMPLE_2026-10-07.md) | Read-only Richmond preview: live morning email next to the inventory paragraph. Nothing sent. |
| [optimize_for.md](./optimize_for.md) | Scheduled goal rotation + override for Optimize kickoffs (#778) |

CLI: `npm run comms:optimize-kickoff` · `npm run comms:show-recap-qa` (#779) · `npm run comms:picks-lock-conversion` (#698)
| [EMAIL_INBOX_BADGE.md](./EMAIL_INBOX_BADGE.md) | Inbox sender badge (BIMI/DMARC) vs in-body email logo (#498) |
| [RESEND_WEBHOOK.md](./RESEND_WEBHOOK.md) | Resend dashboard events + open/click persistence (#512 Slice A) |
| [INBOUND_FORWARDING.md](./INBOUND_FORWARDING.md) | Inbound `email.received` allowlist + Workspace forward (`commsResendInboundWebhook`) |
| [COMMERCIAL_PHASE3.md](./COMMERCIAL_PHASE3.md) | Sponsor / affiliate / offer gates (Phase 3) |

## Related repo paths

| Path | Role |
|------|------|
| `content/comms/` | Editorial drafts (drafter skill) |
| `src/features/comms/registry.js` | Recap template registry + supported channels |
| `src/features/notifications/ui/commsTemplates/commsTemplateRegistry.jsx` | In-app template renderer registry (`templateId` → body) |
| `src/features/comms/model/commsAnalytics.js` | Client comms measurement (opened/cta/push_tap/pref_changed) |
| `/comms-preview` (dev build) | In-app template preview gallery |
| `functions/commsDelivery.js` | Shared delivery orchestrator (#439) |
| `functions/commsCatalog.js` / `functions/commsTemplates.js` | Catalog + server template resolvers |
| `users/{uid}/commsInbox/{messageId}` | In-app channel worker (Admin SDK) |
| `functions/commsPushWorker.js` / `functions/fcmMessagingCore.js` | Push channel worker (FCM) |
| `functions/commsEmailWorker.js` | Email channel worker (Resend, #442) |
| `comms/emailBranding.cjs` | Shared in-body email logo URL |
| `fcm_notification_log` | Shared delivery / dedup log |
| `comms_email_engagement/{resendEmailId}` | Resend open/click plane (#512 Slice A; Admin write only) |

## Delivery model

Fully **automated and event-driven** (no manual War Room sends in production): system event → shared orchestrator → prefs/dedup/fatigue/render → `inApp` + `push` + `email` workers. See [FRAMEWORK.md](./FRAMEWORK.md) §"Layer 3 — DELIVER", [ECOSYSTEM.md](./ECOSYSTEM.md), and the [comms-architect skill](../../.cursor/skills/comms-architect/SKILL.md).

## GitHub epics

- **#441** — Fully-automated, event-driven comms across in-app, push & email (Resend)
- **#439** — Shared delivery orchestrator · **#440** — 7 v1 triggers · **#442** — Resend email channel
- **#272** — Push / in-app / email channel epic
- **#120** — In-app comms (inbox, toasts)
- **#370** / **#371** — Scheduled recap automation follow-ups
- **#573** — Optimize autonomy (playbook → scheduled packs → decisioning); start at [OPTIMIZE_AUTONOMY.md](./OPTIMIZE_AUTONOMY.md)

## Invoke the squad in Cursor

| Skill | Invoke when |
|-------|-------------|
| `comms-analyst` | Cohorts, GA4, engagement reports, experiment readouts |
| `comms-triggers` | New trigger specs, catalog updates, backlog grooming |
| `comms-drafter` | Copy in `content/comms/`, sync to implementation modules |
| `comms-architect` | Delivery pipeline, prefs, dedup, Cloud Functions, rollout |
