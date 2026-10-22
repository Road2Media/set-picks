/**
 * Tour-stats SEO auto-expand (#959).
 *
 * At prerender, read `public_tour_stats/_index` (+ per-slug docs) and add
 * `/tour-stats/{slug}` pages when a tour clears the thin-page gate — no hand
 * edit of `seoRoutes.js`. Aggregates only; never full night setlists.
 *
 * First-wave allowlist + gate:
 *   - `showsWithSetlist` ≥ {@link TOUR_STATS_SEO_MIN_SHOWS_WITH_SETLIST}
 *   - `uniqueSongs` ≥ {@link TOUR_STATS_SEO_MIN_UNIQUE_SONGS}
 *   - `lastShowDate` year === current UTC year
 * Do not expand on the first empty night.
 *
 * Rollback:
 *   - Kill-switch: `TOUR_STATS_SEO_AUTO_EXPAND=0` (or `false` / `off`)
 *   - Extra allowlist: `TOUR_STATS_SEO_ALLOWLIST=slug-a,slug-b` (still gated)
 *   - Denylist: `TOUR_STATS_SEO_DENYLIST=bad-slug`
 */

import { SEO_CONFIG } from '../../src/shared/config/seo.js';

/** Minimum through-today nights with a setlist before a tour is SEO-worthy. */
export const TOUR_STATS_SEO_MIN_SHOWS_WITH_SETLIST = 4;

/** Minimum unique titles — blocks a 4-night run that is still catalog-thin. */
export const TOUR_STATS_SEO_MIN_UNIQUE_SONGS = 20;

/**
 * Paths that are not tour slugs. `/tour-stats/msg` and `/tour-stats/2026`
 * are their own pages (#1139 / #1141). Auto-expand must not overwrite them.
 */
export const TOUR_STATS_RESERVED_SLUGS = new Set(['msg', '2026']);

const FALSEY_ENV = new Set(['0', 'false', 'off', 'no']);

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isTourStatsSeoAutoExpandEnabled(env = process.env) {
  const raw = String(env.TOUR_STATS_SEO_AUTO_EXPAND ?? '1').trim().toLowerCase();
  return !FALSEY_ENV.has(raw);
}

/**
 * @param {string | undefined} raw
 * @returns {Set<string>}
 */
export function parseSlugCsv(raw) {
  const out = new Set();
  if (typeof raw !== 'string' || !raw.trim()) return out;
  for (const part of raw.split(',')) {
    const slug = part.trim();
    if (slug && !slug.startsWith('_')) out.add(slug);
  }
  return out;
}

/**
 * @param {unknown} lastShowDate
 * @param {number} year
 * @returns {boolean}
 */
export function lastShowDateIsInYear(lastShowDate, year) {
  if (typeof lastShowDate !== 'string') return false;
  const m = lastShowDate.trim().match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!m) return false;
  return Number(m[1]) === year;
}

/**
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {{ now?: Date }} [opts]
 * @returns {{ ok: boolean, reason: string }}
 */
export function tourMeetsSeoExpandGate(doc, opts = {}) {
  if (!doc || typeof doc !== 'object') {
    return { ok: false, reason: 'missing-doc' };
  }
  const shows = Number(doc.showsWithSetlist) || 0;
  const unique = Number(doc.uniqueSongs) || 0;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const year = now.getUTCFullYear();

  if (shows < TOUR_STATS_SEO_MIN_SHOWS_WITH_SETLIST) {
    return { ok: false, reason: 'thin-shows' };
  }
  if (unique < TOUR_STATS_SEO_MIN_UNIQUE_SONGS) {
    return { ok: false, reason: 'thin-songs' };
  }
  if (!lastShowDateIsInYear(doc.lastShowDate, year)) {
    return { ok: false, reason: 'not-current-year' };
  }
  return { ok: true, reason: 'pass' };
}

/**
 * @param {{ tourLabel: string, slug: string, siteUrl?: string }} args
 */
export function buildTourStatsSeoCopy({ tourLabel, slug, siteUrl = SEO_CONFIG.siteUrl }) {
  const label =
    typeof tourLabel === 'string' && tourLabel.trim()
      ? tourLabel.trim()
      : 'This tour';
  const path = `/tour-stats/${slug}`;
  const title = `${label} Statistics | Setlist Pick'Em`;
  const description = `${label} Phish setlist statistics—most-played songs, unique songs, bustouts, and gap highlights. Updated every night the band plays live. Play Setlist Pick'Em to unlock personal stats.`;
  const canonicalUrl = `${siteUrl}${path}`;
  const h1 = `${label} setlist statistics`;
  return { label, path, title, description, canonicalUrl, h1 };
}

/**
 * @param {{ tourLabel: string, slug: string, siteUrl?: string }} args
 */
