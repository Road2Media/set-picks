# Comms ecosystem — flow diagram & process descriptions

This document is the single visual + narrative reference for how a triggered
communication travels from a product **event** to a **delivered, measured**
message across in‑app, push, and email — fully automated, with **no manual
"War Room" send step** on the production path.

It complements the other comms docs:

- [`FRAMEWORK.md`](./FRAMEWORK.md) — the TTDMOM operating model (Trigger → Template → Deliver → Measure → Optimize → Monetize)
- [`OPTIMIZE_AUTONOMY.md`](./OPTIMIZE_AUTONOMY.md) — Optimize autonomy playbook + L2 schedule (#573 / #778)
- [`optimize_for.md`](./optimize_for.md) — Scheduled `optimize_for` rotation
- [`catalog.json`](./catalog.json) / [`TRIGGER_CATALOG.md`](./TRIGGER_CATALOG.md) — the machine + human trigger registry
- [`MEASUREMENT_PLAN.md`](./MEASUREMENT_PLAN.md) — the GA4 events & funnels

---

## 1. End‑to‑end flow

```mermaid
flowchart TB
  subgraph SRC["Event sources (Cloud Functions)"]
    A1["Firestore onCreate / onUpdate\n(users, picks)"]
    A2["Scheduler cron\n(onSchedule)"]
    A3["Post-grade hook\n(rollupScoresForShow)"]
    A4["Live-scoring hook"]
    A5["Admin callable\n(dryRun / replay / QA)"]
  end

  A1 --> ORCH
  A2 --> ORCH
  A3 --> ORCH
  A4 --> ORCH
  A5 -. "QA / replay only" .-> ORCH

  subgraph ORCH["commsDelivery orchestrator"]
    direction TB
    R["Resolve trigger from catalog.json\n(channels, prefKeys, dedupKey, templateId)"]
    P["Prefs gate\nnotificationPrefs.channel.family"]
    D["Dedup\nfcm_notification_log / fixed inbox id"]
    F["Fatigue cap\nmax sends per user / show-day"]
    T["Render via template registry"]
    R --> P --> D --> F --> T
  end

  T --> WIN["inApp worker\ncommsInbox write (Admin SDK)"]
  T --> WPU["push worker\nFCM (fcmMessagingCore)"]
  T --> WEM["email worker\nResend"]

  WIN --> LOG["Delivery log +\ncomms_delivered (server)"]
  WPU --> LOG
  WEM --> LOG

  subgraph CLIENT["SPA (client)"]
    INBOX["commsInbox subscription"]
    REND["CommsMessageBody\n(templateId → registry)"]
    PREFS["notificationPrefs toggles"]
    GA["comms_opened / cta_click /\npush_tap / dismissed / pref_changed"]
    INBOX --> REND --> GA
    PREFS --> GA
  end

  WIN --> INBOX
  WPU -. "deep link → /dashboard/profile/notifications" .-> INBOX
  WEM -. "CTA link → app" .-> INBOX

  LOG --> ANALYTICS["GA4 funnels\nDelivered → Opened → CTA → Retention"]
  GA --> ANALYTICS
  ANALYTICS -. "Optimize loop" .-> SRC
```

**Reading the diagram:** every trigger contributes only a thin *resolver*
(audience + payload + dedup scope) and declares its `channels` / `prefKeys` in
`catalog.json`. The orchestrator owns the uniform path
(**prefs → dedup → fatigue → render → dispatch → log**). Channel workers are
**idempotent and pluggable** — adding email did not change push or in‑app.

---

## 2. The six layers (TTDMOM) and who owns them

Each layer maps 1:1 to a Cursor comms skill, so develop → curate → deploy is
repeatable rather than bespoke. The skills enforce the guardrails on every
change regardless of which agent (or human) makes it.

| Layer | Skill | Owns | Artifacts |
|-------|-------|------|-----------|
| **Trigger** | `comms-triggers` | *What fires* | `catalog.json`, `TRIGGER_CATALOG.md` |
| **Template** | `comms-drafter` | *What it says* | `content/comms/`, feature `model/` builders, `registry.js`, in‑app template registry |
| **Deliver** | `comms-architect` | *How it ships* | `functions/commsDelivery.js`, channel workers, `firestore.rules` |
| **Measure** | `comms-analyst` | *Did it work* | GA4 events + funnels, `MEASUREMENT_PLAN.md` |
| **Optimize** | `comms-analyst` + `comms-triggers` | *Make it better* | `EXPERIMENT_PLAYBOOK.md`, catalog updates |
| **Monetize** | `comms-architect` | *Commercial slots* | `COMMERCIAL_PHASE3.md` (gated) |

---

## 3. Process descriptions

### 3.1 Develop a new trigger (curation → code)

1. **Spec it** (`comms-triggers`): add a row to `catalog.json` **and**
   `TRIGGER_CATALOG.md` in the same commit — `triggerId`, `family`, `priority`,
   `automation`, `channels`, `prefKeys`, `dedupKey`, `templateId`, `variables`.
   File a GitHub issue under epic #272.
2. **Draft the copy** (`comms-drafter`): editorial draft in `content/comms/`,
   runtime copy in the in‑app template registry
   (`src/features/notifications/ui/commsTemplates/commsTemplateRegistry.jsx`)
   and/or feature `model/` builders, plus channel variants (push tease → inbox
   depth → email subject/body). Register the template.
3. **Wire delivery** (`comms-architect`): add a thin event adapter that calls
   the shared orchestrator with the trigger's resolver (audience + payload +
   dedup scope). No new prefs/dedup/log code — the orchestrator owns that.
