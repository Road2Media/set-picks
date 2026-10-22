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
    'Live setlist updates are delayed. Our Phish.net connection is temporarily stalled, so songs and scores may update more slowly than normal.',
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
