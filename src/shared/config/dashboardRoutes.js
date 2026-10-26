/**
 * Canonical dashboard path constants and cluster membership helpers.
 * Used by nav active-state, page meta, last-path restore, and deep links.
 *
 * @see docs/DASHBOARD_IA.md
 * @see docs/RELEASE_TRAIN_SPRINT_5_6.md (#418)
 */

/**
 * Account cluster (#770) — identity / Messages / Preferences.
 * Path prefix stays `/dashboard/profile/*` (label-only primary rename; not a new family).
 */
export const PROFILE_CLUSTER_PATHS = Object.freeze({
  profile: '/dashboard/profile',
  notifications: '/dashboard/profile/notifications',
  account: '/dashboard/profile/account',
});

/** Push-enable deep link — lands on Preferences, not Messages (#513 / #770). */
export const PROFILE_PREFERENCES_OPEN_PUSH_HREF = `${PROFILE_CLUSTER_PATHS.account}?openPush=1`;

/**
 * Picks cluster — Make Picks / Picks Lab / Scorecard (#766).
 * `/dashboard` and `/dashboard/picks` are the same Make Picks form.
 */
export const PICKS_CLUSTER_PATHS = Object.freeze({
  home: '/dashboard',
  makePicks: '/dashboard/picks',
  lab: '/dashboard/picks/lab',
  scorecard: '/dashboard/picks/scorecard',
  rewind: '/dashboard/rewind',
});

/**
 * Pools tertiary cluster — My Pools / Create Pool / Join Pool (#768).
 * Pool details (`/dashboard/pool/:id`) stays a sibling destination; primary
 * Pools stays active there (Option C chrome).
 */
export const POOLS_CLUSTER_PATHS = Object.freeze({
  list: '/dashboard/pools',
  create: '/dashboard/pools/create',
  join: '/dashboard/pools/join',
});

/**
 * Stats primary cluster — Personal / Global / Band (#769).
 * `/dashboard/stats` and `/dashboard/stats/personal` are the same Personal surface.
 */
export const STATS_CLUSTER_PATHS = Object.freeze({
  root: '/dashboard/stats',
  personal: '/dashboard/stats/personal',
  global: '/dashboard/stats/global',
  band: '/dashboard/stats/band',
});

/** Pre-#769 Standings Stats peer; SPA redirect preserves `?tour=`. */
export const STATS_CLUSTER_LEGACY_PATHS = Object.freeze({
  tourStats: '/dashboard/tour-stats',
});

/** Pre-#418 paths; SPA redirects preserve bookmarks and email deep links. */
export const PROFILE_CLUSTER_LEGACY_PATHS = Object.freeze({
  notifications: '/dashboard/notifications',
  accountSecurity: '/dashboard/account-security',
});

/**
 * @param {string} pathname
 * @returns {string}
 */
export function normalizeDashboardPathname(pathname) {
  const raw = pathname?.toString?.() || '';
  if (!raw.startsWith('/dashboard')) return raw;
  return raw.replace(/\/+$/, '') || '/dashboard';
}

/**
 * True when pathname is any Account-cluster surface (including legacy redirects).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isProfileClusterPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  if (path === PROFILE_CLUSTER_PATHS.profile) return true;
  if (path === PROFILE_CLUSTER_PATHS.notifications) return true;
  if (path === PROFILE_CLUSTER_PATHS.account) return true;
  if (path === PROFILE_CLUSTER_LEGACY_PATHS.notifications) return true;
  if (path === PROFILE_CLUSTER_LEGACY_PATHS.accountSecurity) return true;
  return path.startsWith(`${PROFILE_CLUSTER_PATHS.profile}/`);
}

/**
 * True when pathname is any Picks-cluster surface (#766).
 * `/dashboard` and `/dashboard/picks` are both Make Picks.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPicksClusterPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  if (path === PICKS_CLUSTER_PATHS.home) return true;
  if (path === PICKS_CLUSTER_PATHS.makePicks) return true;
  if (path === PICKS_CLUSTER_PATHS.lab) return true;
  if (path === PICKS_CLUSTER_PATHS.scorecard) return true;
  if (path === PICKS_CLUSTER_PATHS.rewind) return true;
  return false;
}

/**
 * True when pathname is the Make Picks form (`/dashboard` or `/dashboard/picks`).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isMakePicksPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  return path === PICKS_CLUSTER_PATHS.home || path === PICKS_CLUSTER_PATHS.makePicks;
}

/**
 * True for Pools tertiary destinations only (My / Create / Join).
 * Does not include `/dashboard/pool/:id`.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPoolsTertiaryPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  if (path === POOLS_CLUSTER_PATHS.list) return true;
  if (path === POOLS_CLUSTER_PATHS.create) return true;
  if (path === POOLS_CLUSTER_PATHS.join) return true;
  return path.startsWith(`${POOLS_CLUSTER_PATHS.list}/`);
}

/**
 * True when pathname is any Pools-cluster surface, including pool details.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPoolsClusterPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  if (isPoolsTertiaryPath(path)) return true;
  return path.startsWith('/dashboard/pool/');
}

/**
 * True when pathname is Personal Stats (`/dashboard/stats` or `/personal`).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isPersonalStatsPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  return path === STATS_CLUSTER_PATHS.root || path === STATS_CLUSTER_PATHS.personal;
}

/**
 * True when pathname is Global Stats (`/dashboard/stats/global`).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isGlobalStatsPath(pathname) {
  return normalizeDashboardPathname(pathname) === STATS_CLUSTER_PATHS.global;
}

/**
 * True when Personal or Global Stats quaternary filters mount (sticky / mobile
 * chrome below tertiary). Band has no quaternary tray.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isStatsQuaternaryPath(pathname) {
  return isPersonalStatsPath(pathname) || isGlobalStatsPath(pathname);
}

/**
 * True when pathname is any Stats-cluster surface, including the
 * `/dashboard/tour-stats` redirect hop (Stats primary stays active).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isStatsClusterPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  if (path === STATS_CLUSTER_PATHS.root) return true;
  if (path === STATS_CLUSTER_PATHS.personal) return true;
  if (path === STATS_CLUSTER_PATHS.global) return true;
  if (path === STATS_CLUSTER_PATHS.band) return true;
  if (path === STATS_CLUSTER_LEGACY_PATHS.tourStats) return true;
  return path.startsWith(`${STATS_CLUSTER_PATHS.root}/`);
}

/**
 * True when the chrome tour scope picker should show on a Stats path
 * (Personal / Global / Band / legacy hop). Personal uses the picker only
 * for the tour rollup; all-time stats stay tour-agnostic (#1004).
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isStatsTourScopedPath(pathname) {
  const path = normalizeDashboardPathname(pathname);
  if (path === STATS_CLUSTER_PATHS.root) return true;
  if (path === STATS_CLUSTER_PATHS.personal) return true;
  if (path === STATS_CLUSTER_PATHS.global) return true;
  if (path === STATS_CLUSTER_PATHS.band) return true;
  if (path === STATS_CLUSTER_LEGACY_PATHS.tourStats) return true;
  return false;
}
