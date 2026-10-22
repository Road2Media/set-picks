/**
 * Consistent user-facing terms for dashboard / game surfaces:
 *
 * - **Standings** — Short nav label (`/dashboard/standings`). Same screen as “show standings”
 *   for the date selected in the header.
 * - **Show standings** — Ordered points for one show date only (everyone or one pool).
 * - **All-time standings** — Cumulative leaderboard across every finalized show (all tours).
 *   Canonical name replacing legacy “Season totals” on pool details and optional global
 *   companion on Standings. See #148.
 * - **Tour standings** — Cumulative leaderboard scoped to the current tour via
 *   `show_calendar.showDatesByTour` (global surface on Standings; pool-scoped on pool details).
 *   See #148 / #219.
 * - **Season totals** — Legacy alias for All-time standings on pool details; kept during the
 *   transition and re-exported through {@link POOL_ALL_TIME_STANDINGS_HEADING}.
 *
 * - **Pool details** — Player-facing name for `/dashboard/pool/:id` (roster, invites, season totals).
 *   Internal code may still use “Pool Hub”; user-facing strings should say Pool details.
 */

/** Primary tab for locking picks (`/dashboard`) — same label in context bar + desktop H1 */
export const NAV_LABEL_PICKS = 'Picks';

/** Picks-cluster tertiary: existing form (`/dashboard` and `/dashboard/picks`) */
export const NAV_LABEL_MAKE_PICKS = 'Make Picks';

/** Picks-cluster tertiary: Prediction Lab destination (`/dashboard/picks/lab`) */
export const NAV_LABEL_PICKS_LAB = 'Picks Lab';

/** Picks-cluster tertiary: Scorecard (`/dashboard/picks/scorecard`) — self card + post-lock metrics (#767) */
export const NAV_LABEL_SCORECARD = 'Scorecard';

/** Pools list tab + context + desktop H1 (`/dashboard/pools`) */
export const NAV_LABEL_POOLS = 'Pools';

/** Pools tertiary — list destination (`/dashboard/pools`) */
export const NAV_LABEL_MY_POOLS = 'My Pools';

/** Pools tertiary — create destination (`/dashboard/pools/create`) */
export const NAV_LABEL_CREATE_POOL = 'Create Pool';

/** Pools tertiary — join-by-code destination (`/dashboard/pools/join`) */
export const NAV_LABEL_JOIN_POOL = 'Join Pool';

/**
 * Identity tertiary only (`/dashboard/profile`) — handle, favorite song, avatar, badges.
 * Primary tab label is {@link NAV_LABEL_ACCOUNT}.
 */
export const NAV_LABEL_PROFILE = 'Profile';

/** Account-cluster inbox (`/dashboard/profile/notifications`) — mailbox only */
export const NAV_LABEL_MESSAGES = 'Messages';

/**
 * Primary tab for the `/dashboard/profile/*` cluster (#770).
 * Path prefix stays `/dashboard/profile` (MINOR label change, not a new path family).
 */
export const NAV_LABEL_ACCOUNT = 'Account';

/**
 * Preferences tertiary (`/dashboard/profile/account`) — security, logout, legal,
 * install/PWA, and notification prefs. Path stays `PROFILE_CLUSTER_PATHS.account`.
 */
export const NAV_LABEL_PREFERENCES = 'Preferences';

/**
 * Stats primary tab (#769) — `/dashboard/stats` and `/dashboard/stats/*`.
 * Also the context bar + desktop H1 for the Stats cluster.
 */
export const NAV_LABEL_STATS = 'Stats';

/**
 * Stats tertiary chips — drop the redundant “Stats” suffix so three
 * uppercase `tracking-widest` segments fit the equal-width tray (Standings
 * Show / Tour / Pools pattern). Destination names stay Personal / Global /
 * Band Stats in IA and page copy.
 */
export const NAV_LABEL_PERSONAL_STATS = 'Personal';

/** Stats tertiary — private tour explorer (`/dashboard/stats/global`) */
export const NAV_LABEL_GLOBAL_STATS = 'Global';

/** Stats tertiary — band song-stats shell (`/dashboard/stats/band`) */
export const NAV_LABEL_BAND_STATS = 'Band';

/** Quiet Profile → Personal Stats cross-link */
export const VIEW_PERSONAL_STATS_LINK = 'View personal stats';

/** Admin tab label (`/dashboard/admin`); context/desktop title stays War Room */
export const NAV_LABEL_ADMIN = 'Admin';

/**
 * @deprecated Prefer {@link NAV_LABEL_PREFERENCES} for the Preferences tertiary.
 * Retained for legacy `/dashboard/account-security` meta until redirects settle.
 */
export const NAV_LABEL_ACCOUNT_SECURITY = 'Sign-in & password';

/**
 * @deprecated Prefer {@link NAV_LABEL_MESSAGES} for the cluster Messages tab.
 * Retained for legacy `/dashboard/notifications` meta until redirects settle.
 */
export const NAV_LABEL_NOTIFICATIONS = 'Notifications';

/** Short tab / mobile context label */
export const NAV_LABEL_STANDINGS = 'Standings';

/** Tour stats explorer (#555) — secondary route under Standings */
export const NAV_LABEL_TOUR_STATS = 'Tour stats';

/** Mobile context bar label for a specific pool’s detail route */
export const NAV_LABEL_POOL_DETAILS = 'Pool Details';

/**
 * Desktop layout eyebrow for pool detail (matches in-page section label styling, e.g. Game Status).
 */
export const POOL_DETAILS_LAYOUT_EYEBROW = 'Pool details';

