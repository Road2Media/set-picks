# Finished-tour wrap on `/tour-stats`

**Status:** Implemented (v1.88.0). Tie copy and compact card updated for #1193 (v1.98.1). EiC pass 2026-11-07.  
**Date:** 2026-10-22. Updated 2026-11-07.  
**Issue:** [#1140](https://github.com/Road2Media/set-picks/issues/1140), [#1193](https://github.com/Road2Media/set-picks/issues/1193)  
**Parent:** [#1137](https://github.com/Road2Media/set-picks/issues/1137)  
**Related:** [#974](https://github.com/Road2Media/set-picks/issues/974) share links, [#1136](https://github.com/Road2Media/set-picks/issues/1136) tour-wrap comms (separate surface), [#1192](https://github.com/Road2Media/set-picks/issues/1192) MSG stays off the switcher

## What it is

A closed tour stops reading like a live dashboard. Under the H1, `/tour-stats/{slug}` shows a short wrap built from the `public_tour_stats` doc already on the page. Fall, summer, and Sphere use the same block. An open tour (setlists still short of the itinerary, or the last show is today in Pacific time) keeps the live lede.

## Copy

| Line | Source |
|------|--------|
| Lede, finished | Phish tour setlist statistics for a finished run: most-played songs, song frequency, bustouts by tour, and gap highlights. |
| Headline | `{tour label} is in the books.` |
| Counts | `{shows} shows, {unique} unique songs, {songs played} songs played.` Same three numbers as the tiles. |
| Most played | Rank 1 is the stored first frequency row. One title when nothing else shares that night count, with the play count in parentheses only when it is higher. A tie: `N songs played on two nights, including A, B, C` (top 3 by all-time plays). See the #1193 section. |
| Bustouts | Full bustout count, then the longest gap title. |
| Bustout Boost | `Bustout Boost adds 20 points when you call a song after a gap of 30 or more shows.` Link: How scoring works. |
| Winner | Only when `tourWinners.handles` is on the doc. One handle, or "tied at N points" when several public handles share rank 1. |
| Credit | Song and setlist data provided by Phish.net. |

No nightly setlist. No uid.

## Share

The button shares the slug URL with `utm_source=share&utm_medium=social&utm_campaign=seo_geo&utm_content=tour-wrap`. The build writes `/tour-stats-share/{slug}.jpg` (1200×630) and the finished slug's `og:image` points at it. That JPEG is the link preview. Instagram feed posts stay on the five Canva layouts in `social-brand-approach.md`. Do not invent a sixth frame.

## Winner field

`refreshPublicTourStats` stamps `tourWinners` after a functions deploy and a refresh. Until that runs, the winner line is absent and the song wrap still renders.

## #1193 card and tie copy

**Status:** EiC pass, 2026-11-07. Draft for Patrick to confirm the nights-versus-plays line at staging review. Not a comms template. The sentences live in `finishedTourWrap.js` and render on the card, in prerender HTML, in the share text, and on the share image.

### Design

The card matches the link preview: a Tour wrap label, the headline, four big counts (shows, unique songs, songs played, bustouts), then most played and the longest gap. On a phone the counts are a 2×2 grid. From the `sm` breakpoint they sit in one row. Share stays on the card. Scoring, the winner, and the Phish.net credit are behind a closed More control, so a finished tour does not fill the first screen. Those lines stay in the DOM and in the prerender HTML.

The tour filter moves above the wrap and stays a dropdown. Choosing a tour opens `/tour-stats/{slug}`, which is the link you can share. A Stats link on that row jumps to the dates bar. On a small screen the finished-tour lede is hidden, because the wrap headline already says the run is in the books. Phish at MSG is not in the dropdown.

Colors for the card and the SVG live in `tourWrapTokens.js`.

### Nights versus plays (proposal)

Default is nights, which is how the frequency list ranks a tour. Plays are the extra only when a song was played more than once in a night.

Shipped wording:

- No tie: `Most played: Tweezer, 4 nights (5 plays).`
- Tie, 2026 Fall Tour (22 songs at 2 nights; Possum, Mike's Song, and Chalk Dust Torture lead all-time plays; Tweezer was played 5 times): `Most played: 22 songs played on two nights, including Possum, Mike's Song, Chalk Dust Torture. Tweezer was played 5 times across those two nights.`

Night counts from one through nine are words (`two nights`). The song count stays a digit. The including list has no "and" before the last title, matching the decision on Oct 24. Only the song with the most extra plays is named. Tweezer is that song on Fall Tour and is not one of the three all-time names.

Not shipped, if Patrick wants a different cut:

- Rank the tie by plays instead of nights. Tweezer's 5 plays would stand alone and the 22-song tie would disappear.
- Digits for the night count (`2 nights` instead of `two nights`).
- Put `(5 plays)` on Tweezer inside the including list, ahead of its all-time rank.

### Before / after (2026 Fall Tour)

Before: `Most played: Possum, 2 nights.`

After: `Most played: 22 songs played on two nights, including Possum, Mike's Song, Chalk Dust Torture. Tweezer was played 5 times across those two nights.`
