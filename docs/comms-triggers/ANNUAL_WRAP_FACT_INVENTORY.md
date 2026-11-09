# Annual wrap fact inventory

**Status:** implemented
**Date:** 2026-11-09
**Issues:** [#1111](https://github.com/Road2Media/set-picks/issues/1111) · parent [#1109](https://github.com/Road2Media/set-picks/issues/1109) · year board [#1110](https://github.com/Road2Media/set-picks/issues/1110)
**Code:** `functions/annualWrapCore.js` `assembleAnnualWrapRecipients` · `functions/annualWrapDelivery.js`

Message map for the end-of-year note. The shelf of facts is [COMMS_FACT_INVENTORY.md](./COMMS_FACT_INVENTORY.md). This file says which of those facts the wrap may speak.

Night `show_recap` and the tour wrap stay different notes. Do not paste the nightly setlist line into this wrap. A sentence may speak a fact only when it is true for this player or this year. Missing facts drop out. No model writes the wrap.

A fixture is [ANNUAL_WRAP_SAMPLE.md](./ANNUAL_WRAP_SAMPLE.md). Nothing in that file was sent. The job does not read that page.

## What the wrap says

The rank band is still `champion`, `top5`, `top10`, `full_run`, `partial`, or `fallback`. That id is stored. It does not choose a flavor sentence.

The shared opening keeps “{Year} is officially in the books.” and “Before the next year, here is the final tape.”

The shared summary everyone gets is the year crowd-pulse block, then the first true race fact:

1. The rarest song played all year.
2. Otherwise, how often the annual lead changed hands.
3. Otherwise, the closing show.

A missing fact drops its clause. Crowd pulse is not a stand-in for the race fact, and the race fact is not a stand-in for crowd pulse.

The personal section stays about that player. More than one sentence is fine when each sentence is a true box-score fact or a true beat. A thin set of facts stays short.

## Facts this wrap may speak

| Fact | Where | Sentence |
|------|-------|----------|
| Rank and field size | Year board, same rules as tour standings | Rank paragraph |
| Points, nightly wins, shows played out of the year length | Year board | Rank paragraph |
| Best night | Their scores that year | Date and score, when a night scored above zero |
| Bustouts they caught | Their picks plus that night’s played setlist | Named when they caught one that is not already the rare-hit beat. A title counts only when it was in that night’s official setlist. |
| Shows they sat out | Year length minus shows played | Named only when both counts are known and the count is greater than zero |
| Most picked | `buildYearCrowdPulse` at send time | Shared summary. Songs the room named on at least 2 cards, up to 3. |
| Highest hit rate | Same count | Shared summary. A hit means the exact title was in that night’s official setlist. Spoken only for songs named on at least 10 cards. |
| Lowest hit rate | Same count | Shared summary. Same floor. Omitted when the only qualifying song would be both the highest and the lowest. |
| Other room rates | Same count | Shared summary. How many different songs the room named. The share of calls that were in the setlist, only when the year has at least 10 calls. |
| Rarest song played all year | Played bustouts, gaps, and `public_tour_stats/_year_YYYY` last played / debut year | Shared opening, first race fact. Short date and venue. |
| How often the annual lead changed hands | Nightly year standings, counted at send time | Shared opening, only when the rarest song is missing. |
| Closing show after N shows | Calendar | Shared opening, only when the rarest song and the lead count are both missing. |
| A rare song they picked | Their picks, the song, the gap, the night, the venue | Personal beat. Last played and debut year stay off when the shared opening already named that song. |
| A lead change that involved them | Nightly year standings | Personal beat. |
| A new personal mark against an earlier year | A prior year total passed into the send | Personal beat. The send does not scan earlier years, so this sentence stays out until that total is supplied. |

The nightly set-flow paragraph stays unused. Phish.net recap essays stay out. The word “chair” stays out. A slot, when a later sentence needs one, is a slot.

## Crowd pulse

Counted at send time from graded cards and official setlists for that calendar year. A card names a song once. A night with no official setlist is left out. The same paragraph is copied onto every payload (`crowd_summary`). It is in the in-app opening and in the email. Push stays the rank tease.

A rate is hits divided by cards. Ten cards is the floor. A smaller number is not called a rate.

## Personal section

Keep the rank paragraph. When `tiedCount` is greater than 1, that sentence says “tied for #N with …” and names the other handles.

Then every true box-score sentence: best night, other bustouts, shows sat out.

Then every true beat, in this order. There is no cap of two. A missing beat drops out.

1. A rare song they picked.
2. They took the lead, or lost it, on a named night.
3. A higher year point total, or more nightly wins, than an earlier year already supplied.

## Podium

Published places are official ranks 1 through 5. Each rank is one place. A tie names everyone. Sole first place is Annual Winner. Runner-up, Third Place, then 4th and 5th. A points tie with 5th is that last place, and it names everyone at the rank.

`email_board` is Rank, Handle, Pts, Wins, Nights, Avg. Avg is blank. Correct slots are stored per tour, not per calendar year, so the send does not invent a year average.

## Slot ids

[#1082](https://github.com/Road2Media/set-picks/issues/1082) stores these ids when the sentence actually spoke the slot.

| Id | Slot |
|----|------|
| `rank`, `points`, `nightly_wins`, `shows_played` | Rank paragraph |
| `best_night`, `bustouts_caught`, `shows_sat_out` | Box score |
| `crowd_most_picked`, `crowd_highest_hit_rate`, `crowd_lowest_hit_rate`, `crowd_room_rates` | Shared crowd pulse |
| `rarest_hit`, `lead_changes`, `closing_stand` | The one race fact that was spoken |
| `opening_fallback` | The “inexact science” sentence, and only when all three race facts are missing |
| `rare_hit_picked`, `lead_change_involved`, `personal_mark` | Personal beats that were spoken |

## Out of scope

- The year-end celebration on the annual board ([#1112](https://github.com/Road2Media/set-picks/issues/1112)). It is not a sentence in this wrap.
- A model writing what the year felt like
- The nightly show paragraph
- The morning email’s standings paragraph
- A pool-scoped year board
