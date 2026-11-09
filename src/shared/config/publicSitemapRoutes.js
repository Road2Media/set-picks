/**
 * Indexable public routes (#1144).
 *
 * `public/sitemap.xml` and `public/llms.txt` must list every entry in
 * {@link SITEMAP_PUBLIC_ROUTES}. `scripts/prerender-seo.mjs` appends any
 * that are missing and then fails the build if one is still absent.
 * `verify:seo-prerender` does the same check, and fails when `App.jsx` or
 * `MarketingApp.jsx` gains a route that is neither listed here nor excluded.
 *
 * `/phish-picks` is not a route. #975 is a December go/no-go. Do not add it.
 */
import { SEO_CONFIG } from './seo.js';

/**
 * Concrete URLs that belong in the sitemap and llms.txt.
 * Parametric routes (`:tourSlug`, `:weekId`) are not repeated here.
 * Auto-expanded tour slugs are added at build on top of this list.
 *
 * @type {ReadonlyArray<{ path: string, changefreq: string, priority: string, llms: string }>}
 */
export const SITEMAP_PUBLIC_ROUTES = Object.freeze([
  { path: '/', changefreq: 'weekly', priority: '1.0', llms: 'Home' },
  { path: '/how-it-works', changefreq: 'monthly', priority: '0.8', llms: 'How It Works' },
  {
    path: '/how-scoring-works',
    changefreq: 'monthly',
    priority: '0.8',
    llms: 'How Scoring Works',
  },
  {
    path: '/how-scoring-changed',
    changefreq: 'monthly',
    priority: '0.6',
    llms: 'How Scoring Changed',
  },
  {
    path: '/tour-stats',
    changefreq: 'weekly',
    priority: '0.8',
    llms: 'Tour Insights / Phish tour setlist statistics',
  },
  {
    path: '/tour-stats/2026-sphere',
    changefreq: 'weekly',
    priority: '0.7',
    llms: '2026 Sphere tour statistics',
  },
  {
    path: '/tour-stats/2026-summer-tour',
    changefreq: 'weekly',
    priority: '0.7',
    llms: '2026 Summer Tour setlist statistics',
  },
  {
    path: '/tour-stats/2026',
    changefreq: 'weekly',
    priority: '0.7',
    llms: '2026 Phish tour statistics',
  },
  {
    path: '/tour-stats/2026-2027-nye-run',
    changefreq: 'weekly',
    priority: '0.7',
    llms: "New Year's Run 2026-2027 at MSG",
  },
  {
    path: '/phish-at-msg',
    changefreq: 'weekly',
    priority: '0.7',
    llms: 'Phish at MSG',
  },
  {
    path: '/phish-setlist-prediction-game',
    changefreq: 'monthly',
    priority: '0.85',
    llms: 'Phish Setlist Prediction Game',
  },
  { path: '/about', changefreq: 'monthly', priority: '0.75', llms: 'About' },
  {
    path: '/rewind',
    changefreq: 'weekly',
    priority: '0.6',
    llms: 'Rewind results',
  },
  {
    path: '/phish-iq',
    changefreq: 'daily',
    priority: '0.6',
    llms: 'Phish IQ',
  },
]);

/**
 * Public routes that stay out of the sitemap, with the reason.
 * A new static path in App.jsx must be added here or to SITEMAP_PUBLIC_ROUTES.
 */
export const SITEMAP_EXCLUDED_PUBLIC_PATHS = Object.freeze({
  '/login': 'auth door',
  '/password-reset-complete': 'robots.txt disallows this path',
  '/privacy': 'legal door, linked from the footer, not a discovery URL',
  '/terms': 'legal door, linked from the footer, not a discovery URL',
  '/join': 'invite shell without a code',
  '/join/': 'invite shell without a code',
  '/setup': 'auth-only profile setup',
  '/comms-preview': 'dev preview',
  '/card-shell-preview': 'dev preview',
  '/embed': 'redirect to /embed/stats; robots.txt disallows /embed',
  '/embed/stats': 'noindex frame; robots.txt disallows /embed',
  '/tour-stats/msg': 'permanent redirect to /phish-at-msg',
  '/dashboard/*': 'auth-only app',
  '*': 'marketing-document catch-all, not a page',
});

/**
 * Parametric routes. The sitemap lists a concrete URL instead
 * (`/rewind`, each prerendered tour slug).
 */
export const SITEMAP_DYNAMIC_PUBLIC_PATHS = Object.freeze({
  '/tour-stats/:tourSlug': 'prerendered slugs plus the auto-expand gate',
  '/rewind/:weekId': 'same results page as /rewind',
  '/user/:userId': 'noindex public profiles',
  '/join/:code': 'personalized invite',
  '/invite/:handle': 'personalized invite',
});

/**
 * @param {string} path
 * @param {string} [siteUrl]
 */
