/** Public framed route. Part of #1145. */
export const EMBED_STATS_PATH = '/embed/stats';

/** Production origin copied into third-party embed snippets. */
export const EMBED_SITE_ORIGIN = 'https://www.setlistpickem.com';

/**
 * Kebab tour slug safe to put in a query string and a Firestore path.
 * Rejects `_index`, year roll-ups, and anything that could break out of HTML.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmbedTourSlug(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 80 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

/**
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function isStatsEmbedPath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  return pathname === '/embed' || pathname.startsWith('/embed/');
}
