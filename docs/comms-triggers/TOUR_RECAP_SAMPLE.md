# Tour wrap sample

**Status:** fixture. Nothing was sent.
**Date:** 2026-10-22
**Issue:** [#1084](https://github.com/pat792/set-picks/issues/1084) · [#1136](https://github.com/pat792/set-picks/issues/1136)
**Map:** [TOUR_RECAP_FACT_INVENTORY.md](./TOUR_RECAP_FACT_INVENTORY.md)

This is a three-night fixture, not a live tour. The nightly job does not read this page.

The stored bustout list includes “The Curtain.” That title is not in the official setlist (the played song is “The Curtain With”), so the wrap does not say it. The played bustout is Tweezer, a 200 show gap.

## Shared opening

Sample Tour is officially in the books.

3 shows and 3 players. The rarest hit of the run was Tweezer, a 200 show gap, on opening night, 07/01/26. The tour lead changed hands once. Bea took it on 07/02/26 and held it through the close.

Before the next run, here is the final tape.

The gap, the lead change, and the close can share that paragraph. This fixture has no closing venue on the takeover, so the close clause stops at “through the close.” When `public_tour_stats` has the bustout row, the gap clause also says last played and debut year. The job does not copy this page into a send.

## Ada — caught the rare hit and lost the lead

In-app:

You finished #2 of 3 with 50 points and 1 nightly win, playing 3 of 3 shows. Your best night was 07/01/26 with 30 points. You caught Ghost. You caught Tweezer — a 200 show gap — on 07/01/26. You lost the lead on 07/02/26.

Both personal beats fit under the cap of two. The points mark on this account is the third beat, so it drops. The in-app board is one place per official rank. A three-way tie is one place, not Third Place plus two honorable mentions.

Email:

A huge congrats to our tour winner, {the sole first-place handle}. A tied first place names every winner.

Then every player whose official rank is 1 through 5: Rank, Handle, Pts, Wins, Nights, Avg.

Then both beats: “You caught Tweezer — a 200 show gap — on 07/01/26. You lost the lead on 07/02/26.” Tweezer is not also listed as a caught bustout. Ghost still is. The full recap stays in the app. Push stays the rank tease, and says “tied for #N” when that player is tied.

## Bea — took the lead, caught no rare hit

You finished #1 of 3 with 100 points and 2 nightly wins, playing 3 of 3 shows. Your best night was 07/03/26 with 50 points. You took the lead on 07/02/26.

Email adds: “You took the lead on 07/02/26.” Sole #1 push still says “You took #1.”

## Cy — sat one out, and a mark already on the account

You finished #3 of 3 with 5 points and 0 nightly wins, playing 2 of 3 shows. Your best night was 07/01/26 with 5 points. You sat out 1 show. This is your highest tour point total.

Cy played two of the three nights. Another tour on the account has a lower point total, so the personal beat is that mark. A player whose only stored tour is this one does not get that sentence. Cy has no rare-hit beat and no lead beat, so the mark is inside the cap.

## When those facts are missing

If no played bustout has a gap and the lead changed once into Last Room, the middle paragraph is the scale sentence, “The tour lead changed hands once,” and “Bea took it on 07/02/26 and held it through the close at Last Room.” If the lead count cannot be computed and the calendar has a last venue, it is the scale sentence plus “Last Room closed the run after 3 shows.” If none of the rarest hit, the lead count, or the closing venue exist, the middle sentence stays “Calling setlists is an inexact science…” and the scale sentence stays out.
