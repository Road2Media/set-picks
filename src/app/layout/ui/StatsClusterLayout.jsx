import React from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation } from 'react-router-dom';

import { FeatureNewBadge, useFeatureSpotlight } from '../../../features/feature-discovery';
import { StatsEmbedShareRow } from '../../../features/stats-embed';
import {
  STATS_CLUSTER_PATHS,
  isPersonalStatsPath,
  normalizeDashboardPathname,
} from '../../../shared/config/dashboardRoutes';
import {
  useDashboardDesktopPageChromePortal,
  useDashboardMobileChromePortal,
} from '../../../shared/hooks/useDashboardMobileChromePortal';
import { NAV_LABEL_STATS } from '../../../shared/config/dashboardVocabulary';
import ChromeSegmentedControl from '../../../shared/ui/ChromeSegmentedControl';
import DashboardStickyPageChrome from '../../../shared/ui/DashboardStickyPageChrome';
import StatsClusterMobileChrome, {
  buildStatsClusterNavItems,
} from './StatsClusterMobileChrome';

/**
 * Persistent Stats-cluster sub-navigation (Personal / Global / Band).
 * Nested routes render via {@link Outlet}.
 * Mobile: tertiary tray portals under the context bar (Profile cluster pattern).
 * Desktop: title + tray portaled into the layout sticky stack.
 *
 * @param {{ user: import('firebase/auth').User | null | undefined }} props
 */
export default function StatsClusterLayout({ user }) {
  const location = useLocation();
  const mobileChromeRoot = useDashboardMobileChromePortal();
  const desktopChromeRoot = useDashboardDesktopPageChromePortal();
  const tourStatsSpotlight = useFeatureSpotlight('tour-stats');
  const personalTo = isPersonalStatsPath(location.pathname)
    ? normalizeDashboardPathname(location.pathname)
    : STATS_CLUSTER_PATHS.root;
  const items = buildStatsClusterNavItems(personalTo, {
    badge: tourStatsSpotlight.active ? (
      <FeatureNewBadge variant="dot" title="New: Tour Stats" />
    ) : null,
    onBandClick: tourStatsSpotlight.active
      ? () => tourStatsSpotlight.trackClick()
      : undefined,
  });

  return (
    <div className="max-w-xl mx-auto pb-6 md:pb-12">
      {mobileChromeRoot
        ? createPortal(<StatsClusterMobileChrome items={items} />, mobileChromeRoot)
        : null}

      {desktopChromeRoot
        ? createPortal(
            <DashboardStickyPageChrome title={NAV_LABEL_STATS}>
              <ChromeSegmentedControl ariaLabel="Stats sections" items={items} />
            </DashboardStickyPageChrome>,
            desktopChromeRoot,
          )
        : null}
      <Outlet context={{ user }} />
      <StatsEmbedShareRow />
    </div>
  );
}
