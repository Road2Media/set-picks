# Tour wrap fact inventory

**Status:** implemented
**Date:** 2026-10-22
**Issues:** [#1084](https://github.com/pat792/set-picks/issues/1084) · [#1136](https://github.com/pat792/set-picks/issues/1136) · parent [#1081](https://github.com/pat792/set-picks/issues/1081) · epic [#1109](https://github.com/pat792/set-picks/issues/1109)
**Code:** `functions/tourRecapCore.js` `buildTourRecapPayload` · `src/features/tour-recap/model/tourRecap.js`

Message map for the end-of-tour wrap. The shelf of facts is [COMMS_FACT_INVENTORY.md](./COMMS_FACT_INVENTORY.md). This file says which of those facts the wrap may speak.

Night `show_recap` stays a different paragraph. Do not paste the nightly setlist line into this wrap. A sentence may speak a fact only when it is true for this player or this tour. Missing facts drop out. No model writes the wrap.

## What the wrap says

The rank band is still `champion`, `top5`, `top10`, `full_run`, `partial`, or `fallback`. That id is stored. It does not choose a flavor sentence.

The shared opening keeps “{Tour} is officially in the books.” and “Before the next run, here is the final tape.” When the rarest hit, the lead-change count, or the closing venue exists, the middle paragraph can include all of them. A missing fact drops its clause. A fixture of that copy is [TOUR_RECAP_SAMPLE.md](./TOUR_RECAP_SAMPLE.md). Nothing in that file was sent. The job does not read that page or [TOUR_RANKINGS.md](../TOUR_RANKINGS.md).

The 2026 Fall Tour send is the case study in [TOUR_RANKINGS.md](../TOUR_RANKINGS.md). That message already shipped and keeps the older podium. This map is what the next wrap says (#1136). Do not resend Fall Tour.

## Facts this wrap may speak

| Fact | Where | Sentence |
|------|-------|----------|
| Rank and field size | Wrap payload | Stated as the rank paragraph |
| Points, nightly wins, shows played out of the tour length | Wrap payload | Stated as facts |
| Best night | Their scores on this tour | Date and score, when a night scored above zero |
| Bustouts they caught | Their picks plus that night’s played setlist | Named when they caught one. A title counts only when it was in that night’s official setlist. |
| Shows they sat out | Tour length minus shows played | Named only when both counts are known and the count is greater than zero |
| Field size and unique songs | Tour length, leaderboard count, `public_tour_stats.uniqueSongs` | Shared opening, only when another opening fact exists |
| Rarest hit of the run | Played bustouts, gaps, and `public_tour_stats` last played / debut year | Shared opening. Short date and venue. Lifetime plays stay off. |
| How often the tour lead changed hands | Nightly standings, counted at send time | Shared opening, including who took the lead into the close |
| Closing venue after N shows | Calendar | Shared opening. Skipped as its own sentence when the takeover line already names the venue. |
| A rare hit they picked | Their picks, the song, the gap, the night, the venue | Personal beat, first choice. Catalog tail stays off when the shared opening already named that song. |
| A lead change that involved them | Nightly standings | Personal beat, second choice |
| A new personal mark already on the account | Highest tour points, or most nightly wins, already stored on another tour | Personal beat, third choice |

The nightly set-flow paragraph stays unused. Phish.net recap essays and show notes stay out.

## Shared opening

Keep the headline and “{Tour} is officially in the books.” When any of the facts below exist, the middle paragraph can include every one that is true:

1. Scale: shows, players, and unique songs.
2. Rarest hit of the run: song, gap, short date, venue, last played, debut year.
3. How often the lead changed hands, and who held it into the close.
4. The last venue after N shows, unless the takeover sentence already named it.

If none of the rarest hit, the lead count, or the closing venue exist, keep the “inexact science” sentence and do not add the scale sentence alone. “Before the next run, here is the final tape.” stays.

## Personal beats

Keep the rank paragraph. When `tiedCount` is greater than 1, that sentence says “tied for #N with …” and names the other handles.

Add at most two beats after the box score. Box-score sentences (best night, other bustouts, shows sat out) are not part of the cap. Priority:

1. A rare hit they picked: song, gap, short date, and venue.
2. A lead change that involved them: they took the lead, or lost it, on a named night.
3. A new personal mark the account already stores.

If none exist, the rank paragraph stands alone.

Email carries the chosen beats. Push stays the short rank tease and says “tied for #N” when the player is tied.

## Podium

Published places are official ranks 1 through 5. Each rank is one place. A tie names everyone. `podium.places` is what a new in-app board reads. `rows` and `honorableMentions` stay so a stored message without `places` still renders.

## Slot ids

[#1082](https://github.com/pat792/set-picks/issues/1082) stores these ids when the sentence actually spoke the slot. Several shared-opening ids can be stored together. At most two personal ids.

| Id | Slot |
|----|------|
| `rank`, `points`, `nightly_wins`, `shows_played` | Facts already on the payload |
| `best_night`, `bustouts_caught`, `shows_sat_out` | Added when the fact exists |
| `tour_scale`, `rarest_hit`, `lead_changes`, `closing_stand` | Shared opening. Each id is stored when that clause is spoken. |
| `opening_fallback` | The “inexact science” sentence, and only when the three race facts are all missing. |
| `rare_hit_picked`, `lead_change_involved`, `personal_mark` | Personal beats, up to two, in this order |

The rank-band id stays `champion`, `top5`, `top10`, `full_run`, `partial`, or `fallback`. The band’s flavor sentence is not an id.

## Out of scope

- A model writing what the tour felt like
- The nightly show paragraph ([#1083](https://github.com/pat792/set-picks/issues/1083))
- The morning email’s standings paragraph (“you climbed,” “next up”)
- Cleaning stored bustout titles that are not in the played set ([#626](https://github.com/pat792/set-picks/issues/626)). This wrap still refuses to say one.
