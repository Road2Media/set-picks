# Trigger catalog (v1)

**Machine-readable mirror:** [catalog.json](./catalog.json)  
**Framework:** [FRAMEWORK.md](./FRAMEWORK.md) — TTDMOM  
**Measurement:** [MEASUREMENT_PLAN.md](./MEASUREMENT_PLAN.md)

---

## Automation types

| Value | Meaning |
|-------|---------|
| `automated` | Runs on a cron schedule — no human action required |
| `event_triggered` | Fires when a specific game or user event occurs |

All production triggers are one of these two. There are no admin-initiated or manual triggers in the production comms system.

---

## In-app vs push/email CTAs

| Channel | User context | CTA pattern |
|---------|--------------|-------------|
| **In-app** (`commsInbox`) | Already in the app | Action label + deep link (e.g. `Make picks for show 1` → `/dashboard/picks`). **Never** `Open the app`. |
| **Push** | Lock screen / notification shade | Short teaser body; tap deep-links into the app (may say "Open the app" in body copy). |
| **Email** | Mail client | Branded button + plain-text `Open the app: <url>` footer. |

Registry implementation: `src/features/notifications/ui/commsTemplates/commsTemplateRegistry.jsx`.

---

## Variables — common pool

Every template draws from this shared set. Each trigger declares the subset it uses.

| Variable | Firestore / data source | Fallback |
|----------|------------------------|---------|
| `{{handle}}` | `users/{uid}.handle` | `Picker` |
| `{{first_name}}` | `users/{uid}.firstName` | `{{handle}}` |
| `{{show_date}}` | `show_calendar` snapshot, formatted | — |
| `{{venue_name}}` | `show_calendar` snapshot | — |
| `{{venue_city}}` | `show_calendar` snapshot | — |
| `{{time_to_lock}}` | Computed at send time | — |
| `{{lock_time_local}}` | Computed (published ticket/show time + 20 min when known; else 19:30 venue-local) | `7:30 PM` |
| `{{tour_name}}` | Tour metadata | — |
| `{{days_remaining}}` | Computed from tour start date | — |
| `{{first_show_date}}` | Tour first show | — |
| `{{first_show_venue}}` | Tour first show venue | — |
| `{{first_show_city}}` | Tour first show city | — |
| `{{opener_pick}}` | `picks/{pickId}.opener` | — |
| `{{closer_pick}}` | `picks/{pickId}.closer` | — |
| `{{encore_pick}}` | `picks/{pickId}.encore` | — |
| `{{wildcard_pick}}` | `picks/{pickId}.wildcard` | — |
| `{{song_name}}` | Live scoring event | — |
| `{{pick_type}}` | `opener` / `closer` / `encore` / `wildcard` | — |
| `{{points_earned}}` | Scoring event | — |
| `{{current_score}}` | Live score aggregate | — |
| `{{show_score}}` | Graded show total | — |
| `{{global_rank}}` | Global leaderboard | — |
| `{{global_total_pickers}}` | Count of users in global pool | — |
| `{{pool_name}}` | `pools/{poolId}.name` | — |
| `{{pool_rank}}` | Pool leaderboard | — |
| `{{pool_total_pickers}}` | Pool member count | — |
| `{{leaderboard_name}}` | `Global` or `{{pool_name}}` | `Global` |
| `{{lead_margin}}` | Points ahead of 2nd | — |
| `{{correct_picks_count}}` | Graded pick count | — |
| `{{opener_result}}` | `✓ {{song}}` or `✗ {{song}}` | — |
| `{{closer_result}}` | same | — |
| `{{encore_result}}` | same | — |
| `{{wildcard_result}}` | same | — |
| `{{bustout_bonus}}` | Bonus points for rare-song wildcard | `0` |
| `{{setlist_highlight}}` | Contextual note from setlist data | — |
| `{{top_scorer_handle}}` | Tonight's high scorer | — |
| `{{top_score}}` | Tonight's high score | — |
| `{{tour_rank}}` | Cumulative tour standing | — |
| `{{tour_points}}` | Cumulative tour score | — |
| `{{total_tour_pickers}}` | Users in tour pool | — |
| `{{rank_change}}` | `up 3` / `down 1` / `held` (null on debut / late join) | — |
| `{{shows_played}}` | Shows user has participated in | — |
| `{{shows_remaining}}` | Shows left in tour | — |
| `{{next_show_date}}` | Next scheduled show | — |
| `{{next_show_venue}}` | Next show venue | — |
| `{{pool_tour_rank}}` | Pool-specific tour rank | — |
| `{{invite_kind}}` | `site` or `pool` — which VIP landing the invite URL targets | `site` |
| `{{invite_url}}` | Tracked invite link (`/invite/{handle}` or `/join/{code}?from={handle}` + UTMs) | — |
| `{{invite_headline}}` | Personalized invite line (mirrors invite kit copy) | — |
| `{{inviter_handle}}` | Handle embedded in invite URL / headline | `{{handle}}` |
| `{{invite_code}}` | Pool invite code when `invite_kind=pool` | — |

