# Tour rankings and the end-of-tour recap

| Field | Value |
|--------|--------|
| **Status** | draft — internal. Not player-facing yet. |
| **Date** | 2026-10-13 |
| **Case** | Live `tour_recap` for `2026 Fall Tour` (final show 2026-10-12, Orion Amphitheater, Huntsville). Read against the in-app message the same day. |
| **Code** | `functions/tourRankingsDailyCore.js` · `src/features/scoring/model/aggregateTourStandings.js` · `functions/tourRecapCore.js` · `src/features/tour-recap/ui/TourRecapInApp.jsx` |
| **Related** | #510 · #1084 · [TOUR_RECAP_FACT_INVENTORY.md](./comms-triggers/TOUR_RECAP_FACT_INVENTORY.md) |

This note is the shared case study for two workstreams. They ship separately. Ranking decides the place. Recap comms decides the paragraph. A short player-facing page can be cut from the **Adopted rule** section after the standings screen and the recap use the same numbers. Do not publish the current screens as the rule. They disagree.

## Two workstreams

| | Tour ranking refinement | Recap comms enhancements |
|--|-------------------------|--------------------------|
| **Question** | What is official place, and which screens show it? | What does the end-of-tour message say once that place is known? |
| **Owns** | The rule below. Standings badges. Tie metadata on the rank (`tiedCount`, the other handles at that rank). | Podium labels, the personal rank sentence, the shared intro, canned podium lines, a second personal beat, spoken dates, band-fact color. |
| **Leaves alone** | Recap prose, Phish.net essays, the one-sentence opening. | The points formula, the wins definition, and the wins-then-handle list order. |
| **Done when** | A tie shares one rank on the tour standings screen and on the number the recap is given. List order inside the tie is still wins, then handle. | The Fall Tour case would name the three-way tie as one place, and the shared intro would carry the gap and the lead changes together. |

Ranking goes first only for the place labels. The intro, the canned lines, and the extra personal beat do not need the badge change and can be drafted in parallel. Podium membership and “tied for #N” wait on the rule so comms does not invent a second place system.

No scoring change is required for either stream. Points, wins, and the sort already produce the official rank and the list order. Ranking stops presenting that list order as the place. Comms stops spending the whole intro on a single fact.

Numbers below are the live Fall Tour board on 2026-10-13: graded picks on the eight tour dates, same eligibility and sort as the recap fan-out. 20 players.

## What the live message did

HotDog Billy is alone in the in-app **Third Place** line. ArmenianMan and TheManMulcahy are the two honorable mentions, labeled 4th and 5th. All three have **85 points**.

| List order | Handle | Points | Nightly wins | Shows | Official rank |
|------------|--------|--------|--------------|-------|----------------|
| 1 | I have the book | 115 | 3 | 8 | 1 |
| 2 | YarmouthMeg | 90 | 0 | 8 | 2 |
| 3 | HotDog Billy | 85 | 2 | 7 | 3 |
| 4 | ArmenianMan | 85 | 1 | 8 | 3 |
| 5 | TheManMulcahy | 85 | 1 | 7 | 3 |
| 6 | Jeff | 80 | 1 | 8 | 6 |

Billy’s two nightly wins are why he is listed before the other two. That sort is real. It is not a rule that awards him sole third.

ArmenianMan and TheManMulcahy also have the same win total. Shows played do not break that. Alphabetical handle does: ArmenianMan, then TheManMulcahy. The recap prints those as 4th and 5th.

A nightly win is a share of that night’s top score, and only when the top score is above zero. Billy’s two wins were shared: October 3 with I have the book and Jeff, October 6 with Rivertranced and TheManMulcahy.

YarmouthMeg is second with **zero** nightly wins, ahead of Billy’s two wins. Points decide the rank. Wins only order people who already have the same points.

## Three rankings, one board

