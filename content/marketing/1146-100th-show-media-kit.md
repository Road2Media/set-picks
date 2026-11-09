# Media kit: Phish's 100th show at MSG (#1146)

**Status:** Draft. Needs owner approval before any send. Nothing here has been sent.
**Date:** 2026-11-09
**Issue:** [#1146](https://github.com/Road2Media/set-picks/issues/1146) · Parent [#1137](https://github.com/Road2Media/set-picks/issues/1137)
**Tracker (per-target links and templates):** [`1146-100th-show-outreach-tracker.md`](./1146-100th-show-outreach-tracker.md)
**Contact:** support@setlistpickem.com

Do not send this kit until production serves the three routes below. On 2026-11-09 those URLs still returned the homepage shell. The legacy Garden page at `/tour-stats/msg` is live and will redirect to `/phish-at-msg` once this branch is on production.

Links in this kit use `utm_source=manual` (playbook §6) so a click from the kit is measurable. A published placement must use that target's links in the tracker, not these.

## What the game is

Setlist Pick'Em is a free Phish prediction game, with more bands later. Before the show, a player locks six slots: set 1 opener, set 1 closer, set 2 opener, set 2 closer, encore, and a wildcard. The slot you called scores more than the same song in a different slot. A song back after a 30+ show gap can add a Bustout Boost.

How it works: https://www.setlistpickem.com/how-it-works?utm_source=manual&utm_medium=referral&utm_campaign=seo_geo&utm_content=how-it-works

How scoring works (the ladder in effect for the 100th, which is after December 30, 2026): https://www.setlistpickem.com/how-scoring-works?utm_source=manual&utm_medium=referral&utm_campaign=seo_geo&utm_content=how-scoring-works

## The 100th

January 2, 2027 is the 100th Phish performance at Madison Square Garden. The run is December 30, December 31, January 1, and January 2. The public page lists those four dates and links onward. It does not list a night's setlist.

Run page: https://www.setlistpickem.com/tour-stats/2026-2027-nye-run?utm_source=manual&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

Pool: the button on that page says "Create a NYE pool" and opens a form with the name NYE Run. There is no public join code in this kit.

https://www.setlistpickem.com/dashboard/pools/create?name=NYE+Run&utm_source=manual&utm_medium=referral&utm_campaign=seo_geo&utm_content=predict-100th

## MSG stats highlights

Re-read the live page before a send. Figures below are the committed snapshot in the repo (`msgGardenSnapshot.json`, `checkedOn` 2026-10-22) plus the fixed intro on `/phish-at-msg`. Data courtesy of Phish.net / The Mockingbird Foundation. Aggregates only.

- Phish has played Madison Square Garden 96 times, from December 30, 1994 through July 29, 2026.
- July 29, 2026 was the 96th performance at MSG, the last night of a 5-show run.
- This New Year's run is 4 nights and ends with the 100th performance on January 2, 2027.
- 372 different songs in that snapshot.
- Tweezer is the most-played title in that snapshot, 33 times.
- New Year's Eve at the Garden: 17 times in that snapshot.

Page: https://www.setlistpickem.com/phish-at-msg?utm_source=manual&utm_medium=referral&utm_campaign=seo_geo&utm_content=phish-at-msg

Cite: https://phish.net/venue/157/Madison_Square_Garden.html (verified 2026-11-09). That Phish.net URL is not UTM-tagged. We do not put our campaign parameters on their domain.

## Embed

A fan page can frame our standings card. It shows the tour leader and their points when that field exists, and a link card with no numbers otherwise. It does not show song titles, gaps, bustouts, play counts, or venue counts.

Prose link: https://www.setlistpickem.com/embed/stats?utm_source=manual&utm_medium=referral&utm_campaign=seo_geo&utm_content=embed-stats

```html
<iframe src="https://www.setlistpickem.com/embed/stats" title="Setlist Pick 'Em standings" width="360" height="240" style="border:0;max-width:100%" loading="lazy"></iframe>
```

The credit link inside the frame is `https://www.setlistpickem.com/?utm_source=embed&utm_campaign=seo_geo`. Leave that credit as a normal link.

## Screenshots

The setlist card (six slots) is already in the repo:

![Setlist card with six empty slots and Lock In Picks](../../public/images/marketing/picks-setlist-card-iphone-sample.png)

![Song search on one slot, with Total, Gap, and Last played](../../public/images/marketing/picks-song-search-iphone-sample.png)

Still placeholders. Do not send the kit until these three are real production captures:

1. `/phish-at-msg`, above the fold. Placeholder.
2. `/embed/stats`, the standings card or the link card. Placeholder.
3. `/tour-stats/2026-2027-nye-run`, including the "Create a NYE pool" button. Placeholder.

## What we are not offering

No paid link, no sponsored read, no ad-sales package. No full night setlist. The embed is not a Phish.net data widget.
