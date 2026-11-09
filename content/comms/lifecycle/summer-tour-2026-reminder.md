# Summer Tour 2026 — non-opener reminder

| Field | Value |
|-------|-------|
| **templateId** | `summer-tour-2026-reminder` |
| **triggerId** | `marketing_summer_tour_2026_reminder` |
| **campaignId** | `summer_tour_2026_reminder` |
| **parentCampaignId** | `summer_tour_2026` |
| **implementationModule** | `src/features/marketing-comms/model/summerTour2026Reminder.js` |
| **Server render** | `functions/commsTemplates.js` (`summer-tour-2026-reminder`) |
| **Channels** | email only |
| **GitHub** | #512 Slice B |

## Audience

People in the Summer Tour 2026 launch cohort who were sent the first email, did not open it, and are not suppressed or unsubscribed from lifecycle mail. Default wait is 48 hours after the parent send (`fcm_notification_log.decidedAt`). A human runs the batch. There is no scheduler.

## Placeholders

- `{{greeting_name}}` — from `users/{uid}.handle`, fallback `friend`
- `{{opener_label}}` — `Tuesday, July 7` (2026-07-07 Madison opener)

## Email

**Subject:** Your six slots for Summer Tour are still open

**Preheader:** The first note might still be sitting unopened.

{{greeting_name}}, the first note about Summer Tour might still be sitting unopened.

The opener is {{opener_label}}. Six slots a night: openers, closers, encore, and a wildcard. Lock them before the lights go down.

**CTA:** Make Your Picks → `/dashboard/picks` (click host adds the campaign tags)

**Sign-off:** See you on tour!

## Delivery

- Callable: `deliverMarketingSummerTour2026Reminder` (dryRun default true)
- CLI: `node functions/scripts/deliverMarketingSummerTour2026Reminder.js [--execute] [--uid <uid>] [--wait-hours 72]`
- Dedup: `marketing:summer_tour_2026_reminder:{uid}` (does not collide with `marketing:summer_tour_2026:{uid}`)
- `bypassDailyCap: true` for the batch, same as the launch send
- `--force-resend` retries this reminder only. It does not resend the launch email.
