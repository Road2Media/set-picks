# `comms_show_context` schema (#572)

Night-of show narrative artifact for `show_recap` and the “Tonight” section of
`tour_rankings_daily`. Written **only** by Cloud Functions (Admin SDK). Clients
have no read/write access (`firestore.rules`).

Standalone collection (same rationale as `rollup_audit`): do not nest on
`official_setlists/{showDate}` or metadata writes will re-fire live scoring.

## Document path

`comms_show_context/{showDate}` where `{showDate}` is `YYYY-MM-DD`.

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `showDate` | string | Same as doc id |
| `tourKey` | string \| null | From `show_calendar.showDatesByTour` |
| `opener_title` | string \| null | Slot / set1 first |
| `encore_title` | string \| null | Slot / encore first |
| `bustout_titles` | string[] | Bustout titles that are also in that night’s official setlist |
| `bustout_entries` | `{ title, gap }[]` | Those bustouts, with Phish.net pre-show gap when rows available |
| `tour_debut_titles` | string[] | Tonight titles not seen earlier this tour |
| `tour_debuts_trusted` | boolean | False on the first show of a tour, when the debut list is just the set |
| `set_songs` | map | `{ set1, set2, encore }` title lists |
| `song_gaps` | map | Pre-show gap by normalized title |
| `last_played` | map | `title → YYYY-MM-DD` from `public_tour_stats` for this night. Refreshed on each ensure |
| `lifetime_plays` | map | `title → number` from the song catalog `total` for songs in that night. Refreshed on each ensure. A missing count drops the crowd-favorite name |
| `set_flow_summary` | string \| null | One sentence per set: length, highlight, encore titles |
| `setlist_highlight` | string \| null | One-liner for push / Tonight. Bustouts: `Bustout: Song - a/an N show gap.` or `Bustouts: A - …; B - ….` (#780) |
| `show_moment_tags` | string[] | e.g. `bustout`, `tour_debut`, `multi_encore` |
| `set_counts` | map | `{ set1, set2, encore }` lengths |
| `schemaVersion` | number | `3` (was `2`; bump forces rebuild via `ensureCommsShowContext`) |
| `updatedAt` | timestamp | Server write time |

## Write hooks

1. After Phish.net live setlist persist (`phishnetLiveSetlistAutomation.pollSingleShowDate`) when the setlist changes
2. Safety net in `deliverPostRollupComms` / `runScheduledTourRankingsDaily` via `ensureCommsShowContext`

## Consumers

- `functions/commsEventAdapters.js` → `showLevelPayloadFields` + `buildShowRecapEnrichment`
- Templates: `show-recap`, `tour-rankings-daily` (`setlist_highlight` / `narrative_line`)
- Composer: `functions/showRecapNarrativeCore.js` weaves `set_flow_summary` + card + night rank into `narrative_line` (#985)
- Public projection (#684): `functions/publicShowNotes.js` writes `public_show_notes/{showDate}` from this doc. Clients still cannot read `comms_show_context`. The public doc keeps the opener, the encore, a bustout or a short trusted tour-debut list, and set lengths. It does not copy `set_songs`, gap maps, or any player field. Nights that fail that gate are not published.

## Related

- [`OFFICIAL_SETLISTS_SCHEMA.md`](./OFFICIAL_SETLISTS_SCHEMA.md)
- [`docs/comms-triggers/TRIGGER_CATALOG.md`](./comms-triggers/TRIGGER_CATALOG.md) § `show_recap`

## Tour debut priors

`tour_debut_titles` compares tonight’s `officialSetlist` to **all** prior dates on the
same tour from `show_calendar.showDatesByTour` (exclusive of tonight). Do **not**
truncate to a trailing window — a 12-show lookback caused Dick’s 2026-09-04 to
report `4 songs new to this tour — including Plasma.` even though Plasma played
2026-07-10.