---

## 1 — `account_welcome`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `event_triggered` |
| **Event** | `users/{uid}` document created (first account setup complete, `handle` present) |
| **Channels** | `inApp`, `push`, `email` |
| **Audience** | Every new user, once |
| **Prefs key** | `lifecycle` (default: on) |
| **Dedup** | `welcome:{uid}` |
| **Implementation** | Firestore `onCreate` trigger on `users/{uid}` |

#### Variables used

`{{handle}}`, `{{tour_name}}` (next upcoming tour), `{{next_show_date}}`, `{{next_show_venue}}`

#### Template — Push

**Title:** `Welcome to Setlist Pick'em, {{handle}}`  
**Body:** `You're in. Make your picks before the show and compete for glory.`  
**Deep link:** `/dashboard`

#### Template — In-App

**Heading:** `Welcome to the game, {{handle}}`

**Body:** Setlist Pick'em puts your Phish knowledge to the test. Predict the opener, closer, encore, and a wildcard before every show. Points update live as songs are played — and the competition is real.

{{tour_name}} is coming up. Picks open before each show. Get your first picks in and see where you land.

**CTA:** `Make your first picks →` → `/dashboard/picks`

#### Template — Email

**Subject:** `{{handle}}, you're officially in the pool`  
**Preview:** `Your picks, your score, your ranking. Let's go.`

**Body sections:**
1. Welcome — you're in. What the game is (1 short paragraph).
2. How it works — opener, closer, encore, wildcard; points go live during the show.
3. Next show — `{{next_show_venue}}` on `{{next_show_date}}`. Picks open now.
4. CTA button: `Make your picks`

---

## 2 — `tour_countdown`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `automated` |
| **Schedule** | Daily cron; fires when a tour's first show is exactly 10, 5, 3, or 1 day(s) away |
| **Channels** | `inApp` and `push` on every beat. `email` on T-5 and T-1 only, and only when `picks_secured` is false. |
| **Audience** | All users who have logged in within the last 60 days |
| **Prefs key** | `lifecycle` |
| **Dedup** | `tour_countdown:{tourId}:{uid}:{days_remaining}` |
| **Implementation** | `onSchedule` daily; checks tour start date vs today; fires 4 times per tour |

#### Variables used

`{{handle}}`, `{{tour_name}}`, `{{days_remaining}}`, `{{first_show_date}}`, `{{first_show_venue}}`, `{{first_show_city}}`, `{{picks_secured}}`

#### In-app CTA by picks state (#509)

| Days | No picks | `picks_secured === true` |
|------|----------|--------------------------|
| `10` | `View upcoming shows` | unchanged (`View upcoming shows`) |
| `5` / `3` | `Make picks for show 1` | `View / Edit picks` |
| `1` | `Lock in your picks` | `View / Edit picks` |

#### Email

| Days | Empty card | `picks_secured === true` |
|------|------------|--------------------------|
| `10` / `3` | No email | No email |
| `5` / `1` | Email | No email |

Show-day `picks_lock_reminder` is a separate trigger. It still emails only an empty card.

