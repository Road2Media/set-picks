/**
 * Advertising consent for a future third-party ad script (#421).
 *
 * House promos stay on Remote Config and do not call this module.
 * Auth, Firestore, and GA4 do not call this module.
 * The CMP script stays unmounted until both build-time values are set.
 */

import {
  AD_PREFERENCES_HREF,
  AD_PREFERENCES_SECTION_ID,
} from '../adPreferencesPath';

export { AD_PREFERENCES_HREF, AD_PREFERENCES_SECTION_ID };

/** localStorage record. Stays on the device. */
export const AD_CONSENT_STORAGE_KEY = 'set-picks:ad-consent';

export const AD_CONSENT_VERSION = 1;

/** The only provider this build knows how to load. */
export const CMP_PROVIDER_FUNDING_CHOICES = 'google-funding-choices';

/** Element id so the shell mounts the script at most once. */
export const CMP_SCRIPT_ELEMENT_ID = 'set-picks-cmp';

/**
 * Funding Choices install ids are either an AdSense `pub-` id or an
 * Ad Manager network code. Anything else is rejected so the src cannot
 * be pointed at another host.
 */
const SITE_ID_RE = /^(?:pub-[0-9]{8,20}|[0-9]{8,20})$/;

const CMP_SCRIPT_HOST = 'https://fundingchoicesmessages.google.com';

/**
 * @param {Record<string, string | undefined> | undefined} [env]
 */
export function readCmpConfig(env = import.meta.env) {
  const provider = String(env?.VITE_CMP_PROVIDER ?? '').trim();
  const siteId = String(env?.VITE_CMP_SITE_ID ?? '').trim();
  const recognized =
    provider === CMP_PROVIDER_FUNDING_CHOICES && SITE_ID_RE.test(siteId);
  return {
    provider: recognized ? provider : '',
    siteId: recognized ? siteId : '',
    enabled: recognized,
  };
}

/**
 * @param {string | null | undefined} raw
 * @returns {'unknown' | 'granted' | 'denied'}
 */
export function parseStoredAdChoice(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return 'unknown';
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== AD_CONSENT_VERSION) return 'unknown';
    if (parsed.advertising === 'granted' || parsed.advertising === 'denied') {
      return parsed.advertising;
    }
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

/**
 * @param {'granted' | 'denied'} choice
 * @param {Date} [now]
 */
export function serializeAdChoice(choice, now = new Date()) {
  if (choice !== 'granted' && choice !== 'denied') {
    throw new Error('ad consent choice must be granted or denied');
  }
  return JSON.stringify({
    v: AD_CONSENT_VERSION,
    advertising: choice,
    updatedAt: now.toISOString(),
  });
}

/**
 * @param {{ getItem?: (key: string) => string | null } | null | undefined} storage
 * @returns {'unknown' | 'granted' | 'denied'}
 */
export function readStoredAdChoice(storage) {
  if (!storage || typeof storage.getItem !== 'function') return 'unknown';
  try {
    return parseStoredAdChoice(storage.getItem(AD_CONSENT_STORAGE_KEY));
  } catch {
    return 'unknown';
  }
}

/**
 * @param {{ setItem?: (key: string, value: string) => void } | null | undefined} storage
 * @param {'granted' | 'denied'} choice
 * @param {Date} [now]
 * @returns {{ ok: boolean, reason: 'saved' | 'no-storage' | 'storage-failed' | 'invalid-choice' }}
 */
export function writeStoredAdChoice(storage, choice, now = new Date()) {
  if (choice !== 'granted' && choice !== 'denied') {
    return { ok: false, reason: 'invalid-choice' };
  }
  if (!storage || typeof storage.setItem !== 'function') {
    return { ok: false, reason: 'no-storage' };
  }
  try {
    storage.setItem(AD_CONSENT_STORAGE_KEY, serializeAdChoice(choice, now));
    return { ok: true, reason: 'saved' };
  } catch {
    return { ok: false, reason: 'storage-failed' };
  }
}

/**
 * IAB TCF advertising signal.
 *
 * Purpose 1 is storage and access on the device.
 * Purposes 2, 3, and 4 are ad selection or ad profiles.
 * A loaded decision allows advertising only when purpose 1 is granted
 * and at least one of 2, 3, or 4 is granted.
 *
 * `gdprApplies: false` is not an allow. A missing callback is not an allow.
 * `cmpuishown` is the banner, not a decision.
 *
 * @param {object | null | undefined} tcData
 * @returns {boolean}
 */
