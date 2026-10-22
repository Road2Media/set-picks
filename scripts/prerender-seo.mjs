/**
 * Post-build: write crawler-visible HTML for public marketing routes (#659).
 * Also writes a branded SPA boot shell for dashboard / app hard loads (#743 / #773).
 * Run after `vite build`. Safe to re-run.
 *
 * #832: marketing routes prerender from `dist/index.html` (marketing entry).
 * #853: `/tour-stats*` also uses the marketing shell (+ PublicTourStatsPage preload).
 * #928: tour-stats SEO slugs fetch `public_tour_stats/{slug}` (REST) and embed
 * bustout/frequency facts + FAQ/ItemList JSON-LD for crawlers.
 * #959: additional `/tour-stats/{slug}` pages auto-expand from `_index` when
 * the thin-page gate passes (see `scripts/lib/tourStatsSeoAutoExpand.mjs`).
 * Sitemap + `llms.txt` in `dist/` are rewritten from the same registry.
 * #869: also writes `dist/tour-stats-data/{slug}.json` so public `/tour-stats`
 * can paint aggregates without App Check / Firestore SDK.
 * Boot shells: `dashboard` / `spa-boot` use `dist/app.html`;
 * `login` uses HTML-first `dist/login.html` (#892);
 * `/privacy` + `/terms` use zero-JS legal door shells (#916).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APP_BOOT_SHELL_REL_PATH,
  LIGHT_SPA_BOOT_SHELL_REL_PATH,
  LOGIN_BOOT_SHELL_REL_PATH,
  PRERENDER_ROUTES,
  buildDashboardBootShellHtml,
  buildLegalBootDocumentHtml,
  buildLoginBootShellHtml,
  injectDashboardBootModulepreloads,
  injectLoginBootModulepreloads,
  injectPrerenderHtml,
  injectTourStatsBootModulepreloads,
  prerenderOutputRelPath,
} from './seo-prerender-lib.mjs';
import { fetchFirestoreRestDocument } from './lib/firestoreRestDecode.mjs';
import {
  appendLlmsTourStatsLinks,
  appendSitemapTourStatsUrls,
  isTourStatsSeoAutoExpandEnabled,
  resolveAutoExpandTourStatsRoutes,
  tourStatsDiscoveryFromRoutes,
} from './lib/tourStatsSeoAutoExpand.mjs';
import {
  buildTourStatsFactsHtml,
  mergeTourStatsFactsJsonLd,
  normalizeTourStatsFacts,
} from './lib/tourStatsSeoFacts.mjs';
import { writeFinishedTourWrapShareImage } from './lib/tourWrapShareImage.mjs';
import { SEO_CONFIG } from '../src/shared/config/seo.js';
import {
  buildFinishedTourWrap,
  buildFinishedTourWrapHtml,
  finishedTourWrapShareImageFile,
  finishedTourWrapShareImageUrl,
} from '../src/features/tour-stats/model/finishedTourWrap.js';
import { TOUR_STATS_SEO_FACT_SLUGS } from '../src/shared/config/seoRoutes.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const distDir = join(root, 'dist');
const distIndex = join(distDir, 'index.html');
const distApp = join(distDir, 'app.html');
const distLogin = join(distDir, 'login.html');

const FIRESTORE_PROJECT_ID =
  process.env.VITE_FIREBASE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'set-picks';

if (!existsSync(distIndex)) {
  console.error('prerender-seo: missing dist/index.html — run vite build first');
  process.exit(1);
}
if (!existsSync(distApp)) {
  console.error('prerender-seo: missing dist/app.html — run vite build first');
  process.exit(1);
}
if (!existsSync(distLogin)) {
  console.error('prerender-seo: missing dist/login.html — HTML-first login entry (#892)');
  process.exit(1);
}

const marketingShell = readFileSync(distIndex, 'utf8');
const appShell = readFileSync(distApp, 'utf8');
const loginEntryShell = readFileSync(distLogin, 'utf8');

function isTourStatsPrerenderRoute(path) {
  return typeof path === 'string' && path.startsWith('/tour-stats');
}

function isLegalPrerenderRoute(path) {
  return path === '/privacy' || path === '/terms';
}

/** @type {Map<string, Record<string, unknown> | null>} */
const publicTourStatsDocCache = new Map();

