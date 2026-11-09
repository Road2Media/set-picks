import { POOL_NAME_MAX_LENGTH } from '../api/poolFirestore';

/**
 * Pool name carried on `/dashboard/pools/create?name=`.
 * Empty when the query is missing or not a plain label.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function suggestedPoolName(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed || /[<>]/.test(trimmed)) return '';
  return trimmed.slice(0, POOL_NAME_MAX_LENGTH);
}
