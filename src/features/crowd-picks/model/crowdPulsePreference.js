/**
 * One switch for every crowd pulse surface (#694 P3).
 * Missing, false, or any non-boolean keeps the surfaces on.
 * Only an explicit `true` hides them. Pre-lock blur is unchanged
 * when the surfaces stay visible.
 */

/** @typedef {'standings' | 'stats_night' | 'picks_helper'} CrowdPulseSurface */

export const CROWD_PULSE_SURFACES = Object.freeze([
  'standings',
  'stats_night',
  'picks_helper',
]);

/**
 * @param {import('firebase/firestore').DocumentData | null | undefined} userData
 * @returns {boolean}
 */
export function resolveHideCrowdPulse(userData) {
  const raw = userData?.gamePrefs;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return raw.hideCrowdPulse === true;
}

/**
 * @param {import('firebase/firestore').DocumentData | null | undefined} userData
 * @param {string} surface
 * @returns {boolean}
 */
export function isCrowdPulseSurfaceEnabled(userData, surface) {
  if (
    typeof surface !== 'string' ||
    !CROWD_PULSE_SURFACES.includes(/** @type {CrowdPulseSurface} */ (surface))
  ) {
    return false;
  }
  return !resolveHideCrowdPulse(userData);
}
