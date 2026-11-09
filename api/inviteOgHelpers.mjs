/**
 * Pure helpers for invite OG (api/invite.js). Mirrors src/shared/config/seo.js and
 * src/shared/lib/inviteKit.js — must not import from src/.
 */

import { stripPrerenderBodyFromSpaShell } from '../scripts/seo-strip-body.mjs';

export { stripPrerenderBodyFromSpaShell };

export const SITE_URL = 'https://www.setlistpickem.com';
export const SITE_NAME = "Setlist Pick 'Em";
export const OG_IMAGE_VERSION = '20260711';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/branding/og-card-1200x630.jpg?v=${OG_IMAGE_VERSION}`;
export const DEFAULT_OG_IMAGE_ALT = "Setlist Pick 'Em — live setlist prediction game";
export const DEFAULT_TITLE = "Setlist Pick'em | The Ultimate Live Music Prediction Game";
export const DEFAULT_DESCRIPTION =
  "Setlist Pick 'Em is a free live setlist prediction game built for Phish fans—and more bands soon. Lock openers, closers, encore, and a wildcard before each show; scores update live as songs are played. Tour insights refresh every night the band plays live. Play to unlock personal stats and compete with friends.";

/** Social-crawler user-agent detection (case-insensitive substring match). */
export const CRAWLER_RE =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|LinkedInBot|TelegramBot|Discordbot|redditbot|Applebot|Googlebot|bingbot|ia_archiver/i;

export const SITE_INVITE_DESCRIPTION =
  'Create a free account to predict setlists, track scores live, and compete with friends on Phish tour.';

export const POOL_INVITE_FROM_DESCRIPTION =
  'Create a free account to join the pool and compete with your crew on tour.';

export const POOL_INVITE_GENERIC_DESCRIPTION =
  "You've been invited to a private Setlist Pick 'Em pool. Pick your setlist and compete to win.";

const DEFAULT_POOL_SHARE_TITLE = "Join my Setlist Pick 'Em pool!";

/**
 * @param {unknown} handle
 * @returns {string}
 */
export function normalizeInviteHandle(handle) {
  return String(handle ?? '')
    .trim()
    .replace(/^@+/, '');
}

/**
 * @param {string} handle
 * @returns {string}
 */
export function buildSiteInviteShareTitle(handle) {
  const h = normalizeInviteHandle(handle);
  if (!h) return "You're invited to Setlist Pick'em";
  return `${h} invited you to Setlist Pick'em`;
}

/**
 * @param {string} handle
 * @param {string | null | undefined} [poolName]
 * @returns {string}
 */
export function buildPoolInviteShareTitleFromInviter(handle, poolName) {
  const h = normalizeInviteHandle(handle);
  const name = typeof poolName === 'string' ? poolName.trim() : '';
  if (!h) {
    return name
      ? `You're invited to join a Setlist Pick'em pool: ${name}`
      : "You're invited to join a Setlist Pick'em pool";
  }
  if (name) return `${h} invited you to join their pool: ${name}`;
  return `${h} invited you to join their pool`;
}

/**
 * @param {string | null | undefined} [poolName]
 * @returns {string}
 */
export function buildPoolInviteShareTitle(poolName) {
  const name = typeof poolName === 'string' ? poolName.trim() : '';
  if (name) return `Join my Setlist Pick 'Em pool: ${name}`;
  return DEFAULT_POOL_SHARE_TITLE;
}

/**
 * @param {string | null | undefined} [poolName]
 * @returns {string}
 */
export function buildPoolInviteDescription(poolName) {
  const name = typeof poolName === 'string' ? poolName.trim() : '';
  if (name) {
    return `Join my Setlist Pick 'Em pool — ${name}. Pick openers, closers, and more before each show.`;
  }
  return POOL_INVITE_GENERIC_DESCRIPTION;
}

/**
 * @param {{ code?: string, handle?: string, from?: string }} params
 * @returns {string}
 */
export function buildInvitePageUrl({ code = '', handle = '', from = '' } = {}) {
  const normalizedHandle = normalizeInviteHandle(handle);
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  const normalizedFrom = normalizeInviteHandle(from);

  if (normalizedHandle && !normalizedCode) {
    return `${SITE_URL}/invite/${encodeURIComponent(normalizedHandle)}`;
  }

  if (!normalizedCode) return SITE_URL;

  let url = `${SITE_URL}/join/${encodeURIComponent(normalizedCode)}`;
  if (normalizedFrom) {
    url += `?from=${encodeURIComponent(normalizedFrom)}`;
  }
  return url;
}

