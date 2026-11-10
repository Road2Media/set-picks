import { validateAdCreative } from './validateAdCreative';

/**
 * Kill switch, then schema. Anything other than an enabled flag plus valid
 * JSON renders nothing.
 *
 * @param {{ adsEnabled?: boolean, rawValue?: unknown }} input
 */
export function resolveAdCreative({ adsEnabled, rawValue } = {}) {
  if (adsEnabled !== true) return null;
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return null;

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }
  return validateAdCreative(parsed);
}
