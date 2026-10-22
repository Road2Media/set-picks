/**
 * Centralized dashboard route metadata for consistent mobile context bar titles
 * and desktop heading ownership.
 *
 * When adding a `/dashboard/*` route, update this module, nav active-state rules
 * in `DashboardLayout.jsx`, and the verification script `scripts/verify-dashboard-meta.mjs`.
 * See `docs/DASHBOARD_IA.md`.
 */

import {
  NAV_LABEL_ACCOUNT,
  NAV_LABEL_MESSAGES,
  NAV_LABEL_PICKS,
  NAV_LABEL_POOL_DETAILS,
  NAV_LABEL_POOLS,
  NAV_LABEL_PREFERENCES,
  NAV_LABEL_STANDINGS,
  NAV_LABEL_STATS,
  POOL_DETAILS_LAYOUT_EYEBROW,
} from '../../../shared/config/dashboardVocabulary.js';
import {
  PROFILE_CLUSTER_LEGACY_PATHS,
  PROFILE_CLUSTER_PATHS,
  PICKS_CLUSTER_PATHS,
  isPicksClusterPath,
  isPoolsTertiaryPath,
  isProfileClusterPath,
  isStatsClusterPath,
  isStatsTourScopedPath,
  normalizeDashboardPathname,
} from '../../../shared/config/dashboardRoutes.js';

/** Exported for `scripts/verify-dashboard-meta.mjs` (keep in sync with route paths). */
export { normalizeDashboardPathname };

/**
 * Read the `?view=` query from a search string or URLSearchParams.
 * Tolerant to `undefined` / object forms so the Dashboard layout can
 * pass `location.search` straight through.
 */
function readViewQuery(search) {
  if (!search) return '';
  try {
    const params =
      typeof search === 'string' ? new URLSearchParams(search) : search;
    return params.get?.('view')?.toString?.() || '';
  } catch {
    return '';
  }
}

/**
 * @param {string} pathname
 * @param {string | URLSearchParams | null | undefined} [search]  `location.search`.
 *   Used by `/dashboard/standings` to hide the global date picker when
 *   `?view=tour` (#255) or `?view=year` (#1110) is active, and by Stats
 *   Personal / Global / Band (#769 / #1004) — tour-scoped surfaces share
 *   the chrome tour picker. Year view shows the year picker instead.
 */
export function getDashboardPageMeta(pathname, search) {
  const normalized = normalizeDashboardPathname(pathname);

  // Defaults for safety (should only render within /dashboard/* routes).
  if (!normalized.startsWith('/dashboard')) {
    return {
      contextTitle: '',
      showDatePicker: false,
      isStandingsTourView: false,
      showTourScopePicker: false,
      isStandingsYearView: false,
      showYearScopePicker: false,
      layoutDesktopHeading: null,
      layoutDetailEyebrow: null,
      desktopHeadingTone: 'default',
      ownsDesktopStickyChrome: false,
    };
  }

  const isProfileIdentity = normalized === PROFILE_CLUSTER_PATHS.profile;
  const isProfileMessages =
    normalized === PROFILE_CLUSTER_PATHS.notifications ||
    normalized === PROFILE_CLUSTER_LEGACY_PATHS.notifications;
  const isProfileAccount =
    normalized === PROFILE_CLUSTER_PATHS.account ||
    normalized === PROFILE_CLUSTER_LEGACY_PATHS.accountSecurity;
  const isProfileCluster = isProfileClusterPath(normalized);
  const isPicksCluster = isPicksClusterPath(normalized);
  const isRewind = normalized === PICKS_CLUSTER_PATHS.rewind;
  const isStatsCluster = isStatsClusterPath(normalized);
  const isAdmin = normalized === '/dashboard/admin';
  const isPoolHub = normalized.startsWith('/dashboard/pool/');
  const isStandings = normalized === '/dashboard/standings';
  // Narrow: Standings Tour only. Stats uses `showTourScopePicker` (#1004).
  const isStandingsTourView = isStandings && readViewQuery(search) === 'tour';
  const showTourScopePicker =
    isStandingsTourView || isStatsTourScopedPath(normalized);
  // Standings Year only (#1110). Not the tour picker.
  const isStandingsYearView = isStandings && readViewQuery(search) === 'year';
  const showYearScopePicker = isStandingsYearView;

  const contextTitle = (() => {
    if (isStatsCluster) return NAV_LABEL_STATS;
    if (isStandings) return NAV_LABEL_STANDINGS;
    if (isPoolsTertiaryPath(normalized)) return NAV_LABEL_POOLS;
    if (isPoolHub) return NAV_LABEL_POOL_DETAILS;
    if (isProfileIdentity) return NAV_LABEL_ACCOUNT;
    if (isProfileMessages) return NAV_LABEL_MESSAGES;
    if (isProfileAccount) return NAV_LABEL_PREFERENCES;
    if (isAdmin) return 'War Room';
    if (isPicksCluster) return NAV_LABEL_PICKS;
    return NAV_LABEL_PICKS;
  })();

  const showDatePicker =
    !isProfileCluster &&
    !isPoolHub &&
    !showTourScopePicker &&
    !showYearScopePicker &&
    !isStatsCluster &&
    !isRewind;

  // Five player tabs own title + tray in the desktop sticky stack. Layout H2
  // stays only for War Room. Pool details keeps Option C (no cluster title).
  const ownsDesktopStickyChrome =
    isPicksCluster ||
    isStandings ||
    isStatsCluster ||
    isPoolsTertiaryPath(normalized) ||
    isProfileCluster;

  const layoutDesktopHeading =
    !ownsDesktopStickyChrome && !isPoolHub ? contextTitle : null;

  const layoutDetailEyebrow = isPoolHub ? POOL_DETAILS_LAYOUT_EYEBROW : null;

  return {
    contextTitle,
    showDatePicker,
    isStandingsTourView,
    showTourScopePicker,
    isStandingsYearView,
    showYearScopePicker,
    layoutDesktopHeading,
    layoutDetailEyebrow,
    desktopHeadingTone: isAdmin ? 'warRoom' : 'default',
    ownsDesktopStickyChrome,
  };
}
