import { ensureAppCheckNow } from './firebaseAppCheck';
import { ensureFirebase } from './ensureFirebase';
import { isProductionHostname } from './productionHosts';

// Remote Config stays off the splash graph. The ads feature calls this on the
// first placement mount (epic #419 / #121). The SDK itself is a dynamic import.
//
// Fetch floor (#420): one successful fetch per 60 seconds, not a poll. The
// module singleton means a dashboard navigation does not call fetch again.
// Live updates are attached only while a creative is on screen, so a kill
// switch publish can clear an open Standings tab without a reload.

const FETCH_TIMEOUT_MS = 8000;
const APP_CHECK_WAIT_MS = 4000;

/** Production and dev share a 60 second floor so a kill switch is visible in under 5 minutes. */
export const REMOTE_CONFIG_PROD_MIN_FETCH_INTERVAL_MS = 60 * 1000;
export const REMOTE_CONFIG_DEV_MIN_FETCH_INTERVAL_MS = 60 * 1000;

/** Custom signal name. Console conditions match `development`, `staging`, or `production`. */
export const RELEASE_CHANNEL_SIGNAL = 'release_channel';

/**
 * @param {boolean} isDev
 * @returns {number}
 */
export function remoteConfigMinFetchIntervalMs(isDev) {
  return isDev
    ? REMOTE_CONFIG_DEV_MIN_FETCH_INTERVAL_MS
    : REMOTE_CONFIG_PROD_MIN_FETCH_INTERVAL_MS;
}

/**
 * In-app default (modular `defaultConfig`, the `setDefaults` equivalent).
 * Stays false until a published console value says otherwise. A missing
 * parameter or a failed fetch resolves through this default.
 * `programmatic_ads_enabled` is the Phase 4 proof of concept (#422). It stays
 * false, and `ads_enabled` false still blocks that slot.
 * @returns {{ ads_enabled: string, programmatic_ads_enabled: string }}
 */
export function buildRemoteConfigDefaults() {
  return {
    ads_enabled: 'false',
    programmatic_ads_enabled: 'false',
  };
}

/**
 * One Firebase project serves every host. The signal lets a console condition
 * target staging without turning the unit on for production.
 *
 * @param {{ isDev?: boolean, hostname?: string }} [env]
 * @returns {'development' | 'staging' | 'production'}
 */
export function resolveReleaseChannel({ isDev = import.meta.env.DEV, hostname } = {}) {
  if (isDev) return 'development';
  const host = hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  if (isProductionHostname(host)) return 'production';
  return 'staging';
}

/** @type {Promise<{ getBoolean: (key: string) => boolean, getString: (key: string) => string }> | null} */
let modulePromise = null;

/** @type {import('firebase/remote-config').RemoteConfig | null} */
let remoteConfigInstance = null;
/** @type {typeof import('firebase/remote-config') | null} */
let remoteConfigMod = null;
/** @type {(() => void) | null} */
let configUpdateUnsubscribe = null;
/** @type {Set<() => void>} */
const activationListeners = new Set();

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('remote-config-timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function notifyActivations() {
  for (const listener of [...activationListeners]) {
    try {
      listener();
    } catch {
      // One listener cannot block the kill switch.
    }
  }
}

function detachConfigUpdatesIfIdle() {
  if (activationListeners.size > 0) return;
  if (configUpdateUnsubscribe) {
    configUpdateUnsubscribe();
    configUpdateUnsubscribe = null;
  }
}

function attachConfigUpdates() {
  if (configUpdateUnsubscribe) return;
  if (
    !remoteConfigInstance ||
    !remoteConfigMod ||
    typeof remoteConfigMod.onConfigUpdate !== 'function'
  ) {
    return;
  }
  configUpdateUnsubscribe = remoteConfigMod.onConfigUpdate(remoteConfigInstance, {
    next() {
      const activate = remoteConfigMod.activate(remoteConfigInstance);
      Promise.resolve(activate).then(notifyActivations, notifyActivations);
    },
    error() {},
    complete() {},
  });
}

async function startRemoteConfig() {
  await Promise.race([
    ensureAppCheckNow().catch(() => undefined),
    new Promise((resolve) => {
      setTimeout(resolve, APP_CHECK_WAIT_MS);
    }),
  ]);

  const { app } = await ensureFirebase();
  const mod = await import('firebase/remote-config');
  const remoteConfig = mod.getRemoteConfig(app);
  remoteConfig.settings.minimumFetchIntervalMillis = remoteConfigMinFetchIntervalMs(
    import.meta.env.DEV,
  );
  remoteConfig.defaultConfig = buildRemoteConfigDefaults();
  remoteConfigMod = mod;
  remoteConfigInstance = remoteConfig;

  try {
    if (typeof mod.setCustomSignals === 'function') {
      await mod.setCustomSignals(remoteConfig, {
        [RELEASE_CHANNEL_SIGNAL]: resolveReleaseChannel(),
      });
    }
  } catch {
    // Conditions will not match. The in-app default stays off.
  }

  try {
    await withTimeout(mod.fetchAndActivate(remoteConfig), FETCH_TIMEOUT_MS);
  } catch {
    // Defaults stay in place. A failed fetch renders no unit.
  }

  return {
    getBoolean(key) {
      return mod.getValue(remoteConfig, key).asBoolean();
    },
    getString(key) {
      return mod.getValue(remoteConfig, key).asString();
    },
  };
}

/**
 * Lazy Remote Config singleton. Rejects only when the SDK cannot load;
 * a failed fetch still resolves with in-app defaults (`ads_enabled` false).
 */
export function loadFirebaseRemoteConfig() {
  if (!modulePromise) {
    modulePromise = startRemoteConfig().catch((error) => {
      modulePromise = null;
      remoteConfigMod = null;
      remoteConfigInstance = null;
      throw error;
    });
  }
  return modulePromise;
}

/**
 * Listen for a published template. Opens one live connection for the whole
 * page, and closes it when the last listener leaves. Call this only while a
 * creative is showing so an off switch does not keep a connection open.
 *
 * @param {() => void} listener
 * @returns {Promise<() => void>}
 */
export function subscribeRemoteConfigActivations(listener) {
  if (typeof listener !== 'function') return Promise.resolve(() => {});
  activationListeners.add(listener);
  const remove = () => {
    activationListeners.delete(listener);
    detachConfigUpdatesIfIdle();
  };
  return loadFirebaseRemoteConfig()
    .then(() => {
      if (!activationListeners.has(listener)) return remove;
      attachConfigUpdates();
      return remove;
    })
    .catch(() => {
      remove();
      return remove;
    });
}
