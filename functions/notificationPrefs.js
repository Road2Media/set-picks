/**
 * Per-channel notification prefs (#1045 / #513 Phase 3).
 *
 * Mirror of `src/features/notifications/api/notificationPrefsApi.js`.
 * Keep the two resolvers in lockstep.
 *
 * Resolution for one channel + family:
 *  1. `notificationPrefs.<channel>.<family>` when that value is a boolean.
 *  2. Otherwise the legacy flat `notificationPrefs.<family>` boolean, which
 *     still applies to every channel that has no explicit boolean.
 *  3. Otherwise the default: `commercial` is off until `true`; every other
 *     family is on until `false`.
 */

"use strict";

const NOTIFICATION_CHANNELS = ["push", "inApp", "email"];

const NOTIFICATION_PREF_FAMILIES = [
  "reminders",
  "results",
  "nearMiss",
  "lifecycle",
  "commercial",
];

/**
 * @param {unknown} prefs
 * @param {string | undefined} channel
 * @returns {Record<string, unknown> | null}
 */
function channelMap(prefs, channel) {
  if (!channel || !prefs || typeof prefs !== "object" || Array.isArray(prefs)) return null;
  const value = /** @type {Record<string, unknown>} */ (prefs)[channel];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {Record<string, any> | null | undefined} userData
 * @param {string} key family name (`lifecycle`, `results`, …)
 * @param {string} [channel] `push` | `inApp` | `email`. Omit to read the flat key only.
 * @returns {boolean}
 */
function prefAllows(userData, key, channel) {
  const rawPrefs = userData?.notificationPrefs;
  const prefs =
    rawPrefs && typeof rawPrefs === "object" && !Array.isArray(rawPrefs) ? rawPrefs : null;
  const nestedSource = channelMap(prefs, channel);
  const nested =
    nestedSource && typeof nestedSource[key] === "boolean" ? nestedSource[key] : undefined;
  const flat = prefs && typeof prefs[key] === "boolean" ? prefs[key] : undefined;
  const raw = nested !== undefined ? nested : flat;
  if (key === "commercial") return raw === true;
  return raw !== false;
}

module.exports = {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PREF_FAMILIES,
  prefAllows,
};
