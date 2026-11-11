/**
 * Hostnames where production analytics and the production Remote Config
 * channel apply. Anything else (localhost, Vercel previews, the staging
 * alias) stays off production analytics and uses the staging channel.
 */
const PRODUCTION_HOSTNAMES = new Set([
  'www.setlistpickem.com',
  'setlistpickem.com',
]);

/**
 * @param {unknown} hostname
 * @returns {boolean}
 */
export function isProductionHostname(hostname) {
  return typeof hostname === 'string' && PRODUCTION_HOSTNAMES.has(hostname);
}
