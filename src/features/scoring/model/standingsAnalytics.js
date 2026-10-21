import { ga4Event } from '../../../shared/lib/ga4';

/**
 * Map Standings show status → live setlist engagement status (#638).
 *
 * @param {string} [showStatus]
 * @returns {'live' | 'final' | 'waiting'}
 */
export function resolveLiveSetlistStatus(showStatus) {
  if (showStatus === 'LIVE') return 'live';
  if (showStatus === 'PAST') return 'final';
  return 'waiting';
}

/**
 * Official / live setlist card is shown on Standings (#638).
 *
 * @param {{ show_date?: string, setlist_status?: string }} [payload]
 */
export function trackLiveSetlistView({ show_date, setlist_status } = {}) {
  ga4Event('live_setlist_view', {
    show_date: show_date ?? '',
    setlist_status: setlist_status ?? 'waiting',
  });
}

/**
 * Player saw the delayed-update banner (#644). No error body.
 *
 * @param {{ show_date?: string, activated_by?: string }} [payload]
 */
export function trackLiveSetlistDegradedBannerView({ show_date, activated_by } = {}) {
  ga4Event('live_setlist_degraded_banner_view', {
    show_date: show_date ?? '',
    activated_by: activated_by === 'admin' ? 'admin' : 'automation',
  });
}

/**
 * Banner left the screen after recovery or an admin clear (#644).
 *
 * @param {{ show_date?: string, activated_by?: string }} [payload]
 */
export function trackLiveSetlistDegradedBannerCleared({ show_date, activated_by } = {}) {
  ga4Event('live_setlist_degraded_banner_cleared', {
    show_date: show_date ?? '',
    activated_by: activated_by === 'admin' ? 'admin' : 'automation',
  });
}
