# Fan-facing show dates

**Status:** shipped on staging in 1.81.3–1.81.6
**Date:** 2026-10-09
**Epic:** #1120
**Shipped:** #1121 in 1.81.3, #1122 in 1.81.4, #1123 in 1.81.5, #1124 in 1.81.6. Production is still 1.81.2 until the next promote.

Storage stays `YYYY-MM-DD`. That value is what Firestore, lock checks, dedup keys, and `?showDate=` links use. Fan-facing copy and labels do not print it.

## Decision

| Context | Display | Example |
| --- | --- | --- |
| Last-night sentence | Venue and city. No date. | here's how last night at Allianz Amphitheater at Riverfront, Richmond, VA went. |
| Email preheader | `MM/DD/YY · {venue}, {city}` | `10/07/26 · Allianz Amphitheater at Riverfront, Richmond, VA` |
| Email and in-app eyebrow for the morning recap | `MM/DD/YY · Tour standings` | `10/07/26 · Tour standings` |
| Compact show label | `MM/DD/YY — {city}` | `10/07/26 — Richmond` |
| Next show, return to the same room, last played | `MM/DD/YY` | `Next up: 10/09/26 — VyStar Veterans Memorial Arena, Jacksonville, FL.` |
| This-tour table column | Month and day only. Year comes from the tour. | `10/07` |
| Prior-play table column | `MM/DD/YY` | `07/10/26` |
| Spelled date that already reads as a sentence | Keep it | `Wed, Oct 7, 2026` (pool archive) |
| Storage, URLs, admin fields | `YYYY-MM-DD` | `2026-10-07` |

`MM/DD/YY` is zero-padded slashes and a two-digit year. `2026-10-07` → `10/07/26`.

## Why this shape

Three options were on the table for the morning sentence.

1. Cut the date and leave the venue. This is the sentence. "Last night" already places the show. The venue is what people scan for.
2. Put the longer date-and-venue string in the preheader. Do this as well. Service mail has no preheader, so the inbox snippets the first sentence, which is why `2026-10-07 — …` shows up there. A preheader is hidden after open, so the eyebrow keeps a visible date on the opened card. The venue stays in the sentence once (#584).
3. Shorten the date and leave it in the sentence. Use the short form on labels and on lines that are not "last night" (next show, last played). Do not paste it back into the last-night sentence. The venue is the long part, so `10/07/26 — Allianz Amphitheater at Riverfront, Richmond, VA` is still a label inside speech.

Phish.net puts the date in a badge (`WEDNESDAY` / `10/07/2026`) and the venue in its own block. The setlist prose does not repeat the date. We use a two-digit year because the full year is what makes the storage string feel wrong, and the badge is a label, not a headline.

Tour stats already shortened dates for column width, with hyphens (`10-07`, `07-10-26`) in `src/features/tour-stats/ui/TourStatsView.jsx`. Those hyphens were a fit choice. Slashes are the fan-facing form. #1123 switches the columns to slashes if they still fit. If a slash wraps, the hyphens stay and this doc records the exception.

The song-picker column already uses slashes without a zero (`7/19/24`) in `src/features/crowd-picks/model/formatCatalogLastShort.js`. #1123 zero-pads it.

## Morning mail, before and after

Now:

> Rivertranced, here's how last night at 2026-10-07 — Allianz Amphitheater at Riverfront, Richmond, VA went.

After:

> Rivertranced, here's how last night at Allianz Amphitheater at Riverfront, Richmond, VA went.

Preheader:

> 10/07/26 · Allianz Amphitheater at Riverfront, Richmond, VA

Also in that same mail:

- `Next up: 2026-10-09 — …` → `Next up: 10/09/26 — …`
- `Back at MSG 2026-07-20.` → `Back at MSG 07/20/26.`
- `last played on 2026-07-10` → `last played on 07/10/26`

Subject stays "Your show recap + tour standings". Push stays the rank tease.

In-app has no preheader. Same sentence. Same eyebrow.

## Where the string is built

The join `` `${date} — ${place}` `` is copied in:

- `functions/commsTemplates.js` `venueLine()`, used by the lead `` here's how last night at ${venue} went. ``
- `functions/tourRankingsDailyCore.js`
- `src/features/notifications/model/tourRankingsDailyCopy.js`
- `src/features/notifications/ui/commsTemplates/commsTemplateRegistry.jsx`

"Last played on {date}" is composed at send time in `functions/commsShowContextCore.js` `highlightClause()`, from a stored `YYYY-MM-DD`. The morning adapter recomposes `narrative_line` on the run, so the deployed composer is what the mail says. Format at speech time. Do not rewrite stored facts.

App chrome prints `show.date` through `src/shared/utils/showOptionLabel.js` (tour date select, standings header, pool hub, picks scorecard, share text). `<option value>` stays the storage date.

## Helper

One function, two runtimes (functions cannot import the web ESM module):

- CJS in `functions/`
- `formatFanShowDate` in `src/shared/utils/dateUtils.js`

Both lock `2026-10-07` → `10/07/26`. Invalid input returns the original string. Do not add a fourth parser.

## Sequence

These four landed on staging the same day as the decision.

1. #1121 — morning recap email and the matching in-app paragraphs. Shipped in 1.81.3.
2. #1122 — show labels in the app. Shipped in 1.81.4.
3. #1123 — catalog last-played and tour stats column glyphs. Shipped in 1.81.5.
4. #1124 — night-of show recap, picks confirmed, tour countdown, and the lock-reminder in-app line. Shipped in 1.81.6. Night-of copy does not say "last night".

## Out of scope

Admin war-room date fields. Push copy that is already venue-only or rank-only. Pool archive spelled dates.
