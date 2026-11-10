import { BarChart3, ListMusic, Medal, Settings, User as UserIcon, Users } from 'lucide-react';

import {
  NAV_LABEL_ACCOUNT,
  NAV_LABEL_ADMIN,
  NAV_LABEL_PICKS,
  NAV_LABEL_POOLS,
  NAV_LABEL_STANDINGS,
  NAV_LABEL_STATS,
} from '../../../shared/config/dashboardVocabulary';
import {
  PROFILE_CLUSTER_PATHS,
  STATS_CLUSTER_PATHS,
  isPicksClusterPath,
  isPoolsClusterPath,
  isProfileClusterPath,
  isStatsClusterPath,
} from '../../../shared/config/dashboardRoutes';

/**
 * Primary dashboard tabs. Sidebar and the mobile bottom bar both render this
 * list (#707) so active-state rules live in one place.
 *
 * @param {boolean} isAdmin
 * @returns {Array<{ name: string, path: string, icon: import('react').ComponentType<{ className?: string }> }>}
 */
export function buildDashboardNavItems(isAdmin) {
  const items = [
    { name: NAV_LABEL_PICKS, path: '/dashboard', icon: ListMusic },
    { name: NAV_LABEL_POOLS, path: '/dashboard/pools', icon: Users },
    { name: NAV_LABEL_STANDINGS, path: '/dashboard/standings', icon: Medal },
    { name: NAV_LABEL_STATS, path: STATS_CLUSTER_PATHS.root, icon: BarChart3 },
    { name: NAV_LABEL_ACCOUNT, path: PROFILE_CLUSTER_PATHS.profile, icon: UserIcon },
  ];
  if (isAdmin) {
    items.push({ name: NAV_LABEL_ADMIN, path: '/dashboard/admin', icon: Settings });
  }
  return items;
}

/**
 * Primary tab stays active on child routes. Mirrors Pools → pool details and
 * the Account cluster (Profile / Messages / Preferences).
 *
 * @param {{ path: string }} item
 * @param {string} pathname
 * @returns {boolean}
 */
export function isDashboardNavItemActive(item, pathname) {
  const isPicksSection = item.path === '/dashboard' && isPicksClusterPath(pathname);
  const isProfileSection =
    item.path === PROFILE_CLUSTER_PATHS.profile && isProfileClusterPath(pathname);
  const isPoolsSection = item.path === '/dashboard/pools' && isPoolsClusterPath(pathname);
  const isStandingsSection =
    item.path === '/dashboard/standings' &&
    (pathname === '/dashboard/standings' || pathname === '/dashboard/standings/');
  const isStatsSection =
    item.path === STATS_CLUSTER_PATHS.root && isStatsClusterPath(pathname);
  return (
    isPicksSection ||
    isProfileSection ||
    isPoolsSection ||
    isStandingsSection ||
    isStatsSection ||
    (!isPicksSection &&
      !isProfileSection &&
      !isPoolsSection &&
      !isStandingsSection &&
      !isStatsSection &&
      (pathname === item.path ||
        (item.path === '/dashboard' && pathname === '/dashboard/')))
  );
}