Fall Tour 2026 (`first_show_date` `2026-10-02`) skips the T-1 email for everyone. Push and in-app still fire. The table above starts with the next tour.

**Copy and cadence contract:** `content/comms/lifecycle/tour-countdown.md`

**Deep link:** `/dashboard/picks`

---

## 3 — `picks_confirmed`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `event_triggered` |
| **Event** | User submits/locks their picks for a show |
| **Channels** | `inApp`, `push` |
| **Audience** | The pick owner only |
| **Prefs key** | `lifecycle` |
| **Dedup** | `picks_confirmed:{uid}:{showDate}` |
| **Implementation** | Firestore `onUpdate` on `picks/{pickId}` when locked state changes |

#### Variables used

`{{handle}}`, `{{show_date}}`, `{{venue_name}}`, `{{venue_city}}`, `{{opener_pick}}`, `{{closer_pick}}`, `{{encore_pick}}`, `{{wildcard_pick}}`

#### Template — Push

**Title:** `Picks locked — {{venue_city}} tonight`  
**Body:** `Your picks are in, {{handle}}. Good luck out there.`  
**Deep link:** `/dashboard/picks`

#### Template — In-App

**Heading:** `You're locked in, {{handle}}`

**Body:** Your picks for {{venue_name}} on {{show_date}} are confirmed:

- **Opener:** {{opener_pick}}
- **Closer:** {{closer_pick}}
- **Encore:** {{encore_pick}}
- **Wildcard:** {{wildcard_pick}}

Scores update live during the show. Check back tonight.

**CTA:** `View live scores →`

---

## 4 — `score_first_points`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `event_triggered` |
| **Event** | First correct pick scored for a user in a show (live during show) |
| **Channels** | `inApp`, `push` |
| **Audience** | Pick owner |
| **Prefs key** | `results` |
| **Dedup** | `first_points:{uid}:{showDate}` |
| **Implementation** | Live scoring update hook; fires once per user per show on first non-zero score |

#### Variables used

`{{handle}}`, `{{song_name}}`, `{{pick_type}}`, `{{points_earned}}`, `{{current_score}}`, `{{global_rank}}`

#### Template — Push

**Title:** `First points on the board 🎯`  
**Body:** `Your {{pick_type}} — {{song_name}} — just scored {{points_earned}} pts. You're at {{current_score}} tonight.`  
**Deep link:** `/dashboard/scores`

#### Template — In-App

**Heading:** `{{song_name}} — {{points_earned}} points`

**Body:** Your {{pick_type}} pick hit, {{handle}}. {{song_name}} is on the setlist and you called it. Running total: {{current_score}} points. Current rank: #{{global_rank}}.

**CTA:** `See live scores →`

---

## 5 — `score_leader`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `event_triggered` |
| **Event** | User moves into first place on the global leaderboard or any pool leaderboard during a show |
| **Channels** | `inApp`, `push` |
| **Audience** | Pick owner |
| **Prefs key** | `results` |
| **Dedup** | `leader:{uid}:{showDate}:{leaderboard}` (re-fires if lead lost and regained) |
| **Implementation** | Live scoring update hook; checks rank after each score update |

#### Variables used

`{{handle}}`, `{{leaderboard_name}}`, `{{current_score}}`, `{{lead_margin}}`

#### Template — Push

**Title:** `{{handle}} is in first 🥇`  
**Body:** `You're leading {{leaderboard_name}} with {{current_score}} points — {{lead_margin}} pts ahead.`  
**Deep link:** `/dashboard/scores`

#### Template — In-App

**Heading:** `You're leading {{leaderboard_name}}`

**Body:** {{current_score}} points puts you in first, {{handle}} — {{lead_margin}} points clear of second. There's still show left. Hold it.

**CTA:** `Watch the leaderboard →`

---

