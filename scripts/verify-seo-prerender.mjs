/**
 * CI guard: prerendered public marketing HTML has unique title/description,
 * crawler body, JSON-LD, and favicon links (#659).
 *
 * Does not require a Vite build — uses a fixture shell. Optionally re-checks
 * `dist/` when present (after `npm run build`).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveModulepreloadClosure,
} from './boot-modulepreload.mjs';
import {
  buildTourStatsFactsHtml,
  mergeTourStatsFactsJsonLd,
  normalizeTourStatsFacts,
} from './lib/tourStatsSeoFacts.mjs';
import {
  buildFinishedTourWrap,
  buildFinishedTourWrapHtml,
} from '../src/features/tour-stats/model/finishedTourWrap.js';
import { buildMsgGardenPrerenderEnrichment } from '../src/features/msg-stats/model/msgGardenFacts.js';
import {
  APP_BOOT_SHELL_REL_PATH,
  DASHBOARD_BOOT_PRELOAD_MARKER,
  DASHBOARD_BOOT_SHELL_MARKER,
  LIGHT_SPA_BOOT_SHELL_REL_PATH,
  LOGIN_BOOT_PRELOAD_MARKER,
  LOGIN_BOOT_SHELL_MARKER,
  LOGIN_BOOT_SHELL_REL_PATH,
  LOGIN_FORM_SHELL_MARKER,
  LEGAL_BOOT_BODY_MARKER,
  LEGAL_BOOT_SHELL_MARKER,
  MARKETING_BOOT_SHELL_MARKER,
  PRERENDER_ROUTES,
  SPLASH_BOOT_PRELOAD_MARKER,
  TOUR_STATS_BOOT_PRELOAD_MARKER,
  buildDashboardBootShellHtml,
  buildFixtureShellHtml,
  buildLegalBootDocumentHtml,
  buildLoginBootShellHtml,
  injectDashboardBootModulepreloads,
  injectLoginBootModulepreloads,
  injectPrerenderHtml,
  injectSplashBootModulepreloads,
  injectTourStatsBootModulepreloads,
  prerenderOutputRelPath,
} from './seo-prerender-lib.mjs';
import {
  appendLlmsTourStatsLinks,
  appendSitemapTourStatsUrls,
  applySitemapLastmods,
  resolveAutoExpandTourStatsRoutes,
  tourStatsDiscoveryFromRoutes,
  tourStatsSitemapLastmodMap,
} from './lib/tourStatsSeoAutoExpand.mjs';
import { TOUR_STATS_SEO_FACT_SLUGS } from '../src/shared/config/seoRoutes.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) {
    console.error(`verify:seo-prerender: ${message}`);
    process.exit(1);
  }
}

function assertRouteHtml(html, route, label) {
  assert(html.includes(`<title>${route.title}</title>`) || html.includes(route.title), `${label}: missing title`);
  assert(html.includes(route.description), `${label}: missing description`);
  assert(html.includes(route.h1), `${label}: missing H1`);
  assert(html.includes('application/ld+json'), `${label}: missing JSON-LD`);
  assert(html.includes('data-seo-prerender="true"'), `${label}: missing prerender markers`);
  assert(
    html.includes(`${MARKETING_BOOT_SHELL_MARKER}="true"`),
    `${label}: missing marketing boot overlay (covers SEO body until React mounts)`,
  );
  assert(html.includes('rel="icon"'), `${label}: missing favicon link`);
  assert(html.includes('/favicon/favicon.ico'), `${label}: missing favicon.ico link`);
  // #662: Google SERP favicons need a linked square icon >= 48px at a stable
  // URL; PNG/ICO are primary. The old favicon.svg (854 KB embedded raster)
  // must not come back.
  assert(
    html.includes('/favicon/favicon-96x96.png'),
    `${label}: missing 96x96 PNG icon link (SERP needs square >=48px, #662)`,
  );
  assert(
    !html.includes('favicon.svg'),
    `${label}: favicon.svg link resurfaced — PNG/ICO are primary (#662)`,
  );
  assert(
    !html.includes('/fonts/inter/InterVariable.woff2'),
    `${label}: Inter must not be preloaded (contends with entry JS on cold open)`,
  );
  assert(html.includes(route.canonicalUrl), `${label}: missing canonical`);
  for (const p of route.paragraphs) {
    assert(html.includes(p.slice(0, Math.min(40, p.length))), `${label}: missing body excerpt`);
  }
}

assert(PRERENDER_ROUTES.length >= 8, 'expected marketing + tour-stats + keyword + legal routes');
assert(
  PRERENDER_ROUTES.some((r) => r.path === '/tour-stats'),
  'expected /tour-stats prerender entry',
);
assert(
  PRERENDER_ROUTES.some((r) => r.path === '/tour-stats/2026-sphere'),
  'expected Sphere tour-stats prerender entry',
);
assert(
  PRERENDER_ROUTES.some((r) => r.path === '/tour-stats/2026-summer-tour'),
  'expected 2026 Summer Tour tour-stats prerender entry (#927/#928)',
);
assert(
  PRERENDER_ROUTES.some((r) => r.path === '/tour-stats/msg'),
  'expected Phish at MSG prerender entry (#1139)',
);
assert(
  PRERENDER_ROUTES.some((r) => r.path === '/phish-setlist-prediction-game'),
  'expected keyword-intent prerender entry',
);
assert(
  PRERENDER_ROUTES.some((r) => r.path === '/privacy'),
  'expected /privacy prerender entry (#916 legal door)',
);
assert(
  PRERENDER_ROUTES.some((r) => r.path === '/terms'),
  'expected /terms prerender entry (#916 legal door)',
);
assert(
  PRERENDER_ROUTES.every((r) => !r.path.startsWith('/dashboard')),
  'must not prerender /dashboard/*',
);

const titles = new Set(PRERENDER_ROUTES.map((r) => r.title));
assert(titles.size === PRERENDER_ROUTES.length, 'each prerender route needs a unique title');

function isLegalPrerenderRoute(path) {
  return path === '/privacy' || path === '/terms';
}

const shell = buildFixtureShellHtml();
for (const route of PRERENDER_ROUTES) {
  // Legal routes use zero-JS door shells — not marketing CSR overlay (#916).
  if (isLegalPrerenderRoute(route.path)) continue;
  const html = injectPrerenderHtml(shell, route);
  assertRouteHtml(html, route, `fixture ${route.path}`);
}

const msgRoute = PRERENDER_ROUTES.find((r) => r.path === '/tour-stats/msg');
const msgEnrichment = buildMsgGardenPrerenderEnrichment(null, msgRoute.canonicalUrl);
const msgHtml = injectPrerenderHtml(shell, msgRoute, msgEnrichment);
assert(msgHtml.includes('96 times'), 'MSG prerender HTML must include the played-show count (#1139)');
assert(msgHtml.includes('data-seo-msg-stats="top-songs"'), 'MSG prerender HTML must include most-played songs');
assert(msgHtml.includes('FAQPage'), 'MSG prerender JSON-LD must include FAQPage');
assert(msgHtml.includes('ItemList'), 'MSG prerender JSON-LD must include ItemList');
assert(
  msgHtml.includes('Data courtesy of <a href="https://phish.net">Phish.net</a>'),
  'MSG prerender HTML must credit Phish.net',
);
assert(
  msgHtml.includes('not a pick tip'),
  'MSG opener copy must be labeled as frequencies',
);
assert(
  readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8').includes(
    'https://www.setlistpickem.com/tour-stats/msg',
  ),
  'public sitemap must list /tour-stats/msg',
);
assert(
  readFileSync(join(root, 'public', 'llms.txt'), 'utf8').includes(
    'https://www.setlistpickem.com/tour-stats/msg',
  ),
  'public llms.txt must list /tour-stats/msg',
);

// HTML-first legal door fixtures (no marketing/app/login module graph).
for (const legalPath of ['/privacy', '/terms']) {
  const route = PRERENDER_ROUTES.find((r) => r.path === legalPath);
  const html = buildLegalBootDocumentHtml(legalPath, { rootDir: root });
  const label = `legal door fixture ${legalPath}`;
  assert(html.includes(`<title>${route.title}</title>`), `${label}: missing title`);
  assert(html.includes(route.description), `${label}: missing description`);
  assert(html.includes(route.h1), `${label}: missing H1`);
  assert(html.includes('application/ld+json'), `${label}: missing JSON-LD`);
  assert(
    html.includes(`${LEGAL_BOOT_SHELL_MARKER}="true"`),
    `${label}: missing legal boot shell marker`,
  );
  assert(
    html.includes(`${LEGAL_BOOT_BODY_MARKER}="true"`),
    `${label}: missing legal body marker`,
  );
  assert(html.includes('rel="icon"'), `${label}: missing favicon link`);
  assert(html.includes(route.canonicalUrl), `${label}: missing canonical`);
  assert(
    !/type="module"/.test(html),
    `${label}: must not include module scripts (#916)`,
  );
  assert(
    !/\/assets\/(marketing|app|login)-/.test(html),
    `${label}: must not reference marketing/app/login entry chunks`,
  );
  assert(
    !/\/assets\/firebase/.test(html),
    `${label}: must not reference firebase chunks`,
  );
  const bodyPhrase =
    legalPath === '/terms'
      ? 'entertainment platform where players predict setlists'
      : 'what information we collect, why we collect it';
  assert(html.includes(bodyPhrase), `${label}: missing full policy body excerpt`);
}

assert(
  TOUR_STATS_SEO_FACT_SLUGS.includes('2026-summer-tour'),
  'TOUR_STATS_SEO_FACT_SLUGS must include live summer slug (#928)',
);

// #928: summer route with offline fixture aggregates (no network in CI).
const summerRoute = PRERENDER_ROUTES.find(
  (r) => r.path === '/tour-stats/2026-summer-tour',
);
assert(summerRoute?.tourStatsSeoSlug === '2026-summer-tour', 'summer tourStatsSeoSlug');
const summerFacts = normalizeTourStatsFacts({
  tourLabel: '2026 Summer Tour',
  uniqueSongs: 188,
  showsWithSetlist: 18,
  tourShowCount: 21,
  bustouts: [
    { title: 'Melt the Guns', gap: 142, showDate: '2026-07-15' },
    { title: 'Alumni Blues', gap: 80, showDate: '2026-07-18' },
  ],
  topSongs: [
    { title: 'Character Zero', timesPlayed: 12 },
    { title: 'Free', timesPlayed: 11 },
  ],
});
const summerFactsHtml = buildTourStatsFactsHtml(summerFacts);
const summerEnriched = injectPrerenderHtml(shell, summerRoute, {
  factsHtml: summerFactsHtml,
  jsonLd: mergeTourStatsFactsJsonLd(
    summerRoute.buildJsonLd(),
    summerFacts,
    summerRoute.canonicalUrl,
  ),
});
assertRouteHtml(summerEnriched, summerRoute, 'summer facts fixture');
assert(
  /bustout/i.test(summerEnriched),
  'summer facts fixture: must mention bustout',
);
assert(
  summerEnriched.includes('Melt the Guns'),
  'summer facts fixture: must include real bustout title',
);
assert(
  summerEnriched.includes('data-seo-tour-stats-facts="bustouts"'),
  'summer facts fixture: missing bustouts list marker',
);
assert(
  summerEnriched.includes('data-seo-tour-stats-facts="top-songs"'),
  'summer facts fixture: missing top-songs list marker',
);
assert(
  summerEnriched.includes('188 unique songs'),
  'summer facts fixture: missing unique-songs summary',
);
assert(
  summerEnriched.includes('"@type":"FAQPage"') ||
    summerEnriched.includes('"@type": "FAQPage"'),
  'summer facts fixture: missing FAQPage JSON-LD',
);
assert(
  summerEnriched.includes('"@type":"ItemList"') ||
    summerEnriched.includes('"@type": "ItemList"'),
  'summer facts fixture: missing ItemList JSON-LD',
);

// #959: auto-expand from an offline `_index` mock (no Firestore in CI).
const autoIndexFixture = {
  tours: [
    {
      tourSlug: '2026-fall-tour',
      tourLabel: '2026 Fall Tour',
      lastShowDate: '2026-10-15',
    },
    {
      tourSlug: 'thin-empty-night',
      tourLabel: 'Thin Empty Night',
      lastShowDate: '2026-09-01',
    },
    {
      tourSlug: '2025-nye-run',
      tourLabel: '2025 NYE',
      lastShowDate: '2025-12-31',
    },
  ],
};
const autoDocsFixture = {
  '2026-fall-tour': {
    tourLabel: '2026 Fall Tour',
    uniqueSongs: 64,
    showsWithSetlist: 6,
    tourShowCount: 12,
    lastShowDate: '2026-10-15',
    bustouts: [{ title: 'Foam', gap: 90, showDate: '2026-10-15' }],
    topSongs: [{ title: 'Tweezer', timesPlayed: 4 }],
  },
  'thin-empty-night': {
    tourLabel: 'Thin Empty Night',
    uniqueSongs: 0,
    showsWithSetlist: 0,
    lastShowDate: '2026-09-01',
  },
  '2025-nye-run': {
    tourLabel: '2025 NYE',
    uniqueSongs: 80,
    showsWithSetlist: 12,
    lastShowDate: '2025-12-31',
  },
};
const autoNow = new Date('2026-09-03T12:00:00Z');
const autoRoutes = await resolveAutoExpandTourStatsRoutes({
  indexDoc: autoIndexFixture,
  loadDoc: async (slug) => autoDocsFixture[slug] || null,
  existingSlugs: TOUR_STATS_SEO_FACT_SLUGS,
  now: autoNow,
  env: {},
});
assert(
  autoRoutes.length === 1 && autoRoutes[0].tourStatsSeoSlug === '2026-fall-tour',
  'auto-expand fixture: only the current-year tour that clears the gate',
);
assert(
  !autoRoutes.some((r) => r.tourStatsSeoSlug === 'thin-empty-night'),
  'auto-expand fixture: must not expand the first empty night',
);
assert(
  !autoRoutes.some((r) => r.tourStatsSeoSlug === '2025-nye-run'),
  'auto-expand fixture: first-wave year allowlist must skip prior-year tours',
);

const autoRoute = autoRoutes[0];
const autoFacts = normalizeTourStatsFacts(autoDocsFixture['2026-fall-tour']);
const autoEnriched = injectPrerenderHtml(shell, autoRoute, {
  factsHtml: buildTourStatsFactsHtml(autoFacts),
  jsonLd: mergeTourStatsFactsJsonLd(
    autoRoute.buildJsonLd(),
    autoFacts,
    autoRoute.canonicalUrl,
  ),
});
assertRouteHtml(autoEnriched, autoRoute, 'auto-expand fall facts fixture');
assert(
  autoEnriched.includes('Foam'),
  'auto-expand fixture: must include bustout title from generated facts',
);
assert(
  autoEnriched.includes('data-seo-tour-stats-facts="bustouts"'),
  'auto-expand fixture: missing bustouts list marker',
);
assert(
  autoEnriched.includes('"@type":"FAQPage"') ||
    autoEnriched.includes('"@type": "FAQPage"'),
  'auto-expand fixture: missing FAQPage JSON-LD',
);

// #1140: finished tours embed the wrap (same numbers as the doc) above the lists.
const openFall = buildFinishedTourWrap(autoDocsFixture['2026-fall-tour'], {
  slug: '2026-fall-tour',
  today: '2026-10-22',
});
assert(openFall == null, 'in-progress fall fixture must not render a wrap');

const finishedSummer = {
  tourSlug: '2026-summer-tour',
  tourLabel: '2026 Summer Tour',
  uniqueSongs: 188,
  totalSongPlays: 240,
  showsWithSetlist: 21,
  tourShowCount: 21,
  lastShowDate: '2026-09-06',
  topSongs: [{ title: 'Character Zero', showAppearances: 12, timesPlayed: 14 }],
  bustouts: [{ title: 'Melt the Guns', gap: 142, showDate: '2026-07-15' }],
  tourWinners: { handles: ['Rivertranced'], points: 400, uid: 'hidden-uid' },
  officialSetlist: ['You Enjoy Myself'],
};
const summerWrap = buildFinishedTourWrap(finishedSummer, {
  slug: '2026-summer-tour',
  today: '2026-10-22',
});
assert(summerWrap, 'finished summer fixture must build a wrap');
assert(summerWrap.uniqueSongs === 188, 'wrap unique songs must match the doc');
assert(summerWrap.songsPlayed === 240, 'wrap songs played must match the doc');
assert(summerWrap.showsPlayed === 21, 'wrap shows must match the doc');
const summerRouteForWrap = PRERENDER_ROUTES.find(
  (route) => route.tourStatsSeoSlug === '2026-summer-tour',
);
assert(summerRouteForWrap, 'summer SEO route missing');
const summerWrapHtml = injectPrerenderHtml(shell, summerRouteForWrap, {
  leadHtml: buildFinishedTourWrapHtml(summerWrap),
  factsHtml: buildTourStatsFactsHtml(normalizeTourStatsFacts(finishedSummer)),
  ogImage: 'https://www.setlistpickem.com/tour-stats-share/2026-summer-tour.jpg?v=1',
  ogImageAlt: summerWrap.headline,
});
assert(
  summerWrapHtml.includes('data-tour-wrap="summary"'),
  'finished tour prerender: missing wrap marker',
);
assert(
  summerWrapHtml.includes('188 unique songs'),
  'finished tour prerender: unique songs drifted from the doc',
);
assert(
  summerWrapHtml.includes('240 songs played'),
  'finished tour prerender: songs played drifted from the doc',
);
assert(
  summerWrapHtml.includes('Character Zero'),
  'finished tour prerender: most played drifted from stored rank',
);
assert(
  summerWrapHtml.includes('Melt the Guns'),
  'finished tour prerender: missing longest bustout',
);
assert(
  summerWrapHtml.includes('Rivertranced'),
  'finished tour prerender: missing public winner handle',
);
assert(
  !summerWrapHtml.includes('hidden-uid'),
  'finished tour prerender: uid must stay off the public page',
);
assert(
  !summerWrapHtml.includes('You Enjoy Myself'),
  'finished tour prerender: must not print a nightly setlist',
);
assert(
  summerWrapHtml.includes('tour-stats-share/2026-summer-tour.jpg'),
  'finished tour prerender: missing share image URL',
);
const sphereWrap = buildFinishedTourWrap(
  {
    ...finishedSummer,
    tourSlug: '2026-sphere',
    tourLabel: '2026 Sphere',
    lastShowDate: '2026-05-03',
  },
  { slug: '2026-sphere', today: '2026-10-22' },
);
assert(
  sphereWrap && sphereWrap.headline.includes('2026 Sphere'),
  'sphere fixture must use the same wrap, not a fall-only string',
);

const autoDiscovery = tourStatsDiscoveryFromRoutes([
  ...PRERENDER_ROUTES,
  ...autoRoutes,
]);
const autoSitemap = appendSitemapTourStatsUrls(
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.setlistpickem.com/tour-stats/2026-summer-tour</loc></url>
</urlset>
`,
  autoDiscovery.locs,
);
assert(
  autoSitemap.includes('https://www.setlistpickem.com/tour-stats/2026-fall-tour'),
  'auto-expand sitemap fixture: missing generated loc',
);
assert(
  !autoSitemap.includes('thin-empty-night'),
  'auto-expand sitemap fixture: must not list the thin tour',
);
const childDLastmods = tourStatsSitemapLastmodMap(
  {
    '2026-summer-tour': '2026-09-06',
    '2026-fall-tour': '2026-10-12',
  },
  { siteUrl: 'https://www.setlistpickem.com' },
);
const childDSitemap = applySitemapLastmods(
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.setlistpickem.com/</loc>
    <changefreq>weekly</changefreq>
  </url>
  <url>
    <loc>https://www.setlistpickem.com/tour-stats</loc>
    <changefreq>weekly</changefreq>
  </url>
  <url>
    <loc>https://www.setlistpickem.com/tour-stats/2026-summer-tour</loc>
    <changefreq>weekly</changefreq>
  </url>
  <url>
    <loc>https://www.setlistpickem.com/llms.txt</loc>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
`,
  childDLastmods,
);
assert(
  childDSitemap.includes(
    '<loc>https://www.setlistpickem.com/tour-stats/2026-summer-tour</loc>\n    <lastmod>2026-09-06</lastmod>',
  ),
  'Child D sitemap: summer slug must carry lastShowDate lastmod',
);
assert(
  childDSitemap.includes(
    '<loc>https://www.setlistpickem.com/tour-stats</loc>\n    <lastmod>2026-10-12</lastmod>',
  ),
  'Child D sitemap: hub lastmod is the newest prerendered tour date',
);
assert(
  !/<loc>https:\/\/www\.setlistpickem\.com\/llms\.txt<\/loc>\s*<lastmod>/.test(childDSitemap),
  'Child D sitemap: /llms.txt stays out of lastmod stamping (Request indexing is human)',
);
const llmsBrief = readFileSync(join(root, 'public', 'llms.txt'), 'utf8');
assert(
  llmsBrief.includes('Unique songs:') &&
    llmsBrief.includes('Song frequency:') &&
    llmsBrief.includes('Bustouts:') &&
    llmsBrief.includes('https://www.setlistpickem.com/tour-stats/2026-summer-tour') &&
    llmsBrief.includes('https://www.setlistpickem.com/tour-stats'),
  'Child D llms.txt: unique / frequency / bustout definitions and summer + hub links',
);
const playbook = readFileSync(join(root, 'docs', 'SEO_GEO_PLAYBOOK.md'), 'utf8');
for (const needle of [
  'bustouts summer tour 2026',
  'phish bustout list this tour',
  'unique songs played this tour',
  'utm_campaign=seo_926',
  'utm_content=tour-stats-summer-2026',
  'https://www.setlistpickem.com/llms.txt',
  'sc-domain:setlistpickem.com',
]) {
  assert(playbook.includes(needle), `Child D playbook missing ${needle}`);
}
assert(
  /GSC URL Inspection[\s\S]*\| Human \| \*\*Open\*\*/.test(playbook),
  'Child D playbook must keep GSC Request indexing as an open human step',
);
assert(
  /UTM’d off-site share[\s\S]*\| Human \| \*\*Open\*\*/.test(playbook),
  'Child D playbook must keep the off-site UTM share as an open human step',
);
const autoLlms = appendLlmsTourStatsLinks(
  `## Links
- 2026 Summer Tour setlist statistics: https://www.setlistpickem.com/tour-stats/2026-summer-tour
- About: https://www.setlistpickem.com/about
`,
  autoDiscovery.llms,
);
assert(
  autoLlms.includes('https://www.setlistpickem.com/tour-stats/2026-fall-tour'),
  'auto-expand llms fixture: missing generated URL',
);

