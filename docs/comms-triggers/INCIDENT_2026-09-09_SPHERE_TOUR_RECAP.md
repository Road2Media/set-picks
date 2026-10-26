# Incident — live `tour_recap` for archive `2026 Sphere`

| Field | Value |
|--------|--------|
| **Status** | contained in code (deploy required) |
| **Detected** | 2026-09-09 (Resend review + user report) |
| **Sent** | 2026-09-09 **15:00:10Z–15:00:25Z** (~8:00 AM PT) |
| **Issue** | GitHub #1033 |
| **Trigger** | `tour_recap` / template `tour-recap` via `scheduledTourRankingsDailyComms` → `deliverPendingTourRecaps` |
| **Tour key** | `2026 Sphere` (subject: **`2026 Sphere recap is in`**) |
| **Intended path** | Archive / War Room only (`deliverSphere2026TourRecapInbox` / `sphere-2026-inaugural`) |

## What happened

The 8am PT pending scanner walked **every** past tour in `show_calendar.showDatesByTour`. Sphere players had never received dedup docs under `tour_recap:2026 Sphere:{uid}` (historical wrap used the archive template), so the first eligible cron after #510 adapters were live treated Sphere as a never-sent end-of-tour wrap.

Summer 2026 (`2026 Summer Tour recap is in`, sent 2026-09-08) was protected by dedup on this tick.

## Blast radius (Resend)

- **21** unique emails / recipients
- Subject: `2026 Sphere recap is in`
- From: `Setlist Pick'em <updates@setlistpickem.com>`
- Addresses for those recipients are omitted from this public note and are not stored in git.

Also check in-app `commsInbox` rows and FCM for the same cohort (channels share the delivery orchestrator).

## Fix

1. **14-day lookback** on pending finales (late grades before first send).
2. **Hard-skip** tour keys matching `/\bsphere\b/i` (+ write `skipped_archive`).
3. **Once-ever tour state** — `comms_tour_recap_state/{tourId}` (`sent` / `skipped_archive` / `closed`) so **every** tour is hard-skipped after the single end-of-tour send (not Sphere-only).
4. Seed Summer `sent` + Sphere `skipped_archive` via `node functions/scripts/seedTourRecapState.js --confirm`.
5. **Deploy** `scheduledTourRankingsDailyComms` (+ adapter hosts) and Firestore rules to prod before the next 8am PT tick.

Already-delivered uids are mostly protected by `tour_recap:2026 Sphere:{uid}` dedup; tour state stops prefs-off / other historical tours from being retried forever.

## Systemic fix (#1035)

The three containment layers above stop this blast. They are not the class fix. v1.85.0 stores a process doc (`comms_process_state`) and an `editionStatus` on the calendar tour group. The 8am scanner and `show_recap` re-rollup read those **before** building recipients. A tour name matching Sphere is no longer a send gate. `triggerId` stays `tour_recap`. `campaignId` is the edition slug (`2026-sphere`). Checklist: [FRAMEWORK.md](./FRAMEWORK.md) DELIVER.

Production behavior changes only after Cloud Functions and `firestore.rules` are deployed. `editionStatus` on the live calendar is a separate seed (`functions/scripts/seedCalendarEditionStatus.js --confirm`). The existing `comms_tour_recap_state` seed still blocks `tour_recap` for Summer and Sphere through the ledger’s legacy read.

## Follow-ups (human)

- [x] Clarification email sent (2026-09-10 09:00 ET, 21 recipients). Copy: `content/comms/lifecycle/1033-sphere-recap-correction.md`.
- [ ] Confirm no further Sphere subjects appear in Resend after deploy
- [ ] Spot-check Messages inbox for mistaken `tour-recap` Sphere payloads vs archive `sphere-2026-inaugural`
- [ ] Purge this recipient list from git history after Sprint 18 (separate step; this change does not rewrite history)