export function sitemapLocForPath(path, siteUrl = SEO_CONFIG.siteUrl) {
  const base = String(siteUrl || '').replace(/\/$/, '');
  if (path === '/') return `${base}/`;
  return `${base}${path}`;
}

/**
 * @param {string} xml
 * @returns {Set<string>}
 */
export function sitemapLocSet(xml) {
  return new Set(
    [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
      match[1].trim(),
    ),
  );
}

/**
 * @param {string} xml
 * @param {string} [siteUrl]
 * @returns {string[]} paths missing from the sitemap
 */
export function missingSitemapPaths(xml, siteUrl = SEO_CONFIG.siteUrl) {
  const locs = sitemapLocSet(xml);
  return SITEMAP_PUBLIC_ROUTES.filter(
    (route) => !locs.has(sitemapLocForPath(route.path, siteUrl)),
  ).map((route) => route.path);
}

/**
 * @param {string} text
 * @param {string} [siteUrl]
 * @returns {string[]} paths whose absolute URL is absent from llms.txt
 */
export function missingLlmsPaths(text, siteUrl = SEO_CONFIG.siteUrl) {
  const body = String(text);
  return SITEMAP_PUBLIC_ROUTES.filter(
    (route) => !body.includes(sitemapLocForPath(route.path, siteUrl)),
  ).map((route) => route.path);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Insert any required public URLs that the sitemap does not already list.
 *
 * @param {string} xml
 * @param {string} [siteUrl]
 * @returns {string}
 */
export function appendMissingSitemapRoutes(xml, siteUrl = SEO_CONFIG.siteUrl) {
  const missing = missingSitemapPaths(xml, siteUrl);
  if (!missing.length) return xml;
  const byPath = new Map(SITEMAP_PUBLIC_ROUTES.map((route) => [route.path, route]));
  const block = missing
    .map((path) => {
      const route = byPath.get(path);
      return `  <url>
    <loc>${escapeXml(sitemapLocForPath(path, siteUrl))}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
    })
    .join('\n');
  if (!/<\/urlset>/i.test(xml)) {
    return `${xml.trimEnd()}\n${block}\n`;
  }
  return xml.replace(/<\/urlset>/i, `${block}\n</urlset>`);
}

/**
 * Insert any required public URLs that llms.txt does not already mention.
 *
 * @param {string} text
 * @param {string} [siteUrl]
 * @returns {string}
 */
export function appendMissingLlmsRoutes(text, siteUrl = SEO_CONFIG.siteUrl) {
  const missing = missingLlmsPaths(text, siteUrl);
  if (!missing.length) return text;
  const byPath = new Map(SITEMAP_PUBLIC_ROUTES.map((route) => [route.path, route]));
  const lines = missing.map((path) => {
    const route = byPath.get(path);
    return `- ${route.llms}: ${sitemapLocForPath(path, siteUrl)}`;
  });
  const linksHeader = text.indexOf('## Links');
  if (linksHeader < 0) {
    return `${text.trimEnd()}\n\n## Links\n\n${lines.join('\n')}\n`;
  }
  const credit = text.indexOf('- Setlist data credit:', linksHeader);
  if (credit >= 0) {
    return `${text.slice(0, credit)}${lines.join('\n')}\n${text.slice(credit)}`;
  }
  return `${text.trimEnd()}\n${lines.join('\n')}\n`;
}

/**
 * @param {string} sitemap
 * @param {string} llms
 * @param {string} [siteUrl]
 */
export function assertPublicDiscovery(sitemap, llms, siteUrl = SEO_CONFIG.siteUrl) {
  const missingSitemap = missingSitemapPaths(sitemap, siteUrl);
  const missingLlms = missingLlmsPaths(llms, siteUrl);
  const problems = [];
  if (missingSitemap.length) {
    problems.push(`sitemap.xml missing ${missingSitemap.join(', ')}`);
  }
  if (missingLlms.length) {
    problems.push(`llms.txt missing ${missingLlms.join(', ')}`);
  }
  if (String(sitemap).includes('/phish-picks') || String(llms).includes('/phish-picks')) {
    problems.push('/phish-picks is gated (#975) and must not be published');
  }
  if (problems.length) {
    throw new Error(`public discovery: ${problems.join('; ')}`);
  }
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function extractRoutePaths(source) {
  return [...String(source).matchAll(/\bpath=["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
}

/**
 * Static or parametric paths that are not classified for the sitemap.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export function unclassifiedPublicPaths(paths) {
  const seen = new Set();
  const missing = [];
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    if (SITEMAP_PUBLIC_ROUTES.some((route) => route.path === path)) continue;
    if (Object.prototype.hasOwnProperty.call(SITEMAP_EXCLUDED_PUBLIC_PATHS, path)) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(SITEMAP_DYNAMIC_PUBLIC_PATHS, path)) {
      continue;
    }
    missing.push(path);
  }
  return missing;
}