const autoOff = await resolveAutoExpandTourStatsRoutes({
  indexDoc: autoIndexFixture,
  loadDoc: async (slug) => autoDocsFixture[slug] || null,
  existingSlugs: TOUR_STATS_SEO_FACT_SLUGS,
  now: autoNow,
  env: { TOUR_STATS_SEO_AUTO_EXPAND: '0' },
});
assert(autoOff.length === 0, 'auto-expand kill-switch must emit zero extra routes');

// Fixture: branded dashboard boot shell (#773) — no SEO body, marker present.
const dirtyShell =
  '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body>' +
  '<div id="root"><main data-seo-prerender="true"><h1>leak</h1></main></div>' +
  '</body></html>';
const fixtureBoot = buildDashboardBootShellHtml(dirtyShell);
assert(
  fixtureBoot.includes(`${DASHBOARD_BOOT_SHELL_MARKER}="true"`),
  'boot shell fixture must include dashboard boot marker',
);
assert(
  fixtureBoot.includes('/branding/splash-vinyl-mark.webp'),
  'boot shell fixture must include vinyl brand mark',
);
assert(
  !fixtureBoot.includes('data-seo-prerender'),
  'boot shell fixture must not include SEO prerender body',
);
assert(!fixtureBoot.includes('<h1>leak</h1>'), 'boot shell must strip prior #root body');

