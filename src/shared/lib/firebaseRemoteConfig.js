import { ensureAppCheckNow } from './firebaseAppCheck';
import { ensureFirebase } from './ensureFirebase';

// Remote Config stays off the splash graph. The ads feature calls this on the
// first placement mount (epic #419 / #121). The SDK itself is a dynamic import.

const FETCH_TIMEOUT_MS = 8000;
const APP_CHECK_WAIT_MS = 4000;
const PROD_FETCH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DEV_FETCH_INTERVAL_MS = 60 * 1000;

/** @type {Promise<{ getBoolean: (key: string) => boolean, getString: (key: string) => string }> | null} */
let modulePromise = null;

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
  remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV
    ? DEV_FETCH_INTERVAL_MS
    : PROD_FETCH_INTERVAL_MS;
  remoteConfig.defaultConfig = {
    ads_enabled: 'false',
  };

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
      throw error;
    });
  }
  return modulePromise;
}