/** One-night ordered results (main list on Standings route; glossary / in-page copy). */
export const SHOW_STANDINGS_PHRASE = 'Show standings';

/** Desktop H1 for `/dashboard/standings` matches {@link NAV_LABEL_STANDINGS} (nav + context bar). */
export const SHOW_STANDINGS_EYEBROW = SHOW_STANDINGS_PHRASE;

/**
 * Cumulative "across every finalized show" leaderboard heading. Canonical
 * name; retires **Season totals** in net-new copy. See #148.
 */
export const ALL_TIME_STANDINGS_HEADING = 'All-time standings';
export const ALL_TIME_STANDINGS_DESCRIPTION =
  'Running totals across every graded show — points, wins, and shows played (not just tonight).';

/** Pool-scoped alias of {@link ALL_TIME_STANDINGS_HEADING} for pool details. */
export const POOL_ALL_TIME_STANDINGS_HEADING = ALL_TIME_STANDINGS_HEADING;
export const POOL_ALL_TIME_STANDINGS_DESCRIPTION =
  'Running totals in this pool — points, wins, and shows played across every graded show.';

/**
 * Tour-scoped cumulative leaderboard heading. Scope comes from
 * `show_calendar.showDatesByTour` at runtime. See #148 / #219.
 */
export const TOUR_STANDINGS_HEADING = 'Tour standings';
export const TOUR_STANDINGS_DESCRIPTION =
  'Running totals for this tour across every graded show. Players with the same points share a rank, and the next rank skips. Inside a tie, nightly wins then name set the order.';

/** Pool-scoped alias of {@link TOUR_STANDINGS_HEADING} for pool details. */
export const POOL_TOUR_STANDINGS_HEADING = TOUR_STANDINGS_HEADING;
export const POOL_TOUR_STANDINGS_DESCRIPTION =
  'Running totals in this pool for the current tour — points, wins, and shows played across every graded show in this tour.';

/**
 * Legacy alias retained so existing call sites don't churn while we migrate
 * pool details to **All-time standings** (#148). New code should prefer the
 * `*_ALL_TIME_STANDINGS_*` names above.
 * @deprecated Use {@link POOL_ALL_TIME_STANDINGS_HEADING}.
 */
export const SEASON_TOTALS_HEADING = POOL_ALL_TIME_STANDINGS_HEADING;
/** @deprecated Use {@link POOL_ALL_TIME_STANDINGS_DESCRIPTION}. */
export const SEASON_TOTALS_DESCRIPTION = POOL_ALL_TIME_STANDINGS_DESCRIPTION;

export const LEADING_THIS_SHOW = 'Leading this show';

/**
 * Copy for the Standings "overall winner of the night" banner (#218). Ties
 * render the plural heading; winners are a comma-separated list.
 */
export const TONIGHTS_WINNER_SINGULAR = "Tonight's winner";
export const TONIGHTS_WINNERS_PLURAL = "Tonight's winners";

/**
 * Pick the correct singular/plural heading for the winner(s) of the night.
 *
 * @param {number} winnerCount
 * @returns {string}
 */
export function tonightsWinnerHeading(winnerCount) {
  return winnerCount > 1 ? TONIGHTS_WINNERS_PLURAL : TONIGHTS_WINNER_SINGULAR;
}

/** Standings callout for the prior tour night when the selected show is next or live. */
export const LAST_SHOW_WINNER_SINGULAR = "Last show's winner";
export const LAST_SHOW_WINNERS_PLURAL = "Last show's winners";

/**
 * @param {number} winnerCount
 * @param {string | null | undefined} [poolScopeLabel] — pool name on Standings Pools tab (#305 pool-scoped last show).
 * @returns {string}
 */
export function lastShowWinnerHeading(winnerCount, poolScopeLabel) {
  const phrase =
    winnerCount > 1 ? LAST_SHOW_WINNERS_PLURAL : LAST_SHOW_WINNER_SINGULAR;
  if (typeof poolScopeLabel === 'string' && poolScopeLabel.trim()) {
    return `${phrase} · ${poolScopeLabel.trim()}`;
  }
  return phrase;
}

/** Compact one-line hint next to the info control (#303). */
export const STANDINGS_PICK_PRIVACY_INLINE =
  "Other players' picks stay hidden until showtime.";

/** Accessible name for the standings pick-privacy info control. */
export const STANDINGS_PICK_PRIVACY_INFO_LABEL = 'About hidden picks';

/**
 * Shared showtime-blur explanation for Standings leaderboard info tooltip.
 */
export const SHOWTIME_SONG_BLUR_TOOLTIP =
  'To improve competition, song names and data stay blurred until showtime.';

/** Standings leaderboard tooltip. */
export const STANDINGS_PICK_PRIVACY_TOOLTIP = SHOWTIME_SONG_BLUR_TOOLTIP;

/** Standings self-recap card eyebrow (rank + points snapshot). */
export const STANDINGS_SELF_RECAP_EYEBROW = 'Your rank';

/** Scroll target from self-recap card to the user’s leaderboard row. */
export const STANDINGS_SELF_RECAP_JUMP_LINK = 'Jump to your score card';

/**
 * Shown under the recap when the official setlist exists but share is gated
 * until every non-empty pick for the show has been finalized (`isGraded`).
 */
export const STANDINGS_SHARE_AFTER_FINALIZE_INLINE =
  'Share unlocks after this show is fully finalized (every submitted pick graded).';

/** Picks tab self-recap: link to global standings for the same show date. */
export const PICKS_SELF_RECAP_STANDINGS_LINK = 'View standings';
