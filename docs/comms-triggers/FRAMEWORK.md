# TTDMOM — Comms operating framework

**Trigger → Template → Deliver → Measure → Optimize → Monetize**

This framework governs how the comms squad develops triggered, templated communications that deploy automatically to eligible users, then iterates with analytics and experiments, and eventually introduces commercial slots.

## Principles

1. **No message ships without a Trigger Spec** in [TRIGGER_CATALOG.md](./TRIGGER_CATALOG.md) and [catalog.json](./catalog.json).
2. **Templates are versioned** (`v1.0.0` semver) and registered in `src/features/comms/registry.js`.
3. **Delivery is server-orchestrated _and fully automated_** — Cloud Functions / Admin SDK only; clients never create inbox rows. Every production trigger fires from a **system event** (Firestore write, scheduler tick, scoring hook) — there is **no manual admin/War Room step** in the production happy path. See [Layer 3 — DELIVER](#layer-3--deliver).
4. **Measurement hooks ship with v1** — even single-variant templates log `variant: control` for future A/B.
5. **Commercial comms are a separate class** — gated until Phase 3 criteria in [COMMERCIAL_PHASE3.md](./COMMERCIAL_PHASE3.md).

## Phases

| Phase | Goal | Exit criteria |
|-------|------|---------------|
| **1 — V1 baseline** | Reliable triggered comms for P0/P1 events | Every P0 row in catalog is `shipped` or `in_progress` with dry-run + dedup + prefs |
| **2 — Optimize** | Improve engagement and retention | [EXPERIMENT_PLAYBOOK.md](./EXPERIMENT_PLAYBOOK.md) live; monthly catalog review |
| **3 — Monetize** | Sponsor / affiliate / offer slots | Commercial gates met; `commercial` templates in registry |

## Layer 1 — TRIGGER

A **Trigger Spec** defines *what fires*, not copy.

Required fields: `triggerId`, `eventSource`, `eventCondition`, `audience`, `eligibility`, `channels`, `templateId`, `dedupKey`, `priority`, `phase`, `status`.

### Trigger taxonomy

| Family | Examples |
|--------|----------|
| `lifecycle` | First login, profile incomplete, return after N days |
| `show_calendar` | Picks lock reminders, show tonight |
| `live_game` | Post-show win/near-miss, live setlist (prefs-gated) |
| `results_recap` | Tour/show recap (Sphere model) |
| `social_pools` | Pool invite, standings (future) |
| `system` | Push canary, ops-only |
| `commercial` | Sponsor footer, affiliate CTA (Phase 3 only) |

### Priority

| Priority | Meaning |
|----------|---------|
| **P0** | Lifecycle + picks lock — ship in v1 wave 1–2 |
| **P1** | Engagement + results — v1 wave 2–3 |
| **P2** | Experimental / live realtime |
| **P3** | Commercial |

## Layer 2 — TEMPLATE

Templates link editorial drafts to runtime builders.

| Artifact | Location |
|----------|----------|
| Editorial draft | `content/comms/tours/`, `shows/`, `lifecycle/` |
| Runtime builders | `src/features/<domain>/model/` |
| Registry | `src/features/comms/registry.js` |
| In-app renderer | `src/features/notifications/ui/` |

### Channel strategy

| Channel | Use |
|---------|-----|
| `inApp` | Rich personalized body in `commsInbox` |
| `push` | Short teaser + deep link (often → inbox) |
| `emailAbbreviated` | Re-engagement subject + CTA (Resend) |
| `emailFull` | Long-form recap (Resend; #442) |

**Proven v1 pattern:** push tease → full message in inbox (Sphere recap).

## Layer 3 — DELIVER

**Target architecture — full automation (epic #441).** One shared orchestrator, many thin event adapters, and pluggable per-channel workers. No manual sends in production.

```text
EVENT (Firestore onCreate/onUpdate · scheduler cron · post-grade hook · live-scoring hook)
  → commsDelivery orchestrator (resolve trigger from catalog.json)
     → per uid:  prefs gate → dedup → fatigue cap → render(registry)
        → inApp worker  (Admin SDK → users/{uid}/commsInbox/{messageId})
        → push worker   (FCM → fcmMessagingCore)
        → email worker  (Resend → functions/commsEmailWorker.js)
     → delivery log + comms_delivered
```

### Design rules

1. **One orchestrator, thin adapters.** Each trigger contributes only a *resolver* (audience + payload + dedup scope) and declares `channels`/`prefKeys` in `catalog.json`. The orchestrator owns the uniform path: prefs → dedup → fatigue → render → dispatch → log.
2. **Fully event-driven sources** (no human in the loop):

   | Event source | Trigger(s) |
   |--------------|-----------|
   | Firestore `onCreate users/{uid}` | `account_welcome` |
   | Firestore `onUpdate picks/{pickId}` (lock) | `picks_confirmed` |
   | `onSchedule` cron | `tour_countdown`, `tour_rankings_daily`, `tour_recap` (morning after finale) |
   | post-grade hook after `rollupScoresForShow` | `show_recap`, `tour_engagement_reminder` (last night of tour is still night `show_recap` only) |
   | 8am PT `scheduledTourRankingsDailyComms` | `tour_rankings_daily` (morning-after show, skipped on finale morning); `tour_recap` (first tick after a tour’s final show date) |
   | live-scoring hook | `score_first_points`, `score_leader` |

3. **Pluggable, idempotent channel workers** — each returns `{ ok, skipReason }` and shares one delivery-log contract so re-ticks / retries never double-send:

   | Channel | Worker | Storage / transport |
   |---------|--------|---------------------|
   | `inApp` | Admin SDK batch write | `users/{uid}/commsInbox/{messageId}` |
   | `push` | `functions/fcmMessagingCore.js` | FCM + `private_fcmTokens` |
   | `email` | `functions/commsEmailWorker.js` (**Resend**) | Resend API + delivery log |

4. **Independent fan-out, per-channel prefs** (v1): send to every eligible channel. Eligibility precedence: `notificationPrefs[family]` → channel availability (FCM token / verified email, not suppressed) → dedup → fatigue cap.
5. **War Room callable is QA/replay only.** The admin callable (`deliverSphere2026TourRecapInbox` today; `replayComms(triggerId, audienceFilter, dryRun)` going forward) exists for dry-run preview, backfill, and incident replay — **never** as the production trigger.

### Non-negotiables

- **Idempotency** — shared key `<triggerId>/<uid>:<scope>` recorded in the delivery log (`fcm_notification_log`) and/or a fixed `commsInbox` doc id; same key used as the Resend `idempotencyKey`.
- **Prefs** — `notificationPrefs.reminders`, `.results`, `.nearMiss`, `.lifecycle` (new), `.commercial` (Phase 3).
- **Dry run** — the QA/replay callable defaults `dryRun: true`; production event paths run live but are idempotent.
- **Rollout** — canary uid → cohort % → full audience, by enabling event adapters / schedules (not by manual sends).
- **Measurement** — log `comms_delivered` server-side with `trigger_id`, `template_id`, `channel`, `variant: control`.

### One-shot / pending-scanner checklist (#1035)

Per-uid `fcm_notification_log` is channel idempotency. It is not a process gate. A completed moment (end of tour, archive edition, superseded template) is stored once and read **before** `deliverCommsTrigger`, so email, push, and in-app share one skip.

Incident: [INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md](./INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md). The 2026-09-09 Sphere blast happened because the first live `tour_recap` tick treated “no `tour_recap:{tour}:{uid}` doc” as “never sent,” including an archive edition that had already wrapped under `sphere-2026-inaugural`.

| Check | Required |
|-------|----------|
| Time bound | Lookback or “yesterday / T-N / lock window.” Never unbounded history. |
| Process state | Skip when `comms_process_state/{triggerId}:{scope}` is `sent`, `skipped_archive`, or `closed`. `tour_recap` also honors the `comms_tour_recap_state` mirror. |
| Edition status | Skip `show_calendar` tour groups with `editionStatus` `archive` or `closed`. A tour name is not a gate. |
| Dedup key stability | Changing `triggerId` or template requires `supersedes` on the process doc, or a seed. Do not mint a trigger id per tour. |
| Channel fan-out | The gate runs before `deliverCommsTrigger`. |

`show_recap` stays event-scoped: per-uid dedup is the retry lock for a **live** edition. Re-rollup of an archive show, or of a tour whose process is `skipped_archive` / `closed`, does not start `show_recap`. A `sent` tour process does not block night `show_recap`. Explicit `runCommsTrigger` replay is still allowed and defaults to `dryRun: true`.

`campaignId` is the edition analytics slug (`2026-summer`, `2026-sphere`). `triggerId` stays the catalog intent.

Email join keys: catalog sends go through `commsEmailWorker` (`uid`, `triggerId`, optional `campaignId`) and the orchestrator writes `resendEmailId` on the dedup doc. Marketing batches use that same orchestrator. `deliverSphere2026TourRecapInbox` is inbox + push only (no Resend). Password-reset mail and inbound support forward are not catalog fan-outs and do not write `fcm_notification_log`.

### Email channel — Resend

- **Secret:** `RESEND_API_KEY` via Functions v2 `defineSecret` (`firebase functions:secrets:set RESEND_API_KEY`). Cloud Functions only; never client-side.
- **Send:** `resend.emails.send({...}, { idempotencyKey })`; fan-out via `resend.batch.send([...], { idempotencyKey })` (≤100/call) with exponential backoff on 429/500.
- **Domain:** `from` uses the verified setlistpickem.com sender (SPF/DKIM/DMARC); fail closed if unverified.
- **Compliance:** lifecycle/marketing mail sets `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) wired to `notificationPrefs`; `emailClass: transactional` triggers (e.g. `picks_lock_reminder`) omit marketing unsubscribe headers but still respect `email_suppression`.
- **Reputation:** Resend webhook handler — `email.bounced` (Permanent) → hard-suppress; `email.complained` → unsubscribe + flag; `email.opened` / `email.clicked` → `comms_email_engagement` (#512 Slice A). Idempotent (webhooks are at-least-once, possibly out of order). Dashboard event checklist: [RESEND_WEBHOOK.md](./RESEND_WEBHOOK.md).
- **Inbound (v1.75.0):** `commsResendInboundWebhook` handles `email.received` on a **separate** URL. Allowlist `updates@` / `unsubscribe@` / `support@` → wrap + `emails.send` to `support@road2media.com` (original From + Reply-To). Catch-all other local-parts return 200. [INBOUND_FORWARDING.md](./INBOUND_FORWARDING.md).
- **Agent tooling:** the official **Resend MCP** (`npx -y resend-mcp`) lets agents draft, send, and manage broadcasts/domains/webhooks directly; see [comms-architect skill](../../.cursor/skills/comms-architect/SKILL.md).

### Implementation types

| Type | When |
|------|------|
| `event_driven` | Firestore `onCreate`/`onUpdate`, auth lifecycle (primary path) |
| `scheduled` | Picks lock window, nightly cohort jobs (`onSchedule`) |
| `batch` | Post-grade fan-out (recaps) after the scoring pipeline |
| `realtime` | Live scoring hooks (P2) |
| `replay` | Admin QA / backfill callable only — not a production trigger |

## Layer 4 — MEASURE

See [MEASUREMENT_PLAN.md](./MEASUREMENT_PLAN.md). Every trigger owns a funnel:

```text
Eligible → Delivered → Opened/Tapped → CTA → Retention action
```

## Layer 5 — OPTIMIZE

Monthly cadence (show weeks: weekly):

1. **Analyst** — cohort + funnel report
2. **Triggers** — update catalog (new / deprecate)
3. **Drafter** — copy revisions (new semver)
4. **Architect** — channel mix, experiments, rollout

Fatigue caps: max pushes per user per show day; suppress P2 when P0 fired same day.

## Layer 6 — MONETIZE

See [COMMERCIAL_PHASE3.md](./COMMERCIAL_PHASE3.md). Commercial never overrides P0 lifecycle or picks-lock messages.

## V1 launch waves

| Wave | Triggers | Type | Notes |
|------|----------|------|-------|
| W0 | `picks_lock_reminder` | `automated` | Shipped; push-only today |
| W1 | `account_welcome` | `event_triggered` | Firestore onCreate |
| W1 | `picks_confirmed` | `event_triggered` | Picks locked confirmation |
| W2 | `tour_countdown` | `automated` | Daily cron T-10/5/3/1 |
| W2 | `tour_engagement_reminder` | `event_triggered` | After show 1 graded |
| W3 | `show_recap` | `event_triggered` | After grading; replaces Sphere one-off |
| W3 | `tour_rankings_daily` | `automated` | Next-morning standings |
| W4 | `score_first_points` | `event_triggered` | Live scoring hook |
| W4 | `score_leader` | `event_triggered` | Live leaderboard hook |
| W5 | A/B on W1–W3 copy | — | Requires measurement baseline |
| Phase 3 | `commercial_sponsor_recap_footer` | — | After W5 gates |

All waves deliver through the **single automated orchestrator** across `inApp` + `push` + `email` (Resend); a wave "ships" by enabling its event adapter / schedule, not by a manual send. Tracking: epic #441 (automation), #439 (orchestrator), #440 (triggers), #442 (Resend email channel).

## Squad RACI

| Layer | Analyst | Triggers | Drafter | Architect |
|-------|---------|----------|---------|-----------|
| TRIGGER | Cohorts | Specs | — | Orchestration |
| TEMPLATE | Variant ideas | templateId link | Copy + tests | Channels |
| DELIVER | Canary metrics | QA checklist | Preview | CF deploy |
| MEASURE | Reports | Catalog updates | Copy proposals | Instrumentation |
| OPTIMIZE | Experiment design | Backlog | Variants | Rollout |
| MONETIZE | ROI tiers | Commercial specs | Sponsor copy | Slots + caps |
