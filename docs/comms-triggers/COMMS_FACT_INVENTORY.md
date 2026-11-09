# Communications fact inventory

**Status:** draft
**Date:** 2026-10-08
**Parent:** [#1081](https://github.com/pat792/set-picks/issues/1081)

Living shelf of facts the app already knows. A message may speak a fact only when it is true for that night, that player, or that tour. Missing facts drop out. No model writes the sentence.

This file answers “what can we say?” A message map answers “what does this communication say?” The night paragraph map is [SHOW_RECAP_FACT_INVENTORY.md](./SHOW_RECAP_FACT_INVENTORY.md) ([#1083](https://github.com/pat792/set-picks/issues/1083)). The tour wrap map is [TOUR_RECAP_FACT_INVENTORY.md](./TOUR_RECAP_FACT_INVENTORY.md) ([#1084](https://github.com/pat792/set-picks/issues/1084)). The annual wrap map is [ANNUAL_WRAP_FACT_INVENTORY.md](./ANNUAL_WRAP_FACT_INVENTORY.md) ([#1111](https://github.com/pat792/set-picks/issues/1111)). Add a fact here before a message starts saying it. The morning standings paragraph has its own map: [STANDINGS_FACT_INVENTORY.md](./STANDINGS_FACT_INVENTORY.md) ([#1102](https://github.com/pat792/set-picks/issues/1102)).

## Categories

| Category | What it is | Same for everyone that night? |
|----------|------------|-------------------------------|
| Show | That concert: songs, sets, venue | Yes |
| Stat — personal | This player’s results and history | No |
| Stat — global | The pick’em field | Yes |
| Stat — band | Phish (the act): catalog and tour-history about the songs | Yes |
| Game | How players moved against each other, and what the room picked | Mixed |

**Band** means the musical act. Today that is Phish. Catalog fields come from Phish.net (`song-catalog.json`: lifetime plays, debut, last played). Tour tables are `public_tour_stats`. These facts are the same in every player’s message that night.

A player’s place in a rank band (leading, top 5) or a pool is a personal or game fact, not a band fact.

**Game** means the contest: lead changes, points between players, and crowd pulse. A tour rank number is a personal stat. “You passed two people” is a game fact about that same number.

## Show

| Fact | Where | Said in a message today |
|------|-------|-------------------------|
| Venue, city, show date | `show_calendar` on the send | Greeting and titles |
| Next show date and venue | Calendar | Morning recap, tour countdown, lock reminder |
| Songs in set 1, set 2, and the encore | `official_setlists` | Set 1 opener and the first encore title, inside the night paragraph |
| Song count per set | `comms_show_context.set_counts` | Set 1 count in parentheses. Set 2 count alone. |
| Gap for every song that night (show count) | `official_setlists.songGaps` | Only gaps of 30 or more, as the bustout sticker |
| Bustout title and gap | Night context `bustout_entries`, copied from `official_setlists.bustouts` | One sticker in the night paragraph. Say it only when that title is still in the official setlist. A renamed song can leave the old title on this list ([#1083](https://github.com/pat792/set-picks/issues/1083)). |
| Last time a bustout or high-gap song was played, before that night | Band table `lastPlayed` on that night’s row. See **Stat — band**. | Not said. The night map’s highlight slot will use it. |
| Tour debut titles | `tour_debut_titles` | Not in the night paragraph. On the first show of a tour this list is just the songs played, up to eight. Do not call those debuts. |
| Pre-written set-flow sentence | `set_flow_summary` | The current night arc. It is a sentence, not a raw fact. The night map replaces it. |

## Stat — personal

| Fact | Where | Said in a message today |
|------|-------|-------------------------|
| Night score | The send | Night paragraph and the leftover scorecard |
| Slots that hit, including a song that was only somewhere in the show | `calculateSlotScore` exact vs in the setlist | “You hit {slot}” for both. The night map will separate them. |
| Bustout this player caught or missed, and the slot | Picks plus bustout list | “You caught a bustout” or “stayed off your board” |
| Tour rank, tour points, shows played, tied | Morning payload | The standings paragraph of the morning email |
| Night rank and pool rank | The send | Night paragraph |
| Rank band: lead, top 5, or the field | Today’s tour rank, and yesterday’s rank recovered from the spot count | The morning standings paragraph. The standings map says entered, stayed, left, took the lead, or lost it. |
| Tied with others at that rank | `tour_rank_tied`, `tour_tied_count` | “Tied for #3” |
| Pool name, pool rank that night, pool rank on tour, pool size | Pool fields on the send | Night rank can name the pool. Tour pool rank is on the morning payload. |
| Career points, shows graded, average points per show, correct slots over a career | Profile / `users` career fields | Not in recap messages. On the profile. |

## Stat — global

| Fact | Where | Said in a message today |
|------|-------|-------------------------|
| How many people played that night | `global_total_pickers` | “#4 of 200” |
| How many people are on the tour board | `total_tour_pickers` | Tour standing |
| Who led the room, and their score | `top_scorer_handle`, `top_score` | The in-app card. Not the night paragraph. |

## Stat — band

Phish’s own numbers. A night sentence uses these when it names a song. They are not player scores.

| Fact | Where | Said in a message today |
|------|-------|-------------------------|
| Lifetime plays for a song | Song catalog `total` → tour-table `lifetimePlays` | Tour stats pages (“All Time”). Not in recap messages. |
| Year the song debuted | Song catalog `debut` → tour-table `debutYear` | Tour stats pages. Profile “avg vintage” is a personal average of these years. |
| Last time a bustout or high-gap song was played, before that night | `public_tour_stats` bustout and high-gap rows, `lastPlayed`. Rebuilt 7:30am Eastern, before the 8:00am Pacific recap. | Not said. The night map’s highlight slot will use it. |
| Song-picker last-played date | Song catalog `last_played` | Do not use after the show. It can already be last night. Use the tour-table date above. |
| Times played on this tour, and last tour date | `public_tour_stats` most-played rows `timesPlayed`, `lastPlayed` | Tour stats pages. Not in recap messages. |
| Unique songs and total song plays this tour | `public_tour_stats` `uniqueSongs`, `totalSongPlays`, `tourShowCount` | Tour stats pages. Not in recap messages. |
| Tour-long bustout list and high-gap list | `public_tour_stats` | Tour stats pages. The wrap map may use bustouts this player caught. |

## Game

| Fact | Where | Said in a message today |
|------|-------|-------------------------|
| Moved, held, or slipped since the previous show | `rank_change` (`up N`, `down N`, `held`) | Morning standings paragraph. Stays out of the night paragraph. |
| How often the tour lead changed hands | Nightly standings, not stored as one number | Not said. The wrap map may say it. |
| Points between this player and the night’s winner | This score vs `top_score` | Not said. This is not the “song was in the wrong slot” fact. |
| Lead margin while a show is in progress | `score_leader` payload `lead_margin` | The “you’re in first” note, during the show |
| Crowd pulse: share of cards that named a song, top songs the room picked, how many different songs the room picked | Computed from that night’s picks (`crowdNightCardSummary`). Shown on Standings. | Not said in any message. Speak only after picks lock. A lock reminder goes out before lock and does not get these. |
| Year rank, year points, nightly wins, shows played | The year board. Same rules as tour standings, scoped to that calendar year’s shows on or after game launch (`assembleAnnualWrapRecipients`). | Annual wrap rank paragraph. |
| Year crowd pulse: most picked | Counted at annual-wrap send (`buildYearCrowdPulse` in `functions/annualWrapCore.js`). Graded cards plus that night’s official setlist. A card names a song once. A night with no official setlist is left out. | Shared summary. Songs named on at least 2 cards, up to 3. The same paragraph is on every copy. |
| Year crowd pulse: highest and lowest hit rate | Same count. A hit means that exact title is in the official setlist. The rate is hits divided by cards. | Shared summary, only for songs named on at least 10 cards. One qualifying song is not both the highest and the lowest. |
| Year crowd pulse: other room rates | Same count. How many different songs the room named, and how many calls were in the setlist. | Shared summary. The share is spoken only when the year has at least 10 calls. |
| Rarest song played that year | Played bustouts across the year’s official setlists, longest gap. Last played and debut year from `public_tour_stats/_year_YYYY` when that row exists. | Annual wrap shared opening, when it exists. |
| How often the annual lead changed hands | Nightly year standings, counted at send time. | Annual wrap shared opening, only when the rarest song is missing. |
| Closing show of the year | Last calendar show of that year on the calendar. | Annual wrap shared opening, only when the rarest song and the lead count are both missing. |

## Under consideration

These are not facts yet. A message must not say them until a row in the tables above names where the number lives.

Year crowd pulse for [#1111](https://github.com/pat792/set-picks/issues/1111) is no longer in this list. The rows above name where those year numbers live. The personal section of the annual wrap stays about that player.

## How to add a fact

1. Add one row in the category above in the same change that teaches the app the fact. Name where it lives.
2. Leave “Said in a message today” blank when no message says it yet. A new field does not change a message map by itself.
3. When a message should say it, add the slot to that message’s map. Do not put the sentence in this file.
4. If the fact is missing for a night, the sentence drops that clause. It does not invent a number.

## Changing the mix

The shelf holds every fact. The message map decides the mix: which of those facts that communication speaks, and which stay unused.

Wanting more game facts and fewer setlist stats is an edit to that message’s map. Turn those slots on or off. One approved map is what everyone receives.

A side-by-side test is a second map on a variant, not a second shelf. The rules are in [EXPERIMENT_PLAYBOOK.md](./EXPERIMENT_PLAYBOOK.md): one experiment per family, `comms_variant` on the send, and the slot ids from [#1082](https://github.com/pat792/set-picks/issues/1082) so an open can be joined to which facts the message spoke. A human approves the wording before a variant sends. This shelf does not run the test.

## Seeing the copy before it sends

A backtest is not that live test. It replays one night that already happened, speaks two maps from the facts stored for that night, and writes both paragraphs down. Nothing is emailed.

The product leader reads that page before a map change ships. The page names the show, the two maps, and at least two real players so a quiet board and a busy board are both visible. [SHOW_RECAP_SAMPLE_2026-10-07.md](./SHOW_RECAP_SAMPLE_2026-10-07.md) is that page for the night map: what the morning email said, next to the proposed paragraph.

`npm run comms:show-recap-qa` checks the writer that is already live. It does not apply a second map. There is not yet a command that takes a date and two maps and writes the page. Until that command exists, the page is produced by hand the same way the Richmond sample was, and a copy change does not ship without it.

The nightly job does not read this page. Once a map is in the writer that is deployed, that job fills the slots from stored facts and sends. A missing fact drops its clause. It does not wait for a sample, a label review, or a person.
