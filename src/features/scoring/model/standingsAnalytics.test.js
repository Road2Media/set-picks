import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import {
  resolveLiveSetlistStatus,
  trackLiveSetlistDegradedBannerCleared,
  trackLiveSetlistDegradedBannerView,
  trackLiveSetlistView,
} from './standingsAnalytics.js';

describe('resolveLiveSetlistStatus', () => {
  it('maps LIVE / PAST / other', () => {
    expect(resolveLiveSetlistStatus('LIVE')).toBe('live');
    expect(resolveLiveSetlistStatus('PAST')).toBe('final');
    expect(resolveLiveSetlistStatus('NEXT')).toBe('waiting');
    expect(resolveLiveSetlistStatus('')).toBe('waiting');
  });
});

describe('trackLiveSetlistView', () => {
  beforeEach(() => {
    ga4Event.mockClear();
  });

  it('emits live_setlist_view with show_date and setlist_status', () => {
    trackLiveSetlistView({
      show_date: '2026-07-15',
      setlist_status: 'live',
    });
    expect(ga4Event).toHaveBeenCalledWith('live_setlist_view', {
      show_date: '2026-07-15',
      setlist_status: 'live',
    });
  });

  it('defaults empty date and waiting status', () => {
    trackLiveSetlistView();
    expect(ga4Event).toHaveBeenCalledWith('live_setlist_view', {
      show_date: '',
      setlist_status: 'waiting',
    });
  });
});

describe('live setlist degraded banner analytics (#644)', () => {
  beforeEach(() => {
    ga4Event.mockClear();
  });

  it('emits a view without an error body', () => {
    trackLiveSetlistDegradedBannerView({
      show_date: '2026-07-17',
      activated_by: 'automation',
    });
    expect(ga4Event).toHaveBeenCalledWith('live_setlist_degraded_banner_view', {
      show_date: '2026-07-17',
      activated_by: 'automation',
    });
  });

  it('emits a clear and clamps unknown activation to automation', () => {
    trackLiveSetlistDegradedBannerCleared({
      show_date: '2026-07-17',
      activated_by: 'html',
    });
    expect(ga4Event).toHaveBeenCalledWith('live_setlist_degraded_banner_cleared', {
      show_date: '2026-07-17',
      activated_by: 'automation',
    });
  });
});
