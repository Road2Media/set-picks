# Milestone Badge Matrix

**Parent epic:** [#565](https://github.com/pat792/set-picks/issues/565)  
**Phase:** 0 / product matrix for [#566](https://github.com/pat792/set-picks/issues/566)  
**Status:** Locked for implementation planning; badge art and award code ship in later phases.

This matrix defines the first engagement badge system for Profile and public profile surfaces. It is intentionally conservative: badges reward verified play, streaks, and competitive outcomes from existing scoring data, while clearly calling out any rollup gaps before implementation.

---

## Product Principles

- Badges should nudge another night of picks, not create noisy achievement spam.
- Award rules must be deterministic and explainable from Firestore data or documented rollups.
- Public profile display should celebrate identity without exposing private email, notification, or pool-membership data.
- Regrades must be handled by recomputing from source-of-truth picks or idempotent rollups, not by stacking duplicate awards.
- Initial unlock notifications should be in-app/profile-local only. Email or push for badge unlocks is out of scope.

---

## Rarity Tiers

| Tier | Meaning | Display guidance |
|------|---------|------------------|
| `common` | Early onboarding / low-friction participation | Small chip; good for empty-state momentum |
| `uncommon` | Repeat behavior across a few shows | Profile row placement; share copy optional later |
| `rare` | Meaningful tour commitment or strong outcomes | Highlight in badge grid; public profile worthy |
| `legendary` | Full-tour or long-career achievement | Prominent treatment; avoid overusing |

---

## Data Sources

| Source | Existing? | Use | Notes |
|--------|-----------|-----|-------|
| `picks/{showDate}_{uid}` | Yes | Per-show participation, score, `isGraded`, `winCredited`, picked songs/slots | Source of truth for recompute and backfills |
| `users/{uid}.showsPlayed` | Yes | Career participation count | Written by rollup/backfill; mirrors graded non-empty picks |
| `users/{uid}.wins` | Yes | Career global show wins | Tie-aware via global max; not pool-scoped |
| `users/{uid}.totalPoints` | Yes | Career score total | Useful for future point thresholds; not in v1 badge set |
| `users/{uid}.seasonStats.{tourKey}` | Yes | Tour-scoped points, shows, wins | Supports tour-scoped participation and win badges |
| `users/{uid}.seasonStatsThroughShow` | Yes | Snapshot freshness | Use to avoid awarding from stale aggregate snapshots |
| `show_calendar/snapshot` and `showDatesByTour` | Yes | Tour date order and full-tour attendance | Consecutive-show streaks must follow scheduled tour dates, not calendar days |
| Tour ranking snapshots / daily comms payloads | Partial | Days ranked #1 on tour | Needs a durable per-user daily-rank counter or snapshot before badges can rely on it |
| Pool standings | Partial / separate | Pool-only wins | Deferred; pool badges need a scoped product decision |
| Invite/referral tracking | Partial | Social badges | Deferred until accepted invite tracking is a stable badge source |

---

## Badge Matrix

### Participation / Volume

| badgeId | Name | Unlock blurb | Rule | Scope | Tier | Surfaces | Icon brief | Anti-abuse / gaps |
|---------|------|--------------|------|-------|------|----------|------------|-------------------|
| `shows_played_1` | First Show Scored | Scored your first Set Picks show. | Count graded, non-empty picks for user >= 1. Prefer fresh `users.showsPlayed`; recompute from `picks` if snapshot stale. | `career` | `common` | Profile self, public profile | Ticket stub with one star | Regrade-safe if derived from graded picks; no empty-pick credit. |
| `shows_played_5` | Five on the Board | Played five scored shows. | Graded, non-empty picks count >= 5. | `career` | `common` | Profile self, public profile | Stack of five ticket stubs | Same as `shows_played_1`. |
| `shows_played_10` | Ten-Show Run | Played ten scored shows. | Graded, non-empty picks count >= 10. | `career` | `uncommon` | Profile self, public profile | Calendar with "10" badge | Same as `shows_played_1`. |
| `shows_played_25` | Tour Regular | Played 25 scored shows. | Graded, non-empty picks count >= 25. | `career` | `rare` | Profile self, public profile | Road sign / venue marquee | Long-career users only until multiple tours accumulate. |
| `shows_played_50` | Long Hauler | Played 50 scored shows. | Graded, non-empty picks count >= 50. | `career` | `legendary` | Profile self, public profile | Van / road case | Requires historical integrity before launch if old beta data is included. |
| `tour_shows_5` | Tour Tracker | Played five scored shows in one tour. | For any `tourKey`, `seasonStats.{tourKey}.shows >= 5`. | `tour:{tourKey}` | `uncommon` | Profile self, public profile | Tour map pin cluster | Requires `seasonStatsThroughShow` to be caught up for current tour. |
| `tour_shows_10` | Tour Mainstay | Played ten scored shows in one tour. | For any `tourKey`, `seasonStats.{tourKey}.shows >= 10`. | `tour:{tourKey}` | `rare` | Profile self, public profile | Tour laminate | Same freshness requirement as `tour_shows_5`. |

### Consecutive-Show Streaks

Consecutive means consecutive scheduled shows in a tour. Off days do not break the streak; missing a scheduled show with no graded, non-empty picks does.

| badgeId | Name | Unlock blurb | Rule | Scope | Tier | Surfaces | Icon brief | Anti-abuse / gaps |
|---------|------|--------------|------|-------|------|----------|------------|-------------------|
| `streak_2` | Back-to-Back | Played two scheduled shows in a row. | Sort tour dates by date; user's graded non-empty picks cover any run of 2 adjacent tour dates. | `tour:{tourKey}` | `common` | Profile self, public profile | Two linked show dots | Requires reading per-show participation or a future streak rollup. |
| `streak_3` | Three-Night Stand | Played three scheduled shows in a row. | Same as `streak_2`, run length >= 3. | `tour:{tourKey}` | `uncommon` | Profile self, public profile | Three linked show dots | Back-to-back venues count by scheduled dates, not venue names. |
| `streak_5` | Five-Show Heater | Played five scheduled shows in a row. | Same as `streak_2`, run length >= 5. | `tour:{tourKey}` | `rare` | Profile self, public profile | Flame over five dots | Prefer materialized streak rollup before high-traffic launch. |
| `streak_tour` | Full Tour Run | Played every scored show in a tour. | User has graded non-empty picks for every completed show in a `tourKey`; award only after final show is graded. | `tour:{tourKey}` | `legendary` | Profile self, public profile | Completed tour map loop | Needs clear rule for late-added/cancelled shows from calendar snapshot. |

### Competitive Excellence

| badgeId | Name | Unlock blurb | Rule | Scope | Tier | Surfaces | Icon brief | Anti-abuse / gaps |
|---------|------|--------------|------|-------|------|----------|------------|-------------------|
| `win_1` | First Night Win | Topped a scored show. | `users.wins >= 1` or any graded pick has `winCredited === true`. Ties count. | `career` | `uncommon` | Profile self, public profile | Trophy with one star | Tie policy: tied global #1 counts, matching current `wins` semantics. |
| `win_3` | Three Night Wins | Topped three scored shows. | `users.wins >= 3`. | `career` | `rare` | Profile self, public profile | Trophy with three stars | Requires rollup/backfill freshness. |
| `win_5` | Five Night Wins | Topped five scored shows. | `users.wins >= 5`. | `career` | `rare` | Profile self, public profile | Trophy stack | Same as `win_3`. |
| `win_10` | Ten Night Wins | Topped ten scored shows. | `users.wins >= 10`. | `career` | `legendary` | Profile self, public profile | Gold cup / crown | High bar; validate historical winners before awarding retroactively. |
| `tour_win_1` | Tour Night Winner | Won at least one show in a tour. | For any `tourKey`, `seasonStats.{tourKey}.wins >= 1`. | `tour:{tourKey}` | `uncommon` | Profile self, public profile | Tour pin with trophy | Ties count; not pool-scoped. |
| `tour_win_3` | Tour Closer | Won three shows in a tour. | For any `tourKey`, `seasonStats.{tourKey}.wins >= 3`. | `tour:{tourKey}` | `rare` | Profile self, public profile | Three trophy pins | Same freshness requirement as other `seasonStats` badges. |
| `podium_10` | Podium Regular | Finished top 3 ten times. | Count shows where user's rank <= 3 after global ranking/tie handling. | `career` | `rare` | Profile self, public profile | Medal trio | Gap: no durable top-3 counter today; implement after rank snapshot/rollup exists. |
| `days_first_3` | Three Mornings at #1 | Held tour rank #1 on three daily snapshots. | Count daily tour-ranking snapshots where `rank === 1` for same `tourKey`, ties count. | `tour:{tourKey}` | `rare` | Profile self, public profile | Sunrise with #1 | Gap: needs durable daily rank snapshots or counter; comms payload alone is not enough. |
| `days_first_7` | Week on Top | Held tour rank #1 on seven daily snapshots. | Same as `days_first_3`, count >= 7. | `tour:{tourKey}` | `legendary` | Profile self, public profile | Crown over calendar week | Same snapshot gap; only award after data retention is settled. |

### Identity / Social

| badgeId | Name | Unlock blurb | Rule | Scope | Tier | Surfaces | Icon brief | Anti-abuse / gaps |
|---------|------|--------------|------|-------|------|----------|------------|-------------------|
| `avatar_set` | New Look | Chose a custom avatar. | User selected a non-default curated avatar ID after #567 ships. | `career` | `common` | Profile self, public profile | Smiling record / mask | Depends on #567 field choice; do not use arbitrary uploaded images. |
| `pool_host` | Pool Host | Created a private pool. | User owns at least one active pool. | `career` | `uncommon` | Profile self, public profile optional | Group around table | Defer until pool ownership/public display rule is confirmed. |
| `invite_accept_1` | Brought a Friend | One invited user joined through your link. | Stable invite attribution count >= 1. | `career` | `uncommon` | Profile self first; public later | Two tickets crossing | Gap: requires accepted invite tracking and privacy review. |

---

## Initial Implementation Set

Ship the first award engine against fields that already exist and can be recomputed:

1. `shows_played_1`, `shows_played_5`, `shows_played_10`
2. `tour_shows_5`, `tour_shows_10`
3. `streak_2`, `streak_3` if read-cost is bounded by current tour dates
4. `win_1`, `win_3`, `tour_win_1`
5. `avatar_set` only after #567 chooses the stored avatar field

Defer `podium_*`, `days_first_*`, invite, and pool-host badges until their source data is durable and documented.

## Shipped in #712

Career badges awarded at finalize from fields already on `users/{uid}`, then backfilled by `functions/scripts/backfillBadges.js` (dry-run unless `--apply`). Awards stay once written.

| badgeId | Name | Rule | Tier |
|---------|------|------|------|
| `shows_played_25` | Tour Regular | `showsPlayed >= 25` | `rare` |
| `shows_played_50` | Long Hauler | `showsPlayed >= 50` | `legendary` |
| `win_5` | Five Night Wins | `wins >= 5` | `rare` |
| `win_10` | Ten Night Wins | `wins >= 10` | `legendary` |
| `points_500` | 500 Club | `totalPoints >= 500` | `rare` |
| `points_1000` | 1000 Club | `totalPoints >= 1000` | `legendary` |
| `anniversary_1` | First Anniversary | UTC calendar years from `createdAt` through the show date `>= 1` | `uncommon` |
| `anniversary_2` | Two-Year Run | same, `>= 2` | `rare` |
| `anniversary_3` | Three-Year Fan | same, `>= 3` | `rare` |
| `style_picker` | Style Picker | `favoriteSong` set and not `Unknown` | `common` |

Still deferred: tour winner and multiples, top-5 tour finish, tour-leading batting average / PPS / bustout boosts, triple crown, yearly winner, annual slugging leader and top 5, Pick 'em Evangelist. Those need a durable ranking or invite snapshot. Streaks, full-tour completion, bustout hits, and a perfect night need per-show grade context at finalize.

---

## Award Storage Recommendation

Use a compact, recomputable map on `users/{uid}` only after implementation design confirms the field name:

```json
{
  "badges": {
    "shows_played_5": {
      "awardedAt": "Timestamp",
      "scope": "career",
      "sourceThroughShow": "2026-07-16"
    },
    "tour_shows_10:summer-2026": {
      "awardedAt": "Timestamp",
      "scope": "tour:summer-2026",
      "sourceThroughShow": "2026-07-16"
    }
  }
}
```

Adding this field is a Firestore schema change and should be documented in `docs/API.md` in the implementation PR. The awarder should be idempotent: recompute unlocked badges, merge missing awards, and never overwrite an earlier `awardedAt` unless a deliberate regrade repair script says so.

---

## Non-Goals

- No paid badges or pay-to-unlock mechanics.
- No arbitrary user-uploaded avatar art.
- No email or push blast for every unlock in v1.
- No pool-scoped wins until pool badge privacy and ranking semantics are designed.
- No badge awards from unstable GA4-only signals.
- No retroactive public announcement feed.

---

## Implementation Questions To Resolve

- Should badge display order be fixed by this matrix or computed by rarity + awarded date?
- Should self-profile show locked future badges, or only earned badges plus a small "next up" hint?
- Should public profile hide common onboarding badges when the user has rare/legendary badges?
- Should career stats include beta-era data if a user's historical picks were regraded after schema changes?
- Should a regrade be allowed to revoke a badge, or should awards be permanent once earned? Recommendation: permanent for user trust, with admin repair scripts for data corruption.
