/**
 * Paths that must stay on the marketing document when a returning session
 * hint is set. Anything else hard-opens `/dashboard` from `marketingMain.jsx`.
 * The stats embed is framed on other sites, so a session hint must not
 * replace the card with the dashboard.
 *
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function shouldStayOnMarketingDocument(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  if (pathname === '/tour-stats' || pathname.startsWith('/tour-stats/')) return true;
  if (pathname === '/embed' || pathname.startsWith('/embed/')) return true;
  return false;
}
