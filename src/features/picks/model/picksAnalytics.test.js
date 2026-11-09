import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import { trackScorecardMetricImpression, trackScorecardOpen } from './picksAnalytics';

describe('scorecard analytics (#767)', () => {
  beforeEach(() => {
    ga4Event.mockClear();
  });

  it('trackScorecardOpen emits show_date + lock_state', () => {
    trackScorecardOpen({ show_date: '2026-07-19', lock_state: 'pre_lock' });
    expect(ga4Event).toHaveBeenCalledWith('scorecard_open', {
      show_date: '2026-07-19',
      lock_state: 'pre_lock',
    });
  });

  it('trackScorecardOpen drops unknown lock_state', () => {
    trackScorecardOpen({ show_date: '2026-07-19', lock_state: 'maybe' });
    expect(ga4Event).toHaveBeenCalledWith('scorecard_open', {
      show_date: '2026-07-19',
      lock_state: '',
    });
  });

  it('trackScorecardMetricImpression allows overlap | crowd | rank', () => {
    trackScorecardMetricImpression({ show_date: '2026-07-19', metric: 'overlap' });
    trackScorecardMetricImpression({ show_date: '2026-07-19', metric: 'crowd' });
    trackScorecardMetricImpression({ show_date: '2026-07-19', metric: 'rank' });
    expect(ga4Event).toHaveBeenNthCalledWith(1, 'scorecard_metric_impression', {
      show_date: '2026-07-19',
      metric: 'overlap',
    });
    expect(ga4Event).toHaveBeenNthCalledWith(2, 'scorecard_metric_impression', {
      show_date: '2026-07-19',
      metric: 'crowd',
    });
    expect(ga4Event).toHaveBeenNthCalledWith(3, 'scorecard_metric_impression', {
      show_date: '2026-07-19',
      metric: 'rank',
    });
  });

  it('trackScorecardMetricImpression drops unknown metric', () => {
    trackScorecardMetricImpression({ show_date: '2026-07-19', metric: 'odds' });
    expect(ga4Event).toHaveBeenCalledWith('scorecard_metric_impression', {
      show_date: '2026-07-19',
      metric: '',
    });
  });
});
