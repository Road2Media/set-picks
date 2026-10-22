import React from 'react';

import {
  NAV_LABEL_MAKE_PICKS,
  NAV_LABEL_PICKS_LAB,
  NAV_LABEL_REWIND,
  NAV_LABEL_SCORECARD,
} from '../../../shared/config/dashboardVocabulary';
import { PICKS_CLUSTER_PATHS } from '../../../shared/config/dashboardRoutes';
import DashboardMobileChromeBar from '../../../shared/ui/DashboardMobileChromeBar';
import ChromeSegmentedControl from '../../../shared/ui/ChromeSegmentedControl';

/** Nested mount for Make Picks tools under the tertiary tray (same portal). */
export const PICKS_CLUSTER_MOBILE_TOOLS_ROOT_ID = 'picks-cluster-mobile-tools-root';

/**
 * Mobile-only Picks cluster chrome (#766) — fixed under the context bar.
 * Same Make Picks / Picks Lab / Scorecard segmented control as the in-page desktop tray.
 *
 * @param {{
 *   items: Array<{ to: string, label: string, end?: boolean }>,
 * }} props
 */
export default function PicksClusterMobileChrome({ items }) {
  return (
    <DashboardMobileChromeBar
      heading="Picks sections"
      headingId="picks-cluster-mobile-chrome-heading"
    >
      <ChromeSegmentedControl ariaLabel="Picks sections" items={items} />
    </DashboardMobileChromeBar>
  );
}

export function buildPicksClusterNavItems(makePicksTo, options = {}) {
  const items = [
    { to: makePicksTo, label: NAV_LABEL_MAKE_PICKS, end: true },
    { to: PICKS_CLUSTER_PATHS.lab, label: NAV_LABEL_PICKS_LAB, end: true },
    { to: PICKS_CLUSTER_PATHS.scorecard, label: NAV_LABEL_SCORECARD, end: true },
  ];
  if (options.includeRewind) {
    items.push({
      to: PICKS_CLUSTER_PATHS.rewind,
      label: NAV_LABEL_REWIND,
      end: true,
    });
  }
  return items;
}
