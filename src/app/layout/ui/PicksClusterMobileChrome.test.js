import { describe, expect, it } from 'vitest';

import { PICKS_CLUSTER_PATHS } from '../../../shared/config/dashboardRoutes';
import {
  NAV_LABEL_MAKE_PICKS,
  NAV_LABEL_PICKS_LAB,
  NAV_LABEL_REWIND,
  NAV_LABEL_SCORECARD,
} from '../../../shared/config/dashboardVocabulary';
import { buildPicksClusterNavItems } from './PicksClusterMobileChrome';

describe('buildPicksClusterNavItems', () => {
  it('keeps Lab and Scorecard visible and exact-match Make Picks', () => {
    const items = buildPicksClusterNavItems(PICKS_CLUSTER_PATHS.makePicks);
    expect(items.map((item) => item.label)).toEqual([
      NAV_LABEL_MAKE_PICKS,
      NAV_LABEL_PICKS_LAB,
      NAV_LABEL_SCORECARD,
    ]);
    expect(items.every((item) => item.end === true)).toBe(true);
    expect(items.map((item) => item.to)).toEqual([
      PICKS_CLUSTER_PATHS.makePicks,
      PICKS_CLUSTER_PATHS.lab,
      PICKS_CLUSTER_PATHS.scorecard,
    ]);
    expect(items.map((item) => item.to)).not.toContain(PICKS_CLUSTER_PATHS.phishIq);
  });

  it('adds Rewind only when the flag asks for it', () => {
    const items = buildPicksClusterNavItems(PICKS_CLUSTER_PATHS.makePicks, {
      includeRewind: true,
    });
    expect(items.map((item) => item.label)).toEqual([
      NAV_LABEL_MAKE_PICKS,
      NAV_LABEL_PICKS_LAB,
      NAV_LABEL_SCORECARD,
      NAV_LABEL_REWIND,
    ]);
    expect(items[3].to).toBe(PICKS_CLUSTER_PATHS.rewind);
  });
});
