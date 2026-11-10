# Resend webhook enablement (open plane)

**Status:** shipped (Slice A / #512)  
**Date:** 2026-09-04  
**Related:** #512 Slice A — persist `email.opened` / `email.clicked`. Slice B (non-opener reminder) is `deliverMarketingSummerTour2026Reminder`. It reads this plane and does not change the webhook.

This is the ops checklist for the Resend dashboard plus the Firestore join plane that Optimize `email_open` reads. No new Cloud Functions secret: signing still uses existing `RESEND_WEBHOOK_SECRET`.

## Endpoint

| Item | Value |
|------|--------|
| Export | `commsResendWebhook` (`functions/index.js`) |
| Method | `POST` only (`405` otherwise) |
| Auth | Svix signature headers (`svix-id`, `svix-timestamp`, `svix-signature`) |
| Secret | `RESEND_WEBHOOK_SECRET` (`whsec_…`) — `firebase functions:secrets:set RESEND_WEBHOOK_SECRET` |
| Docs | [`docs/API.md`](../API.md) §2.5 |

Point the Resend dashboard webhook URL at the deployed Gen2 HTTPS URL for `commsResendWebhook` (region `us-central1`). Do not use a Vercel preview URL.

## Events to enable in the Resend dashboard

In Resend → Webhooks → the `commsResendWebhook` endpoint, enable **all** of:

| Event | Handler | Firestore write |
|-------|---------|-----------------|
| `email.bounced` (Permanent only) | hard-suppress | `email_suppression/{sha256(email)}` |
| `email.complained` | suppress + opt out lifecycle and commercial email | `email_suppression` + `users.notificationPrefs.email.lifecycle` and `.email.commercial` (#1045). Push and in-app keys are not written. |
| `email.suppressed` | suppress | `email_suppression` |
| `email.opened` | first-open stamp | `comms_email_engagement/{email_id}` `openedAt` |
| `email.clicked` | first-click stamp (also sets `openedAt` if missing) | `comms_email_engagement/{email_id}` `clickedAt` |

Do **not** enable `email.received` on this webhook. Inbound mail is `commsResendInboundWebhook` ([INBOUND_FORWARDING.md](./INBOUND_FORWARDING.md)).

These are **two different Resend switches**. The webhook can subscribe to `email.clicked` and still receive nothing.

| Setting | Where | Required | What it does |
|---------|--------|----------|--------------|
| Webhook event `email.clicked` | Resend → Webhooks → `commsResendWebhook` | On | If a click happens, POST it here |
| Domain **Click tracking** | Resend → Domains → `setlistpickem.com` | **On** | Rewrite every body `<a href>` to `links.setlistpickem.com` so a tap creates `email.clicked` |
| Domain **Open tracking** | same domain page | On | Pixel → `email.opened` |

**Keep domain Click tracking on.** It sits *in front of* first-party `click.setlistpickem.com`; it does not replace it.

```text
Inbox tap
  → links.setlistpickem.com     (Resend wrap → email.clicked → comms_email_engagement.clickedAt)
  → click.setlistpickem.com     (ours → 302 + UTMs)
  → www.setlistpickem.com/...   (GA4 land)
```

Resend 302s to the original href with `tid` / `tpl` / `cta` intact. Treat `clickedAt` (tap) and GA4 UTM land (arrival) as different KPIs.

**History:** 2026-07-07 Click tracking was turned **off** so the inbox showed `click.setlistpickem.com` directly (“they conflict — you only want ours”). That left no tap signal when `click.` NXDOMAIN’d after the Cloudflare NS import (Fall Tour T-10, 2026-09-22). **Re-enabled 2026-09-22.** Do not turn it off again to “avoid a double hop.”

Wrapping applies only to **new** sends. Mail already in inboxes keeps its original hrefs.

Temporary bounces are ignored (no suppress).

Re-deliveries of the same event are no-ops (first `openedAt` / `clickedAt` wins). Webhooks are at-least-once and can arrive out of order.

## Send-side tags (join keys)

`commsEmailWorker` stamps Resend `tags` on every `resend.emails.send`:

| Tag | Source |
|-----|--------|
| `uid` | recipient Firebase uid |
| `triggerId` | catalog trigger id |
| `campaignId` | `recipient.vars.campaignId` when present (marketing batches) |

Tag names/values are ASCII letters, numbers, underscores, or dashes only (Resend constraint). The webhook copies those tags onto `comms_email_engagement`. Marketing batches already pass `campaignId` in `vars` (`summer_tour_2026`, `summer_2026_almost_end`).

On a successful email send the orchestrator also merges `resendEmailId` + `campaignId` onto the `fcm_notification_log` dedup doc so the reminder batch can join delivered → opened without a collection scan.

## Collection

`comms_email_engagement/{resendEmailId}` is Admin-SDK write only. Clients cannot read or write (`firestore.rules`). See [`docs/API.md`](../API.md) §1.14.

## Reminder batch (Slice B)

`deliverMarketingSummerTour2026Reminder` is the human-triggered second wave. It point-reads `comms_email_engagement/{resendEmailId}` from the parent delivery log and skips anyone with `openedAt`. It does not add a scheduler and it does not send on deploy.