## 6 — `show_recap`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `event_triggered` |
| **Event** | Grading finalized for a show (all picks scored, rollup complete) |
| **Channels** | `inApp`, `push` |
| **Audience** | All users who submitted picks for the show |
| **Prefs key** | `results` |
| **Dedup** | `show_recap:{uid}:{showDate}` in `commsInbox` + `fcm_notification_log` |
| **Implementation** | Batch fan-out triggered after `rollupScoresForShow` completes |
| **Process scope** | `show_recap:{showDate}` |
| **Lookback** | None. Event-scoped to the rollup of that show. |
| **Archive policy** | Skip when the tour `editionStatus` is `archive` or `closed`, when that tour's process is `skipped_archive` or `closed`, or when `show_recap:{showDate}` is already terminal. A `sent` `tour_recap` does not block a live night. Re-rollup of an archive show does not send (#1035). |
| **Note** | Email folded into `tour_rankings_daily`'s next-morning send (#451) — the two triggers fired for the same `(uid, showDate)` on every single-tour-night, the dominant same-day email fatigue collision. inApp/push keep the immediate night-of tease + inbox card unchanged. Narrative vars from `comms_show_context` (#572). `narrative_line` composer (#985) weaves arc + card + relative rank; push stays a short tease. |

#### Variables used

`{{handle}}`, `{{show_date}}`, `{{venue_name}}`, `{{venue_city}}`, `{{show_score}}`, `{{global_rank}}`, `{{global_total_pickers}}`, `{{pool_name}}`, `{{pool_rank}}`, `{{pool_total_pickers}}`, `{{correct_picks_count}}`, `{{total_picks_count}}`, `{{opener_result}}`, `{{closer_result}}`, `{{encore_result}}`, `{{wildcard_result}}`, `{{bustout_bonus}}`, `{{setlist_highlight}}`, `{{set_flow_summary}}`, `{{bustout_titles}}`, `{{tour_debut_titles}}`, `{{opener_title}}`, `{{encore_title}}`, `{{show_moment_tags}}`, `{{user_hit_bustout}}`, `{{narrative_branch}}`, `{{narrative_line}}`, `{{top_scorer_handle}}`, `{{top_score}}`

#### Template — Push

**Title:** `{{venue_city}} recap — {{show_score}} pts, #{{global_rank}}`  
**Body:** `{{correct_picks_count}} of {{total_picks_count}} correct. {{handle}}, your full recap is ready.`  
**Deep link:** `/dashboard/profile/notifications`

#### Template — In-App

**Heading:** `{{venue_name}} — {{show_date}}`

**Your score:** {{show_score}} points

**Your rank:** #{{global_rank}} of {{global_total_pickers}} globally{{#if pool_name}} · #{{pool_rank}} of {{pool_total_pickers}} in {{pool_name}}{{/if}}