/**
 * @param {string} slug
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function loadPublicTourStatsDoc(slug) {
  const id = String(slug || '').trim();
  if (!id) return null;
  if (publicTourStatsDocCache.has(id)) return publicTourStatsDocCache.get(id);
  const doc = await fetchFirestoreRestDocument(
    FIRESTORE_PROJECT_ID,
    `public_tour_stats/${id}`,
  );
  publicTourStatsDocCache.set(id, doc);
  return doc;
}

/**
 * Same-origin CDN snapshots for the public tour-stats data plane (#869).
 * Missing Firestore docs are skipped — the client falls back to REST.
 */
async function emitPublicTourStatsCdnJson() {
  const outDir = join(distDir, 'tour-stats-data');
  mkdirSync(outDir, { recursive: true });
  let indexDoc = null;
  try {
    indexDoc = await loadPublicTourStatsDoc('_index');
  } catch (err) {
    console.warn(
      'prerender-seo: failed to fetch public_tour_stats/_index for CDN JSON:',
      err?.message || err,
    );
    return;
  }
  if (!indexDoc) {
    console.warn(
      'prerender-seo: no public_tour_stats/_index — skip CDN JSON (#869)',
    );
    return;
  }
  const tours = Array.isArray(indexDoc.tours) ? indexDoc.tours : [];
  const indexPayload = {
    tours,
    defaultTourSlug:
      typeof indexDoc.defaultTourSlug === 'string'
        ? indexDoc.defaultTourSlug
        : '',
    cdnGeneratedAt: new Date().toISOString(),
  };
  writeFileSync(join(outDir, '_index.json'), JSON.stringify(indexPayload));
  console.log(
    `prerender-seo: wrote dist/tour-stats-data/_index.json (${tours.length} tours)`,
  );

  const slugs = new Set(
    tours
      .map((t) => (typeof t?.tourSlug === 'string' ? t.tourSlug.trim() : ''))
      .filter((slug) => slug && !slug.startsWith('_')),
  );
  for (const route of PRERENDER_ROUTES) {
    const seoSlug =
      typeof route.tourStatsSeoSlug === 'string'
        ? route.tourStatsSeoSlug.trim()
        : '';
    if (seoSlug) slugs.add(seoSlug);
  }

  for (const slug of slugs) {
    try {
      const doc = await loadPublicTourStatsDoc(slug);
      if (!doc) {
        console.warn(`prerender-seo: no public_tour_stats/${slug} for CDN JSON`);
        continue;
      }
      const rel = `tour-stats-data/${slug}.json`;
      writeFileSync(join(outDir, `${slug}.json`), JSON.stringify({ id: slug, ...doc }));
      await maybeWriteTourWrapShareImage(doc, slug);
      console.log(
        `prerender-seo: wrote dist/${rel} (${Buffer.byteLength(JSON.stringify(doc), 'utf8')} bytes)`,
      );
    } catch (err) {
      console.warn(
        `prerender-seo: failed CDN JSON for ${slug}:`,
        err?.message || err,
      );
    }
  }
}

/**
 * @param {object} route
 * @returns {Promise<{ factsHtml?: string, jsonLd?: object }>}
 */
/**
 * Finished-tour wrap + JPEG for any public doc that has closed (#1140).
 * Image failure still leaves the HTML wrap. Default OG card stays when there
 * is no JPEG.
 *
 * @param {Record<string, unknown>} doc
 * @param {string} slug
 * @returns {Promise<{ wrap: ReturnType<typeof buildFinishedTourWrap>, ogImage: string }>}
 */
async function maybeWriteTourWrapShareImage(doc, slug) {
  const wrap = buildFinishedTourWrap(doc, { slug, now: new Date() });
  if (!wrap) return { wrap: null, ogImage: '' };
  const file = finishedTourWrapShareImageFile(slug);
  if (!file) return { wrap, ogImage: '' };
  try {
    await writeFinishedTourWrapShareImage(wrap, join(distDir, file));
    console.log(`prerender-seo: wrote dist/${file}`);
    return {
      wrap,
      ogImage:
        finishedTourWrapShareImageUrl(slug, {
          siteUrl: SEO_CONFIG.siteUrl,
          version: typeof doc.writtenAt === 'string' ? doc.writtenAt : '',
        }) || '',
    };
  } catch (err) {
    console.warn(
      `prerender-seo: tour wrap share image skipped for ${slug}:`,
      err?.message || err,
    );
    return { wrap, ogImage: '' };
  }
}

