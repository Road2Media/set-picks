/**
 * House-promo creative guard (#121).
 * Text, an https image, and an allowlisted link. No HTML.
 */

const CREATIVE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

const EXACT_INTERNAL_PATHS = new Set([
  '/dashboard',
  '/dashboard/picks',
  '/dashboard/picks/lab',
  '/dashboard/picks/scorecard',
  '/dashboard/rewind',
  '/dashboard/phish-iq',
  '/dashboard/pools',
  '/dashboard/pools/create',
  '/dashboard/pools/join',
  '/dashboard/standings',
  '/dashboard/profile',
  '/dashboard/profile/notifications',
  '/dashboard/profile/account',
  '/dashboard/stats',
  '/dashboard/stats/personal',
  '/dashboard/stats/global',
  '/dashboard/stats/band',
  '/dashboard/stats/night',
  '/how-it-works',
  '/how-scoring-works',
  '/how-scoring-changed',
  '/about',
  '/phish-iq',
  '/phish-setlist-prediction-game',
  '/tour-stats',
  '/phish-at-msg',
]);

const INTERNAL_PREFIXES = ['/dashboard/pool/', '/tour-stats/', '/phish-at-msg/', '/rewind/'];

/**
 * @param {unknown} value
 * @param {{ max: number, required?: boolean }} opts
 * @returns {string | null}
 */
function cleanText(value, { max, required = true }) {
  if (typeof value !== 'string') return required ? null : '';
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return required ? null : '';
  if (text.length > max) return null;
  if (/[<>]/.test(text)) return null;
  return text;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return url.toString();
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
function isAllowlistedInternalPath(pathname) {
  if (EXACT_INTERNAL_PATHS.has(pathname)) return true;
  return INTERNAL_PREFIXES.some(
    (prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length,
  );
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanInternalPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return null;
  }
  if (/[\\<>\s]/.test(trimmed)) return null;

  let url;
  try {
    url = new URL(trimmed, 'https://setlistpickem.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'https://setlistpickem.invalid') return null;

  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (!isAllowlistedInternalPath(pathname)) return null;
  if (/[<>]/.test(url.search) || /[<>]/.test(url.hash)) return null;
  return `${pathname}${url.search}${url.hash}`;
}

/**
 * @param {unknown} raw
 * @returns {{
 *   creative_id: string,
 *   image_url: string,
 *   alt_text: string,
 *   headline: string,
 *   body: string,
 *   cta_label: string,
 *   destination_url: string,
 *   destination_type: 'internal' | 'external',
 * } | null}
 */
export function validateAdCreative(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const creativeId = cleanText(raw.creative_id, { max: 64 });
  if (!creativeId || !CREATIVE_ID_RE.test(creativeId)) return null;

  const imageUrl = cleanHttpsUrl(raw.image_url);
  const altText = cleanText(raw.alt_text, { max: 140 });
  const headline = cleanText(raw.headline, { max: 80 });
  const body = cleanText(raw.body, { max: 140, required: false });
  const ctaLabel = cleanText(raw.cta_label, { max: 32 });
  if (!imageUrl || !altText || !headline || body == null || !ctaLabel) return null;

  const destinationType = raw.destination_type;
  if (destinationType !== 'internal' && destinationType !== 'external') return null;

  const destinationUrl =
    destinationType === 'internal'
      ? cleanInternalPath(raw.destination_url)
      : cleanHttpsUrl(raw.destination_url);
  if (!destinationUrl) return null;

  return {
    creative_id: creativeId,
    image_url: imageUrl,
    alt_text: altText,
    headline,
    body,
    cta_label: ctaLabel,
    destination_url: destinationUrl,
    destination_type: destinationType,
  };
}