export function buildTourStatsSlugJsonLd(args) {
  const { label, title, description, canonicalUrl } = buildTourStatsSeoCopy(args);
  const siteUrl = args.siteUrl || SEO_CONFIG.siteUrl;
  const hubUrl = `${siteUrl}/tour-stats`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: title,
        description,
        isPartOf: { '@id': `${siteUrl}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${siteUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Tour Insights',
            item: hubUrl,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: label,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };
}

/**
 * @param {{ slug: string, tourLabel: string, siteUrl?: string }} args
 */
export function buildAutoTourStatsPrerenderRoute(args) {
  const copy = buildTourStatsSeoCopy(args);
  return {
    path: copy.path,
    title: copy.title,
    description: copy.description,
    canonicalUrl: copy.canonicalUrl,
    h1: copy.h1,
    tourStatsSeoSlug: args.slug,
    autoExpanded: true,
    paragraphs: [
      `Tour Insights for Phish ${copy.label}—setlist statistics, most-played songs, unique songs, bustouts, and gap highlights.`,
      'Statistics refresh every night the band plays live, so the picture keeps getting sharper as you make picks.',
      'Tour-wide song trends for fans—play the game to unlock personal stats as you compete.',
    ],
    buildJsonLd: () => buildTourStatsSlugJsonLd(args),
  };
}

/**
 * @param {{
 *   indexDoc: Record<string, unknown> | null | undefined,
 *   loadDoc: (slug: string) => Promise<Record<string, unknown> | null>,
 *   existingSlugs?: Iterable<string>,
 *   now?: Date,
 *   env?: NodeJS.ProcessEnv,
 * }} args
 * @returns {Promise<ReturnType<typeof buildAutoTourStatsPrerenderRoute>[]>}
 */
export async function resolveAutoExpandTourStatsRoutes({
  indexDoc,
  loadDoc,
  existingSlugs = [],
  now = new Date(),
  env = process.env,
}) {
  if (!isTourStatsSeoAutoExpandEnabled(env)) return [];
  if (!indexDoc || typeof indexDoc !== 'object') return [];

  const tours = Array.isArray(indexDoc.tours) ? indexDoc.tours : [];
  const already = new Set(
    [...existingSlugs].map((s) => String(s || '').trim()).filter(Boolean),
  );
  const allowlist = parseSlugCsv(env.TOUR_STATS_SEO_ALLOWLIST);
  const denylist = parseSlugCsv(env.TOUR_STATS_SEO_DENYLIST);
  const routes = [];

  for (const entry of tours) {
    const slug =
      typeof entry?.tourSlug === 'string' ? entry.tourSlug.trim() : '';
    if (!slug || slug.startsWith('_') || already.has(slug)) continue;
    if (TOUR_STATS_RESERVED_SLUGS.has(slug)) continue;
    if (denylist.has(slug)) continue;
    if (allowlist.size > 0 && !allowlist.has(slug)) continue;

    let doc = null;
    try {
      doc = await loadDoc(slug);
    } catch {
      continue;
    }
    if (!doc) continue;

    const merged = {
      ...doc,
      tourLabel:
        (typeof doc.tourLabel === 'string' && doc.tourLabel.trim()) ||
        (typeof entry.tourLabel === 'string' && entry.tourLabel.trim()) ||
        slug,
      lastShowDate: doc.lastShowDate || entry.lastShowDate || null,
    };

    const gate = tourMeetsSeoExpandGate(merged, { now });
    if (!gate.ok) continue;

    routes.push(
      buildAutoTourStatsPrerenderRoute({
        slug,
        tourLabel: merged.tourLabel,
      }),
    );
    already.add(slug);
  }

  return routes;
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Append missing tour-stats slug URLs to a sitemap.xml document.
 *
 * @param {string} xml
 * @param {string[]} locs absolute URLs
 * @returns {string}
 */
export function appendSitemapTourStatsUrls(xml, locs) {
  const existing = new Set(
    [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) =>
      m[1].trim(),
    ),
  );
  const extras = (Array.isArray(locs) ? locs : []).filter(
    (loc) => loc && !existing.has(loc),
  );
  if (!extras.length) return xml;
  const block = extras
    .map(
      (loc) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
    )
    .join('\n');
  if (!/<\/urlset>/i.test(xml)) {
    return `${xml.trimEnd()}\n${block}\n`;
  }
  return xml.replace(/<\/urlset>/i, `${block}\n</urlset>`);
}

/**
 * Sitemap `<lastmod>` date. Accepts `YYYY-MM-DD` or an ISO timestamp and
 * returns the calendar date only when it is a real UTC day.
 *
 * Use `public_tour_stats.lastShowDate`, not `writtenAt`. The nightly refresh
 * rewrites `writtenAt` even when the show list is unchanged, and Google drops
 * `<lastmod>` that moves without a page change. `changefreq` is ignored.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function sitemapLastmodDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * @param {unknown[]} dates
 * @returns {string | null}
 */
export function maxSitemapLastmod(dates) {
  const valid = (Array.isArray(dates) ? dates : [])
    .map((value) => sitemapLastmodDate(value))
    .filter(Boolean)
    .sort();
  return valid.length ? valid[valid.length - 1] : null;
}

/**
 * Absolute sitemap locs for prerendered tour-stats slugs, plus the hub.
 * Hub `<lastmod>` is the newest slug date (the hub follows the current tour).
 * URLs with no valid date are omitted so unchanged marketing pages stay unstamped.
 *
 * @param {Record<string, unknown>} slugDates
 * @param {{ siteUrl?: string }} [opts]
 * @returns {Record<string, string>}
 */
export function tourStatsSitemapLastmodMap(slugDates, opts = {}) {
  const siteUrl = String(opts.siteUrl || SEO_CONFIG.siteUrl).replace(/\/$/, '');
  /** @type {Record<string, string>} */
  const out = {};
  const dates = [];
  for (const [slug, raw] of Object.entries(slugDates || {})) {
    const clean = String(slug || '').trim();
    const date = sitemapLastmodDate(raw);
    if (!clean || clean.startsWith('_') || !date) continue;
    out[`${siteUrl}/tour-stats/${clean}`] = date;
    dates.push(date);
  }
  const hub = maxSitemapLastmod(dates);
  if (hub) out[`${siteUrl}/tour-stats`] = hub;
  return out;
}

/**
 * Insert or replace `<lastmod>` on url blocks whose `<loc>` is in `lastmods`.
 * Other urls, including home / about / keyword, are left unchanged.
 *
 * @param {string} xml
 * @param {Record<string, string>} lastmods
 * @returns {string}
 */
export function applySitemapLastmods(xml, lastmods) {
  const map = new Map();
  for (const [loc, raw] of Object.entries(lastmods || {})) {
    const key = String(loc || '').trim();
    const date = sitemapLastmodDate(raw);
    if (!key || !date) continue;
    map.set(key, date);
  }
  if (!map.size) return xml;
  return String(xml).replace(/<url>([\s\S]*?)<\/url>/gi, (block, inner) => {
    const locMatch = inner.match(/<loc>\s*([^<]+?)\s*<\/loc>/i);
    if (!locMatch) return block;
    const date = map.get(locMatch[1].trim());
    if (!date) return block;
    const nextInner = /<lastmod>[\s\S]*?<\/lastmod>/i.test(inner)
      ? inner.replace(/<lastmod>[\s\S]*?<\/lastmod>/i, `<lastmod>${date}</lastmod>`)
      : inner.replace(
          /(<loc>\s*[^<]+?\s*<\/loc>)/i,
          `$1\n    <lastmod>${date}</lastmod>`,
        );
    return `<url>${nextInner}</url>`;
  });
}

/**
 * Append missing tour-stats lines to the llms.txt Links section.
 *
 * @param {string} text
 * @param {Array<{ label: string, url: string }>} entries
 * @returns {string}
 */
export function appendLlmsTourStatsLinks(text, entries) {
  const missing = (Array.isArray(entries) ? entries : []).filter(
    (e) => e?.url && !text.includes(e.url),
  );
  if (!missing.length) return text;

  const lines = missing.map(
    (e) => `- ${e.label} setlist statistics: ${e.url}`,
  );
  const linkLines = [...text.matchAll(/^- .*\/tour-stats\/[^\s]+$/gm)];
  const last = linkLines[linkLines.length - 1];
  if (last && typeof last.index === 'number') {
    const insertAt = last.index + last[0].length;
    return `${text.slice(0, insertAt)}\n${lines.join('\n')}${text.slice(insertAt)}`;
  }
  const linksHeader = text.indexOf('## Links');
  if (linksHeader >= 0) {
    const afterHeader = text.indexOf('\n', linksHeader);
    const at = afterHeader >= 0 ? afterHeader + 1 : text.length;
    return `${text.slice(0, at)}${lines.join('\n')}\n${text.slice(at)}`;
  }
  return `${text.trimEnd()}\n\n${lines.join('\n')}\n`;
}

/**
 * @param {Array<{ path?: string, canonicalUrl?: string, tourStatsSeoSlug?: string, h1?: string, title?: string }>} routes
 * @param {{ siteUrl?: string }} [opts]
 */
export function tourStatsDiscoveryFromRoutes(routes, opts = {}) {
  const siteUrl = opts.siteUrl || SEO_CONFIG.siteUrl;
  const locs = [];
  const llms = [];
  const seen = new Set();
  for (const route of Array.isArray(routes) ? routes : []) {
    const slug =
      typeof route?.tourStatsSeoSlug === 'string'
        ? route.tourStatsSeoSlug.trim()
        : '';
    if (!slug) continue;
    const url = route.canonicalUrl || `${siteUrl}/tour-stats/${slug}`;
    if (seen.has(url)) continue;
    seen.add(url);
    locs.push(url);
    const label =
      (typeof route.h1 === 'string' &&
        route.h1.replace(/\s+setlist statistics$/i, '').trim()) ||
      slug;
    llms.push({ label, url });
  }
  return { locs, llms };
}
