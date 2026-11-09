# Comms measurement plan

Instrumentation for triggered communications. Mirrors the pattern in `docs/AUTH_TELEMETRY_RUNBOOK.md`.

GA4 property: **set-picks** (`527619709`). Comms events should register on **production only** (same gate as `src/shared/lib/ga4.js`).

## 1. Events to emit

Client engagement events use `ga4Event` via `src/features/comms/model/commsAnalytics.js`. Server delivery emits structured Cloud Logging **and** GA4 Measurement Protocol (`functions/commsGa4Measurement.js`, wired from `deliverCommsTrigger` on real non-dry-run channel success — #461).

| Event | When | Params |
|-------|------|--------|
| `comms_delivered` | Server wrote inbox row, sent FCM, or sent email (per channel) | `comms_trigger_id`, `comms_template_id`, `comms_channel`, `comms_variant` (MP + logs; `user_id` = Firebase uid on MP) |
| `comms_opened` | User opens inbox message or expands bell item | `trigger_id`, `template_id`, `channel`, `message_id` |
| `comms_dismissed` | User dismisses without reading | `trigger_id`, `template_id`, `message_id` |
| `comms_cta_click` | User taps CTA in message | `comms_trigger_id`, `comms_template_id`, `comms_cta`, `comms_destination` (href) |
| `comms_push_tap` | Notification click opens app | `trigger_id`, `template_id`, `message_id` |
| `comms_pref_changed` | User toggles notification pref | `pref_key`, `enabled` |

### v1 requirement

Even single-variant templates pass `variant: control` on every `comms_*` event so A/B is a config change later.

## 2. GA4 custom dimensions (register once)

Admin → Property → Custom definitions → Event-scoped. Event parameter names match client + server emitters (`comms_*` prefix):

| Display name | Event parameter |
|--------------|-----------------|
| Comms trigger id | `comms_trigger_id` |
| Comms template id | `comms_template_id` |
| Comms channel | `comms_channel` |
| Comms variant | `comms_variant` |
| Comms CTA | `comms_cta` |
| Comms destination | `comms_destination` |

Also register auth dimensions from #291 (`method`, `error_code`) in the same Admin pass.

Historical data is not backfilled after registration.

### Server MP credentials (ops)

| Var | Where | Notes |
|-----|-------|-------|
| `GA4_MEASUREMENT_ID` | Functions param / `.env.set-picks` | Same `G-…` as `VITE_GA_MEASUREMENT_ID` |
| `GA4_MP_API_SECRET` | Secret Manager (`firebase functions:secrets:set GA4_MP_API_SECRET`) | GA4 Admin → Data stream → Measurement Protocol API secrets |

Gate: both set, project `set-picks`, not Functions emulator. Unset secret → no-op (safe for local/CI).

## 3. Funnels per trigger family

### Lifecycle (`first_login_welcome`, `profile_incomplete_nudge`, `return_after_14d`)

```text
Eligible users → comms_delivered → comms_opened → comms_cta_click → login within 7d / pick submitted
```

### Show calendar (`picks_lock_*`, `show_tonight_teaser`)

```text
Eligible → comms_delivered → comms_push_tap → pick submitted before lock
```

Email deep-link funnel (#535):

```text
comms_delivered (email) → comms_email_landed → picks_page_interactive → submit_picks
```

| Event | When |
|-------|------|
| `comms_email_landed` | Picks page mounts with `utm_campaign` (from click host) |
| `picks_page_interactive` | Picks form finished loading (`!isLoadingPicks`) |

**Bot-filtered click KPI:** ignore `/api/email-click` hits with scanner referrers (e.g. `bing.com`) or sub-second engagement; prefer GA4 funnel above + Firestore first-time lock ground truth over raw click-host pageviews.

Marketing reminder (#512 Slice B): parent `comms_delivered` (`marketing:summer_tour_2026:{uid}`) → no `openedAt` → reminder `comms_delivered` (`marketing:summer_tour_2026_reminder:{uid}`) → reminder `openedAt` → click host → `comms_email_landed`.

Primary metric: **pick submission rate before lock** among reminded users vs holdout (when experiments run).

### Channel planes (do not collapse)

`comms_opened` and `comms_cta_click` are **in-app inbox** (and some push deep-link) client events. They are **not** Resend email opens and **not** email link clicks.

| Channel | Attention / open | Click / land | Notes |
|---------|------------------|--------------|-------|
| **inApp** | `comms_opened` | `comms_cta_click` | Default GA “open cliff” lens |
| **email** | Resend opens (#512 Slice A) — `comms_email_engagement.openedAt` (not GA `comms_opened`) | Session UTM `source=email` / `medium=comms` (+ `utm_content` / campaign ≈ template) · `comms_email_landed` · `clickedAt` | **If `comms_cta_click` is 0 for an email-heavy trigger, query UTM sessions and `comms_email_engagement` before concluding no engagement** |
| **push** | `comms_push_tap` / open instrumentation | deep link | Sparse volume; verify wiring before judgment. When a tab is already open, soft-nav via SW `postMessage` (#773 Phase 3) — do not treat tap→interactive TTI like a cold document load |

**Optimize / analyst rule (2026-07-20):** For `picks_lock_reminder`, always report (1) trigger×channel `comms_*` counts **and** (2) UTM email-session `picks_page_interactive` / `submit_picks`. Snapshot recipe: `crew/knowledge/optimize_snapshot_recipe.md`.

**User-level conversion (#698):** Join `fcm_notification_log` (`triggerId=picks_lock_reminder`, doc id `reminder_{showYmd}_{uid}`) with `picks/{showDate}_{uid}` (non-empty slots, `updatedAt` &lt; venue-local lock). CLI: `npm run comms:picks-lock-conversion -- --write` → `crew/output/intel/picks_lock-conversion-*.md`. Cite that file’s `conv_%` in Optimize packs; GA4 remains aggregate / UTM engagement only (client GA4 has no `user_id`).

### Results (`tour_recap_*`, `post_show_*`)

```text
Eligible → comms_delivered → comms_opened → dashboard visit within 24h
```

## 4. Analyst reporting cadence

| Cadence | Report |
|---------|--------|
| Weekly (show weeks) | Picks-lock funnel, push tap rate, pref opt-out rate; **recap slice** (`show_recap` + `tour_rankings_daily` + `tour_recap` + `annual_wrap`) deliver/open/CTA + top `comms_destination` |
| Monthly | Full catalog review: deliver/open/CTA by `trigger_id` |
| Per experiment | Variant comparison per EXPERIMENT_PLAYBOOK.md |

Recap CTA honesty audit: `docs/comms-triggers/CTA_ROUTE_AUDIT.md` (#551). Cadence is **analyst-scheduled** against existing GA4 events — no separate Cloud Function required for v1.

### Data sources

| Source | Use |
|--------|-----|
| GA4 MCP `run_report` | Event counts, cohorts |
| GA4 MCP `run_realtime_report` | Show-day spikes |
| Firestore | `fcm_notification_log` delivery counts, `commsInbox` readAt, `comms_email_engagement` open/click (#512 Slice A) |
| Cloud Functions logs | Server-side `comms_delivered` audit (always) |
| GA4 MP (`comms_delivered`) | Server delivery counts in GA4 (when MP secret bound) |

## 5. Squad KPIs

| Phase | KPI |
|-------|-----|
| V1 | 100% P0 triggers log `comms_delivered`; zero duplicate dedup failures |
| Optimize | Statistically significant lift on primary metric for ≥1 experiment |
| Monetize | Sponsor CTR without ↑ `comms_pref_changed` (commercial off) |

## 6. Implementation checklist (per new trigger)

- [ ] `trigger_id` in catalog.json matches GA4 param
- [ ] Server logs delivery with template_id + variant
- [ ] Client logs open/CTA in inbox UI (`CommsInboxSection`, push deep links)
- [ ] Custom dimensions registered before launch
- [ ] Dry-run QA on staging preview (human browser for inbox UI)
