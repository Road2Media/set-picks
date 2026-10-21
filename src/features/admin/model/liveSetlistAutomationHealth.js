/**
 * War Room health for `live_setlist_automation/{showDate}` (#644).
 * Derived on the client from the admin-only automation doc.
 */

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {'Healthy' | 'Backing off' | 'Paused' | 'Recovered'}
 */
export function deriveAutomationHealth(data) {
  if (!data || data.enabled === false) return 'Paused';
  const failures = Number(data.failureCount || 0);
  if (failures > 0 || data.lastResult === 'error') return 'Backing off';
  if (data.recoveredAt) return 'Recovered';
  return 'Healthy';
}

/**
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
export function truncateAutomationError(value, max = 180) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Player-banner state for the War Room health panel.
 * A missing doc, a permission-denied listen (`null`), and undefined fields
 * stay hidden. This must not throw — a throw unmounts War Room.
 *
 * @param {unknown} data
 * @returns {{
 *   playerStatus: Record<string, unknown> | null,
 *   bannerVisible: boolean,
 *   bannerActivatedBy: '' | 'manual' | 'automatic',
 * }}
 */
export function resolveWarRoomPlayerStatus(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { playerStatus: null, bannerVisible: false, bannerActivatedBy: '' };
  }
  const record = /** @type {Record<string, unknown>} */ (data);
  const bannerVisible = record.status === 'degraded' && !record.resolvedAt;
  let bannerActivatedBy = /** @type {'' | 'manual' | 'automatic'} */ ('');
  if (bannerVisible) {
    bannerActivatedBy = record.activatedBy === 'admin' ? 'manual' : 'automatic';
  }
  return { playerStatus: record, bannerVisible, bannerActivatedBy };
}

/**
 * Attach the War Room automation and player-status listeners.
 * Missing and denied status docs resolve to a hidden banner.
 * Setup failures are reported and do not escape: an effect throw unmounts War Room.
 *
 * @param {{
 *   showDate: string,
 *   subscribeAutomation: Function,
 *   subscribeStatus: Function,
 *   onAutomation: (state: unknown) => void,
 *   onAutomationError: (error: unknown) => void,
 *   onPlayerStatus: (status: Record<string, unknown> | null) => void,
 * }} args
 * @returns {() => void}
 */
export function listenWarRoomAutomation({
  showDate,
  subscribeAutomation,
  subscribeStatus,
  onAutomation,
  onAutomationError,
  onPlayerStatus,
}) {
  let stopAutomation = () => {};
  let stopStatus = () => {};

  const reportAutomationError = (error) => {
    try {
      onAutomationError(error);
    } catch (callbackError) {
      console.error('War Room automation error handler failed', callbackError);
    }
  };

  const reportPlayerStatus = (data) => {
    const next = resolveWarRoomPlayerStatus(data).playerStatus;
    try {
      onPlayerStatus(next);
    } catch (error) {
      console.error('War Room player status handler failed', error);
      try {
        onPlayerStatus(null);
      } catch {
        // Keep War Room mounted even if the caller rejects the empty state.
      }
    }
  };

  const close = () => {
    try {
      stopAutomation();
    } catch (error) {
      console.error('Error closing automation listener', error);
    }
    try {
      stopStatus();
    } catch (error) {
      console.error('Error closing player status listener', error);
    }
  };

  try {
    const unsubAutomation = subscribeAutomation(
      showDate,
      (state) => {
        try {
          onAutomation(state);
        } catch (error) {
          reportAutomationError(error);
        }
      },
      reportAutomationError,
    );
    if (typeof unsubAutomation === 'function') stopAutomation = unsubAutomation;

    const unsubStatus = subscribeStatus(
      showDate,
      (data) => reportPlayerStatus(data),
      (error) => {
        console.error('Error loading player status:', error);
        reportPlayerStatus(null);
      },
    );
    if (typeof unsubStatus === 'function') stopStatus = unsubStatus;
  } catch (error) {
    reportAutomationError(error);
    reportPlayerStatus(null);
    close();
    return () => {};
  }

  return close;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatAutomationTimestamp(value) {
  if (!value) return '—';
  let date = null;
  if (value instanceof Date) date = value;
  else if (typeof value.toDate === 'function') {
    try {
      date = value.toDate();
    } catch {
      date = null;
    }
  }
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}
