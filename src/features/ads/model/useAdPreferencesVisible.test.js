import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/firebaseRemoteConfig', () => ({
  loadFirebaseRemoteConfig: vi.fn(),
}));

import { loadFirebaseRemoteConfig } from '../../../shared/lib/firebaseRemoteConfig';
import { ADS_ENABLED_PARAMETER } from '../config/adSlots';
import { PROGRAMMATIC_ADS_ENABLED_PARAMETER } from '../config/programmaticSlots';
import { readAdPreferencesVisible } from './useAdPreferencesVisible';

const envOff = {};

describe('readAdPreferencesVisible', () => {
  beforeEach(() => {
    loadFirebaseRemoteConfig.mockReset();
  });

  it('stays hidden when Remote Config is at the in-app default', async () => {
    loadFirebaseRemoteConfig.mockResolvedValue({
      getBoolean: () => false,
    });
    await expect(readAdPreferencesVisible(envOff)).resolves.toBe(false);
  });

  it('shows when ads are enabled', async () => {
    loadFirebaseRemoteConfig.mockResolvedValue({
      getBoolean: (key) => key === ADS_ENABLED_PARAMETER,
    });
    await expect(readAdPreferencesVisible(envOff)).resolves.toBe(true);
  });

  it('stays hidden when the programmatic flag is on and ads are not', async () => {
    loadFirebaseRemoteConfig.mockResolvedValue({
      getBoolean: (key) => key === PROGRAMMATIC_ADS_ENABLED_PARAMETER,
    });
    await expect(
      readAdPreferencesVisible({
        VITE_PROGRAMMATIC_ADS_PROVIDER: 'ethicalads',
        VITE_ETHICALADS_PUBLISHER: 'setlist-pickem',
        VITE_CMP_PROVIDER: 'google-funding-choices',
        VITE_CMP_SITE_ID: 'pub-12345678',
      }),
    ).resolves.toBe(false);
  });

  it('stays hidden when Remote Config fails', async () => {
    loadFirebaseRemoteConfig.mockRejectedValue(new Error('remote-config-down'));
    await expect(readAdPreferencesVisible(envOff)).resolves.toBe(false);
  });
});
