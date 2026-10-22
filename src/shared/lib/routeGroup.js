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
 *   | 'rewind'
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
    pathname === '/phish-setlist-prediction-game' ||
    pathname.startsWith('/phish-setlist-prediction-game/') ||
    pathname === '/about' ||
    pathname.startsWith('/about/')
  ) {
    return 'marketing';
  }
  if (pathname === '/tour-stats' || pathname.startsWith('/tour-stats/')) {
    return 'tour_stats';
  }
  if (pathname === '/rewind' || pathname.startsWith('/rewind/')) {
    return 'rewind';
  }
  if (pathname === '/setup' || pathname.startsWith('/setup/')) return 'setup';
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return 'dashboard';
  }
  if (pathname.startsWith('/join')) return 'invite_join';
  if (pathname.startsWith('/invite/')) return 'invite_site';
  return 'other';
}
