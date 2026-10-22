/**
 * Build-time gate for Rewind Mode (#1142).
 * Only the string `'true'` enables the player surfaces. Unset stays off.
 *
 * @returns {boolean}
 */
export function isRewindModeEnabled() {
  return import.meta.env.VITE_ENABLE_REWIND_MODE === 'true';
}
