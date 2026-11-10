import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/firebaseRemoteConfig', () => ({
  loadFirebaseRemoteConfig: vi.fn(),
}));

import { loadFirebaseRemoteConfig } from '../../../shared/lib/firebaseRemoteConfig';
import { fetchAdSlotPayload } from './remoteConfigAdProvider';

describe('fetchAdSlotPayload', () => {
  beforeEach(() => {
    loadFirebaseRemoteConfig.mockReset();
  });

  it('does not fetch Remote Config for an unknown slot', async () => {
    await expect(fetchAdSlotPayload('dashboard_picks_inline')).resolves.toBeNull();
    expect(loadFirebaseRemoteConfig).not.toHaveBeenCalled();
  });

  it('reads the kill switch and the standings parameter', async () => {
    loadFirebaseRemoteConfig.mockResolvedValue({
      getBoolean: vi.fn(() => false),
      getString: vi.fn(() => ''),
    });
    await expect(fetchAdSlotPayload('dashboard_standings_inline')).resolves.toEqual({
      adsEnabled: false,
      rawValue: '',
    });
    expect(loadFirebaseRemoteConfig).toHaveBeenCalledTimes(1);
  });
});
