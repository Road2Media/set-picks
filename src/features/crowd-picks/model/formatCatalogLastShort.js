import { formatFanShowDate } from '../../../shared/utils/dateUtils';

/**
 * Truncate catalog `last` (usually YYYY-MM-DD) for compact UI columns.
 * @param {unknown} raw
 * @returns {string} e.g. `07/19/24`, or `—` when missing
 */
export function formatCatalogLastShort(raw) {
  if (typeof raw !== 'string') return '—';
  const t = raw.trim();
  if (!t || t === '—' || t === '-' || /^never$/i.test(t)) return '—';
  const formatted = formatFanShowDate(t);
  if (typeof formatted === 'string' && /^\d{2}\/\d{2}\/\d{2}$/.test(formatted)) {
    return formatted;
  }
  // Already short / freeform — keep a tight slice
  return t.length > 8 ? t.slice(0, 8) : t;
}
