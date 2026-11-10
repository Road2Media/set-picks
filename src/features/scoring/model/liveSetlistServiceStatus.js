/**
 * Player-facing live setlist service status (#644).
 *
 * Copy is an allow-list. Standings renders the local string for a known
 * `messageKey` and ignores anything else, so a bad projection cannot inject HTML.
 * Keep the sentence in sync with `PLAYER_STATUS_MESSAGES` in
 * `functions/liveSetlistOutage.js`.
 */

export const LIVE_SETLIST_DEGRADED_MESSAGES = {
  phishnet_stalled:
    'Live setlist updates are running late, so songs and scores may come in more slowly than usual.',
};

export const LIVE_SETLIST_DEGRADED_MESSAGE_KEYS = Object.keys(
  LIVE_SETLIST_DEGRADED_MESSAGES,
);

/**
 * @param {unknown} messageKey
 * @returns {string}
 */
export function playerDegradedMessage(messageKey) {
  if (typeof messageKey !== 'string') return '';
  return LIVE_SETLIST_DEGRADED_MESSAGES[messageKey] || '';
}

/**
 * @param {string} showDate
 * @returns {string}
 */
export function liveSetlistServiceStatusDocId(showDate) {
  return `live-setlist-${showDate}`;
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {boolean}
 */
export function isDegradedPlayerStatus(data) {
  if (!data || data.status !== 'degraded') return false;
  if (data.resolvedAt) return false;
  return Boolean(playerDegradedMessage(data.messageKey));
}