**Your picks:**
- Opener: {{opener_result}}
- Closer: {{closer_result}}
- Encore: {{encore_result}}
- Wildcard: {{wildcard_result}}{{#if bustout_bonus}} (+{{bustout_bonus}} Bustout Boost){{/if}}

**Tonight:** {{narrative_line}} *(composer: arc + your card + relative rank — #985; soft-fails to `{{setlist_highlight}}`)*

Tonight's top score was {{top_score}} points — {{top_scorer_handle}} led the room.

**CTA:** `See standings →` → `/dashboard/standings#self-recap`

*(No email template — the "your night" content below now ships inside `tour_rankings_daily`'s email, see #451.)*

---

## 7 — `tour_rankings_daily`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `automated` |
| **Schedule** | Morning after each show night, 8:00 AM `America/Los_Angeles` (`onSchedule "0 8 * * *"`); only fires on days following a show; **skipped** the morning after a tour finale (`tour_recap` day) |
| **Channels** | `inApp`, `push`, `email` |
| **Audience** | Users who have picks in at least one show this tour |
| **Prefs key** | `results` |
| **Dedup** | `tour_rank:{uid}:{showDate}` |
| **Implementation** | `onSchedule` daily; checks if yesterday was a show night; fans out standings update |
| **Note** | Email absorbs `show_recap`'s "your night" section (#451) — one email per `(uid, showDate)` instead of two. inApp/push are unaffected; those still fire immediately, night-of, from `show_recap`. Tour rank is the **overall tour leaderboard** (not last-night-only). `rank_change` is display-rank delta vs the prior show (`up N` / `down N` / `held`); night-one uses debut copy; mid-tour first appearance uses late-joiner catch-up (#544). The morning after a tour finale this trigger is suppressed so `tour_recap` is the only wrap that day. |

#### Variables used

`{{handle}}`, `{{show_date}}`, `{{venue_name}}`, `{{venue_city}}`, `{{show_score}}`, `{{global_rank}}`, `{{global_total_pickers}}`, `{{pool_name}}`, `{{pool_rank}}`, `{{pool_total_pickers}}`, `{{correct_picks_count}}`, `{{total_picks_count}}`, `{{opener_result}}`, `{{closer_result}}`, `{{encore_result}}`, `{{wildcard_result}}`, `{{bustout_bonus}}`, `{{setlist_highlight}}`, `{{top_scorer_handle}}`, `{{top_score}}`, `{{tour_rank}}`, `{{total_tour_pickers}}`, `{{tour_points}}`, `{{rank_change}}`, `{{is_debut}}`, `{{is_late_joiner}}`, `{{tour_rank_tied}}`, `{{tour_tied_count}}`, `{{tour_tied_handles}}`, `{{tour_tier}}`, `{{shows_played}}`, `{{pool_tour_rank}}`, `{{next_show_date}}`, `{{next_show_venue}}`

#### Template — Push

**Title:** `Tour standings after {{venue_city}}`  
**Body:** `{{handle}}, you're #{{tour_rank}} overall ({{rank_change}}). {{tour_points}} pts across {{shows_played}} shows.`  
**Deep link:** `/dashboard/standings`

#### Template — In-App

**Heading:** `Tour standings — after {{venue_city}}`

**Your standing:** #{{tour_rank}} of {{total_tour_pickers}} ({{rank_change}})  
**Tour points:** {{tour_points}} across {{shows_played}} shows{{#if pool_name}} · #{{pool_tour_rank}} in {{pool_name}}{{/if}}

Up next: {{next_show_venue}} on {{next_show_date}}. Picks open now.

**CTA:** `See standings →` → `/dashboard/standings#self-recap`

#### Template — Email

**Subject:** `Your {{venue_city}} recap + tour update — #{{tour_rank}} on tour`  
**Preview:** `{{correct_picks_count}} of {{total_picks_count}} correct last night. Now #{{tour_rank}} on tour ({{rank_change}}).`

**Body sections:**
1. **Your night** *(absorbed from `show_recap`, #451 / #985)* — `{{narrative_line}}` weaves set-flow arc, which of *their* slots hit (bustout caught or missed), and night rank (global + pool when present). Tour `rank_change` stays in the tour paragraph below.
2. **Pick-by-pick** — opener, closer, encore, wildcard results with song names. Bustout Boost called out if earned.
3. **Setlist context** — `{{setlist_highlight}}` (e.g., `Bustout: Melt the Guns - a 2051 show gap.` or `Bustouts: Song A - an 87 show gap; Song B - a 40 show gap.`). Folded into `{{narrative_line}}` when the composer has facts.
4. **Your tour position** — rank, points, shows played, rank change vs yesterday.
5. **Pool standing** — `{{pool_tour_rank}}` in `{{pool_name}}` (if applicable).
6. **Next show** — {{next_show_venue}}, {{next_show_date}}. Picks are open.
7. **Invite friends** — personalized invite headline + link (`{{invite_headline}}`, `{{invite_url}}`; pool variant when user has a pool).
8. **CTA:** `Make picks for next show`

---

## 8 — `picks_lock_reminder`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `automated` |
| **Schedule** | Every 15 min on show days, venue-local **T-3h through lock** (window tracks per-show lock) |
| **Channels** | `inApp`, `push`, `email` |
| **Audience** | Users with a handle and **no picks** for tonight's show |
| **Prefs key** | `reminders` (push + in-app only) |
| **Email class** | `transactional` — email bypasses `reminders` pref; still respects `email_suppression` |
| **Dedup** | `reminder_{showYmd}_{uid}` in `fcm_notification_log` |
| **Implementation** | `scheduledPicksLockReminder` → `runPicksLockReminderFanout` → `deliverCommsTrigger` (`functions/picksLockReminder.js`) |

#### Variables used

`{{handle}}`, `{{show_date}}`, `{{venue_name}}`, `{{venue_city}}`, `{{time_to_lock}}`, `{{lock_time_local}}`, `{{picks_secured}}` (preview/edge; production fanout already skips users with picks)

#### Product choice (#509)

Production `picks_lock_reminder` **skips** users with non-empty picks for tonight (`users_no_picks_tonight`). In-app registry still branches CTA/body on `picks_secured` for `/comms-preview` and any edge payload.

#### Template — Push

**Title:** `Picks lock in {{time_to_lock}} — {{venue_city}} tonight`  
**Body:** `{{handle}}, you haven't made your picks for {{venue_name}} yet.`  
**Deep link:** `/dashboard/picks`

#### Template — In-App

**Heading:** `{{time_to_lock}} until picks lock`

**Body:** {{handle}}, lock in your picks for {{venue_name}}. You're not on the board yet for {{show_date}}.

**CTA:** `Make your picks` (or `View / Edit picks` when `picks_secured`)

#### Template — Email

**Subject:** `Picks close in {{time_to_lock}} — {{venue_city}} tonight`  
**Preview:** `{{venue_name}} · {{time_to_lock}} until picks lock`

**Body sections:**
1. Tonight's show — venue, date.
2. You haven't picked yet — {{time_to_lock}} until picks lock.
3. CTA button: `Lock in your picks`

---

## 9 — `tour_engagement_reminder`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `event_triggered` |
| **Event** | User's first show in the current tour is graded (fires once per tour, after show 1) |
| **Channels** | `inApp`, `push`, `email` |
| **Audience** | Users who completed their first show in a tour |
| **Prefs key** | `lifecycle` |
| **Dedup** | `tour_engage:{uid}:{tourId}` |
| **Implementation** | Fires after `show_recap` delivery confirms first show graded for user |

#### Variables used

`{{handle}}`, `{{show_score}}`, `{{global_rank}}`, `{{global_total_pickers}}`, `{{tour_name}}`, `{{shows_remaining}}`, `{{next_show_date}}`, `{{next_show_venue}}`, `{{picks_secured}}` (next show)

#### In-app CTA by picks state (#509)

| State | CTA |
|-------|-----|
| No picks for next show | `Make picks for next show` |
| `picks_secured === true` | `View / Edit picks` |

#### Template — Push

**Title:** `Show 1 done — {{shows_remaining}} more to go`  
**Body:** `{{handle}}, you scored {{show_score}} pts and ranked #{{global_rank}}. {{tour_name}} continues — keep going.`  
**Deep link:** `/dashboard/standings`

#### Template — In-App

**Heading:** `You're on the board, {{handle}}`

**Body:** {{show_score}} points and rank #{{global_rank}} out of {{global_total_pickers}} in your first show. {{tour_name}} has {{shows_remaining}} shows left — every night you play moves your standing.

The more shows you pick, the better your tour rank. Don't let the tour slip by.

**CTA:** `Make picks for next show` / `View / Edit picks` → `/dashboard/picks`

#### Template — Email

**Subject:** `{{handle}}, show 1 is in the books — {{shows_remaining}} shows left`  
**Preview:** `{{show_score}} pts · #{{global_rank}} global · {{tour_name}} continues`

**Body sections:**
1. Your show 1 result — score, rank, context ("You outscored X% of the field").
2. The tour keeps going — `{{shows_remaining}}` shows remaining, next one is at `{{next_show_venue}}` on `{{next_show_date}}`.
3. Tour standings work differently from single shows — cumulative points determine the tour winner.
4. CTA button: `Pick the next show`

---

## 10 — `marketing_summer_tour_2026_launch`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `batch` (admin callable / CLI — **not** event-driven) |
| **Event** | Manual execute via `deliverMarketingSummerTour2026Launch` or CLI script |
| **Channels** | `email` only (`emailFull` / React Email) |
| **Audience** | Sphere Run seed players (graded picks on any Sphere date) ∪ users who signed up on/after Sphere go-live |
| **Prefs key** | `lifecycle` |
| **Dedup** | `marketing:{campaignId}:{uid}` (`campaignId` = `summer_tour_2026`) |
| **Implementation** | `functions/marketingBatchDelivery.js` · GitHub #468 |
| **Editorial** | `content/comms/lifecycle/summer-tour-2026-launch.md` |

#### Variables used

`{{greeting_name}}`, `{{audience_segment}}`, `{{opener_label}}`, `{{share_url}}`, `{{invite_code}}`

#### Template — Email (full)

**Subject:** `Summer Tour's almost here — bring your crew →`  
**Preview:** `Bring your crew → Summer Tour starts Tuesday, July 7.`

Founder letter (Pat) with feature blocks + primary CTA (share with friends via `/join/:code` invite OG link). Rendered via React Email; see `emails/src/templates/SummerTour2026Launch.jsx`.

---

## 11 — `marketing_summer_2026_almost_end`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `batch` — one-shot `scheduledMarketingSummer2026AlmostEnd` (2026-08-03 08:00 America/Denver) + admin callable / CLI |
| **Event** | Manual / scheduled execute via `deliverMarketingSummer2026AlmostEnd` |
| **Channels** | `email` + `inApp` |
| **Audience** | **Email:** Summer Tour players (`seasonStats["2026 Summer Tour"].shows ≥ 1`). **In-app:** all users. Both exclude QA handles (`QATester`, `MrPickPhive`). |
| **Prefs** | Email honors `lifecycle`. **In-app ignores prefs** (Sphere-style forced fanout; fixed inbox doc id `marketing_summer_2026_almost_end`). |
| **Dedup** | Email: `marketing:{campaignId}:{uid}` (`campaignId` = `summer_2026_almost_end`). Inbox: fixed doc id. |
| **Implementation** | `functions/marketingBatchDelivery.js` · React Email `Summer2026AlmostEnd.jsx` |
| **Editorial** | `content/comms/tours/summer-2026-almost-end.md` |

#### Variables used

`{{greeting_name}}`, `{{branch}}`, `{{rank}}`, `{{points}}`, `{{wins}}`, `{{showsPlayed}}`, `{{avg_points}}`, `{{batting_avg}}`, `{{participantCount}}`, Top 5 snapshot, invite fields

#### Template — Email (full)

**Subject:** `Between the Past and Future, Where We Drift in Time: An almost Tour End Recap`  
**Preview:** `18 shows in the books · Fenway wrapped · Dick's still ahead · your (almost) tour-end tape inside`

Mid-tour recap (Pat) with tour tape, Top 5 table, personalized rank branch, invite ask (players), feature callouts. Non-players get the `noPlay` branch (inbox-only for non-players).

#### Template — In-app

Abbreviated recap + Standings / invite CTA. Forced to every inbox (no play filter, no prefs).

---

## 12 — `tour_recap`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | `automated` — 8am PT `scheduledTourRankingsDailyComms` → `deliverPendingTourRecaps` after the tour's **final show date** is in the past **and within a 14-day lookback**, unless `editionStatus` is `archive` or `closed`. **Not** same-tick as night `show_recap`. **Not** War Room on the production happy path. |
| **Process scope** | `tour_recap:{tourId}` |
| **Lookback** | 14 days after the finale. |
| **Archive policy** | `editionStatus` `archive` / `closed` skips every channel and writes `skipped_archive` or `closed`, including outside the lookback. A tour name is not a gate. Terminal `comms_process_state` (and the `comms_tour_recap_state` mirror) hard-skips. `campaignId` is the edition slug; `triggerId` stays `tour_recap` (#1035). |
| **Event** | Last date in `show_calendar.showDatesByTour` for that tour is already yesterday-or-earlier (PT) and ≤14 days old **and** the process doc is not terminal **and** `editionStatus` is not `archive` or `closed`. First successful fan-out writes `status: sent` and hard-skips forever (once-ever). Older / never-sent finales outside lookback: admin `runCommsTrigger` only. |
| **Channels** | `inApp`, `push`, `email` (abbreviated teaser; optional `emailFull` / in-app long form) |
| **Audience** | Users with ≥1 graded pick on any show in that tour |
| **Prefs key** | `results` |
| **Dedup** | `tour_recap:{tourId}:{uid}` in `fcm_notification_log` + inbox message id |
| **Priority** | P1 (`results_recap`, W3) |
| **Implementation** | Thin adapter in `functions/commsEventAdapters.js` → `deliverCommsTrigger`. Edition flavor from `content/comms/tours/<edition>.md` + send-time payload — do not hardcode Sphere as the live catalog trigger. |
| **Note** | Night `show_recap` ≠ this end-of-tour recap. Last night of tour is still `show_recap` only; this trigger waits until the next morning and that morning skips `tour_rankings_daily`. Do not replace `show_recap` or `tour_rankings_daily` on mid-tour nights. Sphere ’26 stays the archive template `sphere-2026-inaugural` (`deliverSphere2026TourRecapInbox` replay only). The cron skip is `editionStatus: archive` plus the process ledger, not a name regex and not a per-tour trigger id (#1033 / #1035). `campaignId` distinguishes the edition (`2026-summer`, `2026-sphere`). Per-uid dedup remains channel idempotency. GitHub #510 / #1033 / #1035. |

#### Variables used

`{{handle}}`, `{{rank}}`, `{{tiedCount}}`, `{{tiedHandles}}`, `{{points}}`, `{{wins}}`, `{{showsPlayed}}`, `{{participantCount}}`, `{{tour_id}}`, `{{tour_name}}`, `{{show_count}}`, `{{headline}}`, `{{podium}}`

`rank` is competition rank on tour points (#1135). `tiedCount` is how many players share it. `tiedHandles` is the other handles at that rank, in list order (nightly wins, then handle). The personal sentence and the in-app podium still speak list order until #1136. These fields are what that copy should read.

#### Rank branches (personalized)

champion · top 5 · top 10 · full-run outside top 10 · partial attendance · fallback

#### Template — Push

**Title:** `Tour recap is in`  
**Body:** champion: `You took #1 with {{points}} pts and {{wins}} nightly wins. Open the app for the full wrap-up.` otherwise `You finished #{{rank}} ({{points}} pts, {{wins}} wins). Open the app for your personalized recap.`  
**Deep link:** inbox / `/dashboard/standings`

#### Template — In-App

**Heading:** `{{headline}}` (edition flavor)

Podium + honorable mentions + personalized rank-branch paragraph. CTA: standings (no “Open the app”).

#### Template — Email (abbreviated)

**Subject:** `{{tour_name}} recap is in`  
Teaser + champion one-liner + CTA to log in / standings. Full narrative stays in-app.

---

## System triggers

### `push_canary`

| Field | Value |
|-------|-------|
| **Status** | `shipped` |
| **Automation** | QA / developer only — not a production user trigger |
| **Channels** | `push` |
| **Implementation** | `sendPushCanary` callable (`functions/index.js`) |

---

## Superseded / legacy

These shipped implementations are covered by the v1 trigger set above. Keep the code; retire them as the new triggers ship.

| Old trigger | Superseded by |
|-------------|--------------|
| `post_show_win` | `show_recap` (comprehensive) + `score_first_points` / `score_leader` (live) |
| `post_show_near_miss` | `show_recap` |
| `tour_recap_sphere_2026` | `tour_recap` (durable personalized end-of-tour). Sphere ’26 remains archive + War Room replay only. |
| `profile_incomplete_nudge` | `account_welcome` (catch early); add nudge at D+1 if needed |
| `return_after_14d` | `tour_countdown` + `tour_engagement_reminder` cover re-engagement |

---

## Catalog maintenance

1. Update both this file **and** `catalog.json` in the same PR.
2. Link `templateId` in `src/features/comms/registry.js` when a template ships.
3. Add GA4 events per [MEASUREMENT_PLAN.md](./MEASUREMENT_PLAN.md).
4. File `[SKIP-PRD]` GitHub issue under epic #272 for each new P0/P1 trigger.
5. Invoke comms squad skills for copy changes, implementation, or analysis.