export function tcfAllowsAdvertising(tcData) {
  if (!tcData || typeof tcData !== 'object') return false;
  const status = tcData.eventStatus;
  if (status !== 'tcloaded' && status !== 'useractioncomplete') return false;
  const consents = tcData.purpose?.consents;
  if (!consents || consents['1'] !== true) return false;
  return consents['2'] === true || consents['3'] === true || consents['4'] === true;
}

/**
 * Strictest signal wins. The CMP has to be configured, and the player
 * off switch sticks even when the partner would allow a script.
 * An unknown local choice leaves the partner signal in charge.
 * With the CMP off, advertising stays blocked. A saved "allow" does not
 * load a script by itself.
 *
 * @param {{
 *   cmpEnabled?: boolean,
 *   storedChoice?: 'unknown' | 'granted' | 'denied',
 *   tcfAllows?: boolean,
 * }} input
 */
export function resolveAdConsent(input) {
  const cmpEnabled = input?.cmpEnabled === true;
  const stored = input?.storedChoice;
  const choice = stored === 'granted' || stored === 'denied' ? stored : 'unknown';
  const partnerAllows = cmpEnabled && input?.tcfAllows === true;
  const playerDenied = choice === 'denied';
  return {
    choice,
    cmpEnabled,
    advertisingAllowed: partnerAllows && !playerDenied,
    source: cmpEnabled ? 'cmp' : 'first-party',
  };
}

/**
 * The gate Phase 4 calls before inserting a third-party ad script.
 * House promos do not use it.
 *
 * @param {{ advertisingAllowed?: boolean, cmpEnabled?: boolean } | null | undefined} consent
 * @returns {boolean}
 */
export function canLoadThirdPartyAdScript(consent) {
  return Boolean(
    consent && consent.advertisingAllowed === true && consent.cmpEnabled === true,
  );
}

/**
 * @param {{ enabled?: boolean, provider?: string, siteId?: string } | null | undefined} config
 * @returns {string}
 */
export function buildCmpScriptSrc(config) {
  if (!config?.enabled || config.provider !== CMP_PROVIDER_FUNDING_CHOICES) return '';
  if (!SITE_ID_RE.test(config.siteId || '')) return '';
  return `${CMP_SCRIPT_HOST}/i/${config.siteId}?ers=1`;
}

/**
 * Append the Funding Choices script once. Returns before touching the
 * document when the config is off, so the default build creates no tag.
 *
 * @param {Document | { head?: { appendChild: Function }, getElementById?: Function, createElement?: Function } | null | undefined} doc
 * @param {{ enabled?: boolean, provider?: string, siteId?: string } | null | undefined} config
 * @returns {{ mounted: boolean, reason: 'cmp-off' | 'no-document' | 'already-mounted' | 'mounted', src: string }}
 */
export function mountCmpScript(doc, config) {
  const src = buildCmpScriptSrc(config);
  if (!src) return { mounted: false, reason: 'cmp-off', src: '' };
  if (!doc || typeof doc.createElement !== 'function' || !doc.head || typeof doc.head.appendChild !== 'function') {
    return { mounted: false, reason: 'no-document', src };
  }
  if (typeof doc.getElementById === 'function' && doc.getElementById(CMP_SCRIPT_ELEMENT_ID)) {
    return { mounted: false, reason: 'already-mounted', src };
  }
  const script = doc.createElement('script');
  script.id = CMP_SCRIPT_ELEMENT_ID;
  script.async = true;
  script.src = src;
  doc.head.appendChild(script);
  return { mounted: true, reason: 'mounted', src };
}

/**
 * Funding Choices reopen. Absent until the script has actually loaded.
 *
 * @param {{ googlefc?: { showRevocationMessage?: Function } } | null | undefined} globalObj
 * @returns {boolean}
 */
export function canOpenCmpUi(globalObj) {
  const show = globalObj?.googlefc?.showRevocationMessage;
  return typeof show === 'function';
}

/**
 * @param {{ googlefc?: { showRevocationMessage?: Function } } | null | undefined} globalObj
 * @returns {{ opened: boolean, reason: 'opened' | 'cmp-off' }}
 */
export function openCmpPreferences(globalObj) {
  if (!canOpenCmpUi(globalObj)) return { opened: false, reason: 'cmp-off' };
  globalObj.googlefc.showRevocationMessage();
  return { opened: true, reason: 'opened' };
}

const listeners = new Set();

/**
 * Same-tab updates. The browser `storage` event only fires in other tabs.
 * @param {() => void} listener
 * @returns {() => void}
 */
export function subscribeAdConsent(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAdConsent() {
  for (const listener of listeners) listener();
}
