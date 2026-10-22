# Finished-tour wrap on `/tour-stats`

**Status:** Implemented (v1.88.0)  
**Date:** 2026-10-22  
**Issue:** [#1140](https://github.com/Road2Media/set-picks/issues/1140)  
**Parent:** [#1137](https://github.com/Road2Media/set-picks/issues/1137)  
**Related:** [#974](https://github.com/Road2Media/set-picks/issues/974) share links, [#1136](https://github.com/Road2Media/set-picks/issues/1136) tour-wrap comms (separate surface)

## What it is

A closed tour stops reading like a live dashboard. Under the H1, `/tour-stats/{slug}` shows a short wrap built from the `public_tour_stats` doc already on the page. Fall, summer, and Sphere use the same block. An open tour (setlists still short of the itinerary, or the last show is today in Pacific time) keeps the live lede.

## Copy

| Line | Source |
|------|--------|
| Lede, finished | Phish tour setlist statistics for a finished run: most-played songs, song frequency, bustouts by tour, and gap highlights. |
| Headline | `{tour label} is in the books.` |
| Counts | `{shows} shows, {unique} unique songs, {songs played} songs played.` Same three numbers as the tiles. |
| Most played | The first stored frequency row (the list's #1), nights, and the play count in parentheses only when it is higher. |
| Bustouts | Full bustout count, then the longest gap title. |
| Bustout Boost | `Bustout Boost adds 20 points when you call a song after a gap of 30 or more shows.` Link: How scoring works. |
| Winner | Only when `tourWinners.handles` is on the doc. One handle, or "tied at N points" when several public handles share rank 1. |
| Credit | Song and setlist data provided by Phish.net. |

No nightly setlist. No uid.

## Share

The button shares the slug URL with `utm_source=share&utm_medium=social&utm_campaign=seo_geo&utm_content=tour-wrap`. The build writes `/tour-stats-share/{slug}.jpg` (1200×630) and the finished slug's `og:image` points at it. That JPEG is the link preview. Instagram feed posts stay on the five Canva layouts in `social-brand-approach.md`. Do not invent a sixth frame.

## Winner field

`refreshPublicTourStats` stamps `tourWinners` after a functions deploy and a refresh. Until that runs, the winner line is absent and the song wrap still renders.