async function loadTourStatsEnrichment(route) {
  const slug =
    typeof route.tourStatsSeoSlug === 'string' ? route.tourStatsSeoSlug.trim() : '';
  if (!slug) return {};
  try {
    const doc = await loadPublicTourStatsDoc(slug);
    if (!doc) {
      console.warn(
        `prerender-seo: no public_tour_stats/${slug} — static copy only`,
      );
      return {};
    }
    const facts = normalizeTourStatsFacts(doc);
    if (!facts.bustouts.length && !facts.topSongs.length) {
      console.warn(
        `prerender-seo: public_tour_stats/${slug} has no bustouts/topSongs yet`,
      );
    }
    const { wrap, ogImage } = await maybeWriteTourWrapShareImage(doc, slug);
    return {
      factsHtml: buildTourStatsFactsHtml(facts),
      leadHtml: wrap ? buildFinishedTourWrapHtml(wrap) : '',
      jsonLd: mergeTourStatsFactsJsonLd(
        route.buildJsonLd(),
        facts,
        route.canonicalUrl,
      ),
      ogImage: ogImage || undefined,
      ogImageAlt: wrap?.headline || '',
    };
  } catch (err) {
    console.warn(
      `prerender-seo: failed to fetch public_tour_stats/${slug}:`,
      err?.message || err,
    );
    return {};
  }
}

async function resolvePrerenderRoutes() {
  const existingSlugs = new Set(TOUR_STATS_SEO_FACT_SLUGS);
  for (const route of PRERENDER_ROUTES) {
    const seoSlug =
      typeof route.tourStatsSeoSlug === 'string'
        ? route.tourStatsSeoSlug.trim()
        : '';
    if (seoSlug) existingSlugs.add(seoSlug);
  }
  if (!isTourStatsSeoAutoExpandEnabled()) {
    console.log('prerender-seo: tour-stats SEO auto-expand off (kill-switch)');
    return [...PRERENDER_ROUTES];
  }
  let indexDoc = null;
  try {
    indexDoc = await loadPublicTourStatsDoc('_index');
  } catch (err) {
    console.warn(
      'prerender-seo: auto-expand skipped — failed to fetch _index:',
      err?.message || err,
    );
    return [...PRERENDER_ROUTES];
  }
  if (!indexDoc) {
    console.warn('prerender-seo: auto-expand skipped — no public_tour_stats/_index');
    return [...PRERENDER_ROUTES];
  }
  const extra = await resolveAutoExpandTourStatsRoutes({
    indexDoc,
    loadDoc: loadPublicTourStatsDoc,
    existingSlugs,
  });
  if (extra.length) {
    console.log(
      `prerender-seo: auto-expand +${extra.length} tour-stats SEO slug(s): ${extra
        .map((r) => r.tourStatsSeoSlug)
        .join(', ')}`,
    );
  } else {
    console.log('prerender-seo: auto-expand found no extra slugs that meet the gate');
  }
  return [...PRERENDER_ROUTES, ...extra];
}

function emitTourStatsDiscoveryFiles(allRoutes) {
  const { locs, llms } = tourStatsDiscoveryFromRoutes(allRoutes);
  const publicSitemap = join(root, 'public', 'sitemap.xml');
  const publicLlms = join(root, 'public', 'llms.txt');
  if (!existsSync(publicSitemap) || !existsSync(publicLlms)) {
    console.warn('prerender-seo: missing public/sitemap.xml or public/llms.txt');
    return;
  }
  const sitemap = appendSitemapTourStatsUrls(
    readFileSync(publicSitemap, 'utf8'),
    locs,
  );
  const llmsTxt = appendLlmsTourStatsLinks(readFileSync(publicLlms, 'utf8'), llms);
  writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf8');
  writeFileSync(join(distDir, 'llms.txt'), llmsTxt, 'utf8');
  const extraCount = locs.filter(
    (loc) =>
      !TOUR_STATS_SEO_FACT_SLUGS.some((slug) => loc.endsWith(`/tour-stats/${slug}`)),
  ).length;
  console.log(
    `prerender-seo: wrote dist/sitemap.xml + dist/llms.txt (${locs.length} tour-stats SEO loc(s), ${extraCount} auto-expanded)`,
  );
}