/**
 * Resolve OG title + description for invite landings.
 *
 * @param {{
 *   code?: string,
 *   handle?: string,
 *   from?: string,
 *   poolName?: string | null,
 *   siteProfileFound?: boolean,
 * }} params
 * @returns {{ title: string, description: string }}
 */
export function resolveInviteOgContent({
  code = '',
  handle = '',
  from = '',
  poolName = null,
  siteProfileFound,
} = {}) {
  const normalizedHandle = normalizeInviteHandle(handle);
  const normalizedFrom = normalizeInviteHandle(from);
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  const trimmedPoolName = typeof poolName === 'string' ? poolName.trim() : '';

  if (normalizedHandle && !normalizedCode) {
    if (siteProfileFound === false) {
      return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
    }
    return {
      title: buildSiteInviteShareTitle(normalizedHandle),
      description: SITE_INVITE_DESCRIPTION,
    };
  }

  if (normalizedCode) {
    if (normalizedFrom) {
      return {
        title: buildPoolInviteShareTitleFromInviter(normalizedFrom, trimmedPoolName || undefined),
        description: POOL_INVITE_FROM_DESCRIPTION,
      };
    }

    return {
      title: buildPoolInviteShareTitle(trimmedPoolName || undefined),
      description: buildPoolInviteDescription(trimmedPoolName || undefined),
    };
  }

  return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
}

/** Safe hashed asset href. Manifest injection must not accept arbitrary URLs. */
const INVITE_PRELOAD_HREF_RE = /^\/assets\/[A-Za-z0-9._-]+\.js$/;

/**
 * Which invite boot graph this request paints (#733).
 * `pool` = `/join/:code`, `site` = `/invite/:handle`.
 *
 * @param {{ code?: string, handle?: string }} params
 * @returns {'pool' | 'site' | null}
 */
export function resolveInviteBootKind({ code = '', handle = '' } = {}) {
  const normalizedHandle = normalizeInviteHandle(handle);
  const normalizedCode = String(code ?? '').trim();
  if (normalizedHandle && !normalizedCode) return 'site';
  if (normalizedCode) return 'pool';
  return null;
}

/**
 * Pick the precomputed modulepreload list for this invite URL.
 * Returns [] when the manifest is missing or the request is not an invite.
 *
 * @param {{ pool?: unknown, site?: unknown } | null | undefined} manifest
 * @param {{ code?: string, handle?: string }} params
 * @returns {string[]}
 */
export function selectInviteBootPreloadHrefs(manifest, { code = '', handle = '' } = {}) {
  const kind = resolveInviteBootKind({ code, handle });
  if (!kind || !manifest || typeof manifest !== 'object') return [];
  const list = manifest[kind];
  if (!Array.isArray(list)) return [];
  return list.filter((href) => typeof href === 'string' && INVITE_PRELOAD_HREF_RE.test(href));
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {{ title: string, description: string, url: string, image: string, imageAlt?: string }} og
 * @returns {string}
 */
export function buildOgMetaTags({
  title,
  description,
  url,
  image,
  imageAlt = DEFAULT_OG_IMAGE_ALT,
}) {
  return [
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`,
    `  <meta property="og:title" content="${escapeHtml(title)}" />`,
    `  <meta property="og:description" content="${escapeHtml(description)}" />`,
    `  <meta property="og:image" content="${escapeHtml(image)}" />`,
    `  <meta property="og:image:secure_url" content="${escapeHtml(image)}" />`,
    `  <meta property="og:image:type" content="image/jpeg" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    `  <meta property="og:url" content="${escapeHtml(url)}" />`,
    `  <meta property="og:type" content="website" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `  <meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].join('\n');
}

/**
 * @param {{ title: string, description: string, url: string, image: string }} og
 * @returns {string}
 */
export function buildCrawlerHtml(og) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${buildOgMetaTags(og)}
</head>
<body></body>
</html>`;
}

/**
 * @param {string} spaHtml
 * @param {{ title: string, description: string, url: string, image: string }} og
 * @returns {string}
 */
export function injectOgIntoSpa(spaHtml, og) {
  const dynamicTags = buildOgMetaTags(og);
  const cleanedShell = stripPrerenderBodyFromSpaShell(spaHtml);
  return cleanedShell.replace(
    /(<meta\s+charset[^>]*\/?>)/i,
    `$1\n${dynamicTags}`,
  );
}
