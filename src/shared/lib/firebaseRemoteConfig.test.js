import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  ensureFirebase: vi.fn(async () => ({ app: { name: 'test' } })),
  ensureAppCheckNow: vi.fn(async () => undefined),
  getRemoteConfig: vi.fn(() => ({ settings: {}, defaultConfig: {} })),
  fetchAndActivate: vi.fn(async () => true),
  activate: vi.fn(async () => true),
  setCustomSignals: vi.fn(async () => undefined),
  onConfigUpdate: vi.fn(() => vi.fn()),
  getValue: vi.fn(() => ({
    asBoolean: () => false,
    asString: () => '',
  })),
  configUnsubscribe: vi.fn(),
}));

vi.mock('./ensureFirebase', () => ({
  ensureFirebase: h.ensureFirebase,
}));

vi.mock('./firebaseAppCheck', () => ({
  ensureAppCheckNow: h.ensureAppCheckNow,
}));

vi.mock('firebase/remote-config', () => ({
  getRemoteConfig: h.getRemoteConfig,
  fetchAndActivate: h.fetchAndActivate,
  activate: h.activate,
  setCustomSignals: h.setCustomSignals,
  onConfigUpdate: h.onConfigUpdate,
  getValue: h.getValue,
}));

async function loadModule() {
  vi.resetModules();
  return import('./firebaseRemoteConfig.js');
}

describe('resolveReleaseChannel', () => {
  it('splits local, staging, and production hosts', async () => {
    const mod = await loadModule();
    expect(mod.resolveReleaseChannel({ isDev: true, hostname: 'www.setlistpickem.com' })).toBe(
      'development',
    );
    expect(mod.resolveReleaseChannel({ isDev: false, hostname: 'www.setlistpickem.com' })).toBe(
      'production',
    );
    expect(mod.resolveReleaseChannel({ isDev: false, hostname: 'setlistpickem.com' })).toBe(
      'production',
    );
    expect(
      mod.resolveReleaseChannel({
        isDev: false,
        hostname: 'set-picks-git-staging-pat-4867s-projects.vercel.app',
      }),
    ).toBe('staging');
    expect(mod.resolveReleaseChannel({ isDev: false, hostname: 'localhost' })).toBe('staging');
  });
});

describe('remote config defaults and fetch floor', () => {
  it('keeps the kill switch off and the fetch floor under five minutes', async () => {
    const mod = await loadModule();
    expect(mod.buildRemoteConfigDefaults()).toEqual({
      ads_enabled: 'false',
      programmatic_ads_enabled: 'false',
    });
    expect(mod.remoteConfigMinFetchIntervalMs(false)).toBe(60 * 1000);
    expect(mod.remoteConfigMinFetchIntervalMs(true)).toBe(60 * 1000);
    expect(mod.REMOTE_CONFIG_PROD_MIN_FETCH_INTERVAL_MS).toBeLessThan(5 * 60 * 1000);
  });
});

describe('loadFirebaseRemoteConfig', () => {
  beforeEach(() => {
    h.ensureFirebase.mockClear();
    h.ensureAppCheckNow.mockClear();
    h.fetchAndActivate.mockReset();
    h.fetchAndActivate.mockResolvedValue(true);
    h.activate.mockReset();
    h.activate.mockResolvedValue(true);
    h.setCustomSignals.mockReset();
    h.setCustomSignals.mockResolvedValue(undefined);
    h.onConfigUpdate.mockReset();
    h.configUnsubscribe.mockReset();
    h.onConfigUpdate.mockImplementation(() => h.configUnsubscribe);
    h.getRemoteConfig.mockReset();
    h.getRemoteConfig.mockImplementation(() => ({ settings: {}, defaultConfig: {} }));
    h.getValue.mockReset();
    h.getValue.mockImplementation(() => ({
      asBoolean: () => false,
      asString: () => '',
    }));
  });

  it('fetches once per page and does not open a live listener', async () => {
    const mod = await loadModule();
    const order = [];
    h.setCustomSignals.mockImplementation(async () => {
      order.push('signals');
    });
    h.fetchAndActivate.mockImplementation(async () => {
      order.push('fetch');
    });

    const first = await mod.loadFirebaseRemoteConfig();
    const second = await mod.loadFirebaseRemoteConfig();
    expect(second).toBe(first);
    expect(h.fetchAndActivate).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['signals', 'fetch']);
    expect(h.onConfigUpdate).not.toHaveBeenCalled();

    const rc = h.getRemoteConfig.mock.results.at(-1).value;
    expect(rc.settings.minimumFetchIntervalMillis).toBe(
      mod.remoteConfigMinFetchIntervalMs(import.meta.env.DEV),
    );
    expect(rc.defaultConfig).toEqual({
      ads_enabled: 'false',
      programmatic_ads_enabled: 'false',
    });
    expect(h.setCustomSignals).toHaveBeenCalledWith(rc, { release_channel: 'development' });
    expect(first.getBoolean('ads_enabled')).toBe(false);
  });

  it('still fetches when the channel signal fails', async () => {
    h.setCustomSignals.mockRejectedValueOnce(new Error('signals'));
    const mod = await loadModule();
    await expect(mod.loadFirebaseRemoteConfig()).resolves.toBeTruthy();
    expect(h.fetchAndActivate).toHaveBeenCalledTimes(1);
  });

  it('resolves with defaults when the fetch fails', async () => {
    h.fetchAndActivate.mockRejectedValueOnce(new Error('offline'));
    const mod = await loadModule();
    const api = await mod.loadFirebaseRemoteConfig();
    expect(api.getBoolean('ads_enabled')).toBe(false);
    expect(api.getString('dashboard_standings_inline')).toBe('');
  });

  it('retries after the SDK fails to load', async () => {
    h.getRemoteConfig.mockImplementationOnce(() => {
      throw new Error('no-idb');
    });
    const mod = await loadModule();
    await expect(mod.loadFirebaseRemoteConfig()).rejects.toThrow('no-idb');
    await expect(mod.loadFirebaseRemoteConfig()).resolves.toBeTruthy();
    expect(h.fetchAndActivate).toHaveBeenCalledTimes(1);
  });

  it('shares one live listener and detaches it when idle', async () => {
    const mod = await loadModule();
    await mod.loadFirebaseRemoteConfig();
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = await mod.subscribeRemoteConfigActivations(a);
    const unsubB = await mod.subscribeRemoteConfigActivations(b);
    expect(h.onConfigUpdate).toHaveBeenCalledTimes(1);

    const observer = h.onConfigUpdate.mock.calls[0][1];
    observer.next({ getUpdatedKeys: () => new Set(['ads_enabled']) });
    await h.activate.mock.results[0].value;
    await Promise.resolve();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    expect(h.configUnsubscribe).not.toHaveBeenCalled();
    unsubB();
    expect(h.configUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
