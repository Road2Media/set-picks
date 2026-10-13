# Tour wrap fact inventory

**Status:** implemented
**Date:** 2026-10-08
**Issues:** [#1084](https://github.com/pat792/set-picks/issues/1084) · parent [#1081](https://github.com/pat792/set-picks/issues/1081)
**Code:** `functions/tourRecapCore.js` `buildTourRecapPayload` · `src/features/tour-recap/model/tourRecap.js`

Message map for the end-of-tour wrap. The shelf of facts is [COMMS_FACT_INVENTORY.md](./COMMS_FACT_INVENTORY.md). This file says which of those facts the wrap may speak.

Night `show_recap` stays a different paragraph. Do not paste the nightly setlist line into this wrap. A sentence may speak a fact only when it is true for this player or this tour. Missing facts drop out. No model writes the wrap.

## What the wrap says

The rank band is still `champion`, `top5`, `top10`, `full_run`, `partial`, or `fallback`. That id is stored. It does not choose a flavor sentence.

The shared opening keeps “{Tour} is officially in the books.” and “Before the next run, here is the final tape.” The middle sentence is the first fact below that exists. A fixture of that copy is [TOUR_RECAP_SAMPLE.md](./TOUR_RECAP_SAMPLE.md). Nothing in that file was sent.

The 2026 Fall Tour send is the case study for ties and for this one-sentence opening: [TOUR_RANKINGS.md](../TOUR_RANKINGS.md). That note is a draft. It does not change this map until the rank rule is accepted.

## Facts this wrap may speak

| Fact | Where | Sentence |
|------|-------|----------|
| Rank and field size | Wrap payload | Stated as the rank paragraph |
| Points, nightly wins, shows played out of the tour length | Wrap payload | Stated as facts |
| Best night | Their scores on this tour | Date and score, when a night scored above zero |
| Bustouts they caught | Their picks plus that night’s played setlist | Named when they caught one. A title counts only when it was in that night’s official setlist. |
| Shows they sat out | Tour length minus shows played | Named only when both counts are known and the count is greater than zero |
| Rarest hit of the run | Played bustouts and gaps | Shared opening, first choice |
| How often the tour lead changed hands | Nightly standings, counted at send time | Shared opening, second choice |
| Closing venue after N shows | Calendar | Shared opening, third choice |
| A rare hit they picked | Their picks, the song, the gap, the night | Personal sentence, first choice |
| A lead change that involved them | Nightly standings | Personal sentence, second choice |
| A new personal mark already on the account | Highest tour points, or most nightly wins, already stored on another tour | Personal sentence, third choice |

The song-picker last-played date stays unused. The nightly set-flow paragraph stays unused.

## Shared opening

Keep the headline and “{Tour} is officially in the books.” Replace the “inexact science” sentence with the first fact that exists:

1. Rarest hit of the run — song and gap.
2. How often the lead changed hands.
3. The last venue after N shows.

If none exist, keep today’s sentence. “Before the next run, here is the final tape.” stays.

## One personal sentence

Keep the rank paragraph. Add one sentence after it. First fact that is true:

1. A rare hit they picked — song, gap, and the night.
2. A lead change that involved them — they took the lead, or lost it, on a named night.
3. A new personal mark the account already stores.

If none exist, the rank paragraph stands alone.

The new sentence is in the in-app note. Email carries at most one clause of it. Push stays the short rank tease.

## Slot ids

[#1082](https://github.com/pat792/set-picks/issues/1082) stores these ids when the sentence actually spoke the slot. At most one shared-opening id. At most one personal id.

| Id | Slot |
|----|------|
| `rank`, `points`, `nightly_wins`, `shows_played` | Facts already on the payload |
| `best_night`, `bustouts_caught`, `shows_sat_out` | Added when the fact exists |
| `rarest_hit`, `lead_changes`, `closing_stand`, `opening_fallback` | Shared opening, first one that exists. `opening_fallback` is today’s sentence. |
| `rare_hit_picked`, `lead_change_involved`, `personal_mark` | Personal sentence, first one that is true |

The rank-band id stays `champion`, `top5`, `top10`, `full_run`, `partial`, or `fallback`. The band’s flavor sentence is not an id.

## Out of scope

- A model writing what the tour felt like
- The nightly show paragraph ([#1083](https://github.com/pat792/set-picks/issues/1083))
- The morning email’s standings paragraph (“you climbed,” “next up”)
- Cleaning stored bustout titles that are not in the played set ([#626](https://github.com/pat792/set-picks/issues/626)). This wrap still refuses to say one.
