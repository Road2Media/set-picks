import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/ga4', () => ({
  ga4Event: vi.fn(),
}));

import { ga4Event } from '../../../shared/lib/ga4';
import {
  catalogFallbackReason,
  resetSongCatalogFallbackTrackingForTests,
  trackSongCatalogFallback,
} from './songCatalogAnalytics.js';

describe('catalogFallbackReason', () => {
  it('stays quiet while loading and when Storage data is in use', () => {
    expect(catalogFallbackReason({ resolved: false, source: 'fallback' })).toBeNull();
    expect(
      catalogFallbackReason({ resolved: true, source: 'cdn', loadError: new Error('x') }),
    ).toBeNull();
  });

  it('names a bundled fallback with or without a load error', () => {
    expect(
      catalogFallbackReason({
        resolved: true,
        source: 'fallback',
        loadError: new Error('Song catalog JSON missing songs array.'),
      }),
    ).toBe('load_error');
    expect(catalogFallbackReason({ resolved: true, source: 'fallback', loadError: null })).toBe(
      'unavailable',
    );
  });
});

describe('trackSongCatalogFallback', () => {
  beforeEach(() => {
    ga4Event.mockClear();
    resetSongCatalogFallbackTrackingForTests();
  });

  it('sends one session event with reason only', () => {
    trackSongCatalogFallback({ reason: 'load_error' });
    trackSongCatalogFallback({ reason: 'load_error' });
    expect(ga4Event).toHaveBeenCalledTimes(1);
    expect(ga4Event).toHaveBeenCalledWith('song_catalog_fallback', {
      reason: 'load_error',
    });
  });

  it('clamps an unknown reason and does not attach the error', () => {
    trackSongCatalogFallback({ reason: 'https://storage.googleapis.com/secret' });
    expect(ga4Event).toHaveBeenCalledWith('song_catalog_fallback', {
      reason: 'unavailable',
    });
  });
});
