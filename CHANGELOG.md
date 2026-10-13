# Changelog

All notable changes to Setlist Pick'em are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).  
Public API is declared in [`docs/API.md`](docs/API.md).

---

## [1.81.7] — 2026-10-10

### Fixed
- **Morning comms no longer die on one bad calendar value** — a `/` in a tour name is stored as `-` in the wrap-state doc and the shared already-sent id. The 8:00 AM job skips future and long-finished tours while deciding on a wrap. If that wrap step throws, the daily recap still runs (a real finale morning still skips it). One failed recipient does not stop the rest of a send. A show with an invalid timezone is skipped. The lock reminder, countdown, and 8:00 AM job allow 300 seconds. Email, in-app, and phone rules are unchanged. (#1096)

---

## [1.81.6] — 2026-10-09

### Changed
- **Other comms** — show recap, picks confirmed, and the lock reminder name the venue and city. The short date sits on the eyebrow. Night-of copy does not say "last night". Tour countdown, welcome, and next-show lines use `MM/DD/YY`. Payload `show_date` stays `YYYY-MM-DD`. (#1124)

---

## [1.81.5] — 2026-10-09

### Changed
- **Song date columns** — catalog last-played is zero-padded `MM/DD/YY` (`07/19/24`). Tour stats this-tour dates are `MM/DD` and prior-play dates are `MM/DD/YY`. Year stays off this-tour dates. The column tracks are unchanged because slashes are the same length as the old hyphens. (#1123)

---

## [1.81.4] — 2026-10-09

### Changed
- **Show labels** — the tour date select, standings header, pool hub active show, picks scorecard, share text, and the too-early prior-show label print `MM/DD/YY`. `<option value>` stays `YYYY-MM-DD`. Pool archive spelled dates stay spelled. (#1122)

---

## [1.81.3] — 2026-10-09

### Changed
- **Morning recap** — the last-night sentence names the venue and city. The date moves to the email preheader (`10/07/26 · {venue}, {city}`) and the email and in-app eyebrow (`10/07/26 · Tour standings`). Next up, back at, and last played use `MM/DD/YY`. Debut and late-joiner lines drop the storage date. `show_date` on the payload stays `YYYY-MM-DD`. Subject and push are unchanged. (#1121)

---

## [1.81.2] — 2026-10-09

### Fixed
- **Huntsville Saturday postponed to Monday** — the emergency show-calendar fallback and the picks-lock time seed use October 12 at The Orion Amphitheater (7:00pm, doors 5:30pm) instead of October 10. Sunday, October 11, stays. The daily Phish.net sync already drops October 10 (`exclude_from_stats`) and adds October 12; Phish.com has not published a Monday date page, so the seed keeps the lock at 7:20pm Central until that page exists.

---

## [1.81.1] — 2026-10-08

### Added
- **Fact shelf** — the annual wrap’s shared summary may later tell everyone which songs the room picked most, and which of those landed most often and least often. Those year numbers are not facts a message can say yet. A hit means the song was in the setlist. A small number of picks is not a rate. (#1111)

---

## [1.81.0] — 2026-10-08

### Changed
- **Tour wrap** — the end-of-tour note opens with the rarest song that was actually played, otherwise how often the lead changed hands, otherwise the closing venue. The rank paragraph states finish, field size, points, nightly wins, and shows played. When those facts exist it adds the best night, bustouts they caught, and shows they sat out. One more sentence names a rare song they picked, a night they took or lost the lead, or a points or wins mark already stored on another tour. The email congratulates the tour winner, shows the top 5 as a Rank / Handle / Pts / Wins / Nights / Avg grid, and adds that one sentence. The in-app board marks Tour Winner, Runner-up, and Third Place with trophies, and 4th and 5th with medals. A points tie with 5th is named in that last mention. Push stays the rank tease. A bustout title that was not in that night’s setlist is left out. A missing fact drops its clause. The send still goes. (#1084)

---

## [1.80.1] — 2026-10-08

### Changed
- **Night recap highlight** — a gap of 20–29 is “a relative rarity of late,” and a gap of 11–19 is “the return of” that song. A set whose gaps are all 10 or fewer “featured heavy rotation songs,” and names the song with the most lifetime plays when that count is known. A bustout still uses “highlighted by.” A missing count drops the name. A missing gap does not claim the set was all rotation. (#1105)

---

## [1.80.0] — 2026-10-08

### Changed
- **Morning standings paragraph** — the line after the spot count says whether this player took the lead, stayed in the lead, climbed into the top 5, was already in the top 5, lost the lead but stayed in the top 5, or fell out of the top 5. A move that stays outside the top 5 keeps the rank sentence. A missing yesterday rank does not claim a crossing. (#1102)

---

## [1.79.0] — 2026-10-08

### Changed
- **Night recap paragraph** — the show recap and the morning email’s night paragraph speak one sentence per set (length, then the rarest song in that set and when it was last played, then every encore title) and one player line. Stock “tough board / strong night” wording is used only when no player fact exists. A bustout is spoken only when that exact title is in the official setlist, and only once. A missing fact drops its clause. The send still goes. The tour-standings paragraph is unchanged. (#1083)

---

## [1.78.0] — 2026-10-08

### Added
- **Recap sends record which facts they spoke** — each night recap and each tour wrap stores its branch and the filled fact-slot ids on the inbox message and the delivery log. The morning email’s night paragraph uses the night label. An id that is not on the message map is dropped. A missing fact omits that slot and does not hold the send. The sentences are unchanged. (#1082)
- **Fact shelf and message maps** — `docs/comms-triggers/COMMS_FACT_INVENTORY.md` lists facts the app already knows. The night map and the tour-wrap map say which of those facts each recap may speak, and the slot ids the label stores.

---

## [1.77.2] — 2026-10-08

### Fixed
- **Make Picks and Scorecard odds on the open night** — closing and reopening the app kept the previous show’s `pick-recommendations.json` for up to 6 hours. The song menu and scorecard only draw odds when that file’s date is the night in the picker, so 2026-10-09 showed no percent on any song while the cache still said 2026-10-07. A cached file for another night is refetched.

---

## [1.77.1] — 2026-10-07

### Changed
- **Standings and Picks cards** — the column and the free-standing notices share the sponsor shell. Amber wash is you (your rank, scorecard). Teal wash is the night (tonight's show, winner, setlist, crowd pulse, Picks Lab). Quiet cards stay the plain sponsor fill, including the pre-lock picks reminder. Scores stay teal. The picks form stays the heavier hero. Local spec: `/card-shell-preview`.

---

## [1.77.0] — 2026-10-07

### Added
- **Stats rates tip** — a dismissible “Did you know?” under the Standings self-recap (also Scorecard, and Make Picks on a phone) points at Personal and Global for picking average, points per show, and slugging. One dismissal per player. Expires 2026-12-31.
- **Global Stats slugging percentage** — `/dashboard/stats/global` replaces the Shows tray with **SLG**. Slugging percentage is total points ÷ (shows × 30) (`totalPoints / (showsPlayed × 30)` on the career; `seasonStats.{tour}.totalPoints / (shows × 30)` on a tour). 30 is one show of in-setlist hits, so that night is 1.000. All-time rankings need at least 15 shows. This tour keeps the 3-show gate used by PPS and Picking Avg. The next rollup, nightly refresh, or admin `refreshGlobalStatsLeaderboards` writes `boards.sluggingPercentage` on `global_stats_leaderboards` (`schemaVersion` 2). Until that rebuild, the signed-in you-row still shows the ratio from the user doc.

### Changed
- **Global Stats Shows tray** — no longer rendered. Show count stays on each row, and inside PPS and Picking Avg. `boards.shows` is still written for older clients.

### Fixed
- **Stats trays on a phone** — All-time / This tour and the board tray attach after the mobile chrome mounts, so they stay on screen under Personal / Global / Band.

---

## [1.76.4] — 2026-10-03

### Fixed
- **Live setlist gaps** — the first positive Phish.net row gap is kept again. A live gap of 0 is not stored and does not replace a gap already captured. A stored 0 is dropped so a later positive poll can record the actual. Bustout membership is unchanged.

---

## [1.76.3] — 2026-10-01

### Added
- **Create-account benefits** — `/login?mode=signup` lists what an account keeps: real-time setlist updates, scoring and ranking, picks history, and stats for every show you play. The first-paint login shell matches.

---

## [1.76.2] — 2026-10-01

### Changed
- **Marketing headers** — How it works, Scoring, The game, About, and Tour stats use the same Sign In and Join controls as the home page, including on a phone. The vinyl mark still returns home. Short links and nav destinations are unchanged.

---

## [1.76.1] — 2026-09-30

### Changed
- **Tour countdown** — Push and in-app still fire on T-10, T-5, T-3, and T-1. Email fires on T-5 and T-1 only, and only when the opener card is empty. Fall Tour 2026 skips the Oct 1 T-1 email for everyone (T-10, T-5, and T-3 already mailed). T-5, T-3, and T-1 use a confirmation close when `picks_secured` is true (editable up to showtime on the first show date, no lock clock). T-10 is one shared line: gear up for the tour opener. Contract: `content/comms/lifecycle/tour-countdown.md`.

---

## [1.76.0] — 2026-09-28

### Added
- **Owned-social short links** — `/ig/how`, `/ig/card`, `/ig/score`, `/ig/about`, `/ig/stats` and the `/th/` twins 307 to the existing marketing page with `utm_campaign=seo_geo`. Captions paste the short path. The profile link stays the long bio URL. Exact paths only; existing routes are unchanged.

---

## [1.75.3] — 2026-09-28

### Changed
- **Marketing voice pass (epic #972)** — public page prose rewritten so it reads like fan writing: em dashes out of body copy, no "unlock" / "plays live" / label-dash lists. Surfaces: splash, `/how-it-works`, `/how-scoring-works`, `/about`, `/tour-stats`, `/phish-setlist-prediction-game`, plus matching prerender paragraphs and FAQ/HowTo JSON-LD. SERP titles and meta descriptions are unchanged. Review: `content/marketing/marketing-voice-pass-2026-09.md`.

### Added
- **Voice guide + CI guard** — `content/marketing/voice-guide.md` is the Do / Do-not for marketing, editorial, and comms body copy. `npm run verify:marketing-voice` fails the `verify` job above 6 em dashes in rendered prose, on banned phrases, or on label-dash list items.

---

## [1.75.2] — 2026-09-28

### Fixed
- **Historical song gaps one below Phish.net (#1062)** — a later live poll now stores that poll's gap for songs in the feed, and keeps a stored gap only when the song is absent (partial set 1). The first poll is often one show low, before the night is in the Phish.net show index. `npm run backfill:song-gaps -- --existing` rewrites maps that were frozen one low and does not touch `bustouts`.

---

## [1.75.1] — 2026-09-23

### Fixed
- **Make Picks keyboard crush on iOS Chrome (#1041)** — iOS Chrome frames its web view to the keyboard-free screen, so the layout viewport shrinks and every fixed band stays on screen; Safari keeps the layout viewport tall and pans it. After the keyboard settles, when `documentElement.clientHeight` has dropped (Chrome only), hide the mobile top stack and bottom nav, release the scrollport's reserved padding, and hold the focused field in place. Safari never enters this branch. Nothing runs on the tap; the suggestion list is unchanged.

---

## [1.75.0] — 2026-09-22

### Added
- **Inbound Resend receiving webhook (#1037 / #1039)** — `commsResendInboundWebhook` allowlists `updates@` / `unsubscribe@` / `support@setlistpickem.com`. Other local-parts return HTTP 200 without a forward. Separate Svix secret `RESEND_INBOUND_WEBHOOK_SECRET`. Public contact is `support@setlistpickem.com` (Preferences, Privacy, Terms, marketing legal footer). `help@` is not forwarded. Ops: [`docs/comms-triggers/INBOUND_FORWARDING.md`](docs/comms-triggers/INBOUND_FORWARDING.md).
- **Mailto auto-unsubscribe (#1039)** — empty / one-word mail to `unsubscribe@` writes `email_suppression` (`mailto_unsubscribe`, resubscribable) and opts out lifecycle prefs with no Workspace forward. Prose still opts out and forwards for a human reply.

### Changed
- **`resend` SDK in `functions/`** — `^4.8.0` → `^6.28.1` so `emails.receiving.get` / `forward` exist. Outbound `emails.send` path unchanged.
- **Inbound wrap (#1039)** — production path is `receiving.get` + `emails.send`, not passthrough `forward`. Display From is `{sender} via Setlist Pick'em <mailbox@…>`; Reply-To is the original From; body starts with `---------- Forwarded message ----------`.

---

## [Unreleased]

### Added
- **Mobile Chrome keyboard / Make Picks chrome investigation (#1041)** — `docs/investigations/mobile-chrome-keyboard-picks-chrome.md` diagnoses iOS Chrome letterboxing vs usable Safari (evidence under `docs/investigations/evidence/`), cites Chrome/WebKit/`visualViewport` research, and ranks fix options against dashboard chrome principles. Docs only; no version bump.
- **Owned social loop and Phase 1 calendar (#974 / #1046)** — `content/marketing/974-social-post-loop.md` is the “run the social loop” order (Social → Brand Systems → Demand Gen → EiC). Phase 1 paste dates through 2026-10-14 are in `content/marketing/974-social-phase1-calendar.md`. Fan-facing voice lives in the brand skill. No live post, no declared API change, no version bump.
- **Owned-social Canva masters (#974 / #1046)** — draft `score`, `stat`, and `line` feed frames plus `content/marketing/974-social-template-masters-2026-09-24.md`. Repo vinyl + token colors applied on those three designs; Brand Kit / Brand Template writes are not available via Canva MCP. Docs and PNG exports only; no version bump.
- **SEO query registry (#931 / epic #926)** — `docs/seo/query-registry.json` seeds B1–B3, C1–C7, S1–S7 (including #931 fan strings). Weekly append-only GSC log procedure is in `docs/seo/README.md`; snapshots stay under gitignored `crew/output/seo/`.
- **SEO competitor title/H1 scan (#933 / epic #926)** — PR-gated allowlist adds `phishpicks.net` / `phish.jampicks.com` (homepage GET only). `crew/scripts/seo_title_h1_scan.py` extracts title + H1–H3 and diffs `docs/seo/query-registry.json`. Durable brief: `content/marketing/933-competitor-title-h1-gap-brief.md`. Callingit.live / ihoz / Phantasy Tour omitted (ToS or unverifiable). No `/phish-picks`. No version bump (docs + crew scripts).
- **SEO Optimize autonomy (#934 / epic #926)** — `docs/SEO_OPTIMIZE_AUTONOMY.md` is the draft-only scored tune loop (`stats_impressions` \| `query_coverage` \| `geo_citations` \| `crawl_regressions`). Weekly E1 facts packs stay comment-only; agents may open a **draft** PR to `staging` only when scored `DRAFT_PR`. Docs only after **1.63.0** (#991 / #993); no PATCH bump. Packs ingest the #933 competitor brief when present.

### Changed
- **Owned-social masters glass + mark mix (#974)** — `score` uses venue glass + circular vinyl; `stat` uses indigo glass + horizontal wordmark; `line` uses a deep glass band + horizontal wordmark. Canva cannot apply live blur; grounds are token-composited PNGs. Still draft / unpublished.
- **Pick'em search plan (#970)** — EiC-approved SERP/GEO plan + playbook C6/C7 / SERP snapshot. Docs only; no declared API change and no version bump.

---

## [1.74.2] — 2026-09-09

### Added
- **Tour recap once-ever state (#1033)** — `comms_tour_recap_state/{tourId}` (`sent` / `skipped_archive` / `closed`) hard-skips each tour after the single end-of-tour fan-out (or archive close). Seed script: `functions/scripts/seedTourRecapState.js`. Server-only Firestore rules.

### Changed
- **`deliverPendingTourRecaps`** — checks tour state before lookback/Sphere filters; writes `sent` after a successful fan-out and `skipped_archive` for Sphere calendar labels.

### Removed
- **War Room tour recap panel (#1035)** — `/dashboard/admin` no longer previews or executes recap delivery. Live wraps stay on `scheduledTourRankingsDailyComms`. Canary/replay is `runCommsTrigger` or CLI only; the Sphere-only callable is not exposed in the UI.

---

## [1.74.1] — 2026-09-09

### Fixed
- **`tour_recap` pending cron (#1033)** — `deliverPendingTourRecaps` no longer fans out for every historical calendar tour. Finales must be within a **14-day** lookback (late grades), and Sphere archive labels (`/\bsphere\b/i`, e.g. `2026 Sphere`) are hard-skipped so they stay on War Room / `deliverSphere2026TourRecapInbox`. Incident note: `docs/comms-triggers/INCIDENT_2026-09-09_SPHERE_TOUR_RECAP.md`.

---

## [1.74.0] — 2026-09-08

Leftover comms train after **v1.72.2**. Reconciled file delta only (no raw `staging` history merge). Includes staging **1.73.0** (#1008 show_recap composer) and **1.74.0** (#1009 Resend open/click). Does **not** include Dependabot.

### Added
- **Resend open/click plane (#512 Slice A / #1009)** — `commsResendWebhook` persists `email.opened` / `email.clicked` on `comms_email_engagement/{resendEmailId}` (`uid`, `triggerId`, `campaignId`, `openedAt`, `clickedAt`). Duplicate deliveries are no-ops. `resend.emails.send` stamps matching tags; the delivery log may carry `resendEmailId` + `campaignId`. Ops checklist: `docs/comms-triggers/RESEND_WEBHOOK.md`. No reminder trigger or second-wave send (Slice B remains on #512). Reminted after `v1.72.2` (does not reuse shipped 1.72.0).

---

## [1.73.0] — 2026-09-08

### Changed
- **show_recap composer (#985 / #1008)** — `narrative_line` (inbox Tonight + morning night-para) weaves set-flow arc, which of the player’s slots hit (bustout caught or missed), and night rank when those facts exist. Push stays a short tease. Soft-fails to the #572 highlight + scorecard when context is missing. Existing vars only — no new catalog field. Reminted after `v1.72.2` (does not reuse shipped 1.71.0).

---

## [1.72.2] — 2026-09-08

### Fixed
- **Show-recap tour debuts (#1025)** — `writeCommsShowContext` loads the full prior tour itinerary for `tour_debut_titles` (no 12-show trailing slice). `comms_show_context.schemaVersion` → **2**; `ensureCommsShowContext` rebuilds older docs on the next delivery path.

### Added
- **`canary:tour-recap`** — Cloud Functions dry-run / admin canary for `tour_recap` (does not auto-send). Summer execute / live-send notes landed as docs.

---

## [1.72.1] — 2026-09-08

### Changed
- **`tour_recap` timing (#510)** — last night of a tour still sends night `show_recap` only. End-of-tour fan-out waits for the next 8am PT `scheduledTourRankingsDailyComms` tick (`deliverPendingTourRecaps`). That same morning skips `tour_rankings_daily` (email + in-app + push) so the wrap is one message. Dedup unchanged (`tour_recap:{tourId}:{uid}`). Manual `runCommsTrigger` / canary still work.

---

## [1.72.0] — 2026-09-08

Production ship of the leftover Sprint 14 IA polish that stayed on `staging` after the surgical 1.70.x / 1.71.x promotes. Collapses staging 1.70.2 (Lab Use), 1.71.0 (#1013 Scorecard / Make Picks odds), and 1.72.4 (desktop trays + sticky Stats filters) into one MINOR. Does **not** re-ship `tour_recap` or the next-show date default (already live as 1.71.0–1.71.2).

### Added
- **Scorecard graded hit chrome (#1013)** — on graded nights, each slot uses `getSlotScoreBreakdown`. Hits (`points > 0`) show an A5 check + soft inset ring: brand-primary for `exact_slot` / `encore_exact` / `wildcard_hit`, accent-blue for `in_setlist`, amber overlay when `bustoutBoost`. Misses are slightly muted. Pre-grade cards are unchanged.
- **Make Picks dropdown model odds (#1013)** — song autocomplete shows a trailing compact `N%` (or `<1%` / mobile `<1` for `playProbBySong` map misses) from the same Storage artifact as Scorecard, only when `targetShow.date` matches the selected night. Total / Gap / Last stay visible. Not live crowd %.

### Changed
- **Scorecard helper copy (#1013)** — the pre-lock “Overlap unlocks…” footer is now a top-right `InfoTooltip`. Hint copy covers model odds, showtime comparison, and Standings (leaderboard / live setlist / crowd pulse).
- **Picks odds chrome (#1013)** — when `%` would wrap under the song title, Scorecard and Make Picks show an **Odds** label instead. Card top-right tooltip explains odds in plain language (best guess from recent shows). Dropdown stats use `Odds: N%` beside Total / Gap / Last.
- **Desktop Scoring rules affordance** — Picks and Standings use the same Scale `ChromeIconButton` on the title row (mobile pattern); removed the Picks in-flow “Scoring rules” GhostPill.
- **Pools how-it-works icon** — `CircleHelp` → `BookOpen` (desktop title row + mobile context trailing) so the guide control matches Scale-style line icons.

### Fixed
- **Picks Lab add confirmation** — Lab **Use** still writes the shared draft only (does not persist). The Lab destination now shows a live **Your card**, marks the filled slot, toasts the add, and surfaces Lock In Picks / Update Picks when the card is unsaved. Persist remains the explicit lock/update action.
- **Scorecard odds on the live night (#1013)** — Picks cluster fetches `pick-recommendations.json` once and shares it with Scorecard and Make Picks. Hits show a trailing `N%` on the song title (plus a “model odds” hint). Storage `getDownloadURL` failures (App Check on preview hosts) retry the public `alt=media` URL so odds load instead of staying blank.
- **Make Picks Last dates (#1013)** — dropdown Last was falling back to the bundled 2025 catalog (`PHISH_SONGS`) when Storage `getDownloadURL` failed or the tokenized download returned 402. Catalog fetch now retries `alt=media` and normalizes `last` / `last_played` to `YYYY-MM-DD` so Last stays on the live last-played date. Odds `%` no longer clips the Last column.
- **Desktop tertiary tray width** — Scoring rules / How pools work utilities sit on the cluster title row instead of beside the tray, so Standings and Pools tertiary menus match full-width trays on Picks / Stats / Account.
- **Stats quaternary tray width** — `StatsScopeToggle` reserves a fixed trailing column for scope/board `InfoTooltip`s (empty when absent) so All-time / This tour and board switches stay aligned across stacked trays.
- **Stats quaternary sticky chrome** — Personal / Global port All-time / This tour (+ board or Your stats / Top picks) into the desktop sticky stack and mobile fixed chrome below tertiary so both filter rows stay visible while boards scroll.

---

## [1.71.2] — 2026-09-08

### Fixed
- **Dashboard default show date** — after the Summer Tour finale, the date picker could stick on `2026-09-06` instead of the next available show. Selection now seeds from the same `useShowCalendar().showDates` as the picker (live snapshot; emergency FALLBACK only when snapshot missing), advances past stale past dates when cron ingests newer nights, and re-resolves when the schedule day rolls. Emergency `FALLBACK_SHOW_DATES` includes Fall Tour ’26 (Oct 2–11).

### Changed
- Seed `show_calendar/tour_overrides` checklist includes Fall Tour dates for Console paste.

---

## [1.71.1] — 2026-09-07

### Changed
- **`tour_recap` CTA loop** — email (and push copy) **View Recap** → Messages (`/dashboard/profile/notifications`); in-app `TourRecapInApp` CTA **View tour standings** → `/dashboard/standings?view=tour` so the full recap is read before standings.

---

## [1.71.0] — 2026-09-07

### Added
- **`tour_recap` trigger (#510)** — durable personalized end-of-tour recap (`results_recap`, P1). Audience: users with ≥1 graded pick on any show in that tour. Channels: in-app, push, abbreviated email. Prefs: `notificationPrefs.results`. Dedup: `tour_recap:{tourId}:{uid}`. Automated batch fan-out after the tour’s final show is graded (`deliverTourRecapIfFinalShow` → `deliverCommsTrigger`). Rank branches: champion / top 5 / top 10 / full-run outside top 10 / partial attendance / fallback. Edition flavor from `content/comms/tours/<edition>.md` + send-time payload.

### Changed
- **Sphere ’26 recap** — `sphere-2026-inaugural` / `tour_recap_sphere_2026` is archive + War Room replay (`deliverSphere2026TourRecapInbox`) only. Live catalog template is `tour-recap`. `/comms-preview` samples use a generic Sample Tour fixture (no Sphere live IDs).

---

## [1.70.2] — 2026-09-07

### Fixed
- **Inbox Unopened stay-open on first click (#1015)** — opening a message no longer sets `readAt` immediately (which moved the row into the collapsed Read section and made the body feel like it disappeared). The body stays in Unopened while expanded; `readAt` is written on first close (Collapse, leave for another row, or collapse Inbox).

### Changed
- **`commsInbox.readAt` timing** — client sets `readAt` when the user finishes the first open (close / switch-away), not on the open click. Field shape unchanged.

---

## [1.70.1] — 2026-09-04

### Changed
- **Personal / Global Stats display (#1004)** — All-time | This tour trays replace stacked expandables (All-time default). Personal All-time switches Your stats | Top picks; Global switches PPS | Picking Avg | Shows. Global boards page the top 50 at 10 rows and pin the you-row when it is off-page. In-page trays use `ChromeSegmentedControl` `tone="inset"` so they do not clone tertiary chrome.

---

## [1.70.0] — 2026-09-04

### Added
- **Global Stats leaderboards (#1004 Phase 2)** — `/dashboard/stats/global` replaces the rankings-coming shell with expandable **All-time** and **This tour** boards (same IA as Personal): Points per show, Picking average, Shows. Top 50 per board plus a highlighted you-row from the signed-in `users/{uid}` doc. Ratio boards require `showsPlayed >= 3` (documented; Shows has no gate). Functions-owned `global_stats_leaderboards/{allTime|tour:{tourKey}}` rebuild after rollup/revert, nightly at 08:00 ET, and via admin `refreshGlobalStatsLeaderboards`. Client reads those docs + own user doc only.

### Changed
- **Firestore rules** — authenticated read of `global_stats_leaderboards`; Admin SDK / Functions write only.

---

## [1.69.0] — 2026-09-03

### Added
- **Stats content remap (#1004)** — Personal owns every *your* stat (expandable all-time above expandable “Your picks this tour”). Band mounts the #555 song explorer. Global is an honest rankings-coming shell until Phase 2 leaderboards.

### Changed
- **`/dashboard/tour-stats`** — redirects to `/dashboard/stats/band` (preserve `?tour=`). Feature-discovery marker `tour-stats` moves to the Band segment.
- **Tour picker** — `showTourScopePicker` is a real meta flag. Personal gains the same chrome picker as Standings Tour / Band; all-time stats stay tour-agnostic.

---

## [1.68.1] — 2026-09-03

### Changed
- **Desktop sticky chrome** — Picks, Pools, Standings, Stats, and Account share one scrollport sticky stack (date/tour scope + cluster title + tertiary tray). Lock and install banners sit in the scrolling body below that stack. Mobile chrome is unchanged. #704 landscape/`desk` screens stay follow-on.
- **Helper copy** — Account Profile (and Messages) descriptions are `InfoTooltip`s via `DashboardActionRow` `hint`. Visible description paragraphs are owner-opt-in only (`summary`).

---

## [1.68.0] — 2026-09-03

### Added
- **Scorecard full-song model odds (#767)** — `pick-recommendations.json` now includes `playProbBySong` (normalized title → show-wide `playProb`) for every song in the history window. Scorecard looks up each pick; titles missing from the map show `<1% model odds`. Older artifacts without the map still use per-slot top-K rows. Odds stay omitted when the artifact is missing or for another night.

---

## [1.67.0] — 2026-09-03

### Added
- **Account Preferences hub (#770 / #513)** — tertiary **Preferences** at `/dashboard/profile/account` composes sign-in, logout, legal, install/PWA status, and notification prefs (same `notificationPrefs` keys). Cosmetic Push / Email grouping only.
- **Inbox archive + delete (#513 Phase 2)** — Messages sections **Unopened / Read / Archived**. Owners may set `commsInbox.archivedAt` and hard-delete their own inbox docs. Unread bell count excludes archived.

### Changed
- **Primary nav (#770)** — last player tab label is **Account** (path prefix stays `/dashboard/profile/*`). Tertiary is **Profile / Messages / Preferences**. Context titles: Account primary, Preferences tertiary.
- **Messages** — inbox only. Preferences accordion removed. Inbox card keeps the existing expand/collapse header. **Read** and **Archived** start collapsed (count on the row); empty Archived/Read are hidden; history previews 8 newest with Show older. `?openPush=1` and `DashboardInstallEngageBanner` land on Preferences. Legacy `/dashboard/notifications` and `/dashboard/account-security` still preserve query.
- **Profile identity** — callout + prominent **View public profile** CTA. Quiet **View personal stats** link kept. Install card moves to Preferences.
- **Delete account** — demoted to a text-link disclosure (existing #388 confirm flow). Contact us stays hidden.

### Removed / Deprecated
- Preferences accordion on Messages (`NotificationsPrototypeScreen`).

---

## [1.66.1] — 2026-09-03

### Changed
- **Stats tertiary chips** — tray labels are **Personal / Global / Band** (drop the redundant “Stats” suffix) so three uppercase equal-width segments fit on mobile. Destination names and page copy stay Personal / Global / Band Stats.

---

## [1.66.0] — 2026-09-03

### Added
- **Stats primary (#769)** — fifth player tab (`BarChart3`) with nested **Personal Stats** (`/dashboard/stats` and `/dashboard/stats/personal`), **Global Stats** (`/dashboard/stats/global`), and **Band Stats** (`/dashboard/stats/band`). `ChromeSegmentedControl` tray at the cluster call site. Bottom nav is 5 columns for players, 6 when Admin is present.

### Changed
- **Standings tertiary (#769)** — chrome is exactly **Show / Tour / Pools**. Feature-discovery marker `tour-stats` moves to the Stats **Global** segment. Personal stats (season averages + heatmap) move off Profile onto Personal Stats; Profile keeps a quiet **View personal stats** link.
- **`/dashboard/tour-stats` (#769)** — redirects to `/dashboard/stats/global` and preserves `?tour=`. Stats primary stays active on the hop. Public marketing `/tour-stats` is unchanged.

### Removed
- Standings **Stats** segment from `StandingsViewToggle` / `useStandingsView` / mobile Standings chrome (legacy path kept as a redirect).

---

## [1.65.2] — 2026-09-03

### Changed
- **Pools how-it-works chrome** — “How pools work” is a context-bar / tray-adjacent CircleHelp icon (Standings Scale pattern) that opens a modal. Removes the in-flow disclosure under the Pools tertiary tray.

---

## [1.65.1] — 2026-09-03

### Added
- **Picks Scorecard (#767)** — `/dashboard/picks/scorecard` replaces the coming-soon shell with a global, show-scoped self card. Post-lock overlap (“N players also picked this”), optional model odds from Storage `pick-recommendations.json`, and rank/score from the existing show-scoped standings query. Pre-lock shows the player’s own card only. **GA4:** `scorecard_open` `{ show_date, lock_state }`, `scorecard_metric_impression` `{ show_date, metric }` (`overlap` \| `odds` \| `rank`).

---

## [1.65.0] — 2026-09-03

### Added
- **Pools tertiary (#768)** — nested destinations **My Pools** (`/dashboard/pools`), **Create Pool** (`/dashboard/pools/create`), and **Join Pool** (`/dashboard/pools/join`) with the standard `ChromeSegmentedControl` tray. How-it-works stays a disclosure. `/dashboard/pool/:id` is unchanged (Pools primary stays active). Post-auth `/join/:code` with a pending invite lands on Join Pool.

---

## [1.64.0] — 2026-09-03

### Added
- **Picks tertiary cluster (#766)** — Make Picks / Picks Lab / Scorecard nested under the primary Picks tab: `/dashboard` and `/dashboard/picks` (form), `/dashboard/picks/lab`, `/dashboard/picks/scorecard`. Mobile portal + desktop in-page tray use `ChromeSegmentedControl`. Lab tab stays visible when `VITE_ENABLE_PREDICTION_LAB` is off (coming-soon shell). Scorecard is an empty shell. Date picker stays on all three destinations.

### Changed
- **Prediction Lab destination (#766)** — `PickPredictionPanel` moves off the Make Picks scroll to `/dashboard/picks/lab`. Make Picks keeps lock/edit, scoring/lock-status tools, and `utm_campaign` landed logging.

---

## [1.63.1] — 2026-09-03

### Added
- **Tertiary chrome contract (#765)** — `docs/DASHBOARD_IA.md` documents the rectangular equal-width tray (`ChromeSegmentedControl`), mobile portal vs desktop in-page placement, snap-to-top, primary-tab `isActive`, and the cluster checklist (`dashboardPageMeta` / `verify-dashboard-meta` / vocabulary). `NAV_LABEL_STATS` stub only; Profile primary label unchanged.

### Changed
- **Profile desktop cluster nav + Standings desktop toggle (#765)** — both use `ChromeSegmentedControl` (no duplicated tray classes; desktop Standings drops auto-width pills). Standings still has Show / Tour / Stats / Pools.

---

## [1.63.0] — 2026-09-03

### Added
- **Tour-stats SEO auto-expand (#959 / epic #926)** — when `public_tour_stats` meets the thin-page gate (`showsWithSetlist ≥ 4`, `uniqueSongs ≥ 20`, `lastShowDate` in the current year), the next production build prerenders `/tour-stats/{slug}` (facts HTML + FAQ/ItemList), and appends sitemap + `llms.txt` from the same registry — no hand edit of `seoRoutes.js`. Kill-switch: `TOUR_STATS_SEO_AUTO_EXPAND=0`. Optional `TOUR_STATS_SEO_ALLOWLIST` / `TOUR_STATS_SEO_DENYLIST`. Aggregates only; GSC Request indexing stays human.

---

## [1.62.4] — 2026-09-03

### Added
- **SEO GSC + GA4 weekly packs (#932 / epic #926)** — `npm run seo:gsc-weekly-snapshot` reads the #931 query registry, builds a last-7d Search Console + GA4 organic facts pack (fixture mode for CI), and the Monday Action posts `[SKIP-PRD]` on #926 when `GSC_SERVICE_ACCOUNT_JSON` is present. No merge/deploy. Secrets documented in playbook §4 and `docs/GITHUB_AUTOMATION_CONTEXT.md`.

---

## [1.62.3] — 2026-09-02

### Changed
- **Editorial viewport tokens (#968)** — marketing chrome uses local `--page-gutter` / `--header-height` and light type roles (H1 / lede / body / meta / eyebrow). Splash header height stays 5.35rem / 5.25rem; Game Format cards share row height and pin actions. Extends #944; splash `100svh` and dashboard type unchanged.

---

## [1.62.2] — 2026-09-02

### Changed
- **Keyword landing C6/C7 bridge (#973 / epic #972)** — `/phish-setlist-prediction-game` title, meta, prerender, and FAQ now include prediction + lock-your-picks while keeping the C1 “game” H1. No `/phish-picks` doorway.

---

## [1.62.1] — 2026-09-02

### Changed
- **GEO brief + playbook (#930 / epic #926)** — `/llms.txt` adds Tour Insights definitions (unique songs, song frequency, 30+ bustouts) and a 2026 Summer Tour deep link. Playbook §3 adds S4–S6 fan queries; §4 points at Child E0/E1 packs; GSC reindex + UTM off-site share remain human ops after promote.

---

## [1.62.0] — 2026-09-02

### Added
- **Public tour-stats CDN JSON (#869)** — build writes `/tour-stats-data/_index.json` and `/tour-stats-data/{slug}.json` from world-readable `public_tour_stats` so marketing `/tour-stats*` can paint aggregates without App Check or the Firestore SDK.

### Changed
- **Public `/tour-stats*` data plane (#869)** — fetch waterfall is same-origin CDN JSON → Firestore REST → SDK last resort. Session cache + background REST revalidate keep the filter/header interactive and clear the skeleton with last-good data. Marketing page no longer kicks App Check on mount.

### Fixed
- **Safari public tour-stats data gate (#869)** — first meaningful stats no longer wait on reCAPTCHA Enterprise + Firestore WebChannel (the WebKit Private ceiling after #853). Human AC remains: private Safari cold `/tour-stats` vs Chrome mobile.

---

## [1.61.2] — 2026-08-09

### Changed
- **Tour stats above-fold copy** — public `/tour-stats*` hero is one short lede (plus a compact hub Current/Archive line) so the tour filter sits in the first viewport; onboarding/SEO deep links move below the stats.

### Fixed
- **Tour stats Bustouts section tooltip** — restore the header InfoTooltip using the same copy as the dashboard Bustouts tile; keep the public #929 SEO description under the header.

---

## [1.61.1] — 2026-08-09

### Fixed
- **Splash hero wordmark sharpness (#962)** — render the gradient lockup as inline SVG (`?raw`) instead of `<img src=".svg">`, so WebKit keeps vector paint; crop via `preserveAspectRatio` slice (mobile top / `sm+` mid).

---

## [1.61.0] — 2026-08-09

### Added
- **HTML-first `/privacy` + `/terms` door (#916 / epic #889)** — zero-JS shells bake full policy markdown into first HTML (back control + title + body); Vercel rewrites + Vite dev middleware; no marketing CSR / Auth / Firebase on legal cold open.

### Changed
- **Legal document owner** — hard-nav from `/login` signup and marketing footer serve `dist/privacy|terms/index.html`; soft SPA routes remain for Profile/account. Docs: `API.md`, `AUTH_BOOT_PRACTICES` 1c, `OUTBOUND_AUTH_HANDOFF` (`legal-static`), `AUTH_SEAMLESS_PATH`.

---

## [1.60.0] — 2026-08-09

### Added
- **Public tour-stats fan-language copy (#929 / epic #926)** — public surface uses H2s/intros for unique songs, song frequency, and bustouts (30+ show gap); hub `/tour-stats` adds a current-tour blurb linking to the summer SEO slug (Sphere as archive).

### Changed
- **Public tour filter URLs (#929)** — selecting any tour (including the current/default) navigates to `/tour-stats/:slug` so Summer no longer collapses to the hub path.

---

## [1.59.0] — 2026-08-08

### Added
- **2026 Summer Tour tour-stats SEO (#927 / epic #926)** — prerender `/tour-stats/2026-summer-tour` (live calendar slug) with query-shaped title/H1/description + JSON-LD; listed in `sitemap.xml` and `llms.txt`.
- **Tour-stats crawler facts (#928)** — build-time fetch of `public_tour_stats/{slug}` embeds bustout/frequency aggregates + FAQ/ItemList JSON-LD in prerender HTML (Sphere + Summer opt-in slugs).

### Changed
- **Public tour-stats H1** — uses registry H1 when the slug is SEO’d (Sphere / Summer) so cold opens paint tour-specific titles before Firestore loads.
- **Public tour filter (Safari)** — teal chrome uses `appearance-none` + border (native `<select>` often drops Tailwind rings in WebKit).
- **Summer SEO slug** — canonical path is `/tour-stats/2026-summer-tour` (matches Firestore); permanent redirect from `/tour-stats/summer-tour-2026`.

---

## [1.58.0] — 2026-08-08

### Added
- **Marketing editorial chrome tokens (#944)** — `marketingEditorialChrome` shared title/article classes; documented rule in `content/marketing/944-chrome-rule-review.md`.

### Changed
- **`/how-scoring-works` light editorial surface (#944)** — light main + `ScoringRulesContent surface="light"` (soft white panel, slate type, `LINK_ON_LIGHT` next-links). Page owns centered editorial H1/lede (`includeIntro={false}`); in-app Scoring modal keeps embedded dark intro. Tour stats remains dark product chrome. Adds iPhone-framed standings sample (handle blurred) under the rules.
- **Editorial H1 ramp** — HIW / keyword / About / marketing Scoring share one sentence-case size system; keyword keeps optional emerald eyebrow.
- **How it works device carousel** — under “Your setlist card”: Picks form + song-search autocomplete (iPhone frames).
- **Keyword page device shot** — standings leaderboard iPhone sample (names + player counts blurred) under “What is a setlist prediction game?”.

---

## [1.57.0] — 2026-08-08

### Added
- **Marketing mobile menu (#706)** — hamburger + disclosure panel for primary nav below `lg` on splash and marketing shells; inline nav and menu are `lg` complements (portrait tablet now uses hamburger on all marketing pages). Splash cluster: Sign In · Join → · menu (far right). Marketing pages: menu far right; `< Home` hidden below `sm` (logo is home).
- **Splash CTA labels** — header primary is **Join** (trailing arrow); hero primary is **Jump on Tour** (was Make picks now).
- **Splash hero copy** — dropped “Predict the setlist. Win the night.” from on-page + crawlable home paragraphs (competitor overlap); “for friends” → “to play”.
- **Marketing desktop header** — primary nav sits near center (slight right bias) on splash + marketing shells so it no longer crowds Sign In / Join.

### Changed
- **Splash / marketing footer stack (#948)** — primary site links sit above the footer rule; © + Mockingbird attribution + legal links form the true footer.
- **Splash About bottom link row (#947)** — one `text-sm` type scale for peer links (fixes Get started Button size drift).

---

## [1.56.1] — 2026-08-08

### Changed
- **`/how-it-works` show-night walkthrough (#937 / epic #942)** — replaces Lock/Watch/Claim card clone of splash Game Format with setlist card → timeline → pools vs global → personal stats; meta + HowTo JSON-LD updated. Home Game Format teaser unchanged.

---

## [1.56.0] — 2026-08-08

### Added
- **`/about` crawlable origin page (#941 / epic #942)** — prerendered marketing route with brand narrative; splash About becomes a short teaser + link; nav, sitemap, and `llms.txt` updated.

### Changed
- **Keyword landing tighten (#940 / epic #942)** — `/phish-setlist-prediction-game` scannable definitional copy (definition + bullets + short how-to); prerender paragraphs + FAQ JSON-LD answer aligned.
- **Tour Insights copy** — public `/tour-stats*` leans on “Tour Insights” + “setlist statistics” (and tour-named H1/meta when a tour is selected) for fan-intent queries (latest tour stats, summer/fall/Sphere bustouts).

### Added (ops)
- **Crew/skill draft artifacts** — `content/marketing/` drafts + always-on Cursor rule requiring on-disk reference docs for crew/skill structured outputs.

---

## [1.55.8] — 2026-08-08

### Fixed
- **Safari Space Grotesk preload warning** — early `@font-face` in entry HTML and boot-shell critical CSS so the preloaded display font is applied before the Vite CSS bundle arrives.

---

## [1.55.7] — 2026-08-08

### Added
- **Marketing-local scroll-to-top (#925 / #920 slice 2)** — `MarketingScrollToTop` + `scrollMarketingToTop` on the marketing document (nav clicks + route changes). Preserves scroll across `/tour-stats` ↔ `/tour-stats/:slug`. Does **not** import shared app `ScrollToTop` or `appBootPath`.

---

## [1.55.6] — 2026-08-08

### Changed
- **Re-land #920 copy + tour-stats UX (slice 1 / #925)** — keyword page, Game Format lede (“Lock in picks, track live setlists and scores…”), public tour-stats intro; default public tour filter to most recent by `lastShowDate`; always-on teal filter ring. Does **not** remount shared `ScrollToTop` / `appBootPath` on the marketing cold-open graph (deferred to a later #925 slice).

---

## [1.55.4] — 2026-08-06

### Fixed
- **Rollback marketing polish #920 / v1.55.3** — Safari stuck on marketing prerender HTML while Chrome hydrated. Reverts frontend from #921; keeps `public_tour_stats` “X of Y” itinerary fix in tree + already-deployed functions. Re-land #920 later with Safari private AC.

---

## [1.55.3] — 2026-08-06

### Changed
- **Keyword page copy (#920)** — refresh `/phish-setlist-prediction-game` educational copy (prediction framing, personal stats, spreadsheet origin story, how-to-play steps).
- **Splash Game Format lede (#920)** — replace “Three steps—then you're in” with lock / live scores / board framing for every show night.
- **Public tour-stats intro (#920)** — Sphere-through-today tracking + action prompts to use the filter / frequency / bustouts / gaps.

### Fixed
- **Marketing soft-nav scroll (#920)** — mount `ScrollToTop` on the marketing document; header/footer nav clicks reset scroll. Preserve scroll depth when switching `/tour-stats` ↔ `/tour-stats/:slug` only.
- **Public tour filter default + chrome (#920)** — default to most recent tour by `lastShowDate`; always-on teal ring on the filter.
- **Public tour-stats “X of Y tour dates” (#920)** — `tourShowCount` (Y) is the full post-launch calendar itinerary; `showsWithSetlist` (X) stays through-today nights with setlists. Dashboard Tour stats already used full-tour Y and is unchanged.

### Notes
- **Rolled back in v1.55.4** (Safari marketing hydrate). Functions itinerary fix retained.

---

## [1.55.2] — 2026-08-06

### Fixed
- **Public High gaps Last blanks (#918)** — regression of #840: `refreshPublicTourStats` now stamps Bustout/High-gap `lastPlayed` from game-local `official_setlists` across all selectable tours (Sphere → Summer) before phish.net history, and persists a durable `lastPlayedByRow` cache so ranking churn + 429 partials cannot wipe previously filled High gaps Last dates.

---

## [1.55.1] — 2026-08-06

### Fixed
- **Auth door neutral focus on Safari private (#909)** — Keychain sheet was already suppressed, but Safari still left a blinking cursor in email. Reject pre-gesture autofocus (document `focusin` guard), park focus on a non-editable target, and retry neutralize after hydrate when private WebKit refocuses late.
- **Legal back from signup (#908)** — When Terms/Privacy were opened from create-account, the in-page control said “Back to Setlist Pick 'Em” and sent visitors to marketing `/`. It now reads the auth-door resume stash and hard-navs to `/login?mode=signup` (“Back to create account”). Prefetch legal docs on signup; modulepreload legal page chunks on prerendered shells.

---

## [1.55.0] — 2026-08-06

### Changed
- **`/privacy` + `/terms` on marketing document (#908)** — Hard-nav from HTML-first `/login` no longer cold-boots `app.html` / spa-boot. Legal routes prerender on the marketing entry (no AuthProvider); soft routes remain on the app SPA for Profile/account. Docs: `API.md`, `AUTH_BOOT_PRACTICES` 1c, `OUTBOUND_AUTH_HANDOFF`, `AUTH_SEAMLESS_PATH`.

### Fixed
- **Auth door email autofocus / Safari Keychain (#909)** — Credential fields start `readOnly` until intentional focus; HTML-first boot shell blurs any autofocused input so Face ID / Keychain does not steal the Google vs email choice on cold open. QA `qa:cache` sign-in focuses fields before fill so Playwright can edit them.

---

## [1.54.2] — 2026-08-05

### Fixed
- **Google redirect return form flash (#893 follow-up)** — Keep the “Logging you in…” continue overlay through successful `getRedirectResult` + profile load until hard-nav leaves `/login`. Previously intent consume / `onSettled` cleared the overlay and briefly showed Continue with Google before dashboard.

---

## [1.54.1] — 2026-08-05

### Fixed
- **Safari Google redirect return on `/login` (#893)** — Always call `getRedirectResult` after Auth is ready; do not gate completion on sessionStorage intent (Safari can drop the stash after account picker). Dual-write redirect intent to `localStorage` as a return hint. Empty result after a stashed intent shows a retry error instead of a silent form reset.

---

## [1.54.0] — 2026-08-05

### Added
- **HTML-first `/login` auth door (#892 / #894 / epic #889 Phase 2)** — `/login` boots dedicated `login.html` → `loginMain.jsx` with **real form chrome in first HTML** (sign-in / create-account fields + Google CTA markup). Auth-only hydrate wires Firebase; Suspense fallback keeps form chrome (anti-#881 blank hang). Prerender/verify assert form controls, `login-*.js` (not `app-*.js`), and `firebase-core` preload. Marketing warm retargets auth-door assets. Soft `/login` route remains on the app SPA for in-app compat.

### Changed
- **`AUTH_SEAMLESS_PATH` / `AUTH_BOOT_PRACTICES` / `OUTBOUND_AUTH_HANDOFF` / `API.md`:** Phase 2 door construction is the shipped `/login` surface; field stop lifted for this train.

---

## [1.53.2] — 2026-08-05

### Fixed
- **Log Out hang (#899)** — After #881 unauth dashboard → `/login` hard-nav, Account Log Out raced a blank `HardRedirect` to `/login` instead of marketing home. Intentional sign-out now marks post-sign-out, guards to `/`, hard-navs marketing `index.html`, and caps FCM cleanup so revoke cannot block forever. Email CTA unauth `/dashboard/*` → `/login` unchanged.

---

## [1.53.1] — 2026-08-05

### Fixed
- **`/login` boot restore (#890 / epic #889 Phase 0)** — Retire the #881 thin `login.html` Vite entry after Safari private indefinite loading hang. `/login` again boots `app.html` + branded login shell (pre-#881 path that paints the form). Hard-nav helpers for unauth dashboard/setup and signed-in leave stay. Next construction: HTML-first auth door (#892), not another CSR hop tier.

### Changed
- **`AUTH_SEAMLESS_PATH` / `AUTH_BOOT_PRACTICES`:** recalibrated to HTML-first auth-door strategy (epic #889); T0–T2.5 CSR hop train is historical.

---

## [1.53.0] — 2026-08-05

### Added
- **Thin login Vite entry (#881 / epic #856 T2.5 Phase B)** — `/login` boots `login.html` → `loginMain.jsx` (login + AuthProvider only), not the dashboard SPA graph from `app.html`. **Superseded in v1.53.1 (#890)** after Safari private hang.

### Changed
- **`AUTH_SEAMLESS_PATH` / `AUTH_BOOT_PRACTICES` / `OUTBOUND_AUTH_HANDOFF`:** Phase B shipped; `/login` is a dedicated login document.

---

## [1.52.1] — 2026-08-05

### Fixed
- **Create account Terms gate** — Email/password fields stay disabled until Terms & Privacy are accepted (matching Google CTA). Hint + locked CTA (“Accept terms to continue”) make the requirement obvious; removed confusing “full-page Google sign-in” footnote.
- **Dev Google continue overlay stuck** — StrictMode remount on `:5173` no longer strands “Loading Google account sign-in options…” after a redirect stash.
- **`vite preview` `/login` shell** — prerendered `login/index.html` is no longer rewritten to bare `app.html`.

---

## [1.52.0] — 2026-08-05

### Added
- **Marketing idle speculative login warm (#880 / epic #856 T2.5 Phase A)** — After marketing paints, once-per-load idle download of `/login` + login UI + `firebase-core` (no `initializeApp` on marketing). `auth_surface_timing.warm_path=speculative` when idle warm contributed; optional `auth_hop_timing` `cta_to_form` for Sign in / Create account hops. Intent CTA path still uses `warm_path=intent` and excludes App Check / Storage from marketing prefetch.

### Changed
- **`AUTH_BOOT_PRACTICES`:** first paint stays Firebase-free; idle download-only of `firebase-core` is allowed (#880).

---

## [1.51.1] — 2026-08-04

### Fixed
- **Marketing leave chrome matches CTA destination** — Jump on Tour / Make picks now / Play for Free show “Taking you to sign up…”; Sign In shows “Taking you to sign in…” (was one generic “sign-in” string for both).

---

## [1.51.0] — 2026-08-04

### Added
- **Marketing → `/login` intent prefetch (#860 / epic #856)** — Sign In / Jump on Tour / Make picks now / Play for Free (and sibling auth CTAs) prefetch the login document + LoginPage UI assets on pointer/focus/leave without booting Auth on marketing `/`. Login shell modulepreloads `firebase-core` (not App Check). `auth_surface_timing.warm_path=intent` when prefetch contributed.
- **Google continue chrome on `/login`** — fullscreen “Logging you in…” (sign-in) / “Loading Google account sign-in options…” (create account) while redirect/popup is in flight and on redirect return, so the blank gap after the full-page Google note is honest.

### Changed
- Path doc Tier 2 marked shipped; `AUTH_BOOT_PRACTICES` allows login-shell `firebase-core` modulepreload (download only; Auth init still deferred).

---

## [1.50.1] — 2026-08-04

### Fixed
- **Marketing auth CTAs no longer feel dead before `/login` (#872)** — Jump on Tour / Make picks now / Play for Free / Make picks for this tour (and siblings) paint immediate leave chrome + button press nudge, then hard-nav to app `/login` (skips MarketingApp soft-nav → “Loading…” hop). Bonus: Google CTA on `/login` shows “Opening Google…” while redirect/popup starts.

---

## [1.50.0] — 2026-08-04

### Changed
- **Safari / iOS Google sign-in via redirect (#859 / epic #856)** — `shouldPreferGoogleRedirectAuth` routes Safari, iOS, and in-app browsers to `signInWithRedirect` (existing stash + completion). Desktop Chromium/Firefox keep popup; `auth/popup-blocked` falls back to redirect once. Android Chrome stays popup unless WebView. Standing rule 6 in `docs/AUTH_BOOT_PRACTICES.md`.

---

## [1.49.3] — 2026-08-04

### Fixed
- **`/login` boot shell no longer looks like the dashboard** — marketing CTAs (“Jump on Tour” / “Make picks now”) hard-nav to `/login`, but `login/index.html` was reusing the dashboard tab skeleton, so mobile Safari showed app chrome for several seconds before the auth form. Login now paints a header + auth-card skeleton instead.

---

## [1.49.2] — 2026-08-04

### Fixed
- **Hard-ready Google CTA on `/login` (#858 / epic #856)** — warm Auth + click-path modules immediately after form paint; disable Continue with Google until ready (“Preparing sign-in…”); ready click path calls `signInWithPopup` with no chunk awaits (kills first-tap Safari race after #850 soft idle-warm). Standing rule **2b** in `docs/AUTH_BOOT_PRACTICES.md`. Marketing `/` still Firebase-free.

---

## [1.49.1] — 2026-08-04

### Added
- **Auth/content RUM (#857 / epic #856)** — `route_group` splits for `/login` (`login`), educational marketing pages (`marketing`), and `/tour-stats*` (`tour_stats`). GA4 `auth_surface_timing` (paint→Auth warm ready) and `auth_google_timing` (click→OAuth invoke / credential→nav). Ops: `docs/AUTH_TELEMETRY_RUNBOOK.md`, `docs/WEB_VITALS_RUM.md`, `docs/AUTH_SEAMLESS_PATH.md`.

---

## [1.49.0] — 2026-08-04

### Changed
- **Public `/tour-stats*` → marketing document (#853)** — restores cold-open feel after #835 login firebase-deferral regressed the app-shell path. Chrome paints without `AuthProvider`; App Check + Firestore load only when fetching `public_tour_stats`. Prerender shells boot `marketing` + `PublicTourStatsPage` UI preload (no firebase-core modulepreload). Standing auth/App Check rules in `docs/AUTH_BOOT_PRACTICES.md`.

---

## [1.48.4] — 2026-08-04

### Fixed
- **Safari Google sign-in on `/login` (#850)** — warm Firebase Auth after form paint; do not await App Check before `signInWithPopup` (preserves user gesture). Prefetch dashboard/setup chunks; clearer `auth/popup-blocked` copy. Marketing `/` still Firebase-free on cold open.

---

## [1.48.3] — 2026-08-04

### Fixed
- **Marketing cold-open paint (epic #835)** — `/` no longer full-screen-blocks on a “Loading…” overlay while JS downloads; prerender copy stays visible under a thin top progress bar. Non-home marketing routes are lazy so home does not download sibling page chunks. GA4 / web-vitals init wait until idle after first paint.
- **Login interaction auth boot (epic #835)** — anon `/login` paints the form without downloading `firebase-core`; Auth + App Check load on Google / Continue with email (session hint and Google redirect return still eager). `/login` uses a branded boot shell that modulepreloads `LoginPage` UI only.

---

## [1.48.2] — 2026-08-04

### Changed
- **Auth CTA polish (epic #835)** — Google/email CTAs share size; Google stays bold white with brighter hover; email submit is “Continue with email”; password reveal is a compact eye icon when fields have content.
- **Marketing CTAs → `/login`** — removed mid-page Get Started chooser; hero/header/section and marketing-page “play” CTAs go to `/login` or `/login?mode=signup`. Invite VIP modals unchanged (#844).

### Fixed
- Scoring page footer links use dark-surface teal (`LINK_ON_DARK`) instead of light-page emerald.
- Public tour-stats “Make picks for this tour” stays one-line and targets create-account.

---

## [1.48.1] — 2026-08-04

### Fixed
- **App-shell splash auth modal trap (epic #835)** — after visiting `/login`, soft-nav Home no longer leaves users on app-document splash with Sign in/Create account opening modals. App `SplashPage` CTAs (and legal/pool-invite handoffs) navigate to `/login`; `MarketingPageShell` Home uses a hard `<a href="/">` so marketing `index.html` reloads. Invite VIP modals unchanged (#844).

---

## [1.48.0] — 2026-08-04

### Added
- **Inline full-page `/login` (#834)** — sign-in and create-account render as page forms (shared panel chrome with splash modals). Query `mode=signup|signin` preferred; `signup=1` still accepted. Invite VIP (`/join`, `/invite`) keeps modal auth.

### Changed
- Marketing / legacy hops emit `/login?mode=signup` instead of `signup=1`.
- Auth panel chrome (`SplashAuthPanel`) uses dashboard L1 / sponsor geometry — `rounded-xl`, quiet `border-border-subtle/60` + `bg-surface-panel/40`, flatter Google CTA — so `/login` reads as a primary surface instead of a floating glass widget.

---

## [1.47.3] — 2026-08-04

### Added
- **Outbound auth handoff inventory (#830)** — `docs/OUTBOUND_AUTH_HANDOFF.md` classifies email/push/inbox/invite/marketing links after the dual-document cold open (`app-ok` / `retarget-auth` / `public-static` / `invite-shell`).

### Changed
- Unauthenticated `/dashboard/*` and `/setup` hard opens bounce to **`/login`** (not marketing `/`), keeping `persistDashboardPath` restore.
- QA runners and docs sign in via `/login`; email click allowlist accepts `/login`, `/invite`, `/setup`.

---

## [1.47.2] — 2026-08-04

### Fixed
- **Public tour-stats High gaps Last blanks (#840)** — `refreshPublicTourStats` now seeds bustout/gap `lastPlayed` from the previous Firestore write before re-stamping. A partial/429 history pass no longer wipes dates a prior run already filled (High gaps were wiped first because they are queued after bustouts). After deploy, re-run the admin refresh so remaining blank rows can use the history budget.

---

## [1.47.1] — 2026-08-04

### Fixed
- **Public `/tour-stats` cold open (#827)** — warm App Check on boot (not after page mount); skeleton chrome while stats load instead of a blank spinner; prerendered shells `modulepreload` `PublicTourStatsPage` + its static closure so the lazy route is not a serial waterfall after `app` entry parse.

---

## [1.47.0] — 2026-08-04

### Added
- **Marketing cold-open document (#832)** — public splash / educational pages boot from a second Vite entry (`index.html` → `marketingMain`) with no `AuthProvider` / `firebase-core` on the critical path. Authenticated SPA lives at `app.html`; new public route **`/login`** hosts splash auth modals. Invite OG shell prefers `dist/app.html`.
- **Release train doc** — `docs/RELEASE_TRAIN_COLD_OPEN.md` tracks #832 → #837 → #827 → #830.

### Changed
- **Splash laptop spacing (#837)** — on `sm+` only (mobile unchanged): wordmark crops SVG headroom and sits closer under the header; hero fills the viewport with leftover dark space *below* the CTA so the next section doesn’t peek above the fold; copy / primary CTA / secondary links get more vertical breathing room.

### Fixed
- Password-reset success CTA now links to `/login` instead of `/?login=true`.

---

## [1.46.5] — 2026-08-04

### Fixed
- **Cold-open load regression after 1.44.x / 1.46.4 promote** — marketing SEO shells paint a branded inline Loading overlay over crawler copy so plain h1/p no longer flash before React mounts; Inter (~344KB) is no longer high-priority preloaded (keeps `@font-face` + `font-display: swap`); `/privacy`, `/terms`, `/user/*`, bare `/join`, and related hard opens use `dist/spa-boot/index.html` (branded skeleton **without** `DashboardRoute` modulepreload); FCM service-worker registration is idle-deferred on all non-dashboard/setup hard opens; `/fonts/*` gets long-cache headers.
- **Lazy `HomeRoute` dependency waterfall (#731)** — splash `modulepreload` now includes the route's **static import closure** (e.g. `auth-*` + `shared-*`, ~360KB) instead of only the 2KB `HomeRoute` leaf, so Landing no longer waits a serial round-trip after the entry bundle parses. Dashboard boot shell uses the same closure walker. FCM messaging is dynamic-imported from `main.jsx` so it leaves the entry static graph.

---

## [1.46.4] — 2026-08-03

### Changed
- **Tour stats list chrome (#709)** — "Most played" renamed to **Tour Frequency** (tooltip: all songs this tour, ranked by times played). Bustouts / High gaps column order is Song | Date | Gap | Last. Tour night dates render as `mm-dd`; prior-play Last as `mm-dd-yy` (full ISO on hover). Enrichment sub-line uses `All Time - N`. Mobile meta columns use fixed tracks + nowrap so headers stay aligned.

### Fixed
- **Public tour stats Last column blank on Summer (#709)** — Tour Frequency rows carry tour-local `lastPlayed` (latest show date on that tour). Bustout/high-gap Last prefers phish.net songs-catalog `last_played` when it is before that night (no HTTP), then paced history lookups (~1.5s gap, 10s 429 backoff, abort after three consecutive 429s, bustouts queued before high gaps) across all tours before writing.

---

## [1.46.3] — 2026-08-03

### Fixed
- **Public tour stats enrichment export (#666)** — `fetchPhishnetSongsNormalized` was used by `refreshPublicTourStats` but not exported from `phishnetSongCatalog.js`, so every refresh logged "is not a function" and wrote unenriched docs (no `lifetimePlays` / `debutYear` / `lastPlayed`). Export added; redeploy + refresh required for live data.

---

## [1.46.2] — 2026-08-03

### Changed
- **Inbox sender badge DNS audit documented (#498)** — `docs/comms-triggers/EMAIL_INBOX_BADGE.md` now carries the 2026-08-03 live DNS audit: DMARC `p=quarantine` already meets the BIMI prerequisite, Resend DKIM is aligned, but `send.setlistpickem.com` is missing the SPF TXT half of Resend's record pair (DMARC passes on DKIM alone), `default._bimi` is unpublished, and DMARC `rua` reports go to the registrar's unmonitored default. Prioritized human DNS/registrar action list included (SPF fix, VMC-vs-CMC decision, BIMI SVG prep, optional Gmail avatar fallback).

---

## [1.46.1] — 2026-08-03

### Changed
- **Lazy splash/invite auth modals (#733)** — `SplashSignInModal` / `SplashSignUpModal` moved to a `features/auth/modals` secondary barrel and now load behind a `React.lazy` boundary in `SplashAuthModals`, warmed at idle after mount so click-open has no visible fetch gap. Defers ~12 kB (≈4 kB gzip) of modal-only code off the anonymous splash and invite first paint and keeps future modal-stack growth off the cold-open path. No behavior change; modals mount only while open (they rendered `null` closed).

---

## [1.46.0] — 2026-08-03

### Added
- **Public tour stats phish.net enrichment (#666, Phase 1)** — `refreshPublicTourStats` fetches phish.net `v5/songs` server-side (secret stays in Cloud Functions) and stamps `lifetimePlays` + `debutYear` onto every `public_tour_stats` row; public `/tour-stats` rows render a "Debut 1997 · 623 plays all-time" context line. Best-effort: refresh still writes unenriched docs (with `enrichment: null`) if phish.net is unavailable. `schemaVersion` → `2`. Dashboard Tour stats (client aggregation) unchanged.
- **`lastPlayed` on bustout / high-gap public rows (#709 follow-up)** — same refresh looks up each unique bustout/high-gap song's phish.net play history (≤80 lookups/run, cached across tours) and stamps the date last played *before* that tour night. Powers the "Last" column shipped in 1.45.0; schedule/callable timeouts raised to 300s to fit the extra lookups.

### Changed
- `scheduledPublicTourStatsRefresh` and the admin `refreshPublicTourStats` callable now bind the `PHISHNET_API_KEY` secret.

---

## [1.45.1] — 2026-08-03

### Fixed
- **SERP favicon hardening (#662)** — removed the 854 KB embedded-raster `favicon.svg` and its `<link>` from the SPA shell, OG crawler HTML, and SEO prerender shells; the 96×96 PNG + ICO are now primary (square ≥48 px at stable URLs, per Google SERP favicon requirements). `verify:seo-prerender` asserts the PNG link is present and `favicon.svg` never resurfaces; nightly CI curls prod `/favicon.ico` + linked PNG for `200` + `image/*`.

---

## [1.45.0] — 2026-08-03

### Added
- **Tour stats pagination (#709)** — "Most played", "Bustouts", and "High gaps (non-bustout)" now surface **every** song in their category, paginated at 15 rows/page with back/forward arrows and a `16–30 of 87` range indicator. Rank numbers in Most played continue across pages. Applies to both the dashboard Tour stats tab and the public `/tour-stats` pages.
- **"Last" (last played) column on Bustouts / High gaps (#709)** — rows render the date the song was last played *before* that tour night when the server-enriched `public_tour_stats` payload carries it (`lastPlayed`, written by `refreshPublicTourStats` from phish.net song history — see the 1.46.0 entry). The dashboard joins the dates from the world-readable public doc (`mergePublicLastPlayed`); the column self-hides while no row has a date, so nothing changes until the enriched refresh lands.

### Changed
- `aggregateTourSetlistStats` (client + functions mirror) no longer truncates `topSongs` / `gapHighlights` to top-15; `refreshPublicTourStats` writes full ranked lists to `public_tour_stats/{tourSlug}` (public page shows capped lists until the function is deployed and the nightly refresh reruns). The "In most played" self-overlay tile stays pinned to the top 15 and its tooltip now says so.

### Fixed
- **`qa:cache` CI hang + flaky threshold (#748)** — QA tooling only, no app surface. Runner now exits explicitly on every path, `vite preview` is killed by process group (orphaned vite kept CI runners alive for the full 6 h workflow limit), `qa-runners` gained `timeout-minutes: 20`, and the noisy byte-savings assertion was replaced with a deterministic count of season-stats document references in Firestore WebChannel POST bodies.

---

## [1.44.3] — 2026-08-03

### Added
- **Route chunk prefetch registry (#805)** — `shared/lib/routeChunkPrefetch` lets features warm `dashboard` / `setup` / `home` chunks by string key without importing app-layer route modules. Splash and invite auth modals prefetch `dashboard` + `setup` on open.
- **Persisted session hint (#804)** — auth writes `setpicks_session_hint_v1` to localStorage on session resolve and clears it on sign-out, so a cold open on `/` can start the `DashboardRoute` download in the entry tick instead of waiting for Firebase auth to settle. Anonymous visitors are unaffected.

### Changed
- **Lazy `HomeRoute` (#731)** — the splash route joined every other top-level route behind `lazy()`; `prerender-seo` now modulepreloads the `HomeRoute-*.js` chunk into `dist/index.html` so splash first paint keeps its budget. `verify:seo-prerender` asserts each shell preloads only its own route (splash never gets `DashboardRoute`, the app boot shell never gets `HomeRoute`).
- **Auth provider barrel (#731)** — `main.jsx` imports `AuthProvider` from `features/auth/provider` so the entry bundle no longer statically pulls splash/auth-modal UI from the root auth barrel.
- **Earlier pool join (#731)** — `/join/:code` starts the invite join as soon as auth resolves, overlapping the write with the DashboardRoute download and the `/setup` detour. `usePendingPoolJoin` adopts that same in-flight request rather than issuing a second one, so toasts, navigation and the retry timeout are unchanged. Site invites (`/invite/:handle`) remain free of pool side effects.

---

## [1.44.2] — 2026-08-03

### Changed
- **Invite HTML + FCM SW (#732)** — `api/invite` dynamic-imports `firebase-admin` only for crawler OG lookups; defer FCM service-worker registration on public cold-open routes until idle.

---

## [1.44.1] — 2026-08-03

### Changed
- **App Check first-paint policy (#803)** — anonymous `/`, `/join`, `/invite` keep deferred reCAPTCHA until auth modal open; persisted sessions and `/dashboard`/`/setup` still warm immediately.

---

## [1.44.0] — 2026-08-03

### Added
- **Field RUM (#801)** — production `web_vital` GA4 events (LCP/INP/CLS/TTFB/FCP) with `route_group` + `navigation_type`; see `docs/WEB_VITALS_RUM.md`.
- **Self-hosted Inter (#802)** — variable Inter woff2 under `public/fonts/inter/` with preload; removes render-blocking Google Fonts CSS.

### Changed
- CSP Report-Only `style-src` / `font-src` no longer allow `fonts.googleapis.com` / `fonts.gstatic.com` (fonts are first-party).

---

## [1.43.0] — 2026-08-02

### Added
- **Summer 2026 almost-end marketing batch** — trigger `marketing_summer_2026_almost_end` / template `summer-2026-almost-end`: email to Summer Tour players (lifecycle prefs), forced in-app inbox for all users (no prefs), React Email template, admin callable `deliverMarketingSummer2026AlmostEnd`, CLI, and one-shot scheduler `scheduledMarketingSummer2026AlmostEnd` (2026-08-03 08:00 America/Denver) with Firestore run-lock.

### Changed
- `deliverCommsTrigger` accepts optional `channels` filter so multi-channel catalog rows can dispatch a subset (email-only for almost-end while inbox uses a prefs-bypass fanout).

---

## [1.42.4] — 2026-08-01

### Changed
- **Push SPA soft-nav (#773 Phase 3)** — notification clicks on an already-open same-origin tab `postMessage` a `NAVIGATE` path into the SPA (no `client.navigate` full reload); cold open still uses `openWindow`.

---

## [1.42.3] — 2026-08-01

### Changed
- **Email WebView auth path (#773 Phase 2b)** — in-app browsers prefer Google `signInWithRedirect` (with splash intent restore) and show an Open-in-browser banner; popup Google remains the default elsewhere. Return URL via `persistDashboardPath` unchanged.

---

## [1.42.2] — 2026-08-01

### Changed
- **Email CTA cold-boot TTI (#773 Phase 2)** — dashboard hard opens warm App Check + kick `DashboardRoute` before paint; boot shell `modulepreload`s the dashboard chunk (splash untouched); Auth paints profile via `getDoc` then `onSnapshot` and shows `DashboardBootSkeleton` instead of bare “Loading…”.

---

## [1.42.1] — 2026-08-01

### Changed
- **Email CTA branded dashboard boot shell (#773 Phase 1)** — `dist/dashboard/index.html` now ships a generic vinyl-mark + muted nav / skeleton-card shell (no SEO body) so hard opens paint branded chrome before React mounts. `verify:seo-prerender` asserts the boot marker and keeps home prerender intact.

---

## [1.42.0] — 2026-08-01

### Added
- **picks_lock delivery-log conversion join (#698)** — `npm run comms:picks-lock-conversion` joins `fcm_notification_log` ↔ `picks` for true before-lock conversion % (channel split + lock-relative timing); Optimize recipe §E.

---

## [1.41.0] — 2026-08-01

### Added
- **Comms Optimize L2 kickoff scheduler (#778)** — `docs/comms-triggers/optimize_for.md` goal rotation, `npm run comms:optimize-kickoff`, and `.github/workflows/comms-optimize-schedule.yml` (daily cron posts agent prompts on epic #573; no auto-merge/deploy).
- **Show-recap narrative QA (#779)** — `npm run comms:show-recap-qa` checklist + branch samples against `comms_show_context` / fixtures; post-show Optimize kickoffs attach the report on #573 (fail → `DRAFT_PR`).

### Fixed
- **QA cache runner hang (#777)** — `qa:cache` no longer waits on Firestore WebChannel `networkidle` after sign-in.

---

## [1.40.3] — 2026-08-01

### Changed
- **Show recap bustout highlight (#780)** — `setlist_highlight` now labels nights as `Bustout: Song - a/an N show gap.` (one) or `Bustouts: …; ….` (two+). Fixes cold-branch email reading like a vague memory line when a single bustout landed (e.g. Fenway Melt the Guns).

---

## [1.40.2] — 2026-07-31

### Changed
- **Picks lock basis** — wall clock moves from doors+(tour avg − safety) to **published ticket/show time + 20 minutes** (Phish.com `Show Time` → `scheduledStartLocal`). Client + Functions + lock-reminder share the same resolver; timing banner / War Room / admin helper copy updated. Fallback remains **7:30 PM** venue-local when show time is unknown.

---

## [1.40.1] — 2026-07-28

### Fixed
- **SEO prerender flash on app hard loads (#743)** — empty-root SPA shell at `dist/dashboard/index.html` + Vercel rewrites for `/dashboard/*`, `/setup`, `/user/*`, `/privacy`, `/terms`, and related app paths so hard navigations no longer flash home marketing copy. In-app inbox CTAs use React Router `Link` for same-origin destinations (no full reload).

---

## [1.40.0] — 2026-07-28

### Added
- **`VITE_ENABLE_PREDICTION_LAB`** — build-time gate for Prediction Lab UI and recommendations fetch (same pattern as sponsor slots). Omit in Production to ship the rest of the staging train without launching the lab; set `true` on Preview/local to keep QA access.

---

## [1.39.8] — 2026-07-28

### Changed
- **Build toolchain majors (#744, step 2)** — Vite 4 → 8 (Rolldown-based), `@vitejs/plugin-react` 4 → 6, Vitest 1 → 4. Added explicit `vite-node@6` devDep (Vitest 4 no longer bundles the binary used by `crowd:night-stats`). Route-level code splitting and all six vendor/firebase manual chunks verified unchanged; bundle ~4% smaller.

### Fixed
- **`qa:chunks` chunk-name parser** — Rolldown emits base64url file hashes that can contain dashes (`PasswordResetCompletePage-Bdu-qXPb.js`); the parser assumed dash-free hashes and timed out. Now matches the fixed 8-char hash tail under both hash styles.

---

## [1.39.7] — 2026-07-28

### Changed
- **Dev tooling majors (#744, step 1)** — ESLint 9 → 10 and sharp 0.34 → 0.35. Replaced `eslint-plugin-import` (peer-caps at ESLint 9) with the maintained `eslint-plugin-import-x` fork; FSD boundary rule renamed `import/no-restricted-paths` → `import-x/no-restricted-paths` with identical zones. No app-runtime impact.

---

## [1.39.6] — 2026-07-27

### Fixed
- **Primary nav scroll-to-top** — sidebar, bottom tabs, brand home, Profile/Standings segmented controls call `scrollAppToTop` on click (including same-tab re-taps). Route changes also key off `search` so Standings view switches reset scroll.

---

## [1.39.5] — 2026-07-27

### Fixed
- **Dashboard route scroll** — navigating between dashboard tabs (e.g. Standings → Picks) resets the `main` scrollport to the top, not only `window` scroll.

---

## [1.39.4] — 2026-07-27

### Changed
- **Crowd pulse preview blur** — while the show is still `NEXT`, preview **Song** and **Last** stay blurred (Pickers / Gap remain visible); deep stats stay locked until showtime. Exclusive accordion for full-stats sections; category teasers for multi-picker / highest gaps / leaders.
- **Crowd pulse chrome** — title + Full crowd stats use brand accent red; deep section headers use accent blue; teaser song names use red/blue contrast. Standings pick-privacy tooltip copy generalized (no “user feedback” framing).

---

## [1.39.3] — 2026-07-22

### Fixed
- **Invite auth loading gap (#727)** — guest → sign-in keeps auth `loading` until the first profile snapshot, so returning users are not dumped onto Almost There. Profile setup subcopy uses pool-enter framing only when a pending invite breadcrumb is present.
- **Pending pool join UX (#728)** — post-auth with a stored invite lands on `/dashboard/pools` (overrides remembered last-tab). Pending-join status machine drives “Joining your pool…” chrome; `useUserPools` splits `listLoading` vs `actionLoading` so Join/Create buttons no longer flash from list refresh.
- **Join backfill + timeout (#729)** — legacy pick-doc pool snapshot backfill no longer blocks `joinPool` after membership commit. Pending join times out at ~15s with Retry (breadcrumb kept; in-flight dedupe cleared). Pending-join effect no longer cancels on calendar `showDates` identity churn (avoids stuck invite breadcrumb after a successful membership write).

---

## [1.39.2] — 2026-07-22

### Changed
- **Picks lock offset** — doors-based wall clock moves from doors+100 (1h40) to doors+85 (1h25): safety buffer raised 19 → 34 against the Summer Tour 2026 avg doors→start of 119. Client + Functions + lock-reminder copy share the same resolver.

---

## [1.39.1] — 2026-07-22

### Fixed
- **Pool invite join** — Firestore rules now allow `memberJoinedAt` on self-join for `from_membership` pools (new pools since #417). Without this, every invite-link join failed with permission denied and surfaced “Could not join the pool.”
- **Pool invite flash** — `/join/:code` server-rendered SPA shell no longer injects the home-page SEO prerender body into `#root` before React boots (eliminates the brief “About Setlist Pick'Em” marketing copy flash).
- **Pending invite retry** — Deep-link join keeps the stored invite code in `localStorage` until join succeeds or is definitively invalid, so transient failures can be retried from the Pools tab without re-opening the link.

---

## [1.39.0] — 2026-07-22

### Added
- **Pick-recommendations 1y Phish.net history (#721)** — private Storage window `pick-recommendations/history/window.json` synced from Phish.net (outside `official_setlists`). Publisher merges with Firestore priors; artifact adds `historySource`. Callables/schedules: `refreshPickRecommendationHistory`, `scheduledPickRecommendationHistory`.

---

## [1.38.0] — 2026-07-22

### Added
- **Prediction Lab (#651)** — opt-in, default-collapsed panel on Picks: Safe / Slot fit / Long shot recommendations with “Use” apply-to-slot. Consumes `pick-recommendations.json`; hidden when locked or artifact unavailable. GA4: `prediction_lab_open`, `prediction_lab_impression`, `prediction_lab_select`.

### Changed
- **Recommendation risk bands (`v0.1.1-explainable`)** — Slot fit = historically strong for the selected slot (`slotHits` / show window *t*); Safe = high show-wide play probability; Long shot = bustout upside. Lab hides `unbanded` residuals.

---

## [1.37.0] — 2026-07-22

### Added
- **Pick recommendations Storage artifact (#650)** — `pick-recommendations.json` published by `scheduledPickRecommendations` / `refreshPickRecommendations` for the upcoming show (`modelVersion` v0.1.0-explainable). Client `usePickRecommendations` with TTL/stale fallback; optional `VITE_PICK_RECOMMENDATIONS_URL`. See `docs/PICK_RECOMMENDATIONS.md` / `docs/API.md`.

---

## [1.36.0] — 2026-07-21

### Added
- **Song catalog archives (#647)** — each `scheduledPhishnetSongCatalog` / `refreshPhishnetSongCatalog` sync writes a private dated snapshot at `song-catalog/archive/YYYY-MM-DDTHH-mm-ssZ.json` (same payload as live) for leakage-safe prediction backtests (#646). Live `song-catalog.json` client path unchanged. Callable may return optional `archivePath`.

### Changed
- **`docs/SONG_CATALOG.md`** — documents the every-6h schedule (was stale “weekly”), archive layout/retention, and Storage rules for archive objects.

---


## [1.35.9] — 2026-07-27

### Fixed
- **Primary nav scroll-to-top (#740)** — production hotfix of the staging 1.39.6 nav scroll behavior.

---

## [1.35.8] — 2026-07-27

### Fixed
- **Dashboard route scroll (#738)** — production hotfix of the staging 1.39.5 scrollport reset.

---

## [1.35.7] — 2026-07-27

### Changed
- **Crowd pulse preview blur (#736)** — production hotfix of the staging 1.39.4 crowd-pulse preview behavior.

---

## [1.35.6] — 2026-07-22

### Fixed
- Invite Wave 0 UX / join reliability (#727–#729) — see staging 1.39.3 notes (same train).

---

## [1.35.5] — 2026-07-22

### Fixed
- Pool invite join / SEO flash / pending invite retry — see staging 1.39.1 notes (same train).

---

## [1.35.4] — 2026-07-21

### Changed
- **Dashboard card system (#710)** — shared `dashboardCardClasses` module (radius, pad, L1/L2 heights, type scale); `standingsSurfaceClasses` re-exports it; Standings, crowd pulse, SponsorSlot, and Tour Stats consume the shared tokens.
- **Stats naming polish (#710)** — "Picking average" unified across profile + tour stats with batting-average display (`.167`); "Avg pts / show" → "Points per show" with PPG tooltip; public profile stats gain InfoTooltips (footnote paragraph removed).
- **Tour stats view (#710)** — "Your picks this tour" on shared `StatTile` (bottom-pinned `x/y correct` sub-line); personal section recolored to the muted blue family with an emerald hybrid Bustout Boost band; `InfoTooltip` accepts `triggerClassName`.
- **Badge hierarchy + shadow shelf (#710)** — explicit `rank` on the badge catalog (Ten-Show Run > First Night Win > Five on the Board > First Show Scored) so standings avatar pins showcase the highest earned badge; Badges shelf now renders the full ladder with dimmed shadow tiles for unearned milestones.

---

## [1.35.3] — 2026-07-20

### Added
- **Crowd pulse GA4 (#694)** — `crowd_pulse_view`, `crowd_pulse_full_expand`, `crowd_pulse_section_open` on Standings (see `docs/API.md`).

### Changed
- **Crowd pulse Standings polish (#694)** — top-5 Song · Pickers · Gap · Last table; full-stats expandable sections; setlist-hit highlight; frozen `songGaps` preferred over live catalog for historical nights.

### Fixed
- **Crowd pulse gap on past shows** — use `official_setlists.songGaps` pre-show gap so played titles match the setlist card instead of post-play catalog reset.

---

## [1.35.2] — 2026-07-20

### Changed
- **Crowd pulse ship (#694)** — drop Standings “prototype” label; final chrome/copy; extract `FrequencyMeterRow`; blur gate helper + tests. Stats deep-dive / picks helper remain on #694 P1–P2.

---

## [1.35.1] — 2026-07-20

### Changed
- **Optimize measurement planes (#573 / #695)** — `MEASUREMENT_PLAN` channel matrix + email UTM rule; `comms-analyst` / Leadership snapshot recipe (`crew/knowledge/optimize_snapshot_recipe.md`); Optimize pipeline `challenge_evidence` + Comms Orchestration Lead `SQUAD_KICKOFF` router (learning from email CTA miss).

---

## [1.35.0] — 2026-07-20

### Added
- **Crowd pulse on Standings Show (#687 / #689)** — pre-show summary of tonight’s multi-picker songs (frequency meters); deep stats (gap, vintage, tour leaders) blur until picks lock. Feature module `src/features/crowd-picks/`. Standings productization in **1.35.2** (#694); Stats page / helper remain #694 P1–P2.
- **Internal picks rollup report (#687)** — `functions/scripts/picksRollupReport.js` + methodology under `docs/picks-rollup/` for nightly picker volume and song insights.

---

## [1.34.7] — 2026-07-20

### Added
- **SEO string sync CI (#663)** — `npm run verify:seo-strings` keeps `seo.js`, `og-home-html.mjs`, `inviteOgHelpers.mjs`, and `index.html` descriptions aligned (wired into `verify` job).

### Changed
- **GEO enrichment (#661)** — visible splash supporting headline with “Phish setlist prediction game” language; expanded `llms.txt` (name variants + archive disambiguation); public `/user/:userId` profiles send `noindex,follow`.
- **robots.txt hygiene (#663)** — Disallow `/setup`, `/comms-preview`, `/password-reset-complete` in addition to `/dashboard/`.

---

## [1.34.6] — 2026-07-20

### Changed
- **Marketing SEO copy voice** — public tour stats, how-it-works, keyword page, splash how-it-works, `llms.txt`, and meta/OG mirrors now say stats refresh every night the band plays live (not “when Phish.net publishes”); emphasize personal stats from playing, multi-band destination framing, and fan-facing prose without technical jargon. Dropped the public “Set Picks” alias in favor of Setlist Pick ’Em / Setlist Pickem only.
- **Marketing internal links** — shared `surfaceLinkStyles` (teal/emerald, underlined) for readable secondary CTAs; contextual in-copy links across splash sections and marketing pages; splash Game Format scoring link is a real `/how-scoring-works` route.
- **Keyword page adjacent terms** — gracefully weave fantasy setlist, setlist picks game, predicting setlists, calling the set / couch tour vernacular (informed by incumbent lookalikes) without competitor name-drops.

---

## [1.34.5] — 2026-07-19

### Changed
- **Public `/tour-stats` default tour (#665)** — default is the current tour (newest `lastShowDate` on `_index`), not a hardcoded Sphere preference.

---

## [1.34.4] — 2026-07-19

### Fixed
- **`whenFirebaseReady` no-op race** — always kick App Check init instead of resolving immediately when deferred init has not started yet.

---

## [1.34.3] — 2026-07-19

### Fixed
- **Public tour-stats App Check race (#665)** — await `whenFirebaseReady()` before `public_tour_stats` reads; kick App Check on page mount so localhost/prod enforcement does not 403 the first fetch.

---

## [1.34.2] — 2026-07-19

### Changed
- **Marketing internal nav (#663)** — shared primary route list drives splash + marketing headers (lg+) and footers; splash hero secondary CTAs are real `<Link>`s to `/how-it-works`, `/tour-stats`, and `/phish-setlist-prediction-game` instead of in-page-only scroll.

---

## [1.34.1] — 2026-07-19

### Fixed
- **Public tour-stats default slug (#665)** — align default/prerender with live calendar label **2026 Sphere** → `2026-sphere` (was hardcoded `sphere-run-2026`). Index writer prefers any Sphere tour when present.

---

## [1.34.0] — 2026-07-19

### Added
- **Keyword-intent page (#660)** — public `/phish-setlist-prediction-game` educational landing (what a Phish setlist prediction game is, vs archives/trackers, how to play). Prerender + FAQ JSON-LD; sitemap/`llms.txt` + marketing footer links.

---

## [1.33.0] — 2026-07-19

### Added
- **Public `/tour-stats` (#665)** — marketing routes `/tour-stats` and `/tour-stats/:tourSlug` with tour filter; default Sphere (`sphere-run-2026`). Aggregate-only Firestore `public_tour_stats` (most played, bustouts, gap highlights — never full nightly setlists). Admin/scheduled refresh; prerender hub + Sphere; sitemap/`llms.txt` links; GA4 `public_tour_stats_view`.

---

## [1.32.0] — 2026-07-19

### Added
- **SEO prerender for public marketing routes (#659)** — post-build step writes crawler-visible HTML (unique title/description, H1/body, JSON-LD, favicons) for `/`, `/how-it-works`, and `/how-scoring-works` into `dist/`. Shared registry `src/shared/config/seoRoutes.js` (Helmet + prerender); `npm run verify:seo-prerender` in CI. Plug point for future public `/tour-stats` (#665). Browsers still boot the SPA via `createRoot`.

---

## [1.31.1] — 2026-07-19

### Fixed
- **Googlebot empty-body OG (#658)** — homepage edge middleware no longer serves the minimal empty-body OG shell to `Googlebot` / `bingbot` / `Applebot` / `ia_archiver`. Those bots get the normal SPA `index.html`. Social scrapers still get the OG shell, which now also includes favicon `<link>`s.

---

## [1.31.0] — 2026-07-18

### Added
- **Doors-based picks lock (#522)** — wall-clock lock is now `doors + (tour avg doors→start − safety)` when doors are known (Summer Tour 2026 setlist.fm avg 1h59m, safety 19 → **doors+1:40**). The daily Phish.net calendar sync now enriches upcoming dates from first-party Phish.com date pages (`Doors Open` / advertised `Show Time`), preserves prior timing on transient failures, and retains seeded Summer Tour doors as a client/Functions fallback. Unknown doors use the conservative **7:30 PM** venue-local fallback. Client + Functions + `picks_lock_reminder` share the same resolver. Lock toast copy: “Picks locked, almost showtime!”
- **Feature discovery “New” markers (#639)** — client spotlight registry (`features/feature-discovery`) with soft **New** labels on Standings **Stats**, live/official setlist card, and Profile avatar/badges. Clears on visit/interaction; expires `until` 2026-08-31; localStorage per uid. Wires `feature_spotlight_*` GA4 from #638.
- **Feature engagement GA4 (#638)** — client events for recent surfaces: `live_setlist_view`, `tour_stats_view`, `avatar_changed`, `badge_shelf_view`; helpers for future `badge_pin_changed` (no pin UI yet) and `feature_spotlight_*` (wired in #639). Wrappers under scoring / tour-stats / profile / feature-discovery.
- `docs/scoring-analysis/` — durable repo docs for scoring/prediction canvas research (slot odds, significance, calibration, combos, greenfield model, predictive picker framework); links issues #645–#653.

### Changed
- War Room show-date panel shows the resolved per-show lock time and source (doors / explicit / fallback).
- Picks and pre-lock Standings now show a dismissible, session-scoped timing notice with the resolved cutoff and, when known, its relationship to the published doors time. It is the top notice on Standings and stays dismissed for that show across both surfaces. Cutoff-related comms use only relative `time_to_lock` wording; tour countdown copy no longer repeats an absolute deadline.
- **Profile Your stats copy** — removed the footnote under the self-profile averages grid; each tile now uses the same Info tooltips as Standings → Stats (`InfoTooltip` shared UI).

### Fixed
- **Profile avg correct on show day (#635 Slice 0)** — live season-stats fallback now preserves `users.careerCorrectSlots`, and `deriveLatestFinalizedShow` excludes today (`d < today`) so an ungraded calendar date no longer falsely stales rollups through yesterday. Multi-day gaps still need the rollup watermark (Slices 1–2).

---

## [1.30.0] — 2026-07-17

### Added
- **Tour stats explorer (#555)** — private dashboard route `/dashboard/tour-stats` aggregates a selectable tour’s `official_setlists` on demand (unique songs, top frequency, bustouts, high-gap highlights) plus a self pick overlay (correct slots / bustout hits / top-song overlap). Peer Standings chrome tab (**Show \| Tour \| Stats \| Pools**); shares the Tour view’s chrome tour scope picker (`?tour=`). No public SEO route or rollup schema in v1. SemVer MINOR for the new dashboard surface.
- **Comms Optimize autonomy playbook (#573 L0)** — `docs/comms-triggers/OPTIMIZE_AUTONOMY.md` plus squad skill handoffs (analyst → triggers → drafter → architect → PM), PM pack template, draft-only/`staging` gate, and #572 night vs #510 tour boundary.
- **Comms Optimize L1 (#573)** — goal-input convention + Cloud Agent kickoff prompt; first on-demand PM pack archived on the epic (`optimize_for=picks_lock`, 2026-07-17).

### Changed
- **Standings IA (#555 UX)** — Stats is a fourth Standings view tab (not a buried Tour-only link and not a fifth primary bottom-nav item). Mobile context title on `/dashboard/tour-stats` stays **Standings**; sticky chrome matches Show/Tour/Pools.
- **Tour stats copy/layout (#555)** — summary reads “x of n tour dates”; grids use setlist-style column headers; summary tiles are Unique songs / Songs played / Unique ratio / Bustouts with Info tooltips (no footnote strip); Bustouts card keeps the scoring-rules “What is a bustout?” link; High gaps / Most played use Info tooltips.

### Fixed
- **Tour stats data hygiene (#555)** — the Bustouts and High-gaps cards now only count songs actually played that night, so stale `official_setlists` snapshot entries (the writer unions `bustouts`/`songGaps` across polls and never drops removed rows) no longer leak in as never-played “bustouts” or mislabeled high gaps. A played song whose frozen pre-show gap clears the bustout threshold is now shown as a bustout even if the frozen `bustouts` array missed it, keeping the two cards consistent. “Most played” ties now break by lifetime plays (song catalog) instead of alphabetically.

---

## [1.29.0] — 2026-07-16

### Added
- **Per-song gap on Standings setlist (#587 Phase B)** — `official_setlists/{showDate}` now freezes a `songGaps` map (normalized title → pre-show gap) at live-automation and admin-save time from the same Phish.net row `gap` that feeds `bustouts`. Standings setlist rows use an invisible 4-col grid (# / Song / Gap / Bustout) and show every frozen gap (including 0); bustouts stay emphasized. Display-only — not read by scoring; historical nights never join the weekly catalog. Ops backfill: `functions/scripts/backfillSongGaps.js` (`npm run backfill:song-gaps`). Schema: `docs/OFFICIAL_SETLISTS_SCHEMA.md`, `docs/API.md` §1.12.

---

## [1.28.1] — 2026-07-16

### Changed
- **Standings unset-avatar fallback (#568 follow-up)** — players who have not picked a curated avatar now render a neutral handle-initial chip in standings rows instead of the default `ticket`, so an unset avatar no longer reads as a deliberate ticket choice. Selected avatars and the earned-badge pin are unchanged; the self “add” control still appears on your own row when `avatarId` is unset.

### Fixed
- Backfilled milestone badges (`shows_played_1/5/10`, `win_1`) for existing users so shelves and standings pins populate without waiting for the next finalize.

---

## [1.28.0] — 2026-07-16

### Changed
- **Standings identity marks (#567/#568 follow-up)** — show/tour/pool standings rows render curated avatars next to handles, pin the top earned badge on the avatar, and show a dashed “add” control on your own row when `avatarId` is unset (links to Profile).

---

## [1.27.0] — 2026-07-16

### Added
- **Selectable profile avatars (#567)** — curated 12-mark set under `/avatars/*.svg`, persisted as `users.avatarId`. Picker on dashboard Profile; public `/user/:uid` shows the selected mark (default `ticket` when unset).

---

## [1.26.0] — 2026-07-16

### Added
- **Profile avg correct / show (#554 slice C)** — `rollupScoresForShow` materializes `users.careerCorrectSlots` (and per-tour `seasonStats.*.correctSlots`) with pick-level `correctSlotsCredited` for regrade-safe diffs. Public + self Profile show avg correct when the field is present; otherwise —.
- **Self Profile top-picks strip (#553)** — frequency-forward ranked strip (top 10) on dashboard Profile, live-computed over the last 40 graded shows with correct / exact / wild / bustout secondary counts and `profile_pick_heatmap_computed` telemetry. Public heatmap deferred until a rollup path ships.
- **Self Profile avg vintage** — mean catalog debut year over titles in the heatmap window (n of m dated).

### Changed
- Season-aggregates backfill / revert / premature-grade reset scripts now maintain `careerCorrectSlots` + `correctSlotsCredited`.

---

## [1.25.0] — 2026-07-16

### Added
- **Song catalog `debut` field (#554 slice B)** — `song-catalog.json` rows now include Phish.net `debut` (string, empty when unknown). Profile avg-vintage helpers join pick titles to catalog debut years in memory; UI surfaces when pick titles are available (slice C / heatmap).

---

## [1.24.1] — 2026-07-16

### Added
- **Profile avg points / show (#554 slice A)** — public profile stats strip derives average points per graded show from existing career totals (no extra Firestore reads).

---

## [1.24.0] — 2026-07-16

### Added
- **Standings setlist bustout badges (#587 Phase A)** — official setlist rows now badge songs present in `official_setlists.bustouts`, using the existing scoring snapshot with no new listeners or schema changes.

---

## [1.23.1] — 2026-07-16

### Fixed
- **`tour_rankings_daily` venue/location dedupe (#584)** — recap emails now use a non-location-led subject, name the show location once in the body, use “last night’s show” for the tour movement paragraph, and render same-venue next shows as “Back at …” instead of repeating the full next-up line. In-app preview copy mirrors the shared contract.

---

## [1.23.0] — 2026-07-16

### Added
- **Sponsor slot seam (#609)** — `shared/ui/SponsorSlot` reserved placement composed on Standings below the sticky chrome; renders nothing unless `VITE_ENABLE_SPONSOR_SLOTS=true` (ads epic #419 Phase 1 seam).
- **Standings GA4 events (#609)** — `standings_view_change { from, to }` on Show/Tour/Pools switches and `scoring_rules_opened { surface }`, closing the measurement blind spots for standings iteration.

### Changed
- **Standings sticky chrome declutter (#609)** — sticky tier now holds only the Show/Tour/Pools switcher: full-width equal-thirds segmented control on mobile (never wraps), inline pill group on desktop. Invite moves out of chrome into an in-flow content promo (`StandingsInvitePromo`) on both breakpoints; Scoring rules stays as a desktop sticky utility and a mobile Scale icon. Reserved-padding hacks removed.
- **Standings mobile Views header (#609)** — Show/Tour/Pools is a fixed H3 header in the mobile chrome stack directly under the Standings context bar (portaled `StandingsMobileFixedChrome`), not sticky-in-`main`. Desktop keeps sticky page chrome.
- **Desktop Tour Date sticky everywhere** — sticky Tour Date chrome (previously Standings-only) applies on all `showDatePicker` routes (Picks, Pools, Admin, Standings Show/Pools).
- **Mobile fixed chrome on primary tabs (#609)** — Picks (Scale + status), Pools (Go to Picks + How pools work), and Profile (section sub-nav) nest under the context bar via a shared `#dashboard-mobile-fixed-chrome-root` portal, matching Standings scroll-hide behavior.
- **Mobile chrome tier heights + surfaces (#609)** — shared `DashboardMobileChromeBar` (`min-h-[3.5rem]`, `bg-brand-bg/95`) so tools rows match across tabs; context bar gains `min-h-[3.375rem]` and stays `surface-chrome`, so the stack reads brand → lighter title chrome → darker page-toned tools → content.
- **Mobile chrome control harmonization (#609)** — shared `ChromeSegmentedControl` (boxed toggle) for Profile sections and Standings views (icons kept on Show/Tour/Pools); shared `ChromeIconButton` for Scoring rules on Picks/Standings; Pools action pills use unified `text-xs` + `h-3.5` icon sizing.
- **Standings tour scope in chrome (#609)** — the Tour view's tour selector (`StandingsTourScopeSelect`) now lives in the dashboard chrome Tour Date slot (mobile context bar + desktop sticky row) with the same treatment as the date picker, instead of an in-flow picker above the leaderboard. Single-tour case shows a static label; the in-flow `TourPicker` remains for the pool hub standings section.
- **Tour Date scope stepper (#609)** — single-row Tour Date control with prev/next double-chevron arrows in rounded-square hit targets (`ChromeScopeStepper` + `DashboardTourDateScope`). Mobile context bar clusters title + date left and keeps a trailing portal for Standings Scoring rules (Scale); Show/Tour/Pools fills the tools band full-width. Tour scope stays a single-row select without arrows (only ~2 selectable tours today; revisit when the list regularly exceeds ~3).
- **Standings surface harmonization (#609 polish)** — content boxes share invite/sponsor geometry (`rounded-xl`, even pad) and title/body type scale; colors stay per-surface.
- **Picks mobile Scale → H2 (#609 polish)** — Scoring rules portals into the context-bar trailing slot (mirrors Standings); empty tools band omitted when no lock/saved status.
- **How pools work (#609 polish)** — in-flow solid panel below chrome (not translucent overlay); trigger font matches other tools pills.
- **Invite promo copy + shell (#609 polish)** — “Invite your crew” + text/social secondary; sponsor-matching fill/border with teal interior accents. Chooser secondary copy updated for site vs pool paths.
- **Last-show winner banner (#609 polish)** — visible only while selected show is `NEXT` (picks open); hides after lock (`LIVE`).
- **Tour Date select font (#609 polish)** — slightly smaller so more venue characters fit before clip.
- **Share-your-score secondary copy** — “Share your box score via text or social.”

### Fixed
- **Active Show venue label (#609 polish)** — Standings card uses full desktop show label (no 40-char compact truncate).
- **Waiting-for-setlist collapse (#609 polish)** — chevron flips and toggles expand/collapse (no separate Collapse control).

---

## [1.22.3] — 2026-07-16

### Fixed
- **`tour_rankings_daily` night rank tense** — first paragraph uses past tense (`were ranked`) for prior-night global rank; tour paragraph stays present tense.
- **Invite share nudge copy** — “Want to invite friends to join the community…” with Standings “invite friends” CTA guidance (service + marketing email blocks).
- **Tour rankings canary preview** — passes `inviteBlockHtml` / header / CTA into the branded shell so previews match production share cards.

---

## [1.22.2] — 2026-07-16

### Fixed
- **Invite landings blank white (#582)** — `api/invite.js` no longer serves empty crawler HTML to browsers when `dist/index.html` is missing from the function bundle. Loads SPA from disk or fetches live `/` as fallback; crawler-only stub reserved for bots when SPA is unavailable.

---

## [1.22.1] — 2026-07-16

### Changed
- **Show recap email copy (#572 follow-up)** — scorecard prose; tour lines use `ranked` / `points` / `spots`; soft invite nudge; in-app style headers (eyebrow + emoji + title) on email-channel templates.
- **Main promote** — Sprint 8 invite kit + VIP/OG/Standings Invite + email invite block + show recap narrative. Standings sticky chrome (#589/#590) excluded from this release (remains on staging for Sprint 9).
- **Standings Invite chrome** — utility row above Show/Tour/Pools: gradient-outline Invite friends + Picks-matching Scoring rules GhostPill; empty Show/Pools boards keep stronger Invite CTAs. Solid teal reserved for view pills.

---

## [1.22.0] — 2026-07-16

### Added
- **Show recap narrative (#572)** — night-of deterministic narrative for `show_recap` + morning `tour_rankings_daily` “Tonight” block. New server-written `comms_show_context/{showDate}` artifact (setlist flow, bustouts, tour debuts, `setlist_highlight`); adapters enrich scorecard fields (`correct_picks_count`, slot marks, `bustout_bonus`, `narrative_branch`). Soft-fails to prior scorecard-only copy when context is missing.

---

## [1.21.4] — 2026-07-15

### Changed
- **Picks lock time (temp)** — venue-local wall clock moves **7:30 PM → 7:55 PM** (app + Cloud Functions mirrors + reminder copy). Temporary until first-song / admin-configurable lock ships; reminder window is **T-3h through lock** (16:55–19:54 local).

---

## [1.21.3] — 2026-07-15

### Added
- **Email invite share block (#583)** — Reusable site + pool invite block in React Email (`InviteShareBlock`) and service comms HTML shell; personalized headline + tracked VIP URLs (`/invite/{handle}`, `/join/{code}?from={handle}`) with `utm_source=email`, `utm_campaign`, `utm_content`. Wired into `tour_rankings_daily` lifecycle email and Summer Tour 2026 marketing template (aligned with invite kit copy).

---

## [1.21.2] — 2026-07-15

### Added
- **Standings invite chooser (#581)** — primary **Invite** CTA on dashboard Standings opens a sheet to share a site invite (`/invite/{handle}`) or pick a pool and share `/join/{code}?from={handle}`; empty-state copy wires to the same chooser.

---

## [1.21.1] — 2026-07-15

### Added
- **Invite OG handlers (#582)** — `api/invite.js` serves personalized Open Graph tags for `/invite/:handle` (site VIP) and `/join/:code?from=` (pool inviter); crawlers resolve handle/pool via Firebase Admin; browsers get SPA shell with static OG injection (no Firestore). Rewrites in `vercel.json`.

---

## [1.21.0] — 2026-07-15

### Added
- **VIP invite landings (#580)** — `/invite/:handle` site VIP landing and `/join/:code?from=` pool landing with personalized copy when the inviter handle resolves; full-page auth CTAs (Create account primary, Sign in secondary). Site invites never write pool join storage; pool invites still store `phish_pool_pending_invite` and join after auth via `usePendingPoolJoin`.

---

## [1.20.26] — 2026-07-15

### Added
- **Invite kit (#579)** — `features/invite` public API: site/pool URL + personalized copy builders, `shareInvite` + `invite_share` telemetry; pool share hook consumes the kit (`?from=` when handle provided).

---

## [1.20.25] — 2026-07-15

### Changed
- **Official pick slots** — sixth cell is **Encore 2** (from `encoreSongs[1]`) instead of blank Wildcard; song titles wrap so long names fit.

## [1.20.24] — 2026-07-15

### Fixed
- **Standings mobile sticky nest** — Show/Tour/Pools stick flush under the Standings · Tour Date context bar (tighter top offset; Scoring rules overlays the pill row so it no longer adds a second tier).

---

## [1.20.23] — 2026-07-15

### Added
- **Standings setlist Phish.net credit** — in-card attribution + “see more show details” link to that show’s Phish.net setlist (API ToS attribution; local storage already allowed with refresh).
- **Standings sticky chrome** — desktop sticky stack: Tour Date (when Show/Pools) → Standings title + Show/Tour/Pools pills; content scrolls underneath. Mobile date stays in the fixed context bar.

---

## [1.20.22] — 2026-07-15

### Added
- **Standings live setlist card (#552)** — collapsible set-broken official setlist + six-slot official board (wildcard blank) on Standings; reuses existing `official_setlists` subscription (no extra listeners).

---

## [1.20.21] — 2026-07-15

### Fixed
- **Pool invite Create account (#577)** — `/join/:code` opens the Create account modal (legal checkbox) so new Google joiners avoid the #406 Sign-in dead end; `/?login=true` still opens Sign in; modals switch Create account ↔ Sign in. Join context is a persistent in-modal banner (not a fading toast).

---

## [1.20.20] — 2026-07-15

### Added
- **Auth QA harness (#574)** — `qa:setup`, `qa:auth-scenarios`, `qa:google-signup`, `qa:materialize-env`, and `ga4:auth-funnel` for Cloud Agent / CI investigation of Google and email sign-up failures.
- **Auth telemetry `surface`** — `login` / `sign_up` / `auth_error` emit `surface` (`sign_in` | `create_account`) so Create-account returning Google users are distinguishable from Sign-in modal logins in GA4.

---

## [1.20.19] — 2026-07-15

### Fixed
- **iOS home screen icon** — regenerate `apple-touch-icon.png` from the wordmark PWA manifest asset so Safari matches Chrome’s full wordmark icon; bump favicon cache busters.

---

## [1.20.18] — 2026-07-15

### Fixed
- **iOS Chrome A2HS copy (#539)** — stop claiming Chrome can’t install; teach Share → Add to Home Screen with Chrome steps (toolbar or ··· → Share).

---

## [1.20.17] — 2026-07-14

### Changed
- **Profile boot P0 (#496)** — single `AuthProvider` session listener; `fetchUserProfileDocument` awaits App Check; Profile form seeds from auth `userProfile` (no redundant spinner when warm).

---

## [1.20.16] — 2026-07-14

### Added
- **Email deep-link P0 (#535)** — persist intended dashboard path on unauth redirect; eager App Check on dashboard mount; picks-lock CTA includes `?showDate=`; `comms_email_landed` + `picks_page_interactive` funnel events.

---

## [1.20.15] — 2026-07-14

### Changed
- **PWA-first push disable (#532)** — Messages **Disable** is only shown in standalone/installed context; browser tabs get install/Settings copy instead. Desktop Chrome tabs follow the same rule.

---

## [1.20.14] — 2026-07-14

### Changed
- **A2HS copy by platform (#539)** — Android Chrome / desktop Chromium / iOS Safari lead copy and Safari Share-toolbar steps are shared across the dashboard banner and Profile install card; telemetry uses `android_chrome` / `desktop_chromium` / `ios_safari` / `ios_non_safari`.

---

## [1.20.13] — 2026-07-14

### Added
- **In-app picks CTA honesty (#509)** — `tour_countdown`, `picks_lock_reminder`, and `tour_engagement_reminder` switch to **View / Edit picks** when payload `picks_secured` is true; adapters enrich countdown/engagement from picks for the target show.

---

## [1.20.12] — 2026-07-14

### Fixed
- **Service email mobile typography (#536)** — branded email shell adds viewport meta and bumps body/CTA/footer sizes so Gmail iOS no longer shrinks copy into illegible text.

---

## [1.20.11] — 2026-07-14

### Fixed
- **Safari/PWA standings loading (#507)** — show-scoped standings use React Query (60s stale) so tab revisits skip the full-page spinner; LIVE listeners still apply after snapshot seed; calendar snapshot reference churn no longer restarts the fetch.

---

## [1.20.10] — 2026-07-14

### Fixed
- **Comms CTA / route honesty (#551)** — show recap inbox CTA no longer promises a “full recap” while linking only to standings; labels and destinations aligned (picks → `/dashboard/picks`, recap/score → `/dashboard/standings#self-recap`). Email CTAs and CTA click measurement (`comms_destination`) updated; audit matrix in `docs/comms-triggers/CTA_ROUTE_AUDIT.md`.

---

## [1.20.9] — 2026-07-14

### Fixed
- **Tour countdown multi-tour no-op (#514)** — `scheduledTourCountdownComms` now resolves first-show targets from `showDatesByTour` so past tours on the calendar no longer collapse every show into one pseudo-tour and skip T-10/T-5/T-3/T-1.

---

## [1.20.8] — 2026-07-14

### Fixed
- **Comms venue/location missing from email copy** — `parseShowCalendarSnapshotToShows` was dropping `venue` / `city` / tour fields and only keeping date + timezone, so tour rankings ("Next up: [date]"), lock reminders, picks confirmed, and countdown emails shipped without venue. Parser now preserves location metadata; calendar sync also stores a separate `city` field for subject lines after the next show-calendar refresh.

---

## [1.20.7] — 2026-07-11

### Fixed
- **Admin picks lock deploy gap (#522)** — `lockPicksForShowNow` is now included in `npm run deploy:functions:phishnet`; added `verify:phishnet-deploy-manifest` CI guard, ops CLI (`functions/scripts/lockPicksForShowNow.js`), and `docs/PICKS_LOCK_ADMIN_RUNBOOK.md`. War Room surfaces a clearer error when the callable is missing (`functions/internal`).

---

## [1.20.6] — 2026-07-11

### Fixed
- **Homepage Open Graph / Instagram link previews** — edge middleware serves minimal OG HTML to Meta scrapers on `/`; OG image switched to versioned JPEG (`og-card-1200x630.jpg?v=20260711`) with `og:image:type` and tags moved immediately after charset. Fixes stale Meta cache and maximizes scraper compatibility.
- **Invite link OG handler** — flattened `api/invite.js` (nested `api/invite/[code].js` never registered on Vercel). Crawler UA detection no longer matches the Instagram in-app browser.

---

## [1.20.5] — 2026-07-10

### Changed
- **Picks lock time** — venue-local wall clock moves from **7:55 PM → 7:30 PM** so most shows lock before set 1 and War Room has headroom for manual lock. Reminder window is **T-3h through lock** (16:30–19:29 local); email/in-app copy fallbacks say `7:30 PM`.

### Fixed
- **`tour_rankings_daily` rank change (#544)** — morning tour standings now compute display-rank delta vs the prior show (`up N` / `down N` / `held`) on the **overall tour leaderboard**, so recipients no longer all see "held your spot". Night-one debut, late-joiner catch-up, ties, and leader/top-5 flavor copy are included; regrades recompute from current picks.

---

## [1.20.4] — 2026-07-08

### Fixed
- **Song autocomplete ranking** — pick/admin suggestions now sort by lowest catalog gap, then most times played, and dedupe duplicate Phish.net rows so common titles like **Light** surface in the top 10 instead of being buried by alphabetical catalog order.

---

## [1.20.3] — 2026-07-08

### Fixed
- **Push test notification from hydrated "On"** — "Send test notification" no longer dead-ends with _"token was not freshly rotated in this browser session"_ when push status was restored from a persisted token (the #523 hydration path). The canary now remints the FCM token on-demand (deleteToken + getToken) and re-upserts before sending, preserving the freshly-rotated-token guarantee while removing the need to toggle push off/on first.

---

## [1.20.2] — 2026-07-08

### Fixed
- **Push notification UI hydration** — wait for App Check before reading `private_fcmTokens`, fall back to the browser's live FCM token, and re-sync Firestore when the server pruned a stale doc so Messages no longer shows false "Off" after a prior Enable (#384 follow-up).

---

## [1.20.1] — 2026-07-08

### Changed
- **`account_welcome` copy** — community-focused welcome email and in-app message (pools, tour tracking, spread the word).

### Fixed
- **Comms Functions deploy** — `npm run comms:sync` copies `comms/emailBranding.cjs` and `comms/emailLinks.cjs` into `functions/comms/` at predeploy; deploy validate checks bundled files exist; CI runs sync before functions tests.

---

## [1.20.0] — 2026-07-07

### Added
- **Admin picks lock override (#522)** — War Room **Lock picks now** button; `lockPicksForShowNow` callable writes `show_lock_state/{showDate}`; picks form honors admin lock during `NEXT`.

### Fixed
- **Functions comms bundle paths** — `commsEmailWorker` requires `./comms/*` so new Gen2 deploys (e.g. `lockPicksForShowNow`) load inside the Cloud Run `/workspace` bundle.

---

## [1.19.0] — 2026-07-07

### Added
- **`picks_lock_reminder` email + in-app** (#524) — migrate show-day lock fanout to `deliverCommsTrigger`; audience is users with a handle and no picks for tonight's show; transactional email bypasses `reminders` pref and daily cap.
- **Email CTA click tracking** — `click.setlistpickem.com` → `api/email-click` redirect with UTM params; `comms/emailLinks.cjs`; wired in `commsEmailWorker` at send time.

### Changed
- **Comms email classification** — `emailClass: transactional` on `picks_lock_reminder`; channel-aware prefs in `commsDelivery` (push/in-app still honor `reminders`); transactional emails omit marketing `List-Unsubscribe` headers.
- **Notifications UI copy** — clarify that show-day pick reminder emails are service notices, separate from the Tour & onboarding email toggle.
- **Service email shell** — wordmark is decorative (CSS background, not a link); body CTA is the only in-body link.

### Fixed
- **Service email wordmark** — bare hosted `<img>` let clients open the raw PNG on tap; header is now non-clickable.
- **Email click API route** — Vercel did not deploy nested `api/email-click/[[...path]].js`; use flat `api/email-click.js` + query rewrite so `click.setlistpickem.com` 302s correctly.

---

## [1.18.8] — 2026-07-05

### Changed
- **Dependabot re-enabled (#504)** — restore `open-pull-requests-limit` to 5/5/3 after v1.18 enablement-wave ops reset; triage per `docs/DEPENDABOT_OPERATIONS.md`.
- **Email branding (#498)** — keep large vinyl in-body logo (`web-app-manifest-512x512.png`); centralize URLs in `comms/emailBranding.cjs`; document inbox sender badge (BIMI/DMARC) separately from in-body HTML.
- **Service comms email shell** — gradient wordmark via hosted `/branding/email-gradient-wordmark.png` (marketing-email pattern; no CID/data URIs); teal CTA + top accent per `design.md`; warm sign-off; `assembleServiceEmail()` copy contract; production-fidelity preview via `--send`.
- **In-app comms CTAs** — `tour-countdown` and `tour-engagement-reminder` use contextual picks deep links instead of generic “Open the app”; document in-app vs push/email CTA rules in `TRIGGER_CATALOG.md`.

### Added
- **`comms/emailBranding.cjs`** — shared in-body email logo URL helper.
- **`comms/email-gradient-wordmark.png`** + **`public/branding/email-gradient-wordmark.{png,svg}`** — email-cropped gradient wordmark; regenerate via `npm run generate:email-wordmark`.
- **`functions/tourCountdownRecoveryDelivery.js`** + **`functions/scripts/deliverTourCountdownRecovery.js`** — manual T-1 recovery batch when cron misses (#514).
- **`docs/comms-triggers/EMAIL_INBOX_BADGE.md`** — runbook for inbox sender badge (BIMI/DMARC) vs in-body logo (#498).
- **`scripts/send-local-email-preview.mjs`** — local Resend preview helper for branded email shells.
- **`scripts/generate-email-wordmark.mjs`** — rasterize SVG wordmark for email + Functions bundle.
- **`vercel.json`** — rewrite `/favicon.ico` → `/favicon/favicon.ico` for domain-root favicon fetchers.

### Fixed
- **Tour-countdown email** — venue line dedup when city is already in venue string; `Make Your Picks` CTA to `/dashboard/picks`.

---

## [1.18.7] — 2026-07-04

### Fixed
- **Standings "Checking your picks…" spinner stuck on Safari** — derive next-show pick status from the standings picks query instead of a redundant `getDoc`; harden `useNextShowPicksStatus` against effect cancellation races (Pools / Pool Hub).

---

## [1.18.6] — 2026-07-04

### Fixed
- **Safari dashboard tab navigation** — stop remounting the lazy route tree on every `/dashboard/*` pathname change (`shellTransitionKey` in `RootAppShell`); static-import primary nav tabs (Picks, Pools, Standings, Profile) so tab switches never hit Suspense; keep Admin / Pool Hub / Account / Messages lazy with per-route boundaries and eager prefetch on dashboard mount.

---

## [1.18.5] — 2026-07-04

### Fixed
- **PR queue stabilization** — pause Dependabot (`open-pull-requests-limit: 0`) after v1.18 enablement-wave; add Vercel `ignoreCommand` to skip SPA previews for CI/functions-only dependency PRs.

### Added
- **`docs/DEPENDABOT_OPERATIONS.md`** — definitive enablement timeline, agent triage table, ops-reset procedure, re-enable checklist.

---

## [1.18.4] — 2026-07-04

### Fixed
- **Vercel build time** — drop explicit `npm ci` install command so Vercel restores its dependency cache (`up to date in 1s`) instead of reinstalling 685 packages (~2 min). `.npmrc` `legacy-peer-deps` retains the v1.18.1 peer-resolution fix.

### Changed
- **Dependabot CI** — auto-apply `skip-version-bump` label and exempt `dependabot/*` branches from the SemVer gate (dependency-only PRs do not bump `package.json`).

---

## [1.18.3] — 2026-07-04

### Fixed
- **Auth iframe headers (Vercel)** — replace unsupported negative-lookahead `X-Frame-Options` route with explicit app-route allowlist plus dedicated `/__/auth/*` and `/__/firebase/*` header blocks. v1.18.2 regex still applied `DENY` to Firebase Auth proxy paths on Vercel.

---

## [1.18.2] — 2026-07-04

### Fixed
- **Google / email sign-in regression (#412 follow-up)** — `X-Frame-Options: DENY` no longer applies to Firebase Auth proxy routes (`/__/auth/*`, `/__/firebase/*`). The catch-all header from v1.16.0 blocked Auth helper iframes on the custom `www.setlistpickem.com` domain, causing `auth/popup-closed-by-user` ("Sign-in was cancelled") and hung email sign-in.
- **Marketing `/join/:code` cold starts** — the invite OG serverless handler skips Firestore for regular browsers; only social crawlers pay the Admin lookup.

---

## [1.18.1] — 2026-07-03

### Fixed
- **Vercel install** — pin `firebase@10.14.1`, add `overrides` + `.npmrc` `legacy-peer-deps`, and `npm ci` install command so `@firebase/rules-unit-testing` peer resolution no longer fails on deploy.

---

## [1.18.0] — 2026-07-03

### Added
- **Pool read caps (#415)** — pool hub loads members via `pool.members` (capped at 100); user pool lists capped at 50 (`MAX_POOL_MEMBERS_FETCH` / `MAX_USER_POOLS_FETCH`).
- **Live grading early-exit (#416)** — `gradePicksOnSetlistWrite` skips the full picks scan when the playable scoring setlist is unchanged (metadata-only writes).

---

## [1.17.0] — 2026-07-03

### Added
- **Versioned Firestore indexes (#413)** — `firestore.indexes.json` wired in `firebase.json` (exported baseline from prod; currently no composites).
- **Dependabot + informational npm audit (#414)** — weekly npm updates for root and `functions/`, monthly Actions; CI audit step is non-blocking. Triage notes in `AGENTS.md`.

---

## [1.16.0] — 2026-07-03

### Added
- **Security headers + CSP Report-Only (#412)** — `vercel.json` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and `Content-Security-Policy-Report-Only` (Firebase, GA4, reCAPTCHA Enterprise, Google Fonts, Phish.in). Documented in `docs/SECURITY_HEADERS.md`; enforce flip is promote-day after report-only soak.

---

## [1.15.0] — 2026-07-03

### Added
- **Server `comms_delivered` → GA4 Measurement Protocol (#461)** — `functions/commsGa4Measurement.js` posts per-channel delivery events (params match client `comms_*` dimensions) from `deliverCommsTrigger` on real sends. Gated by `GA4_MEASUREMENT_ID` + `GA4_MP_API_SECRET`, prod project, and non-emulator.

---

## [1.14.0] — 2026-07-03

### Added
- **Visible pool invite code** — pool details, pool cards, and post-create success show the invite code with a one-tap **Copy** control for in-person sharing.

### Changed
- Invite share clipboard and Open Graph copy use **“Join my Setlist Pick 'Em pool”** wording (pool name included when known). Native share remains URL-only so iMessage can still fetch OG.

---

## [1.13.0] — 2026-07-03

### Added
- **Profile cluster IA (#418 Phase 1)** — nested routes under `/dashboard/profile` with sub-nav **Profile** / **Messages** / **Account**; `ProfileClusterLayout`, `AccountPage`, and `features/account` (moved account security + delete from `features/profile`). Avatar shortcut → Account; bell → Messages.
- **Legacy redirects** — `/dashboard/notifications` → `/dashboard/profile/notifications` and `/dashboard/account-security` → `/dashboard/profile/account` (query string preserved).

### Changed
- Comms/email/push deep links and unsubscribe footer targets use `/dashboard/profile/notifications`.
- Dashboard last-path restore excludes the entire Profile cluster.

---

## [1.12.0] — 2026-07-03

### Added
- **Pool standings from membership (#417)** — new pools write `standingsScope: 'from_membership'` and `memberJoinedAt.{uid}`; pool-scoped standings (hub + Standings Pools filter) count only picks that list the pool and whose `showDate` is on/after that member’s join day (`America/Los_Angeles`). Existing pools (no field) keep legacy retroactive carryover and create/join backfill.

### Changed
- `deletePoolWithCleanup` activity scan honors `from_membership` so pre-join legacy pick docs do not block delete on new-mode pools.

---

## [1.11.0] — 2026-07-03

### Added
- **Summer Tour 2026 pre-opener marketing email (#468)** — admin batch send for Sphere alum + post-Sphere signups via React Email (`emails/`), `deliverMarketingSummerTour2026Launch` callable/CLI (dry-run default, optional `onlyUids` canary), share CTA uses `/join/:code` invite OG links when the recipient has a pool. Prefs key `lifecycle`; dedup `marketing:summer_tour_2026:{uid}`.

### Fixed
- **Localhost App Check** — dev mode uses the registered debug token UUID instead of minting an unregistered random token (`true`), so Google sign-in and Firestore work on `localhost` without manual IndexedDB seeding.

---

## [1.10.2] — 2026-07-02

### Added
- **`tour_countdown` T-3 reminder (#463)** — daily 9am PT cron now fires when a tour's first show is exactly 3 days away (in addition to T-10, T-5, T-1). Summer Tour 2026 (Jul 7 kickoff) sends on Jul 4.

---

## [1.10.1] — 2026-07-02

### Fixed
- **Live-scoring and post-rollup email channel** — bind `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` on `gradePicksOnSetlistWrite`, `rollupScoresForShow`, `refreshLiveScoresForShow`, `scheduledPhishnetLiveSetlistPoll`, and `pollLiveSetlistNow` so comms event adapters can send email (inApp/push already worked; email skipped without secret injection). Closes #460.

---

## [1.10.0] — 2026-07-02

Bundled comms phase-1 release to production: rolls up staging-only increments 1.7.1–1.9.0 plus #455 email preferences UI. Main was at 1.7.0 (event adapters, gated off). `COMMS_EVENT_ADAPTERS_ENABLED` remains off until post-deploy canary (#438).

### Added
- **Resend deliverability (#442)** — `commsResendWebhook` (bounce/complaint/suppression → `email_suppression`), `commsEmailUnsubscribe` (RFC 8058 one-click), email worker suppression gate
- **Firestore** — `email_suppression/{sha256(email)}` server-only collection
- **Per-user daily email fatigue cap (#453)** — at most one discretionary email per user per `America/Los_Angeles` day, enforced transactionally via `email_cap:{uid}:{day}` inside `fcm_notification_log`. `account_welcome` is exempt. New `comms_capped` structured log event (Cloud Logging, not yet GA4 — see epic #441).
- **Branded HTML email body (#456)** — comms email sends a branded `html` part (logo, CTA button, footer with "Manage preferences"/"Unsubscribe" links) alongside plain-text fallback. Body copy renders as a single `<p>` with `<br>` line breaks (avoids Gmail content-folding quirk).
- **`bypassDailyCap` (admin-only, `runCommsTrigger`)** — skips the #453 daily cap for QA template preview runs. See `scripts/canary-comms-preview.mjs`.
- **Push notification click-through** — `firebase-messaging-sw.js` handles `notificationclick`, focusing an existing app window or opening the deep link.
- **Notifications email preferences UI (#455)** — Email accordion on `/dashboard/notifications` shows lifecycle email status, suppression reason, and unsubscribe / re-enable actions. "Tour & onboarding updates" copy now states it applies to push, in-app, and email.
- **Comms email subscription callables (#455)** — `getCommsEmailStatus`, `unsubscribeCommsEmail`, `resubscribeCommsEmail` (clients cannot read `email_suppression` directly). Self-serve resubscribe clears `one_click_unsubscribe` and `user_preferences` suppressions; hard bounces and spam complaints stay blocked.
- `functions/commsEmailUnsubscribe.test.js`, `functions/commsEmailPrefs.test.js` — unit coverage for unsubscribe and prefs callables.

### Changed
- Comms email `List-Unsubscribe` headers include signed one-click unsubscribe URLs when `RESEND_WEBHOOK_SECRET` is set
- **Comms fatigue reduction (#451)** — `show_recap` no longer emails; recap content folded into `tour_rankings_daily`'s next-morning email. `inApp`/`push` unchanged.
- Fixed stale `tour_rankings_daily` schedule description in `docs/comms-triggers/` (documented as "10:00 AM ET"; actual cron is 8:00 AM `America/Los_Angeles`)
- **Known daily-cap limitation:** first-reservation-wins per day — morning crons (`tour_rankings_daily`, `tour_countdown`) usually win over evening `tour_engagement_reminder`.
- **`forceResend` (`runCommsTrigger`)** varies the Resend `idempotencyKey` (timestamp + random suffix) in addition to bypassing dedup.
- Branded HTML body no longer repeats the plain-text "Open the app: `<url>`" line (HTML has its own CTA).
- **`commsEmailUnsubscribe` method gating (#456):** POST suppresses immediately (RFC 8058 one-click); GET renders a confirmation form (link-scanner safe); other methods return `405`.
- Branded HTML footer "Unsubscribe" link points at `/dashboard/notifications`; raw one-click URL is only in the `List-Unsubscribe` header.

### Fixed
- Executed the #453 daily-cap manual test plan: two non-exempt triggers same day → first sends, second capped with `comms_capped` logging.

---

## [1.7.0] — 2026-06-30

### Added
- **Comms v1 event adapters** — thin Firestore/scheduler hooks for all 8 planned triggers: `account_welcome`, `picks_confirmed`, `show_recap`, `tour_engagement_reminder`, `score_first_points`, `score_leader`, `tour_countdown`, `tour_rankings_daily` (issue #440, PR #448)
- **New Cloud Functions:** `commsOnUserProfileWrite`, `commsOnPickWrite`, `scheduledTourCountdownComms`, `scheduledTourRankingsDailyComms`; post-rollup and live-scoring hooks in `rollupCore.js` / `recomputeLiveScoresForShow`
- **`COMMS_EVENT_ADAPTERS_ENABLED`** runtime gate — adapters no-op unless set to `true` (default off; enable after canary)

### Changed
- Comms trigger catalog: all 8 v1 triggers marked `shipped` in `catalog.json` + `TRIGGER_CATALOG.md`

---

## [1.6.0] — 2026-06-28

### Added
- **Comms delivery substrate** — generalized `runCommsTrigger` callable, channel workers (inApp, push, Resend email), catalog resolver, and fatigue/dedup pipeline (epic #441/#442)
- **Comms frontend substrate** — multi-template inbox renderer, dev preview gallery (`/dev/comms-preview`), measurement analytics (`comms_opened`, `comms_cta`, `push_tap`, `pref_changed`)
- **`notificationPrefs` keys** — `lifecycle` and `commercial` preference toggles with UI
- **Comms automation framework docs** — TTDMOM framework, ECOSYSTEM.md, fully-automated event-driven architecture

### Changed
- `functions/index.js` — adds `runCommsTrigger` export and `RESEND_API_KEY` secret binding

---

## [1.5.0] — 2026-06-22

### Added
- **Comms squad scaffold** — TTDMOM framework, 9 trigger catalog entries, templates, Cursor squad skills (PR #428)

---

## [1.4.0] — 2026-06-22

### Added (Sprint 5 — Growth & Engagement)
- **Dynamic OG tags** for `/join/:code` invite links via Vercel Serverless Function and Firebase Admin SDK (issue #128, PR #436)
- **SEO marketing routes** `/how-it-works` and `/how-scoring-works` with JSON-LD schemas; sitemap.xml and llms.txt updated; splash footer links (issue #339, PR #434)
- **Past-tours picker** for global standings and pool hub — `TourPicker` component, `useStandingsTourSelection` URL hook, `resolveSelectableTours`/`getTourByKey` helpers with 17 unit tests (issue #295, PR #433)
- **Setlist lock toast** fires once on `NEXT→LIVE` transition (issue #120, PR #432)
- **Profile update confirmation toast** on successful `saveProfile` (issue #120, PR #432)
- **Firebase Auth email templates runbook** (`docs/FIREBASE_AUTH_EMAIL_TEMPLATES.md`) (issue #120, PR #432)
- **SW update UX** — `useServiceWorkerUpdate` hook + `UpdateAvailableBanner` wired into app shell; `SKIP_WAITING` message handler in FCM service worker; strategy decision documented (issue #383, PR #431)

### Fixed
- **Push notification UI hydration** — `usePushTokenRegistration` now reads Firestore on mount when `Notification.permission === 'granted'`, preventing false "Off" state (issue #384, PR #430)
- **Recap push copy alignment** — `sendRecapPushFanout` now uses same personalized title/body as admin preview (issue #384, PR #430)
- **Recap resend visibility** — callable now returns `pushSent`, `pushSentCount`, `pushSkipReason`; `forceResend` parameter bypasses dedup (issue #384, PR #430)

---

## [1.3.0] — 2026-05-16

### Added (Sprint 4 — Pool Lifecycle and Growth)
- Pool hub standings section with All-time / Tour toggle
- Materialized pool standings reads from `users.{uid}.seasonStats.{tourKey}`
- Tour-scoped global standings via `useTourStandings`
- Pool lifecycle management (create, join, leave flows)
- Auth telemetry for partial-profile orphan detection (PR #402)
- `createdAt` resilience + orphan repair (PR #404)
- Sign-in modal new-user block with consent enforcement (PR #406)
- Splash Google modal UX fixes (PR #410)

---

## [1.2.0] — 2026-05-02

### Added (Sprint 3 — Live-Night Foundation continued)
- Live scoring hooks: `score_first_points`, `score_leader` triggers
- Bustout boost tier table (30+ show gap bonus scoring)
- Post-show rollup recovery admin tooling
- Public player profile page (`/user/:userId`)
- Password reset complete flow (`/password-reset-complete`)

---

## [1.1.0] — 2026-04-18

### Added (Sprint 2 — Live-Night Foundation)
- Live setlist polling + real-time score updates
- Show calendar provider and tour resolution logic (`resolveCurrentTour`)
- FCM web push foundation: service worker, VAPID, token storage (issue #273)
- Push notifications feature: opt-in UI, channel prefs, profile entry (issue #274)
- Legal consent gate: Terms / Privacy acceptance at signup
- Firestore security rules for `private_fcmTokens` and `commsInbox`

---

## [1.0.0] — 2026-04-04

### Added (Sprint 1 — Architecture & UI)
- Initial production release
- Vite + React 18 SPA with Firebase Auth (email/password + Google OAuth)
- Firestore data model: `users`, `pools`, `picks`, `show_calendar`
- Global standings (`/dashboard/standings`)
- Pool hub (`/dashboard/pool/:id`)
- Pick submission UI with slot picker and song autocomplete
- Phish.net API integration via Firebase Callable (epic #42)
- Song catalog CDN delivery
- Vercel hosting with App Check, immutable asset caching
- FSD (Feature-Sliced Design) architecture enforced via ESLint import boundaries
- CI matrix: lint + vitest + dashboard-meta + dashboard-ui + Vercel preview

---

[Unreleased]: https://github.com/pat792/set-picks/compare/v1.10.0...HEAD
[1.10.0]: https://github.com/pat792/set-picks/compare/v1.7.0...v1.10.0
[1.7.0]: https://github.com/pat792/set-picks/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/pat792/set-picks/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/pat792/set-picks/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/pat792/set-picks/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/pat792/set-picks/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/pat792/set-picks/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/pat792/set-picks/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/pat792/set-picks/releases/tag/v1.0.0
