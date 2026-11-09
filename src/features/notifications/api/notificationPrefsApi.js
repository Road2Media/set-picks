import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '../../../shared/lib/firebase';

/**
 * Channels stored under `users/{uid}.notificationPrefs`.
 * Names match catalog `channels` (`inApp`, not `in-app`).
 * Server mirror: `functions/notificationPrefs.js`.
 */
export const NOTIFICATION_CHANNELS = Object.freeze(['push', 'inApp', 'email']);

/**
 * Family keys. `commercial` is default-deny. Every other family is default-allow.
 * Catalog `prefKeys` stay these family names; delivery resolves them per channel.
 */
export const NOTIFICATION_PREF_FAMILIES = Object.freeze([
  'reminders',
  'results',
  'nearMiss',
  'lifecycle',
  'commercial',
]);

function defaultFamilyValue(family) {
  return family === 'commercial' ? false : true;
}

function defaultChannelMap() {
  /** @type {Record<string, boolean>} */
  const map = {};
  for (const family of NOTIFICATION_PREF_FAMILIES) {
    map[family] = defaultFamilyValue(family);
  }
  return map;
}

/**
 * Resolved prefs: one boolean per channel per family.
 * Missing docs resolve to these defaults (#1045).
 */
export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  push: Object.freeze(defaultChannelMap()),
  inApp: Object.freeze(defaultChannelMap()),
  email: Object.freeze(defaultChannelMap()),
});

/**
 * @param {Record<string, unknown> | null} prefs
 * @param {string | undefined} channel
 * @returns {Record<string, unknown> | null}
 */
function channelMap(prefs, channel) {
  if (!channel || !prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return null;
  const value = prefs[channel];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * Same rules as `functions/notificationPrefs.js` `prefAllows`.
 *
 * @param {Record<string, unknown> | null} prefs
 * @param {string} channel
 * @param {string} family
 * @returns {boolean}
 */
export function resolveChannelPref(prefs, channel, family) {
  const nestedSource = channelMap(prefs, channel);
  const nested =
    nestedSource && typeof nestedSource[family] === 'boolean' ? nestedSource[family] : undefined;
  const flat = prefs && typeof prefs[family] === 'boolean' ? prefs[family] : undefined;
  const raw = nested !== undefined ? nested : flat;
  if (family === 'commercial') return raw === true;
  return raw !== false;
}

/**
 * @param {import('firebase/firestore').DocumentData | null | undefined} userData
 */
export function resolveNotificationPrefs(userData) {
  const raw = userData?.notificationPrefs;
  const prefs = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  /** @type {Record<string, Record<string, boolean>>} */
  const resolved = {};
  for (const channel of NOTIFICATION_CHANNELS) {
    /** @type {Record<string, boolean>} */
    const channelPrefs = {};
    for (const family of NOTIFICATION_PREF_FAMILIES) {
      channelPrefs[family] = resolveChannelPref(prefs, channel, family);
    }
    resolved[channel] = channelPrefs;
  }
  return resolved;
}

/**
 * @param {string} uid
 * @param {(prefs: ReturnType<typeof resolveNotificationPrefs>) => void} onPrefs
 * @param {(err: unknown) => void} onError
 * @returns {() => void} unsubscribe
 */
export function subscribeNotificationPrefs(uid, onPrefs, onError) {
  if (!uid) return () => {};
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      onPrefs(resolveNotificationPrefs(snap.exists() ? snap.data() : null));
    },
    (err) => {
      onError(err);
    }
  );
}

/**
 * Merge-updates one or more `notificationPrefs.<channel>.<family>` booleans.
 * Does not write the legacy flat keys. A channel left unset keeps inheriting
 * that flat boolean.
 *
 * @param {string} uid
 * @param {Partial<Record<'push' | 'inApp' | 'email', Partial<Record<string, boolean>>>>} patch
 */
export async function mergeNotificationPrefs(uid, patch) {
  if (!uid) throw new Error('Missing uid');
  const ref = doc(db, 'users', uid);
  /** @type {Record<string, unknown>} */
  const updates = { updatedAt: serverTimestamp() };
  let wrote = false;
  for (const channel of NOTIFICATION_CHANNELS) {
    const channelPatch = patch?.[channel];
    if (!channelPatch || typeof channelPatch !== 'object') continue;
    for (const family of NOTIFICATION_PREF_FAMILIES) {
      const value = channelPatch[family];
      if (typeof value !== 'boolean') continue;
      updates[`notificationPrefs.${channel}.${family}`] = value;
      wrote = true;
    }
  }
  if (!wrote) return;
  await updateDoc(ref, updates);
}