| Surface | What “3rd” means on this board |
|---------|--------------------------------|
| Morning standings copy and `assignDisplayRanks` | Competition rank on points. All three are tied for #3. Jeff is #6. |
| Recap personal sentence | Same competition rank. “You finished #3 of 20…” for Billy, ArmenianMan, and TheManMulcahy. The sentence does not say they are tied. |
| Tour standings screen | Badge is the row number after sorting by points, then wins, then handle. Billy is 3, ArmenianMan is 4, TheManMulcahy is 5. |
| In-app podium | Same row numbers, with place names. Billy is Third Place. The other two are honorable mentions. |
| Email top-5 grid | Five people, competition rank on points. The grid already prints rank 3 on all three rows. Jeff (official #6) is past the five-person cutoff. |

The personal sentence and the podium the reader sees under it use different place systems. **View tour standings** then shows the row-number badges, so the next screen agrees with the podium labels and disagrees with “you finished #3” for everyone in a tie who is not the first name in that tie. TelaTuby is the same kind of miss one step down: 70 points, tied with Adam for official #7, badge 8 on the standings list.

## Written rules that exist today

There is no player-facing tiebreak page.

What the code comments say:

- Sort is points descending, then nightly wins descending, then handle A–Z. `aggregateTourStandings.js` calls the handle step a placeholder for issue #73 §3.5. That helper never landed. Handle order is what shipped.
- `assignDisplayRanks` is competition rank on **points only**. Ties share a rank. The next rank skips. Morning copy uses this and can say “tied for #3.”
- The wrap contract names one special case: if someone is level with 5th on points, that last honorable mention names them all. See `content/comms/tours/tour-recap.md` and `buildTourRecapPodium`. The grouping runs **after** the wins sort, and only looks past the fifth person. A tie for third is already split into “Third Place,” “4th,” and “5th” before that rule runs, so the rule does not fire. On this board the fifth person is TheManMulcahy at 85, and the next player, Jeff, has 80.

So the recap did what the current contract says. The contract does not say what to do when the tie is for first, second, or third. The standings screen does not use the competition rank the morning email uses.

## Adopted rule (proposal)

**Official tour rank** is competition rank on total points.

- Same points, same rank.
- The next rank is one more than the number of players with more points.
- On this board: #1, #2, #3, #3, #3, #6.

**List order inside a tie** is nightly wins, then handle A–Z. That order chooses who is printed first on a tied line. It does not create a new rank. Shows played do not order a tie. There is no head-to-head rule.

**A nightly win** is sharing that night’s highest graded score when that score is greater than zero. Ties at the top of a night each get the win.

Speak a tie out loud whenever more than one player has the rank. “Tied for #3” is the place. “2 nightly wins” is a stat on that line, in the same way points and shows are.

A future prize that needs one recipient is a separate prize order, labeled as such. This tour does not need it. First place is alone at 115.

Until the standings badge, the recap podium, and the personal sentence all use this rank, leave the player-facing page unwritten. Publishing today’s podium would freeze the contradiction.

## How comms should apply it

Podium membership follows official rank, not the first three rows of the sorted list.

For this tour the top of the recap would read:

- Tour winner: I have the book (115 pts, 3 nightly wins)
- Runner-up: YarmouthMeg (90 pts, 0 nightly wins)
- Tied for third: HotDog Billy (2 nightly wins, 7 shows), ArmenianMan (1 nightly win, 8 shows), TheManMulcahy (1 nightly win, 7 shows)

Honorable mentions are the next rank groups, and a tied rank is one line that names everyone. The current “only expand 5th” rule becomes “every published place names the whole tie.”

The email grid’s rank column already shares a number inside a points tie. Keep that. Decide the cutoff as “ranks 1 through 5,” and when a tie makes that more than five people, name the extra people. On this tour the top five ranks are still these five people, because Jeff is #6. The bug the reader hit is the in-app place labels, plus the standings badges behind the CTA.

Personal sentence, same rank, with the tie spoken:

> You finished tied for #3 of 20 with HotDog Billy and TheManMulcahy, with 85 points and 1 nightly win, playing 8 of 8 shows.

Wins stay in the sentence as a stat. They are not introduced as the reason someone else is “really” third.

## Critique of the Fall Tour in-app recap

The shell is right: shared tape, then a personal result, then standings. The facts it chose are thin, and two canned lines overclaim.

### The race was knowable, and the opening spent its one sentence on the gap

The shared middle sentence keeps the first fact that exists, and drops the rest. This tour had a played bustout with a gap, so the lead story and the closing stand were never going to appear.

What that one sentence can say, and what it hid:

- Spoken: Alumni Blues, a 158-show gap, opening night at Jim Whelan Boardwalk Hall. That is the rarest bustout whose title is in that night’s official setlist. The stored “The Curtain” gap of 197 stays out because that title is not in the official setlist. Keep that refusal.
- Hidden: the lead changed hands five times.
  - October 2: Ross
  - October 3: HotDog Billy, Jeff, and YarmouthMeg, tied
  - October 4: Jeff and Ross
  - October 6: Jeff
  - October 7: HotDog Billy and Jeff, through October 9
  - October 11: I have the book, held through the Huntsville close
- Hidden: Orion Amphitheater closed the run after 8 shows.

The winner’s own personal sentence also misses the lead. They caught Twenty Years Later, a 36-show gap, on October 11 — the same night they took the lead. A rare hit outranks a lead change, so the personal line says the song and does not say they took the lead. Billy, Jeff, and YarmouthMeg were in at least one lead change and caught no gapped bustout, so their personal line can say a single lead date. ArmenianMan and TheManMulcahy never held the lead and caught no gapped bustout, so their personal line has no race sentence at all. A reader who wanted the story of the tour will not find it in the shared intro.

The gap line is a good first beat. It is not a tour recap. The intro should be a short paragraph that can hold more than one true fact.

### Canned podium prose

Two lines are hardcoded in `TourRecapInApp.jsx` for every tour:

- “Taking down {wins} nightly wins … is a dominant performance.”
- “The race for the top was incredibly tight down the stretch.”

On this board the winner’s margin is 25 points, and they took the lead on night 7 of 8. The race was volatile, then it opened up. “Incredibly tight down the stretch” describes a different finish. “Dominant” is a mood, not a fact. YarmouthMeg in second with no nightly wins is the sharper shared fact, and the message does not say it.

### Personalization

The personal block is a stack of true sentences: rank, best night, caught songs, shows sat out, then one extra sentence. That is the right honesty bar. It reads like a box score. The rank line also sounds exclusive (“you finished #3”) on a three-way tie.

Useful additions that are already true, still without invented color:

- Say the tie, and name the other players at that rank.
- Let the rare-hit sentence and the lead sentence both survive, capped at two personal beats. October 11 for the winner is both a 36-gap catch and the night they took the lead.
- Keep shows sat out and best night. They are already the right kind of fact.

Storage dates (`2026-10-11`) are still what this template prints. Other morning copy on staging already speaks a short date and a venue. This wrap should too.

### A tighter shared intro, from facts we already store

Not sent. This is the shape, using only the Fall Tour facts above plus `public_tour_stats` (109 different songs, 131 song plays).

> 2026 Fall Tour is officially in the books.
>
> Eight shows, twenty players, 109 different songs. The rarest hit of the run was Alumni Blues, a 158-show gap, on opening night at Boardwalk Hall. The lead changed hands five times. I have the book took it on October 11 and held it through the close at Orion Amphitheater in Huntsville.
>
> Before the next run, here is the final tape.

Second place with no nightly wins fits the podium, not this paragraph: “Runner-up: YarmouthMeg, 90 points, no nightly wins.”

Alumni Blues can take one more stored band fact when we want fan texture without a new source: last played July 12, 2023, debut year 1985, 113 lifetime plays (`public_tour_stats` bustout row). That stays a clause on the gap sentence. Phish.net is already the cited source for those catalog fields.

## Phish.net recaps and show notes

A model should not write the wrap, and it should not paraphrase a Phish.net essay into one. The fact shelf is the gate: a sentence may speak a fact only when we store it and it is true.

Already stored, and unused or barely used in this wrap:

- Gap, last played, debut year, lifetime plays on the tour bustout table
- Unique songs and total song plays
- Lead-change count and the nights the lead set changed
- Closing venue
- Points margin, and a runner-up with no nightly wins

Not stored: Phish.net show recaps, jam charts, and editorial show notes. Show-note pages are still a gated product. Adding them means a new inventory row first: where the text lives, who wrote it, the source URL, and the attribution line. Then one slot on the wrap map. The practical version is a human-approved sentence or two per tour, written from those sources, reviewed like any other comms draft. A scraped recap paragraph in the live send is the wrong layer.

## Workstream 1 — Tour ranking refinement

1. Accept the rule in this doc. Point the standings description at it when the badge matches.
2. Standings badges use competition rank and mark a tie. List order inside the tie stays wins, then handle.
3. Hand comms a rank payload that already includes `tiedCount` and the other handles at that rank. The recap does not re-derive place from row order.

## Workstream 2 — Recap comms enhancements

Depends on workstream 1 for place labels only.

1. Podium and honorable mentions group by the official rank. Retire sole “Third Place” inside a tie. Generalize the 5th-place naming rule to every place.
2. Personal sentence says “tied for #N with …” when `tiedCount` is greater than 1.
3. Replace the one-slot opening and the two canned podium lines with a short multi-fact intro. Gap, lead changes, and the close can all be present. Drop a clause when its fact is missing.
4. Allow the rare-hit beat and the lead beat in the same personal paragraph, still capped.
5. Speak a short date and the venue. Fold last-played / debut year into the gap clause from `public_tour_stats`.
6. Leave Phish.net recap essays and show notes out until a sourced, human-approved fact is on the inventory. That slice stays inside this workstream. It does not reopen the rank rule.
