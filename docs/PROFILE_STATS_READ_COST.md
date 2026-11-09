# Profile season stats: read-cost observability (#220)

`useUserSeasonStats` live-computes every visit to `/user/:userId`. This doc
is the engineering + product reference for how many Firestore reads each
view costs today, how we measure it, and at what point we should promote
the `users.totalPoints / users.wins / users.shows` materialization
follow-up.

## What gets computed per view

Every run of `computeUserSeasonStats(uid, showDates)` (see
`src/features/profile/api/profileSeasonStats.js`) executes two passes:

1. **Per-user point-reads.** `|showDates|` calls to
   `getDoc(picks/{showDate}_{uid})` to discover the graded, non-empty picks
   the viewed user actually submitted. Chunked at 24 parallel reads.
2. **Global-max collection queries.** For each show the user played, one
   `picks where showDate == {date}` query (via `fetchGlobalShowWinners` in
   `features/scoring`) to compute the global-max winner rule. Chunked at 10
   parallel queries.

Read formula (upper bound):

```
reads_per_view = |showDates|         // point reads
               + |shows_played|      // collection queries (each returns ~N player docs)
```

`|shows_played|` is typically much smaller than `|showDates|` — the average
profile is light on per-show activity.

## Instrumentation

Every successful `useUserSeasonStats` run ships one GA4 event:

```
profile_season_stats_computed
  shows_checked       // |showDates|
  shows_played        // graded non-empty picks for the viewed uid
  collection_queries  // collection reads performed for the wins pass
  elapsed_ms          // rounded ms from compute start to compute end
  self_view           // true when the viewer is looking at their own profile
```

Source: `src/features/profile/model/profileStatsTelemetry.js`. The event is
best-effort: GA failures are swallowed (with a `console.warn`) so telemetry
never breaks the profile view. In dev, the same payload is mirrored to
`console.info` so the signal is visible without GA4 credentials.

GA4 is already wired via `react-ga4` (see `src/shared/lib/ga4.js`), so no
new SDK is required. Create a GA4 Explorer / saved view filtered on
`event_name = profile_season_stats_computed` to watch reads × views over
time.

## Trigger thresholds

When either of the following conditions holds **sustained over at least 7
days**, file a materialize follow-up:

- **≥ 50 profile views / day** of `profile_season_stats_computed`, or
- **p95 `elapsed_ms` > 1500 ms**.

Thresholds are centralized in `PROFILE_STATS_TELEMETRY_THRESHOLDS` (same
module) so product + engineering share a single source of truth.

## Global Stats leaderboards (#1004 Phase 2)

`/dashboard/stats/global` must **not** scan `users` from the client.

Read formula per visit:

```
reads_per_view = 1                          // global_stats_leaderboards/allTime
               + 1                          // global_stats_leaderboards/tour:{tourKey}
               + 0 or 1                     // users/{uid} only if Auth profile is not already live
```

Ratio boards (Points per show, Picking average, and Slugging percentage) require **`showsPlayed >= 3`** (tour boards: `seasonStats.{tourKey}.shows >= 3`) so a one-show spike cannot own the list. All-time slugging requires **`showsPlayed >= 15`**. Slugging is `totalPoints / (shows × 30)`, where 30 is one show of in-setlist hits. The deprecated Shows board has no ratio gate and is no longer rendered. Constants live in `functions/globalStatsLeaderboards.js` and `src/features/stats/model/globalLeaderboardRanking.js` (`GLOBAL_LEADERBOARD_MIN_SHOWS`, `GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME`, `GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS`).

Rebuild is Functions-owned (`rollupScoresForShow`, nightly schedule, admin callable) from materialized `users` fields. **v1.100.0 (#1044)** adds Average vintage and Bustout Boost on the same all-time and this-tour docs. Bustout Boost reads `seasonStats.{tourKey}.bustoutBoosts` (all-time is the sum). Average vintage is computed inside that rebuild from graded `picks` and the song catalog, then copied onto `users.avgVintageYear` / `users.avgVintageByTour` for the you-row. The visit above still does not scan `users` or `picks`. See `docs/API.md` §1.14. In most played and pool-scoped boards stay out.

## Materialization follow-up (out of scope for #220)

When the thresholds trip, the natural next step is to materialize
`users.totalPoints / users.wins / users.shows` inside `rollupScoresForShow`
(`functions/index.js`). That function already has every pick for the show
loaded while it's running, so computing the global-max once per rollup and
incrementing `users.wins` for tied winners is a cheap incremental change.

Until then, the live-compute path stays the single source of truth so
Profile `Wins` can't drift from the Standings (#218) and Tour standings
(#219) surfaces — all three share
`src/shared/utils/showAggregation.js::reduceShowWinners`.

## Self Profile pick heatmap (#553 interim)

`useProfilePickHeatmap` live-computes on dashboard Profile only:

```
reads ≈ 1 collection query (picks where userId == uid)
       + min(|graded shows|, 40) official_setlists point reads
```

Telemetry event: `profile_pick_heatmap_computed` (same view/p95 thresholds
as season stats). Public profile must not call this path until a
`pickSongStats` (or equivalent) rollup lands.
