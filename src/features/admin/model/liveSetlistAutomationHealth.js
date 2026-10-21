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
