import { EMBED_SITE_ORIGIN, isEmbedTourSlug } from './embedPaths';

/** Required campaign pair for embed backlinks (#1145). */
export const EMBED_UTM = Object.freeze({
  utm_source: 'embed',
  utm_campaign: 'seo_geo',
});

/**
 * Normal followable credit URL. UTM lives on the query string so the link
 * still counts when the host page cannot see our referrer.
 *
 * @param {string} [siteOrigin]
 * @returns {string}
 */
export function buildEmbedCreditUrl(siteOrigin = EMBED_SITE_ORIGIN) {
  const url = new URL('/', siteOrigin);
  url.searchParams.set('utm_source', EMBED_UTM.utm_source);
  url.searchParams.set('utm_campaign', EMBED_UTM.utm_campaign);
  return url.toString();
}

/**
 * Iframe snippet for a plain HTML host page. The credit link is inside the
 * framed document, not in this snippet, so the host cannot turn it into a button.
 *
 * @param {{ siteOrigin?: string, tourSlug?: string, card?: 'badge' | 'standings' }} [opts]
 * @returns {string}
 */
export function buildStatsEmbedSnippet(opts = {}) {
  const url = new URL('/embed/stats', opts.siteOrigin || EMBED_SITE_ORIGIN);
  if (opts.card === 'badge') url.searchParams.set('card', 'badge');
  if (isEmbedTourSlug(opts.tourSlug)) url.searchParams.set('tour', opts.tourSlug);
  const src = url.toString();
  return `<iframe src="${src}" title="Setlist Pick 'Em standings" width="360" height="240" style="border:0;max-width:100%" loading="lazy"></iframe>`;
}
