import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/lib/firebaseRemoteConfig', () => ({
  loadFirebaseRemoteConfig: vi.fn(),
  subscribeRemoteConfigActivations: vi.fn(async () => () => {}),
}));

import {
  loadFirebaseRemoteConfig,
  subscribeRemoteConfigActivations,
} from '../../../shared/lib/firebaseRemoteConfig';
import { createRemoteConfigAdProvider } from './remoteConfigAdProvider';

const creative = {
  creative_id: 'install_pwa_v1',
  image_url: 'https://www.setlistpickem.com/branding/splash-vinyl-mark.webp',
  alt_text: 'Mark',
  headline: 'Faster picks on show night',
  cta_label: 'Install',
  destination_url: '/dashboard/profile',
  destination_type: 'internal',
};

describe('loadAdCreative', () => {
  beforeEach(() => {
    loadFirebaseRemoteConfig.mockReset();
    subscribeRemoteConfigActivations.mockClear();
  });

  it('does not fetch Remote Config for an unknown slot', async () => {
    const provider = createRemoteConfigAdProvider();
    await expect(provider.loadAdCreative('dashboard_picks_inline')).resolves.toBeNull();
    expect(loadFirebaseRemoteConfig).not.toHaveBeenCalled();
  });

  it('returns null when the kill switch is off', async () => {
    loadFirebaseRemoteConfig.mockResolvedValue({
      getBoolean: () => false,
      getString: () => JSON.stringify(creative),
    });
    const provider = createRemoteConfigAdProvider();
    await expect(
      provider.loadAdCreative('dashboard_standings_inline', { surface: 'dashboard-standings' }),
    ).resolves.toBeNull();
  });

  it('returns null for invalid JSON and for a failed load', async () => {
    loadFirebaseRemoteConfig.mockResolvedValueOnce({
      getBoolean: () => true,
      getString: () => '{not json',
    });
    const provider = createRemoteConfigAdProvider();
    await expect(provider.loadAdCreative('dashboard_standings_inline')).resolves.toBeNull();

    loadFirebaseRemoteConfig.mockRejectedValueOnce(new Error('offline'));
    await expect(provider.loadAdCreative('dashboard_standings_inline')).resolves.toBeNull();
  });

  it('returns null when context is not an object', async () => {
    const provider = createRemoteConfigAdProvider();
    await expect(
      provider.loadAdCreative('dashboard_standings_inline', 'production'),
    ).resolves.toBeNull();
    expect(loadFirebaseRemoteConfig).not.toHaveBeenCalled();
  });

  it('returns a creative when the flag is on and the JSON is valid', async () => {
    loadFirebaseRemoteConfig.mockResolvedValue({
      getBoolean: () => true,
      getString: () => JSON.stringify(creative),
    });
    const provider = createRemoteConfigAdProvider();
    await expect(provider.loadAdCreative('dashboard_standings_inline')).resolves.toMatchObject({
      creative_id: 'install_pwa_v1',
      destination_url: '/dashboard/profile',
    });
  });
});

describe('watchSlot', () => {
  beforeEach(() => {
    subscribeRemoteConfigActivations.mockReset();
    subscribeRemoteConfigActivations.mockResolvedValue(() => {});
  });

  it('does not listen for an unknown slot', () => {
    const provider = createRemoteConfigAdProvider();
    const stop = provider.watchSlot('dashboard_picks_inline', () => {});
    expect(subscribeRemoteConfigActivations).not.toHaveBeenCalled();
    stop();
  });

  it('listens for a known slot and detaches', async () => {
    const unsubscribe = vi.fn();
    subscribeRemoteConfigActivations.mockResolvedValue(unsubscribe);
    const provider = createRemoteConfigAdProvider();
    const onChange = vi.fn();
    const stop = provider.watchSlot('dashboard_standings_inline', onChange);
    await vi.waitFor(() => {
      expect(subscribeRemoteConfigActivations).toHaveBeenCalledWith(onChange);
    });
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