const prerenderRoutes = await resolvePrerenderRoutes();

for (const route of prerenderRoutes) {
  // Legal door shells are written separately (zero-JS; #916) — not marketing CSR.
  if (isLegalPrerenderRoute(route.path)) continue;

  const shell = marketingShell;
  const enrichment = await loadTourStatsEnrichment(route);
  let html = injectPrerenderHtml(shell, route, enrichment);
  // Marketing home statically imports splash UI via marketingMain — no lazy
  // HomeRoute waterfall, so no splash modulepreload injection (#832).
  // /tour-stats* preloads PublicTourStatsPage UI closure; firebase stays off
  // preload (#853 — fetch-time ensureFirebase after #835 login defer regression).
  if (isTourStatsPrerenderRoute(route.path)) {
    html = injectTourStatsBootModulepreloads(html, distDir);
  }
  const rel = prerenderOutputRelPath(route.path);
  const outPath = join(distDir, rel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  const factNote = enrichment.factsHtml ? ' +aggregate-facts' : '';
  console.log(
    `prerender-seo: wrote dist/${rel} (${Buffer.byteLength(html, 'utf8')} bytes)${factNote}`,
  );
}

await emitPublicTourStatsCdnJson();
emitTourStatsDiscoveryFiles(prerenderRoutes);

// HTML-first legal door (#916): full policy body in first HTML, no module graph.
for (const legalPath of ['/privacy', '/terms']) {
  const html = buildLegalBootDocumentHtml(legalPath, { rootDir: root });
  const rel = prerenderOutputRelPath(legalPath);
  const outPath = join(distDir, rel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  console.log(
    `prerender-seo: wrote dist/${rel} (HTML-first legal door, ${Buffer.byteLength(html, 'utf8')} bytes)`,
  );
}

// Branded boot shell for /dashboard/* + /setup (via vercel.json).
// Use the app document shell so boot loads AuthProvider, not marketingMain.
const brandedShell = buildDashboardBootShellHtml(appShell);
const appBootHtml = injectDashboardBootModulepreloads(brandedShell, distDir);
const appBootPath = join(distDir, APP_BOOT_SHELL_REL_PATH);
mkdirSync(dirname(appBootPath), { recursive: true });
writeFileSync(appBootPath, appBootHtml, 'utf8');
console.log(
  `prerender-seo: wrote dist/${APP_BOOT_SHELL_REL_PATH} (branded #root boot shell + modulepreload)`,
);

// Light spa boot: same branded skeleton, no DashboardRoute preload —
// public profile, bare /join, etc. must not contend for the dashboard graph.
const lightBootPath = join(distDir, LIGHT_SPA_BOOT_SHELL_REL_PATH);
mkdirSync(dirname(lightBootPath), { recursive: true });
writeFileSync(lightBootPath, brandedShell, 'utf8');
console.log(
  `prerender-seo: wrote dist/${LIGHT_SPA_BOOT_SHELL_REL_PATH} (branded shell, no route modulepreload)`,
);

// `/login`: HTML-first form chrome + login hydrate + firebase-core (#892 / #860).
const loginShell = buildLoginBootShellHtml(loginEntryShell);
const loginBootHtml = injectLoginBootModulepreloads(loginShell, distDir);
const loginBootPath = join(distDir, LOGIN_BOOT_SHELL_REL_PATH);
mkdirSync(dirname(loginBootPath), { recursive: true });
writeFileSync(loginBootPath, loginBootHtml, 'utf8');
console.log(
  `prerender-seo: wrote dist/${LOGIN_BOOT_SHELL_REL_PATH} (HTML-first form + login hydrate + firebase-core preload)`,
);

console.log(
  `prerender-seo: OK (${prerenderRoutes.length} routes + legal door + app boot + light spa + login boot)`,
);
