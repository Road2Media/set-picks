/**
 * Path helpers for cold-boot warming on app / email hard opens (#773 Phase 2).
 * #803: anonymous `/` `/join` `/invite` keep deferred App Check; session +
 * dashboard/setup still warm immediately.
 */

/**
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function isDashboardEntryPath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

/**
 * Public cold-open surfaces where anonymous visitors should not pay reCAPTCHA
 * before first paint / auth CTA (#803). Returning sessions warm via AuthContext.
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function isPublicColdOpenPath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  return (
    pathname === '/' ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/invite/')
  );
}

/**
 * Defer FCM service-worker registration until idle on non-app hard opens.
 * Dashboard/setup keep immediate registration (push surfaces).
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function shouldDeferMessagingServiceWorker(pathname) {
  if (typeof pathname !== 'string' || !pathname) return true;
  return !isDashboardEntryPath(pathname) && pathname !== '/setup';
}

/**
 * Public Firestore-backed tour stats surfaces (#827).
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function isPublicTourStatsPath(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  return pathname === '/tour-stats' || pathname.startsWith('/tour-stats/');
}

/**
 * Surfaces that need Firestore ASAP on hard open (skip App Check idle deferral).
 * Invite/join anonymous paths are intentionally excluded (#803) — warm on
 * persisted session or auth modal open instead.
 * Public `/tour-stats*` hard-opens on the marketing document (#853) and warms
 * App Check from the page/fetch path — not `main.jsx`.
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function shouldWarmAppCheckOnBoot(pathname) {
  if (typeof pathname !== 'string' || !pathname) return false;
  return isDashboardEntryPath(pathname) || pathname === '/setup';
}

/**
 * Defer the GA4 library download until idle on anonymous public cold opens
 * (#733). Dashboard, setup, and other app-document routes start the download
 * immediately so signed-in pageviews are not held for idle.
 *
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function shouldDeferGa4Boot(pathname) {
  return isPublicColdOpenPath(pathname);
}

/**
 * Should boot kick off the `DashboardRoute` import (#804)?
 *
 * Dashboard hard opens always do. Public cold-open surfaces only do when a
 * persisted session hint says the visitor is about to be redirected there —
 * anonymous visitors must not pay for the dashboard graph on splash.
 *
 * @param {string} [pathname]
 * @param {{ hasSession?: boolean }} [opts]
 * @returns {boolean}
 */
export function shouldPrefetchDashboardOnBoot(pathname, opts = {}) {
  if (typeof pathname !== 'string' || !pathname) return false;
  if (isDashboardEntryPath(pathname)) return true;
  if (!opts.hasSession) return false;
  return pathname === '/' || pathname === '/setup' || isPublicColdOpenPath(pathname);
}
