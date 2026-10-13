# Setlist Pick'em — Public API Declaration

**Version:** 1.74.0  


**SemVer:** https://semver.org  
**Status:** Stable (≥ 1.0.0)

This document is the required public API declaration for Semantic Versioning compliance. Any change to a surface defined here determines the version bump type (MAJOR / MINOR / PATCH) for the next release. Agents and human contributors MUST consult this document before tagging a release.

---

## 1. Firestore Schema

All collections live in the default `(default)` Firestore database for project `set-picks`.

### 1.1 `users/{uid}`

| Field | Type | Notes |
|-------|------|-------|
| `handle` | string | Display name |
| `email` | string | Auth email — used for comms delivery |
| `photoURL` | string? | Legacy optional URL field (unused by curated avatar picker) |
| `avatarId` | string? | **v1.27.0+ (#567)** Curated avatar catalog id (e.g. `ticket`, `flame`). Missing/unknown → default `ticket` |
| `badges` | map? | **v1.28.0+ (#568)** Earned milestone badges `{ [badgeId]: { awardedAt, scope, sourceThroughShow } }`. Written server-side at rollup; idempotent merge |
| `favoriteSong` | string? | Display favorite; empty/`Unknown` treated as unset in UI |
| `termsPrivacyAcceptedAt` | Timestamp? | Legal consent gate |
| `createdAt` | Timestamp | Account creation |
| `isAdmin` | boolean? | Admin custom claim mirror |
| `notificationPrefs` | map | Channel opt-in flags (see §1.2) |
| `totalPoints` | number? | Career graded points (written by `rollupScoresForShow`) |
| `showsPlayed` | number? | Career graded non-empty shows |
| `wins` | number? | Career global night wins (ties share) |
| `careerCorrectSlots` | number? | **v1.26.0+ (#554)** Sum of pick slots that scored > 0 across graded shows. Used for avg correct / show. Absent until rollup/backfill. |
| `seasonStatsThroughShow` | string? | YYYY-MM-DD freshness watermark for materialized career/tour stats |
| `seasonStatsSnapshotAt` | Timestamp? | Last rollup write time |
| `seasonStats.{tourKey}` | map | Per-tour aggregated scoring (`totalPoints`, `shows`, `wins`, and **v1.26.0+** `correctSlots`) |

### 1.2 `users/{uid}` — `notificationPrefs` shape

```json
{
  "lifecycle":   true,
  "liveGame":    true,
  "recap":       true,
  "commercial":  false
}
```

### 1.3 `users/{uid}/private_fcmTokens/{tokenId}`

| Field | Type | Notes |
|-------|------|-------|
| `token` | string | FCM registration token |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

### 1.4 `users/{uid}/commsInbox/{messageId}`

| Field | Type | Notes |
|-------|------|-------|
| `templateId` | string | Registry key (e.g. `"account-welcome"`) |
| `triggerId` | string | Catalog trigger ID |
| `readAt` | Timestamp? | **v1.70.2+ (#1015):** Null until the user closes the message after opening it (Collapse, switch to another row, or collapse Inbox). Opening alone does not set `readAt`, so Unopened rows stay expanded while reading. |
| `archivedAt` | Timestamp? | **v1.67.0+ (#513 / #770)** Set when the owner archives the message. Unread bell count excludes archived. |
| `createdAt` | Timestamp | |
| `payload` | map | Template-specific variables. `show_recap`, the morning `tour_rankings_daily` night paragraph, and `tour_recap` may include `payload.fact_label` (**#1082**): `{ map: "show_recap" \| "tour_recap", branch?, slots: string[], showDate?, tourId? }`. `slots` are filled ids from the message map. Unknown ids are not written. Absence of a fact omits that slot and does not drop the send. `tour_recap` may also include `personal_line` (the in-app rank paragraph plus at most one personal sentence), `personal_clause` (that one sentence, for the email), and `email_board` (up to five rows: rank, handle, points, wins, nights, avg). Push stays the rank tease. (**#1084**) |

**Client write surface (v1.67.0 / #513):** owners may update `readAt` and/or `archivedAt` only (payload / `templateId` / `createdAt` stay server-owned). Owners may **hard-delete** their own inbox docs. Clients cannot create inbox docs — Admin SDK / Cloud Functions only.

### 1.5 `pools/{poolId}`

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Pool display name |
| `ownerId` | string | Owner uid |
| `inviteCode` | string | Used in `/join/:code` URLs |
| `members` | string[] | Member uids |
| `createdAt` | string (ISO8601) | Pool create time |
| `status` | `'active' \| 'archived'` | |
| `standingsScope` | `'legacy' \| 'from_membership'`? | **Absent = `legacy`.** New pools write `from_membership` (#417): pool standings count only picks that list this pool in `pick.pools` **and** whose `showDate` is on/after that member’s membership calendar day (`America/Los_Angeles`). Legacy pools keep retroactive carryover + create/join backfill. |
| `memberJoinedAt` | map `{ [uid]: ISO8601 }`? | Per-member join/create anchor for `from_membership` pools. Set for creator on create; updated on join. |

### 1.6 `picks/{pickId}` (subcollection: `pools/{poolId}/picks/{uid}`)

Stores per-user, per-show slot picks and computed scores.

| Field | Type | Notes |
|-------|------|-------|
| `correctSlotsCredited` | number? | **v1.26.0+ (#554)** Slots that scored > 0 on last finalize; used for regrade diffs into `users.careerCorrectSlots` |
| `winCredited` | boolean? | Whether this pick currently counts as a global night win |

### 1.7 `fcm_notification_log/{dedupId}`

Deduplication log shared by all comms channels. Document ID is the `dedupKey` from the trigger spec (e.g. `welcome:{uid}`). A `/` in an interpolated value is stored as `-` so the id stays one path segment. Presence of a doc = trigger already delivered; delete to allow re-send. After a successful email send (**v1.74.0 / #512 Slice A**) the doc may also include `resendEmailId` and `campaignId` for join with `comms_email_engagement`. When the send carried `payload.fact_label` (**#1082**), the same object is copied onto this row so an open can be joined to the branch and filled slots.

Also hosts the per-user daily email fatigue cap (#453): doc ID `email_cap:{uid}:{day}` (`day` = `YYYY-MM-DD` in `America/Los_Angeles`), `{ kind: "email_daily_cap", count, cap, lastTriggerId, lastEmailSentAt }`. Written transactionally by `commsEmailDailyCap.js`. `account_welcome` is exempt and never creates one of these docs. Not a new collection — same server-only rules entry as the dedup docs above.

### 1.7.1 `comms_tour_recap_state/{tourId}` (**v1.74.2 / #1033**)

Tour-level once-ever gate for production `tour_recap`. Document ID is the calendar tour key (e.g. `2026 Summer Tour`). A `/` in the key is stored as `-` so the id stays one Firestore path segment (`2026/2027 NYE Run` → `2026-2027 NYE Run`). Keys that are already a legal id are unchanged. Written only by Admin SDK (`deliverPendingTourRecaps` or `functions/scripts/seedTourRecapState.js`). Clients have no access. The 8am scanner reads this collection only for tours whose finale is already past and inside the 14-day lookback, plus Sphere archive labels.

| Field | Type | Notes |
|-------|------|-------|
| `tourId` | string | Same as doc id |
| `status` | string | `sent` \| `skipped_archive` \| `closed` — any of these permanently blocks the 8am pending scanner for this tour |
| `finalDate` | string? | Tour finale `YYYY-MM-DD` when known |
| `completedAt` | timestamp | Server time when the terminal status was written |
| `source` | string | `cron` \| `manual` \| `seed` \| `incident` |

Per-uid channel idempotency remains `fcm_notification_log` (`tour_recap:{tourId}:{uid}`). The tour doc is the durable process so each tour only gets **one** automatic end-of-tour send.

### 1.8 `show_calendar` (singleton or subcollection — see `docs/SHOW_CALENDAR_TOUR_LABELS.md`)

Tour and show date metadata. Read by `resolveCurrentTour` and `resolveSelectableTours`.

`show_calendar/snapshot` show rows (Phish.net sync) include at minimum:

| Field | Type | Notes |
|-------|------|-------|
| `date` | string | `YYYY-MM-DD` |
| `venue` | string | Display venue line |
| `city` | string? | City |
| `timeZone` | string | IANA venue timezone |
| `doorsLocal` | string? | Venue-local doors `HH:mm` from first-party Phish.com date page (informational; client/Functions also seed known Summer Tour 2026 dates) |
| `scheduledStartLocal` | string? | Advertised venue-local ticket/show time `HH:mm` from Phish.com; primary input for the picks wall-clock lock |
| `scheduleSource` | `'phish.com'`? | Timing provenance |
| `scheduleSourceUrl` | string? | Official date-page URL |
| `picksLockLocal` | string? | Venue-local picks lock `HH:mm` when materialized/overridden |

**Picks wall-clock lock (#522):** when `scheduledStartLocal` (or a seeded advertised show time) is known, lock = **published ticket/show time + 20 minutes**. Same Phish.com date-page source as doors (`Show Time`). When show time is unknown, fallback is **19:30** venue-local. Admin `show_lock_state` and (planned) setlist `s1o` still win as earlier signals.

`scheduledPhishnetShowCalendar` runs daily at 06:00 ET. Phish.net is canonical for dates/tours/venues; the sync then fetches Phish.com upcoming date pages for timing. A Phish.com failure does not fail or erase the calendar: prior timing is preserved.

### 1.9 `email_suppression/{sha256(email)}`

Server-only email suppression list (issue #442). Document ID is SHA-256 of the normalized recipient address. Presence of `{ suppressed: true }` blocks comms email sends. Written by `commsResendWebhook` and `commsEmailUnsubscribe`.

### 1.10 `show_lock_state/{showDate}` (#522)

Admin picks-lock override. Document ID is the show date (`YYYY-MM-DD`). Written only by the `lockPicksForShowNow` callable (Admin SDK). Clients read during `NEXT` to treat picks as locked before wall-clock or setlist poll signals fire.

| Field | Type | Notes |
|-------|------|-------|
| `showDate` | string | `YYYY-MM-DD` |
| `picksLockedAt` | Timestamp | Lock instant |
| `lockReason` | `'admin_override'` | v1 only writes this value |
| `lockedBy` | string? | Admin email when stamped |

### 1.11 `comms_show_context/{showDate}` (#572)

Server-written night-of narrative artifact for `show_recap` / `tour_rankings_daily`. Document ID is the show date (`YYYY-MM-DD`). Clients have no access. Schema: [`docs/COMMS_SHOW_CONTEXT_SCHEMA.md`](./COMMS_SHOW_CONTEXT_SCHEMA.md).

| Field | Type | Notes |
|-------|------|-------|
| `setlist_highlight` | string? | One-liner bustout/debut sticker. Bustout nights: `Bustout: Song - a/an N show gap.` (singular) or `Bustouts: …; ….` (plural, `;`-separated) (#780). Inbox Tonight / morning night-para prefer composed `narrative_line` (#985). |
| `set_flow_summary` | string? | One sentence per set: length, then the highlight, then every encore title |
| `bustout_titles` | string[] | Bustout titles that are also in that night’s official setlist |
| `tour_debut_titles` | string[] | New-to-tour titles tonight |
| `tour_debuts_trusted` | boolean | False on the first show of a tour (**v1.79.0**) |
| `set_songs` | map | `{ set1, set2, encore }` title lists (**v1.79.0**) |
| `song_gaps` | map | Pre-show gap by normalized title (**v1.79.0**) |
| `last_played` | map | Title → `YYYY-MM-DD` from the public tour table for this night (**v1.79.0**) |
| `lifetime_plays` | map | Title → lifetime play count for songs in that night, from the song catalog `total` (**v1.80.1**). Used when a set’s gaps are all 10 or fewer. A missing count drops the song name. |
| `show_moment_tags` | string[] | e.g. `bustout`, `tour_debut` |
| `schemaVersion` | number | `3` (**v1.79.0**; rebuilds the night paragraph). Was `2` in v1.72.2. |

### 1.12 `official_setlists/{showDate}`

Per-show official results. Document ID is the show date (`YYYY-MM-DD`). Full schema and scoring contract: [`docs/OFFICIAL_SETLISTS_SCHEMA.md`](./OFFICIAL_SETLISTS_SCHEMA.md). Selected declared fields:

| Field | Type | Notes |
|-------|------|-------|
| `setlist` | Record<string,string> | Slot answers keyed by `FORM_FIELDS` id (`s1o`, `s1c`, …). |
| `officialSetlist` | string[] | Ordered full-show song list. |
| `bustouts` | string[] | Per-show bustout snapshot (pre-show gap ≥ 30). Scoring source of truth (#214). |
| `songGaps` | Record<string,number> | **v1.29.0 (#587 Phase B)** — frozen pre-show gap per dated row, keyed by normalized title. Display-only (Standings “Gap N” signal); not read by scoring. Absent on pre-Phase-B shows. **v1.76.4** — the first positive gap sticks. A live row gap of 0 is not stored and does not replace a positive gap. Songs absent from a partial poll keep their stored gap. |

### 1.13 `public_tour_stats/{tourSlug}` (**v1.33.0 / #665**)

Public, aggregate-only tour song stats for SEO marketing routes. Written by Cloud Functions Admin SDK (`refreshPublicTourStats` / nightly schedule). **Never** contains full per-show `officialSetlist` arrays. Clients may read; client writes denied.

**Public data plane (v1.62.0 / #869):** marketing `/tour-stats*` prefers same-origin CDN snapshots at `/tour-stats-data/{docId}.json` (build-time copy of these docs, including `_index`) then Firestore REST. App Check + the Firestore SDK are a last-resort fallback only — not required for the happy path. Dashboard **`/dashboard/stats/band`** (legacy `/dashboard/tour-stats` redirect, **v1.69.0 / #1004**) still reads this collection (REST, `skipCdn`) for Last-date join.

Document ID is a kebab-case slug from the calendar tour label (`2026 Sphere` → `2026-sphere`). Special doc `_index` lists tours for the public filter.

| Field | Type | Notes |
|-------|------|-------|
| `tourSlug` | string | Same as doc id |
| `tourLabel` | string | Display label from `show_calendar` / Phish.net |
| `showDates` | string[] | Through-today eligible show dates used for aggregates (metadata; not setlists) |
| `firstShowDate` / `lastShowDate` | string\|null | `YYYY-MM-DD` — through-today range (for current-tour defaulting) |
| `tourShowCount` | number | Full post-launch tour itinerary length (Y in “X of Y tour dates”); may include upcoming nights |
| `showsWithSetlist` | number | Through-today dates with an `official_setlists` doc (X in “X of Y tour dates”) |
| `uniqueSongs` / `totalSongPlays` | number | Aggregate counts |
| `topSongs` | `{ title, timesPlayed, lastPlayed?, lifetimePlays?, debutYear? }[]` | Tour Frequency (UI label; formerly "Most played"), **full ranked list** as of v1.45.0 (#709; top-15 before) — **no** per-song `showDates` lists. `lastPlayed` = latest tour show date the song appeared (`YYYY-MM-DD`, v1.46.4) |
| `bustouts` / `gapHighlights` | `{ title, gap, showDate?, lifetimePlays?, debutYear?, lastPlayed? }[]` | Single event date OK; never a full night setlist. `gapHighlights` uncapped as of v1.45.0 (#709). `lastPlayed` = `YYYY-MM-DD` last Phish play *before* that tour night (v1.46.0 / #709 follow-up) |
| `lastPlayedByRow` | object | **v1.55.2 (#918)** — durable bustout/high-gap Last-date cache (`{ "song|YYYY-MM-DD": "YYYY-MM-DD" }`). Server refresh only; clients may ignore. Survives ranking churn so a song that drops out of `gapHighlights` and later returns keeps its stamp. |
| `enrichment` | `{ source, enrichedAt } \| null` | **v1.46.0 (#666)** — non-null when rows carry phish.net lifetime fields; `null` when the refresh ran without phish.net (missing key / upstream failure) |
| `writtenAt` | string | ISO timestamp |
| `schemaVersion` | number | `2` (**v1.46.0 #666**; `1` before) |

**Row enrichment (v1.46.0 / #666, Phase 1 of the gated-external-sources plan):** every refresh fetches phish.net `v5/songs` **server-side** (secret `PHISHNET_API_KEY`; never sent to browsers) and stamps `lifetimePlays` (all-time times played) + `debutYear` onto each row — `null` when phish.net has no data for the title, **absent** when the whole refresh ran unenriched. setlist.fm / phish.com remain behind the explicit legal/product gate (issue #666 phase 3).

**`lastPlayed` on bustout / high-gap rows (v1.46.0 / #709 follow-up; hardened v1.47.2 / #840; v1.55.2 / #918):** after lifetime enrichment, the refresh (1) seeds from the prior doc's `lastPlayedByRow` cache + array rows, (2) stamps from game-local `official_setlists` already loaded for every selectable tour (Sphere plays fill Summer High gaps with zero HTTP), (3) prefers songs-catalog `last_played` when it is strictly before the row's `showDate`, then (4) looks up remaining rows via phish.net play history (`/v5/setlists/slug/{slug}.json`, capped at 120 lookups/run, ~1.5s pacing, 429 backoff + abort-after-3, bustouts before high gaps, shared across tours). **v1.47.2 (#840) / v1.55.2 (#918):** partial/429 passes must not wipe dates already filled — seed + durable `lastPlayedByRow` accumulate instead of regressing. Best-effort — failed lookups leave the field absent; UI always shows the Last column (`—` when missing). Dashboard Tour stats joins the same dates from the world-readable public doc.

**`lastPlayed` on `topSongs` (v1.46.4):** latest eligible tour show date the song was played (`YYYY-MM-DD`). UI displays tour-scoped `mm-dd`.

`_index` fields: `tours[]` (`tourSlug`, `tourLabel`, `firstShowDate`, `lastShowDate`, `showCount`), `defaultTourSlug` (current tour = newest `lastShowDate` among indexed tours), `writtenAt`, `schemaVersion`. `showCount` matches doc `tourShowCount` (full post-launch itinerary). `firstShowDate` / `lastShowDate` remain through-today.

Tour labels are ingested via **`scheduledPhishnetShowCalendar`** (daily 06:00 ET) from Phish.net as new dates publish; public stats rebuild after calendar sync and again at **07:30 ET** (`scheduledPublicTourStatsRefresh`).

### 1.14 `global_stats_leaderboards/{docId}` (**v1.70.0 / #1004**, slugging **v1.77.0**)

Functions-owned Global Stats leaderboards for **`/dashboard/stats/global`**. Written by Cloud Functions Admin SDK from materialized `users` fields (`totalPoints`, `showsPlayed`, `careerCorrectSlots`, `seasonStats.{tourKey}`). **Clients `getDoc` these docs + the signed-in `users/{uid}` only — no `users` collection query/scan.** Slugging percentage is not a stored user field. It is derived at rebuild as total points ÷ (shows × 30).

Doc IDs: **`allTime`** (career) and **`tour:{tourKey}`** (same tour key as `seasonStats` / chrome `?tour=`).

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | number | `2` (**v1.77.0**). `1` was PPS / Picking average / Shows only. |
| `minShows` | number | Ratio-board gate for Points per show, Picking average, and **tour** slugging. Default **3** (`showsPlayed` / tour `shows`). |
| `sluggingMinShows` | number | Gate applied to `boards.sluggingPercentage` on this doc. **15** when `scope === 'allTime'`, **3** when `scope === 'tour'`. |
| `sluggingMinShowsAllTime` | number | Constant **15**. Present on every doc so operators can see the all-time floor without reading a tour doc. |
| `slotsPerShow` | number | `6` — same as `PROFILE_SLOTS_PER_SHOW` / `FORM_FIELDS.length` |
| `topN` | number | `50` |
| `scope` | `'allTime' \| 'tour'` | |
| `tourKey` | string \| null | Calendar tour label when `scope === 'tour'` |
| `playerCount` | number | Eligible players scanned for that scope (before top-N slice) |
| `boards.pointsPerShow` | `{ uid, handle, value, shows, rank }[]` | `totalPoints / shows`. Competition rank. Minimum 3 shows. |
| `boards.pickingAverage` | `{ uid, handle, value, shows, rank }[]` | `correctSlots / (shows * 6)`. Minimum 3 shows. |
| `boards.sluggingPercentage` | `{ uid, handle, value, shows, rank }[]` | **v1.77.0.** `totalPoints / (shows × 30)`. 30 is one show of 5-point in-setlist hits (SLG 1.000). All-time minimum **15** shows. Tour minimum **3**. |
| `boards.shows` | `{ uid, handle, value, shows, rank }[]` | Show count; no min-shows gate. **Deprecated in v1.77.0** — still written, no longer rendered. Show count remains the `shows` field on every row. |
| `trigger` | `'rollup' \| 'scheduled' \| 'admin' \| 'revert'` | Last rebuild source |
| `rebuiltAt` | Timestamp | Server write time |

Rebuild: after `rollupScoresForShow` / revert (all-time + that show’s tour, soft-fail), nightly **`scheduledGlobalStatsLeaderboardsRefresh`** (08:00 ET), and admin callable **`refreshGlobalStatsLeaderboards`**.

**Out of v1:** avg vintage, Bustout Boost, In most played, pool-scoped boards.

Signed-in read; client writes denied. Admin SDK / Functions write only.

### 1.15 `comms_email_engagement/{resendEmailId}` (**v1.74.0 / #512 Slice A**)

Server-only Resend open/click plane. Document ID is the Resend `email_id`. Written by `commsResendWebhook` on `email.opened` / `email.clicked`. Clients have no access. Join keys come from Resend send tags (`uid`, `triggerId`, `campaignId`). Ops checklist: [`docs/comms-triggers/RESEND_WEBHOOK.md`](./comms-triggers/RESEND_WEBHOOK.md).

| Field | Type | Notes |
|-------|------|-------|
| `resendEmailId` | string | Same as doc id |
| `uid` | string? | From send tag, or unique `users.email` match for untagged legacy mail |
| `triggerId` | string? | Catalog trigger id from send tag |
| `campaignId` | string? | Marketing `vars.campaignId` from send tag when present |
| `email` | string? | Normalized recipient |
| `openedAt` | Timestamp? | First open (click without a prior open also stamps this) |
| `clickedAt` | Timestamp? | First click |
| `openedEventId` / `clickedEventId` | string? | First Svix delivery id per event type |
| `updatedAt` | Timestamp | Last applied write |

Idempotent: duplicate webhook deliveries do not overwrite first-write timestamps. The `fcm_notification_log` dedup doc may also carry `resendEmailId` + `campaignId` after a successful email send.

---

## 2. Cloud Function Callables

All callables are in region `us-central1`. Requests must be authenticated Firebase users. Admin-only callables additionally require the `admin` custom claim.

### 2.1 `deliverSphere2026TourRecapInbox` (admin-only, replay / QA)

Historical Sphere ’26 inbox + push fan-out. **Not** the production `tour_recap` path (#510). **Not** in War Room (removed 1.74.2 / #1035). CLI `functions/scripts/deliverSphere2026TourRecapInbox.js` remains for archive replay only. Prefer `runCommsTrigger` (§2.2) for catalog canary. Live end-of-tour recaps fire from the morning cron (`deliverPendingTourRecaps` → `deliverCommsTrigger`).

**Request:**
```json
{
  "forceResend": false
}
```

**Response:**
```json
{
  "pushSent": true,
  "pushSentCount": 42,
  "pushSkipReason": null
}
```

### 2.2 `runCommsTrigger` (admin-only)

General-purpose comms delivery callable. Runs a named trigger through the full prefs → dedup → fatigue → render → dispatch pipeline.

**Request:**
```json
{
  "triggerId": "account_welcome",
  "recipients": [{ "uid": "...", "payload": {}, "vars": {} }],
  "dryRun": true,
  "forceResend": false,
  "bypassDailyCap": false
}
```

`bypassDailyCap` (v1.9.0+, admin-only QA) skips the #453 per-user daily email fatigue cap reservation entirely — never set by the production event adapters, only used by this callable so a reviewer can preview every template's rendered email in one sitting (see `scripts/canary-comms-preview.mjs`). `forceResend` bypasses dedup *and* varies the Resend idempotency key (timestamp + random suffix), so repeated QA sends with changed content don't collide with Resend's 24h idempotency window ("request body was modified and doesn't match the original request").

**Response:**
```json
{
  "ok": true,
  "triggerId": "account_welcome",
  "templateId": "account-welcome",
  "dryRun": true,
  "processed": 1,
  "delivered": 1,
  "skipped": 0,
  "byChannel": { "inApp": 0, "push": 0, "email": 0 },
  "results": [
    {
      "uid": "...",
      "status": "would_deliver",
      "channels": ["inApp", "push", "email"],
      "dedupId": "welcome:..."
    }
  ]
}
```

### 2.2a `deliverMarketingSummerTour2026Launch` (admin-only, #468)

Batch marketing email for Summer Tour 2026 pre-opener. Resolves Sphere alum ∪ post-Sphere signup cohort, renders React Email HTML, sends email channel only via Resend. Defaults to dry-run.

**Request:**
```json
{
  "dryRun": true,
  "forceResend": false,
  "onlyUids": ["optional-canary-uid"]
}
```

`onlyUids` limits the cohort to the listed UIDs (canary). `forceResend` bypasses marketing dedup (`marketing:summer_tour_2026:{uid}`). Daily email fatigue cap is bypassed for this batch (`bypassDailyCap: true`).

**Response (dry-run):**
```json
{
  "ok": true,
  "dryRun": true,
  "triggerId": "marketing_summer_tour_2026_launch",
  "campaignId": "summer_tour_2026",
  "cohortSize": 1,
  "sendable": 1,
  "skippedNoEmail": 0,
  "preview": [{ "uid": "...", "segment": "sphere_alum", "handle": "...", "email": "...", "inviteCode": "ABC12" }]
}
```

**Response (execute):** same fields plus `delivery` (orchestrator result: `processed`, `delivered`, `skipped`, `byChannel`, `results`).

CLI: `functions/scripts/deliverMarketingSummerTour2026Launch.js` (`--execute`, `--uid <uid>`, `--force-resend`). Secrets: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` (Secret Manager on the callable).

### 2.2a-ii `deliverMarketingSummer2026AlmostEnd` + `scheduledMarketingSummer2026AlmostEnd` (admin / one-shot)

Mid-tour almost-end recap (pre–Dick’s). **Email** → Summer Tour players (`seasonStats["2026 Summer Tour"].shows ≥ 1`, lifecycle prefs). **In-app** → all users (QA handles excluded), **no prefs gate**, fixed inbox doc `marketing_summer_2026_almost_end`. Non-players get the `noPlay` copy branch (inbox only).

**Callable request:** same shape as §2.2a (`dryRun` default true, `forceResend`, `onlyUids`).

**Scheduler:** `scheduledMarketingSummer2026AlmostEnd` — cron `0 8 3 8 *` `America/Denver` (2026-08-03 08:00 MT / 10:00 ET). Firestore run-lock `comms_marketing_runs/summer_2026_almost_end` (`pending` → `running` → `completed` / `cancelled` / `failed`). Abort before send: set status `cancelled`.

CLI: `functions/scripts/deliverMarketingSummer2026AlmostEnd.js` (`npm run comms:deliver-summer-2026-almost-end` in `functions/`). Email channel uses `deliverCommsTrigger` with `channels: ["email"]`; inbox is a Sphere-style Admin SDK fanout.

### 2.2b `lockPicksForShowNow` (admin-only, #522)

One-click War Room escape hatch: stamps `show_lock_state/{showDate}` so clients lock picks immediately. Idempotent; no setlist or scoring side effects.

**Request:**
```json
{ "showDate": "2026-07-07" }
```

**Response:**
```json
{ "ok": true, "showDate": "2026-07-07", "alreadyLocked": false }
```

When `alreadyLocked` is `true`, the doc already carried `lockReason: admin_override` and the server did not rewrite timestamps.

**Deploy:** `firebase deploy --only functions:lockPicksForShowNow` or `npm run deploy:functions:phishnet`. The War Room button ships via Vercel automatically; the callable does not. See `docs/PICKS_LOCK_ADMIN_RUNBOOK.md`.

**Ops CLI (no War Room):** `cd functions && node scripts/lockPicksForShowNow.js --showDate=YYYY-MM-DD`

### 2.3 `getPhishnetSetlist`, `scheduledPhishnetShowCalendar`, `refreshPhishnetShowCalendar`, `refreshLiveScoresForShow`, `scheduledPhishnetSongCatalog`, `refreshPhishnetSongCatalog`, `scheduledPickRecommendations`, `refreshPickRecommendations`, `scheduledPickRecommendationHistory`, `refreshPickRecommendationHistory`, `scheduledPhishnetLiveSetlistPoll`, `setLiveSetlistAutomationState`, `pollLiveSetlistNow`, `sendPushCanary`, `scheduledPublicTourStatsRefresh`, `refreshPublicTourStats`

Phish.net integration, live scoring, and public tour-stats refresh. Deployed via `npm run deploy:functions:phishnet`. Internal admin use — request/response shapes documented in `docs/PHISHNET_CALLABLE_RUNBOOK.md`.

**`public_tour_stats` (#665):** `scheduledPublicTourStatsRefresh` (daily 07:30 ET) and admin callable `refreshPublicTourStats` rebuild aggregate docs. Calendar sync also triggers a refresh after writing `show_calendar/snapshot`.

**`global_stats_leaderboards` (#1004 / v1.70.0):** `scheduledGlobalStatsLeaderboardsRefresh` (daily 08:00 ET) and admin callable `refreshGlobalStatsLeaderboards` rebuild all-time + every tour. `rollupScoresForShow` also rebuilds all-time + the finalized show’s tour (soft-fail). Request: none. Response: `{ ok, docsWritten, usersScanned, tourKeys }`. Admin claim required on the callable.

**Storage object `song-catalog.json` (v1.25.0+, #554):** published by `scheduledPhishnetSongCatalog` / `refreshPhishnetSongCatalog`. Each song object includes `{ name, total, gap, last, debut }` where `debut` is a string (typically `YYYY-MM-DD`) or `""` when unknown. See `docs/SONG_CATALOG.md`. Adding `debut` is a **MINOR** catalog-field addition (clients may ignore unknown fields).

**Storage archive `song-catalog/archive/{stamp}.json` (v1.36.0+, #647):** each catalog sync also writes a dated private snapshot (same JSON payload as live) at `song-catalog/archive/YYYY-MM-DDTHH-mm-ssZ.json` for leakage-safe recommendation backtests (#646). Not public-read (Admin SDK / ops only). Live client path is unchanged. `refreshPhishnetSongCatalog` may return optional `archivePath` (`string | null`) when the archive write succeeded.

**Storage object `pick-recommendations.json` (v1.37.0+, #650; history merge v1.39.0+, #721; full-song map v1.68.0+ / #767):** published by `scheduledPickRecommendations` (cron `15 */6 * * *` ET) and admin callable `refreshPickRecommendations`. Payload includes `generatedAt`, `modelVersion` (`v0.1.1-explainable`+), `targetShow`, `historyShowCount`, `historySource` (`merged` \| `phishnet` \| `firestore`), `topK`, `slots` (`s1o`/`s1c`/`s2o`/`s2c`/`enc`/`wild`) — each an array of `{ name, normalizedName, rank, score, playProb, slotAffinity, confidence, riskBand, reasons }` — and **`playProbBySong`** (`{ [normalizedName]: number }`, show-wide `playProb` for every history song; Lab still uses `slots` top-K). `riskBand`: `safe` (high show-wide playProb), `slot_fit` (strong for that slot over prior window *t*), `long_shot` (bustout), or `unbanded` (Lab hides). Priors: private Phish.net ~1y window at `pick-recommendations/history/window.json` merged with `official_setlists` (`showDate < target`; Firestore wins ties). Join to catalog by `normalizedName` / normalized title. No-op (skip publish) when there is no upcoming show or insufficient history. Optional private archives under `pick-recommendations/archive/`. Client: Storage `getDownloadURL` + localStorage TTL (override `VITE_PICK_RECOMMENDATIONS_URL`). See `docs/PICK_RECOMMENDATIONS.md`.

**Storage object `pick-recommendations/history/window.json` (v1.39.0+, #721):** private recommendation-only setlist cache (not public-read). Synced by `scheduledPickRecommendationHistory` (`40 4 * * *` ET) and admin `refreshPickRecommendationHistory` (`{ force?: boolean, years?: number }`, default 1y). Does **not** write `official_setlists`.

### 2.4 Comms event adapters (v1.7.0+)

Automated comms delivery triggered by Firestore writes, post-rollup hooks, live-scoring hooks, and scheduled jobs. All adapters route through `deliverCommsTrigger` and are **gated** by `COMMS_EVENT_ADAPTERS_ENABLED=true` (default off).

| Export | Trigger | Event source |
|--------|---------|--------------|
| `commsOnUserProfileWrite` | `account_welcome` | `users/{uid}` write when handle first appears |
| `commsOnPickWrite` | `picks_confirmed` | `picks/{pickId}` create with non-empty picks |
| Post-rollup hook | `show_recap`, `tour_engagement_reminder` | `rollupScoresForShow` completion. Last night of a tour is still night `show_recap` only. |
| Live-scoring hook | `score_first_points`, `score_leader` | `recomputeLiveScoresForShow` |
| `scheduledTourCountdownComms` | `tour_countdown` | Daily 9am PT cron (300s; T-10/T-5/T-3/T-1). Push and in-app on every beat. Email on T-5 and T-1 only, and only when the opener card is empty (`picks_secured` false). Fall Tour 2026 (`first_show_date` `2026-10-02`) skips the T-1 email for everyone. A tour whose first show has an invalid IANA `timeZone` is skipped. |
| `scheduledTourRankingsDailyComms` | `tour_rankings_daily`, `tour_recap` | Daily 8am PT cron (300s). Rankings = morning-after show, **skipped** when that show is a tour finale (`tour_recap` day). A failure in the tour-recap step does not cancel rankings on any other morning. A show whose `timeZone` is not a valid IANA name is skipped. `tour_recap` = first tick after that tour’s final show date while inside a **14-day lookback** and `comms_tour_recap_state/{tourId}` is not terminal (dedup `tour_recap:{tourId}:{uid}`); successful fan-out writes `status: sent` (once-ever). One tour’s failure does not stop another tour in the same tick. Sphere calendar labels (`/\bsphere\b/i`) write `skipped_archive` (#1033). |
| `scheduledPicksLockReminder` | `picks_lock_reminder` | Every 15 min (300s); venue-local show day **T-3h–lock** (window tracks per-show lock from ticket-time+20 or 19:30 fallback); **not** gated by `COMMS_EVENT_ADAPTERS_ENABLED` (v1.19.0+). A show with an invalid IANA `timeZone` is skipped. |

Trigger specs and channels: `docs/comms-triggers/catalog.json`. Admin canary/replay: `runCommsTrigger` (§2.2).

**v1.71.0+ (#510):** `tour_recap` is a P1 `results_recap` batch trigger. Audience is users with ≥1 graded pick on any show in that tour. Channels: in-app, push, abbreviated email. Prefs: `notificationPrefs.results`. Dedup: `tour_recap:{tourId}:{uid}`. Night `show_recap` is unchanged. Sphere ’26 (`deliverSphere2026TourRecapInbox`) is replay/QA only.

**v1.72.1:** `tour_recap` is **not** same-tick as the finale `show_recap`. Production fan-out is the 8am PT `scheduledTourRankingsDailyComms` tick after the tour’s last show date (`deliverPendingTourRecaps`). That tick skips `tour_rankings_daily` when yesterday was the finale. Manual `runCommsTrigger` / canary still work.

**v1.74.1 / v1.74.2 (#1033):** `deliverPendingTourRecaps` only attempts finales within **14 days** (late-grade window before first send), **hard-skips** Sphere archive tour keys, and persists **`comms_tour_recap_state/{tourId}`** (`sent` / `skipped_archive` / `closed`) so each tour is once-ever after the end-of-tour send. Seed existing tours with `functions/scripts/seedTourRecapState.js`.

**v1.71.1:** Email CTA **View Recap** → `/dashboard/profile/notifications`. In-app `TourRecapInApp` CTA **View tour standings** → `/dashboard/standings?view=tour`.

**v1.73.0 (#985):** Night `show_recap` (and the morning `tour_rankings_daily` night-para) compose `narrative_line` from set-flow arc + the player’s card + night rank when those facts exist. Push stays a short tease. Soft-fails to the #572 highlight wrappers. Existing payload fields only.

**v1.81.3 (#1121):** Morning `tour_rankings_daily` speech drops the storage date from the last-night sentence (venue and city only). Email preheader is `MM/DD/YY · {venue}, {city}`. Email and in-app eyebrow is `MM/DD/YY · Tour standings`. Next up, back at, and last played use `MM/DD/YY`. Payload `show_date` stays `YYYY-MM-DD`. Subject and push are unchanged. A deployed `scheduledTourRankingsDailyComms` revision is what the 8:00 AM Pacific run sends.

**v1.81.4 (#1122):** Visible show labels (tour date select, standings header, pool hub, picks scorecard, share text) use `MM/DD/YY`. Select values and stored `show.date` stay `YYYY-MM-DD`. Pool archive keeps `formatShowLabel` spelled dates.

**v1.81.5 (#1123):** Catalog last-played and tour-stats prior-play columns use `MM/DD/YY`. This-tour tour-stats dates use `MM/DD` (no year). Stored dates stay `YYYY-MM-DD`.

**v1.81.6 (#1124):** Show recap, picks confirmed, and lock-reminder sentences name the venue and city. Their eyebrows carry `MM/DD/YY`. Tour countdown and other future-show lines use `MM/DD/YY`. Payload `show_date` stays `YYYY-MM-DD`.

### 2.5 Comms email deliverability HTTP endpoints (v1.7.1+)

| Export | Method | Auth | Description |
|--------|--------|------|-------------|
| `commsResendWebhook` | POST | Svix signature (`RESEND_WEBHOOK_SECRET`) | Bounce/complaint/suppression → `email_suppression`. **v1.74.0 / #512 Slice A:** `email.opened` / `email.clicked` → `comms_email_engagement`. Dashboard events: [`docs/comms-triggers/RESEND_WEBHOOK.md`](./comms-triggers/RESEND_WEBHOOK.md). Do **not** subscribe `email.received` here. |
| `commsResendInboundWebhook` | POST | Svix signature (`RESEND_INBOUND_WEBHOOK_SECRET`) | **v1.75.0:** `email.received` allowlist (`updates@`, `unsubscribe@`, `support@`) → wrap + `emails.send` to `support@road2media.com` (original From in display name + body + Reply-To). `unsubscribe@` only: empty/one-word mailto auto-suppresses (`mailto_unsubscribe`) and is not forwarded; prose still opts out and forwards. Other local-parts 200 no-op. Public contact is `support@setlistpickem.com`. [`INBOUND_FORWARDING.md`](./comms-triggers/INBOUND_FORWARDING.md). |
| `commsEmailUnsubscribe` | GET/POST | HMAC query params (`uid`, `email`, `sig`) | RFC 8058 one-click unsubscribe; opts user out of lifecycle email |

Configure the Resend dashboard webhook URL to the deployed `commsResendWebhook` HTTPS endpoint and enable bounce, complaint, suppressed, opened, and clicked events. Signing secret: `firebase functions:secrets:set RESEND_WEBHOOK_SECRET`. Checklist: [`docs/comms-triggers/RESEND_WEBHOOK.md`](./comms-triggers/RESEND_WEBHOOK.md).

**v1.75.0 inbound:** create a **second** Resend webhook pointed at `commsResendInboundWebhook` with **only** `email.received`. Each Resend endpoint has its own `whsec_`. Set `firebase functions:secrets:set RESEND_INBOUND_WEBHOOK_SECRET`. Do not add `email.received` to the engagement webhook — that path ignores it.

**`commsEmailUnsubscribe` method gating (v1.9.0+, #456):** the two HTTP methods behave differently by design —
- **POST** with a valid signature (the real RFC 8058 one-click action; mail clients issue this automatically via `List-Unsubscribe-Post`) suppresses immediately and returns a success page.
- **GET** with a valid signature (the visible footer "Unsubscribe"/"Manage preferences" link, or any link-scanner/antivirus gateway prefetching it) never suppresses by itself — it renders an HTML confirmation page with a form that must be explicitly submitted (a real POST) to complete the unsubscribe.
- Any other method, or an invalid/missing signature, returns `400`/`405` without touching `email_suppression`.

The branded HTML email body's visible footer link points at the `/dashboard/profile/account` Preferences page, not this endpoint directly — the raw one-click URL is only ever embedded in the invisible `List-Unsubscribe` header. Legacy `/dashboard/notifications` still redirects to Messages (query preserved); `?openPush=1` then hops to Preferences. `/dashboard/account-security` redirects to Preferences (query preserved).

### 2.6 Comms email subscription callables (v1.10.0, #455)

Authenticated callables backing the Preferences email section (`/dashboard/profile/account`). Clients cannot read `email_suppression` directly.

| Export | Auth | Description |
|--------|------|-------------|
| `getCommsEmailStatus` | Signed-in user | Returns `{ hasEmail, suppressed, reason, canResubscribe, message, lifecycleEnabled }` for the caller's account email |
| `unsubscribeCommsEmail` | Signed-in user | Writes `email_suppression` with `reason: user_preferences` and opts out `notificationPrefs.lifecycle` |
| `resubscribeCommsEmail` | Signed-in user | Clears self-serve suppressions (`one_click_unsubscribe`, `mailto_unsubscribe`, `user_preferences`) and re-enables `notificationPrefs.lifecycle`; hard bounces and spam complaints are rejected |

---

## 3. Public URL Routes

These routes are part of the public surface. Renaming or removing them is a MAJOR change.

| Path | Auth | Description |
|------|------|-------------|
| `/` | None | Public splash / landing page. **v1.32.0+ (#659):** build-time prerender injects crawler-visible H1/body + JSON-LD into `dist/index.html`. **v1.47.0 (#832):** `/` boots the **marketing** Vite entry (real splash UI, no `AuthProvider` / `firebase-core` on cold open). **v1.48.3 (#835):** boot chrome is a thin top progress bar (not a full-screen spinner) so prerender body is visible while marketing JS loads; sibling marketing routes are lazy off the home graph. **v1.57.0 (#706):** mobile hamburger for primary marketing nav below `lg`. Social scrapers on `/` may still receive the empty-body OG shell (`middleware.js`). |
| `/login` | `mode?` (`signin` \| `signup`), `signup=1` (compat) | **v1.47.0 (#832):** auth entry for marketing CTAs. **v1.48.0 (#834):** full-page inline sign-in / create-account (no modal). Marketing CTAs hard-navigate here (`?mode=signup` for create account). **v1.48.1:** app-shell splash CTAs also navigate here (no splash modals); `MarketingPageShell` Home hard-navigates to marketing `/`. **v1.48.2:** mid-page Get Started chooser removed — splash/marketing play CTAs go straight here. **v1.48.3 (#835):** branded `login/index.html` boot shell; form paints without Auth init on the critical path. **v1.48.4 (#850):** after form paint, warm Auth (+ parallel App Check); Google/`signInWithPopup` must not await App Check (Safari gesture). **v1.49.2 (#858):** warm starts **immediately** after paint; Continue with Google stays disabled until Auth + click-path modules are ready (brief “Preparing sign-in…”); ready click path invokes popup/redirect with no chunk awaits — standing rules in `docs/AUTH_BOOT_PRACTICES.md` (incl. rule 2b). **v1.49.3:** `login/index.html` paints a login auth-card skeleton (not dashboard bottom-tab chrome) while the SPA mounts. **v1.50.0 (#859):** Safari / iOS / in-app Google sign-in uses `signInWithRedirect` (desktop Chromium/Firefox keep popup; `auth/popup-blocked` → one-shot redirect). **v1.51.0 (#860):** marketing CTA intent prefetches `/login` UI assets (no Firebase execute on marketing `/`); login shell modulepreloads `firebase-core`; `auth_surface_timing.warm_path=intent` when prefetch contributed; Google continue chrome covers redirect blank gap. **v1.52.0 (#880):** after marketing first paint, idle speculative download of `/login` + login UI + `firebase-core` (still no `initializeApp` on marketing); `warm_path=speculative` when idle warm contributed without CTA intent; optional `auth_hop_timing` `{ phase: cta_to_form, value, intent, warm_path }`. **v1.53.0 (#881):** thin CSR `login.html` entry (form only after JS) — **retired in v1.53.1 (#890)** after Safari private hang. **v1.53.1 (#890):** restored `app.html` + branded shell. **v1.54.0 (#892 / #894 / epic #889 Phase 2):** **HTML-first auth door** — first document includes real form controls; `login.html` → auth-only `loginMain.jsx` hydrate (not dashboard `app-*.js` / react-query); Suspense fallback keeps form chrome; Terms/Privacy hard-nav; post-auth / unauth dashboard-setup hard-nav across documents. Compatibility: `signup=1` and `/?login=true` still resolve here. **v1.47.3 (#830):** unauthenticated `/dashboard/*` and `/setup` hard opens bounce here; outbound inventory in `docs/OUTBOUND_AUTH_HANDOFF.md`. Invite VIP (`/join`, `/invite`) keeps modal auth until #844. |
| `/how-it-works` | None | How to play marketing page. **v1.32.0+ (#659):** served as prerendered `dist/how-it-works/index.html` when present. **v1.47.0:** marketing document. **v1.56.1 (#937):** show-night walkthrough (distinct from splash Game Format teaser). |
| `/how-scoring-works` | None | Scoring rules marketing page. **v1.32.0+ (#659):** served as prerendered `dist/how-scoring-works/index.html` when present. **v1.47.0:** marketing document. **v1.58.0 (#944):** light editorial main + `ScoringRulesContent surface="light"` (in-app modal remains dark default). |
| `/tour-stats` | None | **v1.33.0 (#665):** public aggregate tour song stats (filter + default Sphere). Prerendered shell; live data from `public_tour_stats`. Never full nightly setlists. **v1.47.1 (#827):** skeleton chrome + `PublicTourStatsPage` modulepreload. **v1.49.0 (#853):** boots the **marketing** document (no `AuthProvider`); App Check + Firestore load at fetch time only — restores cold-open feel after #835 login deferral regressed the app-shell path. **v1.60.0 (#929):** hub “current tour” blurb links to the live summer SEO slug; filter selection always uses slug URLs. **v1.62.0 (#869):** first meaningful stats prefer `/tour-stats-data/*.json` + Firestore REST (no App Check kick on marketing). |
| `/tour-stats/:tourSlug` | None | **v1.33.0 (#665):** same surface for a kebab-case tour slug (e.g. `2026-sphere`). Default Sphere slug is also prerendered. **v1.49.0 (#853):** same marketing-document boot as `/tour-stats`. **v1.59.0 (#927/#928):** `2026-summer-tour` prerendered + sitemap/`llms.txt` (live calendar label **2026 Summer Tour**); crawler HTML includes aggregate bustout/frequency facts at build time. **v1.60.0 (#929):** fan-language H2s/intros on the public surface; selecting the current/default tour keeps the slug path (no collapse to `/tour-stats`). **v1.62.0 (#869):** same CDN/REST data plane as the hub. **v1.62.1 (#930):** `/llms.txt` restates unique / frequency / 30+ bustout definitions and deep-links this summer slug. **v1.63.0 (#959):** additional slugs auto-prerender (facts HTML + FAQ/ItemList, sitemap, `llms.txt`) when `public_tour_stats` meets the thin-page gate — no hand edit of `seoRoutes.js`. Gate: `showsWithSetlist ≥ 4` and `uniqueSongs ≥ 20` and `lastShowDate` in the current UTC year. Kill-switch / allowlist / denylist: `TOUR_STATS_SEO_AUTO_EXPAND`, `TOUR_STATS_SEO_ALLOWLIST`, `TOUR_STATS_SEO_DENYLIST`. Aggregates only; never full night setlists. No `/phish-picks`. |
| `/tour-stats-data/:docId.json` | None | **v1.62.0 (#869):** build-time JSON snapshot of `public_tour_stats/{docId}` (`_index` + each tour slug). Same-origin; `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. Aggregates only — never full night setlists. Client revalidates via Firestore REST. |
| `/phish-setlist-prediction-game` | None | **v1.34.0 (#660):** keyword-intent educational page for Phish setlist prediction game queries; prerendered HTML + FAQ JSON-LD. **v1.47.0:** marketing document. **v1.56.0 (#940):** tightened scannable definitional landing (epic #942). **v1.62.2 (#973):** title / description / FAQ bridge C6 (`phish setlist prediction`) and C7 (`phish picks`) on this same URL — no `/phish-picks` doorway. |
| `/about` | None | **v1.56.0 (#941):** crawlable origin / brand narrative (extracted from splash About); prerendered marketing document. |
| `/join/:code` | None | Pool invite deep link; optional `?from={handle}` for inviter personalization; VIP landing stores code and prompts auth (#580); personalized OG (#582) |
| `/invite/:handle` | None | Site VIP invite deep link; personalized landing when handle resolves; no pool join side effects (#580); personalized OG (#582) |
| `/user/:userId` | None | Public player profile — **`noindex,follow`** (#661); not a sitemap target |
| `/privacy` | None | Privacy policy. **v1.61.0 (#916):** HTML-first legal door — full policy body in first HTML; no marketing CSR / Auth / Firebase. Soft route remains on app SPA for Profile/account. |
| `/terms` | None | Terms of service. **v1.61.0 (#916):** same HTML-first legal-door boot as `/privacy`. |
| `/password-reset-complete` | None | Firebase Auth continue URL |
| `/setup` | Auth | Profile setup (new users) |
| `/dashboard/*` | Auth | Full game dashboard |

Dashboard sub-routes are documented in `docs/DASHBOARD_IA.md`.

**Account primary (**v1.67.0 / #770**):** last player-tab label is **Account** (was Profile). Path prefix stays **`/dashboard/profile/*`** (no new `/dashboard/account` family). Tertiary: **Profile** (`/dashboard/profile`) · **Messages** (`/dashboard/profile/notifications`, inbox only) · **Preferences** (`/dashboard/profile/account` — security, logout, legal, install/PWA, notification prefs). `?openPush=1` and the dashboard install push nudge land on Preferences. Avatar shortcut → Preferences; bell → Messages. **#513 Phase 2:** inbox sections Unopened / Read / Archived; owner `archivedAt` + hard delete. Phase 3 per-channel pref keys are deferred (same `notificationPrefs` keys; cosmetic Push / Email grouping only).

**Stats primary (**v1.66.0 / #769** chrome, **v1.69.0 / #1004** remap, **v1.70.0 / #1004** Global boards, **v1.70.1** trays):** fifth player tab. Nested destinations (not `?view=`): **`/dashboard/stats`** and **`/dashboard/stats/personal`** (Personal — All-time | This tour tray; All-time inner Your stats | Top picks; This tour self overlay), **`/dashboard/stats/global`** (All-time | This tour tray, then PPS | Picking Avg | SLG; top 50 paginated 10/page + you-row; Functions-owned `global_stats_leaderboards`; **v1.77.0** slugging = total points ÷ (shows × 30), all-time minimum 15 shows), **`/dashboard/stats/band`** (private tour song explorer from **v1.30.0 / #555** — frequency / bustouts / high gaps). **`/dashboard/tour-stats`** redirects to `/dashboard/stats/band` and preserves `?tour=`. Stats tab stays active on all `/dashboard/stats/*` and on the redirect hop. Every Stats destination uses the chrome tour picker (`showTourScopePicker`); Personal and Global all-time do not restamp with `?tour=`. **Public** counterpart: **`/tour-stats`** (**v1.33.0 / #665**) — Band’s marketing twin; aggregates only, no self overlay, not under `/dashboard/`. Unchanged in v1.70.1.

**Picks cluster (**v1.64.0 / #766**):** nested destinations under the primary **Picks** tab (not `?view=`). **`/dashboard`** and **`/dashboard/picks`** are Make Picks (existing form). **`/dashboard/picks/lab`** is Picks Lab. **`/dashboard/picks/scorecard`** is Scorecard. The Picks tab stays active on all three. Global date picker stays on. The Lab segment is always visible.

**Picks — Scorecard (**v1.65.1 / #767**, full-song odds **v1.68.0**, graded hit chrome **v1.72.0 / #1013**):** global, show-scoped self card at **`/dashboard/picks/scorecard`**. Overlap is post-lock only. Odds are optional show-wide `playProb` from Storage `pick-recommendations.json` (`playProbBySong` when present; else per-slot top-K). When the map exists, every pick shows a percent; titles missing from history show `<1%`. Omit all odds if the artifact is missing or for another night. On graded nights (`locked` + official setlist), each slot uses `getSlotScoreBreakdown`: hits (`points > 0`) show a light A5 check + inset ring (brand-primary for `exact_slot` / `encore_exact` / `wildcard_hit`; accent-blue for `in_setlist`; amber overlay when `bustoutBoost`). Misses are slightly muted. Pre-grade cards are unchanged. Rank/score reuse the existing show-scoped standings query. **GA4 (client):** `scorecard_open` `{ show_date, lock_state }` where `lock_state` is `empty` \| `pre_lock` \| `locked_ungraded` \| `graded`; `scorecard_metric_impression` `{ show_date, metric }` where `metric` is `overlap` \| `odds` \| `rank`.

**Picks — Make Picks song picker (**v1.72.0 / #1013**):** the autocomplete dropdown shows compact model odds as an `Odds: N%` stat (`<1%` / mobile `<1` when the title is missing from `playProbBySong`) from the same Storage artifact as Scorecard, only when `targetShow.date` matches the selected night. Total / Gap / Last stay beside it. The Make Picks card shows an **Odds** label + tooltip (plain-language “best guess from recent shows”). Not live crowd %.

**Pools tertiary (**v1.65.0 / #768**):** nested destinations under Pools — **`/dashboard/pools`** (My Pools), **`/dashboard/pools/create`** (Create Pool), **`/dashboard/pools/join`** (Join Pool). **`/dashboard/pool/:id`** (pool details) is unchanged; Pools primary stays active. Not `?view=`. Post-auth `/join/:code` with a pending invite lands on `/dashboard/pools/join`.

**Standings Show — Crowd pulse (**v1.35.0 / #687**, productized **#694**, preview blur **v1.39.4**):** client-side aggregate of submitted picks for the selected `showDate`. While `showStatus === 'NEXT'`, preview **Song** + **Last** columns blur (pickers / gap stay clear); full deep stats (multi list / gaps / vintage / leaders) stay locked until showtime. **GA4 (client):** `crowd_pulse_view` `{ show_date, deep_stats: locked|open, pickers }`, `crowd_pulse_full_expand` `{ show_date }`, `crowd_pulse_section_open` `{ show_date, section }` where `section` is `top_songs` | `multi_picker` | `highest_gaps` | `vintage` | `leaders`.

**Picks — Prediction Lab (**v1.38.0 / #651**, moved **v1.64.0 / #766**, add confirmation **v1.72.0**):** lives at **`/dashboard/picks/lab`**. Opt-in slot recommendations consuming Storage `pick-recommendations.json` (see §2.3). **Use** fills the shared cluster draft (same card as Make Picks) and does **not** persist — Lock In Picks / Update Picks still writes `picks/{showDate}_{uid}`. Lab shows a live Your card plus that save CTA when the draft is dirty. Manual autocomplete on Make Picks is unchanged. When `VITE_ENABLE_PREDICTION_LAB` is not `true`, the Lab route still renders (coming-soon shell) — the tertiary tab is not hidden. **GA4 (client):** `prediction_lab_open` `{ show_id, model_version }`, `prediction_lab_impression` `{ show_id, slot, model_version, risk_band, rank }`, `prediction_lab_select` `{ show_id, slot, model_version, risk_band, rank, song_normalized }`.

**Field RUM — web-vitals (**v1.44.0 / #801**, route groups **v1.49.1 / #857**):** production hostnames only. Client emits GA4 `web_vital` for LCP, INP, CLS, TTFB, FCP after idle. Params: `{ metric_name, value, metric_id, metric_rating, route_group, navigation_type }` where `route_group` is `splash` \| `login` \| `marketing` \| `tour_stats` \| `invite_join` \| `invite_site` \| `dashboard` \| `setup` \| `other` and `navigation_type` is `navigate` \| `reload` \| `back_forward` \| `prerender`. Ops: [`docs/WEB_VITALS_RUM.md`](WEB_VITALS_RUM.md).

**Auth interaction timings (**v1.49.1 / #857**, hop **v1.52.0 / #880**):** production hostnames only (same `ga4Event` gate). `auth_surface_timing` `{ phase: paint_to_ready, value, route_group: login, warm_path, navigation_type }` once per `/login` warm (`warm_path`: `immediate` \| `idle` \| `intent` \| `speculative`). `auth_google_timing` `{ phase: click_to_popup \| credential_to_nav, value, method: google, auth_flow, outcome, error_code? }`. `auth_hop_timing` `{ phase: cta_to_form, value, intent: signin \| signup, warm_path, route_group: login }` when a marketing CTA stamped the hop. Ops: [`docs/AUTH_TELEMETRY_RUNBOOK.md`](AUTH_TELEMETRY_RUNBOOK.md) · plan [`docs/AUTH_SEAMLESS_PATH.md`](AUTH_SEAMLESS_PATH.md) §7.

### 3.1 Email CTA click-through host (`click.setlistpickem.com`)

Service comms email bodies expose **one** tracked CTA link (the teal button). The header wordmark is decorative (CSS background, not a link).

| Host / path | Handler | Description |
|-------------|---------|-------------|
| `https://click.setlistpickem.com/{path}` | Vercel `api/email-click/[[...path]].js` (host rewrite in `vercel.json`) | 302 redirect to `https://www.setlistpickem.com/{path}` with `utm_source=email`, `utm_medium=comms`, and trigger metadata (`utm_campaign` ← `tid`, `utm_content` ← `tpl`, `utm_term` ← `cta`) |

URL builder: `comms/emailLinks.cjs` (`buildEmailTrackedCtaUrl`). Applied at send time in `commsEmailWorker.js`. Resend domain **Click tracking** stays **on** (`links.setlistpickem.com` wrap → our host → www). That wrap does not strip UTM/trigger query params. Webhook `email.clicked` is not sufficient without the domain toggle — see [`docs/comms-triggers/RESEND_WEBHOOK.md`](comms-triggers/RESEND_WEBHOOK.md). Cloudflare DNS: CNAME `click` → same Vercel target as `www`.

### 3.2 HTTP security headers (Vercel)

Applied via `vercel.json` to all routes. Policy details: `docs/SECURITY_HEADERS.md`.

| Header | Mode | Notes |
|--------|------|-------|
| `X-Content-Type-Options` | Enforce | `nosniff` |
| `Referrer-Policy` | Enforce | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | Enforce | `DENY` on listed app routes only; **omitted** on `/__/auth/*` and `/__/firebase/*` (Vercel does not honor negative-lookahead header sources) |
| `Permissions-Policy` | Enforce | camera/microphone/geolocation disabled |
| `Content-Security-Policy-Report-Only` | Report-only | Flip to `Content-Security-Policy` after soak (promote-day) |

Adding or tightening enforced CSP is MINOR; removing a security header is MAJOR.

### 3.3 Invite landing Open Graph (`api/invite.js`)

Social crawlers (Meta, X, Slack, …) do not execute JavaScript. Invite URLs are rewritten to `api/invite.js`, which injects pool- or inviter-specific OG tags into the SPA shell for browsers and crawlers. If the bundled `dist/index.html` is missing, the function fetches live site `/` HTML as a fallback. Empty crawler-only HTML is never returned to browsers (avoids blank white pages).

| Public path | Rewrite (`vercel.json`) | Query params | Crawler behavior | Browser behavior |
|-------------|-------------------------|--------------|------------------|------------------|
| `/join/:code` | `/api/invite?code=:code` | Unmatched query preserved (e.g. `?from={handle}`) | Resolves pool name via Admin SDK; `from` personalizes title via invite-kit copy | SPA shell + static OG (no Firestore) |
| `/invite/:handle` | `/api/invite?handle=:handle` | — | Resolves `users.handle` via Admin SDK; generic OG if missing | SPA shell + static OG from URL handle |

Copy mirrors `src/shared/lib/inviteKit.js` (`buildSiteInviteShareTitle`, `buildPoolInviteShareTitleFromInviter`) and legacy pool OG (`Join my Setlist Pick 'Em pool: {name}`) when `from` is absent. Constants mirror `src/shared/config/seo.js` in `api/inviteOgHelpers.mjs` (no `src/` imports in serverless).

**v1.44.2 / #732:** `firebase-admin` is dynamic-imported only on the crawler/Firestore branch so browser requests do not pay Admin module cold-start. Client FCM service-worker registration is idle-deferred on `/`, `/join/*`, and `/invite/*` (still on-demand via messaging helpers).

**Vercel env:** `FIREBASE_SERVICE_ACCOUNT` (JSON) enables Firestore Admin lookups for crawlers.

**Tests:** `api/inviteOgHelpers.test.js` (pure helpers; no Vercel runtime).

### 3.4 Owned-social short links (`/ig/*`, `/th/*`)

Temporary (307) redirects in `vercel.json`. The caption shows the short path. The landing URL carries `utm_medium=social`, `utm_campaign=seo_geo`, `utm_source` (`instagram` or `threads`), and `utm_content` from the beat. No wildcard. No trailing slash. These paths are not pages and are not in the sitemap.

| Caption path | Lands on | `utm_content` |
|--------------|----------|----------------|
| `/ig/how`, `/th/how` | `/how-it-works` | `how-it-works` |
| `/ig/card`, `/th/card` | `/phish-setlist-prediction-game` | `card-open` |
| `/ig/score`, `/th/score` | `/how-scoring-works` | `how-scoring-works` |
| `/ig/about`, `/th/about` | `/about` | `about` |
| `/ig/stats`, `/th/stats` | `/tour-stats` | `tour-stats` |

The profile link stays the long `utm_content=link-in-bio` URL. Local Vite does not apply `vercel.json`, so `/ig/how` on `localhost` still falls through to the app shell.

**Tests:** `src/shared/config/socialShortLinks.test.js`.

---

## 4. Environment Variable Interface

These `VITE_*` variables are read at build time. Adding or removing one is a MINOR (add) or MAJOR (remove/rename) change.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | No | Defaults to `set-picks.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `VITE_GA_MEASUREMENT_ID` | No | GA4 measurement ID (omit locally) |
| `VITE_FCM_VAPID_KEY` | No | Web push VAPID key |
| `VITE_SETLIST_API_SOURCE` | No | Setlist data source override |
| `VITE_USE_CALLABLE_PHISHNET_SETLIST` | No | Route fetches through callable |
| `VITE_SONG_CATALOG_URL` | No | CDN URL override for song catalog |
| `VITE_PICK_RECOMMENDATIONS_URL` | No | CDN URL override for pick recommendations (#650) |
| `VITE_ENABLE_SPONSOR_SLOTS` | No | `true` renders reserved sponsor/ad placements (`SponsorSlot`); omit to hide (default) |
| `VITE_ENABLE_PREDICTION_LAB` | No | `true` renders Prediction Lab + loads pick-recommendations artifact on **`/dashboard/picks/lab`**. Omit to show the Lab coming-soon shell (default). The Lab tertiary segment stays visible either way (**v1.64.0 / #766**). Use on Preview/local for QA; leave unset in Production until launch |

### 4.1 Cloud Functions runtime env vars

Set in Firebase Functions config or Cloud Secret Manager. Adding one is a MINOR change; removing or renaming is MAJOR.

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | For email channel | Resend API key (Secret Manager); bound to `runCommsTrigger`, `deliverMarketingSummerTour2026Launch`, `deliverMarketingSummer2026AlmostEnd`, `scheduledMarketingSummer2026AlmostEnd`, and comms adapters |
| `RESEND_WEBHOOK_SECRET` | For email deliverability | Resend/Svix webhook signing secret (`whsec_…`); also signs one-click unsubscribe URLs |
| `RESEND_INBOUND_WEBHOOK_SECRET` | For inbound receiving | **v1.75.0:** Svix secret for `commsResendInboundWebhook` only (`whsec_…` from the `email.received` Resend webhook) |
| `GA4_MEASUREMENT_ID` | For server `comms_delivered` MP | Same `G-…` id as `VITE_GA_MEASUREMENT_ID`; Functions `defineString` / `.env.set-picks` |
| `GA4_MP_API_SECRET` | For server `comms_delivered` MP | GA4 Measurement Protocol API secret (Secret Manager); bound on all `deliverCommsTrigger` hosts; unset → no-op |
| `COMMS_EVENT_ADAPTERS_ENABLED` | No | Must be `"true"` for v1 event adapters to fire; default off |
| `PHISHNET_API_KEY` | For Phish.net callables | Phish.net API key (Secret Manager) |

### 4.2 Build-time tour-stats SEO auto-expand (#959)

Read by `scripts/prerender-seo.mjs` (not `VITE_*`; not shipped to the client). Adding one is MINOR; removing or renaming is MAJOR.

| Variable | Required | Description |
|----------|----------|-------------|
| `TOUR_STATS_SEO_AUTO_EXPAND` | No | Kill-switch. Default on. Set `0` / `false` / `off` to skip extra slugs (static Sphere + Summer in `seoRoutes.js` still prerender). |
| `TOUR_STATS_SEO_ALLOWLIST` | No | Optional comma-separated slugs; when set, only those slugs may auto-expand (still must meet the thin-page gate). |
| `TOUR_STATS_SEO_DENYLIST` | No | Optional comma-separated slugs that must never auto-expand (rollback a bad tour). |

---

## 5. Firestore Security Rules Contract

`firestore.rules` enforces access control. Any change that **widens** access (allows previously denied reads/writes) is a MAJOR change. Changes that **narrow** access are MINOR or PATCH.

Current rules version is not independently versioned — it is tied to the app release version. See `firestore.rules` for the canonical contract.

---

## 6. Version Bump Decision Table

| Change | Bump | Examples |
|--------|------|---------|
| Bug fix, copy change, style tweak | **PATCH** | Fix toast wording, fix broken query, UI color |
| New feature, new route, new callable, new env var, new collection | **MINOR** | New comms trigger, new standings view, new marketing page |
| Rename/remove route, rename/remove callable, rename Firestore field, remove env var, widen security rules | **MAJOR** | Rename `commsInbox` → `inbox`, remove `/how-it-works`, break callable request shape |
| Breaking Firestore schema migration | **MAJOR** | Add required field with no default, rename collection |

---

## 7. Release Process

1. Bump `version` in `package.json` per the table above.
2. Add an entry to `CHANGELOG.md` under `## [X.Y.Z] — YYYY-MM-DD`.
3. Open a PR to `staging`, merge, then promote `staging → main`.
4. After the `main` merge: `git tag vX.Y.Z -m "Release X.Y.Z" && git push origin vX.Y.Z`.
5. Update this document if any API surface changed.

---

## 8. Pre-release and Build Metadata

- Pre-release staging builds MAY be tagged `vX.Y.Z-rc.N` (e.g. `v1.7.0-rc.1`).
- Build metadata (e.g. `v1.6.0+sha.abc123`) is informational and does not affect precedence.
- The `staging` branch is treated as a rolling pre-release; only `main` tags carry official version numbers.
