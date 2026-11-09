'use strict';

const DEFAULT_SITE_URL = 'https://www.setlistpickem.com';
const EMAIL_CLICK_HOST = 'https://click.setlistpickem.com';

/** Paths we will redirect to on www — block open redirects. */
const ALLOWED_PATH_PREFIXES = [
  '/dashboard',
  '/join',
  '/invite',
  '/login',
  '/setup',
  '/how-it-works',
  '/how-scoring-works',
  '/how-scoring-changed',
  '/',
];

/**
 * @param {string} input
 * @returns {string | null}
 */
function normalizeDestinationPath(input) {
  if (!input || typeof input !== 'string') return null;
  let path = input.trim();
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path);
      if (u.hostname !== 'www.setlistpickem.com' && u.hostname !== 'setlistpickem.com') {
        return null;
      }
      path = `${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const pathname = path.split('?')[0].split('#')[0];
  const allowed = ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`))
  );
  if (!allowed) return null;
  return path;
}

/**
 * Click-tracking URL on `click.setlistpickem.com` — the only link in service email bodies.
 *
 * @param {string} destinationUrlOrPath — e.g. `https://www.setlistpickem.com/dashboard/picks`
 * @param {{ triggerId?: string, templateId?: string, cta?: string }} [meta]
 * @returns {string}
 */
function buildEmailTrackedCtaUrl(destinationUrlOrPath, meta = {}) {
  const destPath = normalizeDestinationPath(destinationUrlOrPath);
  if (!destPath) {
    throw new Error(`buildEmailTrackedCtaUrl: invalid destination ${destinationUrlOrPath}`);
  }
  const pathWithoutLeading = destPath.replace(/^\//, '');
  const params = new URLSearchParams();
  if (meta.triggerId) params.set('tid', meta.triggerId);
  if (meta.templateId) params.set('tpl', meta.templateId);
  if (meta.cta) params.set('cta', meta.cta);
  const qs = params.toString();
  const host = String(process.env.EMAIL_CLICK_HOST || EMAIL_CLICK_HOST).replace(/\/+$/, '');
  return `${host}/${pathWithoutLeading}${qs ? `?${qs}` : ''}`;
}

/**
 * Final www redirect target with UTM params (`api/email-click` handler).
 *
 * @param {string} destinationPath
 * @param {URLSearchParams | Record<string, string | string[] | undefined>} [query]
 * @returns {string}
 */
function buildEmailClickRedirectUrl(destinationPath, query = {}) {
  const base = String(process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
  const normalized = normalizeDestinationPath(destinationPath);
  if (!normalized) return `${base}/dashboard`;
  const url = new URL(normalized, `${base}/`);
  const entries =
    query instanceof URLSearchParams
      ? Object.fromEntries(query.entries())
      : query;
  const tid = Array.isArray(entries.tid) ? entries.tid[0] : entries.tid;
  const tpl = Array.isArray(entries.tpl) ? entries.tpl[0] : entries.tpl;
  const cta = Array.isArray(entries.cta) ? entries.cta[0] : entries.cta;
  url.searchParams.set('utm_source', 'email');
  url.searchParams.set('utm_medium', 'comms');
  if (tid) url.searchParams.set('utm_campaign', String(tid));
  if (tpl) url.searchParams.set('utm_content', String(tpl));
  if (cta) url.searchParams.set('utm_term', String(cta));
  return url.toString();
}

module.exports = {
  DEFAULT_SITE_URL,
  EMAIL_CLICK_HOST,
  ALLOWED_PATH_PREFIXES,
  normalizeDestinationPath,
  buildEmailTrackedCtaUrl,
  buildEmailClickRedirectUrl,
};
