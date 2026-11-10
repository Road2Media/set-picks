import { describe, expect, it } from 'vitest';

import {
  NAV_LABEL_ACCOUNT,
  NAV_LABEL_ADMIN,
  NAV_LABEL_PICKS,
  NAV_LABEL_POOLS,
  NAV_LABEL_STANDINGS,
  NAV_LABEL_STATS,
} from '../../../shared/config/dashboardVocabulary';
import { buildDashboardNavItems, isDashboardNavItemActive } from './dashboardNav.js';

const items = buildDashboardNavItems(true);

function activeNames(pathname) {
  return items.filter((item) => isDashboardNavItemActive(item, pathname)).map((item) => item.name);
}

describe('isDashboardNavItemActive (#707)', () => {
  it('keeps exactly one primary active, including pool details and the account cluster', () => {
    const cases = [
      ['/dashboard', NAV_LABEL_PICKS],
      ['/dashboard/', NAV_LABEL_PICKS],
      ['/dashboard/picks', NAV_LABEL_PICKS],
      ['/dashboard/picks/lab', NAV_LABEL_PICKS],
      ['/dashboard/picks/scorecard', NAV_LABEL_PICKS],
      ['/dashboard/rewind', NAV_LABEL_PICKS],
      ['/dashboard/phish-iq', NAV_LABEL_PICKS],
      ['/dashboard/pools', NAV_LABEL_POOLS],
      ['/dashboard/pools/create', NAV_LABEL_POOLS],
      ['/dashboard/pools/join', NAV_LABEL_POOLS],
      ['/dashboard/pool/abc123', NAV_LABEL_POOLS],
      ['/dashboard/standings', NAV_LABEL_STANDINGS],
      ['/dashboard/standings/', NAV_LABEL_STANDINGS],
      ['/dashboard/stats', NAV_LABEL_STATS],
      ['/dashboard/stats/personal', NAV_LABEL_STATS],
      ['/dashboard/stats/global', NAV_LABEL_STATS],
      ['/dashboard/stats/band', NAV_LABEL_STATS],
      ['/dashboard/stats/night', NAV_LABEL_STATS],
      ['/dashboard/tour-stats', NAV_LABEL_STATS],
      ['/dashboard/profile', NAV_LABEL_ACCOUNT],
      ['/dashboard/profile/notifications', NAV_LABEL_ACCOUNT],
      ['/dashboard/profile/account', NAV_LABEL_ACCOUNT],
      ['/dashboard/notifications', NAV_LABEL_ACCOUNT],
      ['/dashboard/account-security', NAV_LABEL_ACCOUNT],
      ['/dashboard/admin', NAV_LABEL_ADMIN],
    ];

    for (const [pathname, expected] of cases) {
      expect(activeNames(pathname), pathname).toEqual([expected]);
    }
  });

  it('omits admin when the player is not an admin', () => {
    const playerItems = buildDashboardNavItems(false);
    expect(playerItems.map((item) => item.name)).not.toContain(NAV_LABEL_ADMIN);
    expect(playerItems).toHaveLength(5);
  });
});
