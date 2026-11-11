/**
 * Coarse route groups for field RUM / GA4 (#801 / #857).
 * Keep values stable — they are Exploration dimensions.
 *
 * @param {string} [pathname]
 * @returns {
 *   | 'splash'
 *   | 'login'
 *   | 'legal'
 *   | 'marketing'
 *   | 'tour_stats'
 *   | 'embed'
 *   | 'rewind'
 *   | 'phish_iq'
 *   | 'invite_join'
 *   | 'invite_site'
 *   | 'dashboard'
 *   | 'setup'
 *   | 'other'
 * }
 */
export function resolveRouteGroup(pathname) {
  if (typeof pathname !== 'string' || !pathname) return 'other';
  if (pathname === '/') return 'splash';
  if (pathname === '/login' || pathname.startsWith('/login/')) return 'login';
  if (pathname === '/privacy' || pathname === '/terms') return 'legal';
  if (
    pathname === '/how-it-works' ||
    pathname.startsWith('/how-it-works/') ||
    pathname === '/how-scoring-works' ||
    pathname.startsWith('/how-scoring-works/') ||
    pathname === '/how-scoring-changed' ||
    pathname.startsWith('/how-scoring-changed/') ||
    pathname === '/phish-setlist-prediction-game' ||
    pathname.startsWith('/phish-setlist-prediction-game/') ||
    pathname === '/about' ||
    pathname.startsWith('/about/') ||
    pathname === '/tour-notes' ||
    pathname.startsWith('/tour-notes/') ||
    pathname === '/phish-at-msg' ||
    pathname.startsWith('/phish-at-msg/')
  ) {
    return 'marketing';
  }
  if (pathname === '/tour-stats' || pathname.startsWith('/tour-stats/')) {
    return 'tour_stats';
  }
  if (pathname === '/embed' || pathname.startsWith('/embed/')) {
    return 'embed';
  }
  if (pathname === '/rewind' || pathname.startsWith('/rewind/')) {
    return 'rewind';
  }
  if (pathname === '/phish-iq' || pathname.startsWith('/phish-iq/')) {
    return 'phish_iq';
  }
  if (pathname === '/setup' || pathname.startsWith('/setup/')) return 'setup';
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return 'dashboard';
  }
  if (pathname.startsWith('/join')) return 'invite_join';
  if (pathname.startsWith('/invite/')) return 'invite_site';
  return 'other';
}
