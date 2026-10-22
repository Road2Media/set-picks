# Tour recap — reusable end-of-tour template

| Field | Value |
|--------|--------|
| **Status** | live runtime. Copy follows the tour-wrap fact map (#1084, #1136). |
| **Date** | 2026-10-22 |
| **Trigger** | `tour_recap` (#510) |
| **Template ID** | `tour-recap` |
| **Implementation** | `src/features/tour-recap/model/tourRecap.js` |
| **In-app UI** | `src/features/tour-recap/ui/TourRecapInApp.jsx` |
| **Server render** | `functions/commsTemplates.js` (`tour-recap`) |
| **Edition flavor** | Per-tour Markdown under `content/comms/tours/<edition>.md` + send-time payload. Do not hardcode a live tour (including Sphere) in the catalog. |

Night `show_recap` is a different trigger. This file is the reusable tour wrap-up contract.

---

## Headline

{{tour_name}}: Setlist Pick'em Wrap-Up

---

## Opening (shared)

{{tour_name}} is officially in the books.

When any of the rarest hit, the lead-change count, or the closing venue exists, the middle paragraph can include all of them. A missing fact drops its clause. Speak a short date (`MM/DD/YY`) and the venue. The job does not read `docs/TOUR_RANKINGS.md`.

1. Scale: show count, player count, and unique songs from `public_tour_stats` when that count is known.
2. The rarest hit of the run: song, gap, short date, venue. Opening night when that date is the tour’s first known show. Last played and debut year from `public_tour_stats` fold into this clause. Lifetime plays stay off. A title counts only when that exact title was in that night’s official setlist.
3. How often the tour lead changed hands. When the last change is a full takeover, name who took it, the short date, and the closing venue.
4. The last venue after N shows, when the takeover sentence did not already name it.

If none of the rarest hit, the lead count, or the closing venue exist, keep: “Calling setlists is an inexact science on a good day, and a {{show_count}}-show run kept everyone honest. Despite the curveballs, {{participantCount}} of you stepped up to lay down your picks.” Do not add the scale sentence alone.

Before the next run, here is the final tape.

---

## The Podium

Computed from tour standings at send time. Published places are official ranks 1 through 5. Each rank is one place. A tie names everyone at that rank, in list order (nightly wins, then handle). Rank 6 and later stay off the board.

Labels: Tour Winner / Tied for first, Runner-up / Tied for second, Third Place / Tied for third, then 4th / Tied for 4th (and the same pattern for 5th). A new send skips “a dominant performance” and “incredibly tight down the stretch.” A stored message with no `podium.places` keeps those older lines. Do not ship a static live-tour snapshot in the catalog.

---

## Your final result (personalized)

The rank band (`champion`, `top5`, `top10`, `full_run`, `partial`, `fallback`) is still stored on the send. It does not choose a flavor sentence.

When `tiedCount` is greater than 1: You finished tied for #{{rank}} of {{participantCount}} with {{tiedHandles}}, with {{points}} points and {{wins}} nightly wins, playing {{showsPlayed}} of {{showCount}} shows.

Otherwise: You finished #{{rank}} of {{participantCount}} with {{points}} points and {{wins}} nightly wins, playing {{showsPlayed}} of {{showCount}} shows.

When the fact exists, add:

- Your best night was {{date}} with {{score}} points.
- You caught {{songs}}. Skip a song already named in a personal beat below.
- You sat out {{count}} shows. Say this only when the count is greater than zero.

Then at most two beats, in this order:

1. You caught {{song}} — a {{gap}} show gap — on {{date}} at {{venue}}. Last played and debut year stay off this beat when the shared opening already named that song.
2. You took the lead on {{date}}. Or: You lost the lead on {{date}}.
3. This is your highest tour point total. Or: This is the most nightly wins you've had on a tour. Only when another tour on the account is already lower. A one-tour account does not get this sentence.

If none of those are true, the rank paragraph stands alone. Box-score sentences are not part of the two-beat cap.

---

## Email

Congrats to the tour winner by handle. When first place is a tie, name every winner. Then the grid of official ranks 1 through 5 (Rank, Handle, Pts, Wins, Nights, Avg). A tie can make that grid longer than five rows. Then the personal beats above (both, when both exist). Primary CTA **View Recap** → `/dashboard/profile/notifications` (Messages inbox). The rank paragraph, best night, caught songs, and shows sat out stay in-app.

---

## Push

Title: `Tour recap is in`  
Body: sole #1 says they took #1. A tie says “tied for #N.” Everyone else gets the rank tease. Deep link is Messages.

---

## In-app CTA

After reading the recap body: **View tour standings** → `/dashboard/standings?view=tour`.

---

## Sphere ’26

Historical edition only: `content/comms/tours/sphere-2026-inaugural.md` + War Room replay callable. Not the live catalog template.