const fixtureLoginBoot = buildLoginBootShellHtml(dirtyShell);
assert(
  fixtureLoginBoot.includes(`${LOGIN_BOOT_SHELL_MARKER}="true"`),
  'login boot fixture must include login auth-card marker',
);
assert(
  fixtureLoginBoot.includes(`${LOGIN_FORM_SHELL_MARKER}="true"`),
  'login boot fixture must include HTML-first form marker (#892)',
);
assert(
  /id="si-email"/.test(fixtureLoginBoot) && /<input\b/i.test(fixtureLoginBoot),
  'login boot fixture must include real form controls in first HTML (#892)',
);
assert(
  !fixtureLoginBoot.includes(`${DASHBOARD_BOOT_SHELL_MARKER}="true"`) &&
    !fixtureLoginBoot.includes('dbs-tabs'),
  'login boot fixture must not reuse dashboard tab chrome',
);
assert(
  fixtureLoginBoot.includes('/branding/splash-vinyl-mark.webp'),
  'login boot fixture must include vinyl brand mark',
);
assert(!fixtureLoginBoot.includes('<h1>leak</h1>'), 'login boot must strip prior #root body');

// Fixture: each shell modulepreloads its own route chunk + static closure (#731).
// Both route leaves exist; HomeRoute pulls a fake auth dep so closure is covered.
const fakeDist = mkdtempSync(join(tmpdir(), 'seo-prerender-'));
mkdirSync(join(fakeDist, 'assets'), { recursive: true });
writeFileSync(
  join(fakeDist, 'assets', 'HomeRoute-a1b2c3d4.js'),
  'import { x } from "./auth-deadbeef.js";\nexport default x;\n',
  'utf8',
);
writeFileSync(join(fakeDist, 'assets', 'auth-deadbeef.js'), 'export const x = 1;\n', 'utf8');
writeFileSync(join(fakeDist, 'assets', 'DashboardRoute-e5f6a7b8.js'), '', 'utf8');
writeFileSync(
  join(fakeDist, 'assets', 'PublicTourStatsPage-c0ffee01.js'),
  'import { y } from "./tour-stats-deadbeef.js";\nexport default y;\n',
  'utf8',
);
writeFileSync(
  join(fakeDist, 'assets', 'tour-stats-deadbeef.js'),
  'export const y = 1;\n',
  'utf8',
);

