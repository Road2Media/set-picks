import { describe, expect, it } from 'vitest';

import { isMarketingTourStatsPath } from './scrollMarketingToTop';

describe('isMarketingTourStatsPath', () => {
  it('matches public tour-stats hub and slug routes', () => {
    expect(isMarketingTourStatsPath('/tour-stats')).toBe(true);
    expect(isMarketingTourStatsPath('/tour-stats/2026-summer-tour')).toBe(true);
  });

  it('rejects dashboard and other marketing paths', () => {
    expect(isMarketingTourStatsPath('/')).toBe(false);
    expect(isMarketingTourStatsPath('/how-it-works')).toBe(false);
    expect(isMarketingTourStatsPath('/phish-at-msg')).toBe(false);
    expect(isMarketingTourStatsPath('/dashboard/tour-stats')).toBe(false);
  });
});