4. **Instrument** (`comms-analyst`): the orchestrator already logs
   `comms_delivered`; confirm the client logs `comms_opened` / `comms_cta_click`
   for the new `templateId` (handled generically by the inbox renderer).

### 3.2 Curate / preview templates (no real data needed)

- Run the SPA in dev and open **`/comms-preview`** — a gallery that renders every
  registered in‑app template with realistic sample payloads. This is the
  development/QA "War Room" preview. It is **dev‑build only** (redirects home in
  production).
- For push/email previews, use the **Resend MCP** (drafting/QA only) and the
  push canary callable. The Resend MCP is **not** the production send path.

### 3.3 Deploy & roll out (automated, no manual send)

1. **Dry run** — orchestrator + new adapter run with `dryRun: true` (counts +
   payload preview, no writes/sends).
2. **Canary** — execute for a single test uid (`QA_TEST_EMAIL`), verify inbox +
   push + email land and `comms_delivered` is logged.
3. **Enable the adapter** — deploy the Cloud Function; the event source now fans
   out automatically. There is no human execute step.
4. **Monitor** — `fcm_notification_log`, CF error logs, and the GA4
   Delivered→Opened→CTA funnel.

### 3.4 Optimize (feedback loop)

Canonical playbook: **[OPTIMIZE_AUTONOMY.md](./OPTIMIZE_AUTONOMY.md)** (#573). L2 kickoff cron: [#778](https://github.com/pat792/set-picks/issues/778).

Cycle order: `comms-analyst` → `comms-triggers` → `comms-drafter` → `comms-architect` → **PM**.

Agents produce a **PM review pack** (template in the playbook), may open **draft** PRs to **`staging`**, and never auto-merge or production-deploy. Night uniqueness (#572 `show_recap`) stays separate from end-of-tour (#510 `tour_recap`). Variant assignment is a stable `hash(uid + experimentId) % 100` bucket; every event already carries `comms_variant` (default `control`) so experiments are drop‑in.

---

## 4. Channels

| Channel | Worker | Storage / transport | Notes |
|---------|--------|---------------------|-------|
| `inApp` | inbox worker | `users/{uid}/commsInbox/{messageId}` (Admin SDK) | Rich personalized body; clients read + set `readAt` only |
| `push` | push worker | FCM over `users/{uid}/private_fcmTokens` + `fcm_notification_log` | Short teaser + deep link to `/dashboard/profile/notifications` |
| `email` | email worker | **Resend** (`resend.emails.send`, idempotency key + `uid`/`triggerId`/`campaignId` tags) | Verified `setlistpickem.com` sender; `List-Unsubscribe` (RFC 8058) wired to `notificationPrefs`; bounce/complaint webhook → suppress; open/click webhook → `comms_email_engagement` ([RESEND_WEBHOOK.md](./RESEND_WEBHOOK.md)); inbound replies: [INBOUND_FORWARDING.md](./INBOUND_FORWARDING.md) |

**Proven v1 pattern:** push tease → full message in inbox; email carries the
abbreviated teaser + CTA back into the app.

---

## 5. Preferences (gating)

Catalog `prefKeys` stay family names. Delivery resolves each family **per
channel** (#1045 / #513 Phase 3). The client resolver is
`src/features/notifications/api/notificationPrefsApi.js`. The server mirror is
`functions/notificationPrefs.js` (`commsDelivery.js` passes the channel).

| Family | Default | Push | In-app | Email |
|--------|---------|------|--------|-------|
| `reminders` | on | lock-reminder push | lock-reminder inbox | show-day reminder email is `emailClass: transactional` and does not read this key |
| `results` | on | graded-show push, including the legacy post-show rollup | recap inbox | recap and rankings email |
| `nearMiss` | on | legacy close-call push | no current trigger | no current trigger |
| `lifecycle` | on | welcome, countdown, pick confirmation | same inbox | welcome, countdown, and other tour email |
| `commercial` | **off (opt-in)** | future sponsor slots | same | same |

Resolution for one channel:

1. `notificationPrefs.<channel>.<family>` when that value is a boolean.
2. Otherwise the legacy flat `notificationPrefs.<family>` boolean. An existing
   opt-out still blocks every channel that has not been set on its own.
3. Otherwise the default. Allow-categories opt out only on `false`.
   `commercial` opts in only on `true`.

Transactional email still bypasses `prefKeys` and still honors
`email_suppression`.

**UI (v1.111.0 / #1045):** Preferences (`/dashboard/profile/account`) has three
groups. Push updates write `notificationPrefs.push.*` (including close calls).
Messages write `notificationPrefs.inApp.*` for reminders, results, and
lifecycle. Email updates write `notificationPrefs.email.results` and
`.email.lifecycle`. There is no email reminders switch and no in-app close-call
switch, because nothing in those channels reads those keys. Unsubscribe, the
one-click header, a mailto unsubscribe, and a spam complaint set
`notificationPrefs.email.lifecycle` and `.email.commercial` to `false` and do
not write the flat keys. `email_suppression` still pauses every email.
Re-enable sets `notificationPrefs.email.lifecycle` to `true` only.

---

## 6. Measurement

Server logs `comms_delivered` (with `comms_trigger_id`, `comms_template_id`,
`comms_channel`, `comms_variant: control`). The client logs the engagement half
via `src/features/comms/model/commsAnalytics.js`:

`comms_opened` · `comms_dismissed` · `comms_cta_click` · `comms_push_tap` ·
`comms_pref_changed`.

Together they complete the funnel:

```text
Eligible → Delivered → Opened/Tapped → CTA → Retention action
```

See [`MEASUREMENT_PLAN.md`](./MEASUREMENT_PLAN.md) for the custom dimensions to
register in GA4.