const fixtureSplashPreload = injectSplashBootModulepreloads(
  buildFixtureShellHtml(),
  fakeDist,
);
assert(
  fixtureSplashPreload.includes(`${SPLASH_BOOT_PRELOAD_MARKER}="true"`) &&
    fixtureSplashPreload.includes('/assets/HomeRoute-a1b2c3d4.js'),
  'splash must modulepreload the HomeRoute chunk',
);
assert(
  fixtureSplashPreload.includes('/assets/auth-deadbeef.js'),
  'splash must modulepreload HomeRoute static deps (auth closure)',
);
assert(
  !fixtureSplashPreload.includes('DashboardRoute-'),
  'splash must not modulepreload the DashboardRoute chunk',
);
assert(
  injectSplashBootModulepreloads(fixtureSplashPreload, fakeDist) ===
    fixtureSplashPreload,
  'splash modulepreload injection must be idempotent',
);
assert(
  resolveModulepreloadClosure(join(fakeDist, 'assets'), [
    '/assets/HomeRoute-a1b2c3d4.js',
  ]).includes('/assets/auth-deadbeef.js'),
  'closure walker must follow static from "./chunk.js" edges',
);

const fixtureDashboardPreload = injectDashboardBootModulepreloads(
  buildDashboardBootShellHtml(buildFixtureShellHtml()),
  fakeDist,
);
assert(
  fixtureDashboardPreload.includes(`${DASHBOARD_BOOT_PRELOAD_MARKER}="true"`) &&
    fixtureDashboardPreload.includes('/assets/DashboardRoute-e5f6a7b8.js'),
  'app boot shell must modulepreload the DashboardRoute chunk',
);
assert(
  !fixtureDashboardPreload.includes('HomeRoute-'),
  'app boot shell must not modulepreload the HomeRoute chunk',
);

