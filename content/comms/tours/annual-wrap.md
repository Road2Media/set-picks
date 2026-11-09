# Annual wrap — end of the calendar year

| Field | Value |
|--------|--------|
| **Status** | live runtime. Copy follows the annual-wrap fact map (#1111). |
| **Date** | 2026-11-09 |
| **Trigger** | `annual_wrap` (#1111) |
| **Template ID** | `annual-wrap` |
| **Implementation** | `functions/annualWrapCore.js` (sentences) · `src/features/tour-recap/model/annualWrap.js` (template id and year-board link) |
| **In-app UI** | `src/features/tour-recap/ui/TourRecapInApp.jsx` with the annual eyebrow and year-board link |
| **Server render** | `functions/commsTemplates.js` (`annual-wrap`) |

Night `show_recap` and `tour_recap` are different triggers. This file is the year note.

A sample fixture is `docs/comms-triggers/ANNUAL_WRAP_SAMPLE.md`. Nothing in that file is sent. The job does not read it.

---

## Headline

{{year}}: Setlist Pick'em Wrap-Up

---

## Opening (shared)

{{year}} is officially in the books.

The crowd-pulse paragraph is the same in every in-app note and every email. It names the songs the room called most, then the highest and lowest hit rates among songs called at least 10 times, then how many different songs the room named and how many of those calls were in the setlist. A hit means the song was in the setlist. A smaller sample is not called a rate. A missing clause drops out.

Then the first true race fact:

1. The rarest song played all year: song, gap, short date, venue. Opening night when that date is the year’s first known show. Last played and debut year from `public_tour_stats/_year_YYYY` fold into this clause. A title counts only when that exact title was in that night’s official setlist.
2. Otherwise, how often the annual lead changed hands, and who held it into the close when that last change was a full takeover.
3. Otherwise, the last venue after N shows.

If none of those exist: “Calling setlists is an inexact science on a good day, and a {{show_count}}-show year kept everyone honest. Despite the curveballs, {{participantCount}} of you stepped up to lay down your picks.”

Before the next year, here is the final tape.

---

## The Podium

Computed from the year board at send time. The board is the standings year view: calendar dates on or after game launch, points, nightly wins, and shows played. Published places are official ranks 1 through 5. A tie names everyone.

Labels: Annual Winner / Tied for first, Runner-up / Tied for second, Third Place / Tied for third, then 4th / Tied for 4th, and the same for 5th.

---

## Your year (personalized)

The rank band is stored. It does not choose a flavor sentence.

When `tiedCount` is greater than 1: You finished tied for #{{rank}} of {{participantCount}} with {{tiedHandles}}, with {{points}} points and {{wins}} nightly wins, playing {{showsPlayed}} of {{showCount}} shows.

Otherwise: You finished #{{rank}} of {{participantCount}} with {{points}} points and {{wins}} nightly wins, playing {{showsPlayed}} of {{showCount}} shows.

When the fact exists, add the best night, the bustouts they caught (skip a song already named in the rare-song beat), and the shows they sat out.

Then every true beat: the rare song they picked, the night they took or lost the lead, and a higher year total than an earlier year when that earlier total was supplied. A thin year stays the rank paragraph.

---

## Email

Congrats to the annual winner by handle. When first place is a tie, name every winner. Then the shared opening, including the crowd-pulse block. Then the grid of official ranks 1 through 5 (Rank, Handle, Pts, Wins, Nights, Avg). Avg is blank. Then the personal section. Primary CTA **View Recap** → `/dashboard/profile/notifications`.

---

## Push

Title: `Annual wrap is in`
Body: sole #1 says they took #1. A tie says “tied for #N.” Everyone else gets the rank tease. The crowd paragraph stays off the push. Deep link is Messages.

---

## In-app CTA

After the recap: **View year standings** → `/dashboard/standings?view=year&year={{year}}`.
