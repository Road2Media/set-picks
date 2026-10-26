import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import { trackRewindLock, trackRewindShare, trackRewindStart } from './rewindAnalytics';

describe('rewind analytics (#1142)', () => {
  beforeEach(() => {
    ga4Event.mockClear();
  });

  it('emits start, lock, and share without song titles', () => {
    trackRewindStart({ week_id: '2026-11-23', show_date: '1995-12-31' });
    trackRewindLock({ week_id: '2026-11-23', show_date: '1995-12-31', score: 40 });
    trackRewindShare({ week_id: '2026-11-23' });
    expect(ga4Event).toHaveBeenNthCalledWith(1, 'rewind_start', {
      week_id: '2026-11-23',
      show_date: '1995-12-31',
    });
    expect(ga4Event).toHaveBeenNthCalledWith(2, 'rewind_lock', {
      week_id: '2026-11-23',
      show_date: '1995-12-31',
      score: 40,
    });
    expect(ga4Event).toHaveBeenNthCalledWith(3, 'rewind_share', {
      week_id: '2026-11-23',
    });
    const blob = JSON.stringify(ga4Event.mock.calls);
    expect(blob).not.toContain('Wilson');
  });
});