const fixtureTourStatsPreload = injectTourStatsBootModulepreloads(
  buildFixtureShellHtml(),
  fakeDist,
);
assert(
  fixtureTourStatsPreload.includes(`${TOUR_STATS_BOOT_PRELOAD_MARKER}="true"`) &&
    fixtureTourStatsPreload.includes('/assets/PublicTourStatsPage-c0ffee01.js'),
  'tour-stats shell must modulepreload the PublicTourStatsPage chunk',
);
assert(
  fixtureTourStatsPreload.includes('/assets/tour-stats-deadbeef.js'),
  'tour-stats shell must modulepreload PublicTourStatsPage static deps',
);
assert(
  !fixtureTourStatsPreload.includes('DashboardRoute-') &&
    !fixtureTourStatsPreload.includes('HomeRoute-'),
  'tour-stats shell must not modulepreload dashboard or splash route chunks',
);
assert(
  injectTourStatsBootModulepreloads(fixtureTourStatsPreload, fakeDist) ===
    fixtureTourStatsPreload,
  'tour-stats modulepreload injection must be idempotent',
);

const distIndex = join(root, 'dist', 'index.html');
const distHowItWorks = join(root, 'dist', 'how-it-works', 'index.html');
// Only validate dist when post-build prerender has clearly run (subdir artifact).
if (existsSync(distIndex) && existsSync(distHowItWorks)) {
  for (const route of PRERENDER_ROUTES) {
    // Legal door shells asserted separately (#916) — not marketing CSR overlay.
    if (isLegalPrerenderRoute(route.path)) continue;
    const outPath = join(root, 'dist', prerenderOutputRelPath(route.path));
    assert(existsSync(outPath), `dist missing ${prerenderOutputRelPath(route.path)} — run npm run build`);
    const html = readFileSync(outPath, 'utf8');
    assertRouteHtml(html, route, `dist ${route.path}`);
  }

  const appBootPath = join(root, 'dist', APP_BOOT_SHELL_REL_PATH);
  assert(existsSync(appBootPath), `dist missing ${APP_BOOT_SHELL_REL_PATH} — run npm run build`);
  const appBootHtml = readFileSync(appBootPath, 'utf8');
  assert(
    appBootHtml.includes(`${DASHBOARD_BOOT_SHELL_MARKER}="true"`),
    'app boot shell must include branded dashboard skeleton marker',
  );
  assert(
    appBootHtml.includes('/branding/splash-vinyl-mark.webp'),
    'app boot shell must include vinyl brand mark',
  );
  assert(
    /<div id="root">[\s\S]*?<\/div>/i.test(appBootHtml),
    'app boot shell must keep a #root mount point',
  );
  assert(
    !appBootHtml.includes('data-seo-prerender'),
    'app boot shell must not include SEO prerender body',
  );
  assert(
    appBootHtml.includes(`${DASHBOARD_BOOT_PRELOAD_MARKER}="true"`) &&
      appBootHtml.includes('DashboardRoute-'),
    'app boot shell must modulepreload DashboardRoute chunk',
  );
  assert(
    !appBootHtml.includes(SPLASH_BOOT_PRELOAD_MARKER),
    'app boot shell must not gain splash modulepreloads',
  );
  const homeHtml = readFileSync(distIndex, 'utf8');
  assert(
    homeHtml.includes('data-seo-prerender'),
    'home dist/index.html must still include SEO prerender body',
  );
  assert(
    !homeHtml.includes(DASHBOARD_BOOT_PRELOAD_MARKER),
    'home dist/index.html must not gain dashboard boot modulepreloads',
  );
  // #832: home is the marketing entry — splash UI is static in that graph.
  // Do not modulepreload lazy HomeRoute / auth (those belong on app.html).
  assert(
    !homeHtml.includes(SPLASH_BOOT_PRELOAD_MARKER),
    'home marketing document must not inject HomeRoute splash modulepreloads',
  );
  assert(
    !homeHtml.includes('HomeRoute-'),
    'home marketing document must not reference HomeRoute chunk',
  );
  assert(
    /\/assets\/marketing-[^"]+\.js/.test(homeHtml),
    'home dist/index.html must boot the marketing entry chunk',
  );
  assert(
    !/\/assets\/firebase-core-[^"]+\.js/.test(homeHtml),
    'home marketing document must not load firebase-core on cold open',
  );
  assert(
    homeHtml.includes(`${MARKETING_BOOT_SHELL_MARKER}="true"`),
    'home dist/index.html must include marketing boot overlay',
  );
  assert(
    !homeHtml.includes('href="/fonts/inter/InterVariable.woff2"'),
    'home dist/index.html must not preload Inter (~344KB)',
  );

  const distApp = join(root, 'dist', 'app.html');
  assert(existsSync(distApp), 'dist missing app.html — authenticated SPA entry (#832)');
  const appHtml = readFileSync(distApp, 'utf8');
  assert(
    /\/assets\/app-[^"]+\.js/.test(appHtml),
    'dist/app.html must boot the authenticated SPA entry chunk',
  );

  const distLoginEntry = join(root, 'dist', 'login.html');
  assert(
    existsSync(distLoginEntry),
    'dist missing login.html — HTML-first login Vite entry (#892)',
  );
  const loginEntryHtml = readFileSync(distLoginEntry, 'utf8');
  assert(
    /\/assets\/login-[^"]+\.js/.test(loginEntryHtml),
    'dist/login.html must boot the auth-door login entry chunk (#892)',
  );
  assert(
    !/\/assets\/app-[^"]+\.js/.test(loginEntryHtml),
    'dist/login.html must not boot the dashboard SPA entry',
  );
  assert(
    /id="si-email"/.test(loginEntryHtml) && /<input\b/i.test(loginEntryHtml),
    'dist/login.html must include form controls in first HTML (#892)',
  );

  const distTourStats = join(root, 'dist', 'tour-stats', 'index.html');
  if (existsSync(distTourStats)) {
    const tourHtml = readFileSync(distTourStats, 'utf8');
    assert(
      /\/assets\/marketing-[^"]+\.js/.test(tourHtml),
      'prerendered /tour-stats must boot the marketing entry (#853)',
    );
    assert(
      !/\/assets\/app-[^"]+\.js/.test(tourHtml),
      'prerendered /tour-stats must not boot the authenticated SPA entry',
    );
    assert(
      tourHtml.includes(TOUR_STATS_BOOT_PRELOAD_MARKER) &&
        tourHtml.includes('PublicTourStatsPage-'),
      'prerendered /tour-stats must modulepreload PublicTourStatsPage (#827/#853)',
    );
    assert(
      !/\/assets\/firebase[^"]*\.js/.test(tourHtml),
      'prerendered /tour-stats must not modulepreload firebase-core (fetch-time only)',
    );
    assert(
      !/\/assets\/auth-[^"]+\.js/.test(tourHtml) &&
        !tourHtml.includes('ensureFirebase-'),
      'prerendered /tour-stats must not modulepreload auth / ensureFirebase (#853)',
    );
    assert(
      !tourHtml.includes(DASHBOARD_BOOT_PRELOAD_MARKER) &&
        !tourHtml.includes('DashboardRoute-'),
      'prerendered /tour-stats must not pull DashboardRoute modulepreload',
    );
    assert(
      !tourHtml.includes(SPLASH_BOOT_PRELOAD_MARKER),
      'prerendered /tour-stats must not gain splash modulepreloads',
    );
    const cdnIndex = join(root, 'dist', 'tour-stats-data', '_index.json');
    assert(
      existsSync(cdnIndex),
      'dist missing tour-stats-data/_index.json — public CDN snapshot (#869)',
    );
    const cdnIndexJson = JSON.parse(readFileSync(cdnIndex, 'utf8'));
    assert(
      Array.isArray(cdnIndexJson.tours),
      'tour-stats-data/_index.json must include tours[]',
    );
    const distSitemap = join(root, 'dist', 'sitemap.xml');
    const distLlms = join(root, 'dist', 'llms.txt');
    assert(existsSync(distSitemap), 'dist missing sitemap.xml');
    assert(existsSync(distLlms), 'dist missing llms.txt');
    const sitemapXml = readFileSync(distSitemap, 'utf8');
    const llmsTxt = readFileSync(distLlms, 'utf8');
    assert(
      sitemapXml.includes('https://www.setlistpickem.com/tour-stats/2026-summer-tour'),
      'dist sitemap must keep the static summer SEO loc',
    );
    assert(
      llmsTxt.includes('https://www.setlistpickem.com/tour-stats/2026-summer-tour'),
      'dist llms.txt must keep the static summer SEO URL',
    );
  }
  const howItWorksHtml = readFileSync(distHowItWorks, 'utf8');
  assert(
    !howItWorksHtml.includes(SPLASH_BOOT_PRELOAD_MARKER),
    'marketing routes must not gain splash modulepreloads',
  );
  assert(
    howItWorksHtml.includes(`${MARKETING_BOOT_SHELL_MARKER}="true"`),
    'marketing routes must include marketing boot overlay',
  );

  // Legal door: zero-JS HTML-first shells (#916) — not marketing CSR / spa-boot.
  for (const legalPath of ['privacy', 'terms']) {
    const legalHtmlPath = join(root, 'dist', legalPath, 'index.html');
    assert(existsSync(legalHtmlPath), `dist missing ${legalPath}/index.html — run npm run build`);
    const legalHtml = readFileSync(legalHtmlPath, 'utf8');
    assert(
      legalHtml.includes(`${LEGAL_BOOT_SHELL_MARKER}="true"`),
      `prerendered /${legalPath} must include legal boot shell marker (#916)`,
    );
    assert(
      legalHtml.includes(`${LEGAL_BOOT_BODY_MARKER}="true"`),
      `prerendered /${legalPath} must include legal body in first HTML (#916)`,
    );
    assert(
      !/type="module"/.test(legalHtml),
      `prerendered /${legalPath} must not include module scripts (#916)`,
    );
    assert(
      !/\/assets\/marketing-[^"]+\.js/.test(legalHtml),
      `prerendered /${legalPath} must not boot the marketing entry (#916)`,
    );
    assert(
      !/\/assets\/app-[^"]+\.js/.test(legalHtml),
      `prerendered /${legalPath} must not boot the authenticated SPA entry`,
    );
    assert(
      !/\/assets\/login-[^"]+\.js/.test(legalHtml),
      `prerendered /${legalPath} must not boot the login entry`,
    );
    assert(
      !/\/assets\/firebase[^"]*\.js/.test(legalHtml),
      `prerendered /${legalPath} must not reference firebase`,
    );
    const bodyPhrase =
      legalPath === 'terms'
        ? 'entertainment platform where players predict setlists'
        : 'what information we collect, why we collect it';
    assert(
      legalHtml.includes(bodyPhrase),
      `prerendered /${legalPath} must include full policy body (#916)`,
    );
  }

  const lightBootPath = join(root, 'dist', LIGHT_SPA_BOOT_SHELL_REL_PATH);
  assert(existsSync(lightBootPath), `dist missing ${LIGHT_SPA_BOOT_SHELL_REL_PATH} — run npm run build`);
  const lightBootHtml = readFileSync(lightBootPath, 'utf8');
  assert(
    lightBootHtml.includes(`${DASHBOARD_BOOT_SHELL_MARKER}="true"`),
    'light spa boot must include branded skeleton marker',
  );
  assert(
    !lightBootHtml.includes(DASHBOARD_BOOT_PRELOAD_MARKER),
    'light spa boot must not modulepreload DashboardRoute',
  );
  assert(
    !lightBootHtml.includes('DashboardRoute-'),
    'light spa boot must not reference DashboardRoute chunk',
  );
  assert(
    !lightBootHtml.includes(SPLASH_BOOT_PRELOAD_MARKER),
    'light spa boot must not gain splash modulepreloads',
  );
  assert(
    !lightBootHtml.includes('data-seo-prerender'),
    'light spa boot must not include SEO prerender body',
  );

  const loginBootPath = join(root, 'dist', LOGIN_BOOT_SHELL_REL_PATH);
  assert(
    existsSync(loginBootPath),
    `dist missing ${LOGIN_BOOT_SHELL_REL_PATH} — run npm run build`,
  );
  const loginBootHtml = readFileSync(loginBootPath, 'utf8');
  assert(
    loginBootHtml.includes(`${LOGIN_BOOT_SHELL_MARKER}="true"`),
    'login boot shell must include login auth-card marker',
  );
  assert(
    loginBootHtml.includes(`${LOGIN_FORM_SHELL_MARKER}="true"`),
    'login boot shell must include HTML-first form marker (#892)',
  );
  assert(
    /id="si-email"/.test(loginBootHtml) &&
      /id="su-email"/.test(loginBootHtml) &&
      /<input\b/i.test(loginBootHtml),
    'login boot shell must include real form controls in first HTML (#892)',
  );
  assert(
    !loginBootHtml.includes(`${DASHBOARD_BOOT_SHELL_MARKER}="true"`) &&
      !loginBootHtml.includes('dbs-tabs') &&
      !loginBootHtml.includes('data-dashboard-boot-shell'),
    'login boot shell must not reuse dashboard tab chrome',
  );
  assert(
    /\/assets\/login-[^"]+\.js/.test(loginBootHtml),
    'login boot shell must boot auth-door login entry (#892)',
  );
  assert(
    !/\/assets\/app-[^"]+\.js/.test(loginBootHtml),
    'login boot shell must not boot dashboard SPA entry (#892)',
  );
  assert(
    !loginBootHtml.includes('vendor-react-query') &&
      !loginBootHtml.includes('QueryClientProvider'),
    'login boot shell must not pull react-query on the auth door',
  );
  assert(
    loginBootHtml.includes(`${LOGIN_BOOT_PRELOAD_MARKER}="true"`) &&
      (/\/assets\/firebase-core-[^"]+\.js/.test(loginBootHtml)),
    'login boot shell must modulepreload firebase-core (#860)',
  );
  // LoginPage-* preload is preferred when the chunk exists (lazy leaf); not required
  // if the hydrate graph folds into login-*.js.
  assert(
    !/\/assets\/firebaseAppCheck-[^"]+\.js/.test(loginBootHtml) &&
      !/\/assets\/firebase-appcheck-[^"]+\.js/.test(loginBootHtml),
    'login boot shell must not modulepreload App Check',
  );
  assert(
    !/\/assets\/firebase-storage-[^"]+\.js/.test(loginBootHtml),
    'login boot shell must not modulepreload firebase-storage',
  );
  assert(
    !loginBootHtml.includes(DASHBOARD_BOOT_PRELOAD_MARKER) &&
      !loginBootHtml.includes('DashboardRoute-'),
    'login boot shell must not pull DashboardRoute',
  );
  assert(
    !loginBootHtml.includes('data-seo-prerender'),
    'login boot shell must not include SEO prerender body',
  );
  assert(
    injectLoginBootModulepreloads(loginBootHtml, join(root, 'dist')) ===
      loginBootHtml,
    'login modulepreload injection must be idempotent',
  );

  console.log('verify:seo-prerender: dist/ checked');
} else {
  console.log('verify:seo-prerender: fixture-only (dist/ not prerendered)');
}

console.log('verify:seo-prerender OK');
