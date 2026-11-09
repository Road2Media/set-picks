import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import {
  trackPhishIqFinish,
  trackPhishIqShare,
  trackPhishIqSignUp,
  trackPhishIqStart,
} from './phishIqAnalytics';

describe('phish IQ analytics', () => {
  beforeEach(() => {
    ga4Event.mockClear();
  });

  it('emits start, finish, share, and sign-up without song titles', () => {
    trackPhishIqStart({ quiz_date: '2026-11-09' });
    trackPhishIqFinish({ quiz_date: '2026-11-09', score: 4 });
    trackPhishIqShare({ quiz_date: '2026-11-09', score: 4 });
    trackPhishIqSignUp({ quiz_date: '2026-11-09' });
    expect(ga4Event.mock.calls.map((call) => call[0])).toEqual([
      'phish_iq_start',
      'phish_iq_finish',
      'phish_iq_share',
      'phish_iq_sign_up',
    ]);
    const params = JSON.stringify(ga4Event.mock.calls.map((call) => call[1]));
    expect(params).not.toMatch(/song|title|prompt/i);
    expect(params).toContain('"score":4');
  });
});
