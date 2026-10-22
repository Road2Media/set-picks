import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TOUR_STATS_SEO_MIN_SHOWS_WITH_SETLIST,
  TOUR_STATS_SEO_MIN_UNIQUE_SONGS,
  appendLlmsTourStatsLinks,
  appendSitemapTourStatsUrls,
  applySitemapLastmods,
  buildAutoTourStatsPrerenderRoute,
  maxSitemapLastmod,
  sitemapLastmodDate,
  tourStatsSitemapLastmodMap,
  isTourStatsSeoAutoExpandEnabled,
  lastShowDateIsInYear,
  parseSlugCsv,
  resolveAutoExpandTourStatsRoutes,
  tourMeetsSeoExpandGate,
  tourStatsDiscoveryFromRoutes,
} from './tourStatsSeoAutoExpand.mjs';

describe('tourStatsSeoAutoExpand (#959)', () => {
  const now = new Date('2026-09-03T12:00:00Z');

  it('documents the thin-page constants in the 3–5 / unique-song band', () => {
    assert.equal(TOUR_STATS_SEO_MIN_SHOWS_WITH_SETLIST, 4);
    assert.ok(TOUR_STATS_SEO_MIN_UNIQUE_SONGS >= 15);
  });

  it('kill-switch treats 0 / false / off as disabled (default on)', () => {
    assert.equal(isTourStatsSeoAutoExpandEnabled({}), true);
    assert.equal(isTourStatsSeoAutoExpandEnabled({ TOUR_STATS_SEO_AUTO_EXPAND: '1' }), true);
    assert.equal(isTourStatsSeoAutoExpandEnabled({ TOUR_STATS_SEO_AUTO_EXPAND: '0' }), false);
    assert.equal(isTourStatsSeoAutoExpandEnabled({ TOUR_STATS_SEO_AUTO_EXPAND: 'false' }), false);
    assert.equal(isTourStatsSeoAutoExpandEnabled({ TOUR_STATS_SEO_AUTO_EXPAND: 'off' }), false);
  });

  it('rejects first empty night and other thin pages', () => {
    assert.equal(
      tourMeetsSeoExpandGate(
        { showsWithSetlist: 0, uniqueSongs: 0, lastShowDate: '2026-09-01' },
        { now },
      ).reason,
      'thin-shows',
    );
    assert.equal(
      tourMeetsSeoExpandGate(
        { showsWithSetlist: 1, uniqueSongs: 12, lastShowDate: '2026-09-01' },
        { now },
      ).reason,
      'thin-shows',
    );
    assert.equal(
      tourMeetsSeoExpandGate(
        { showsWithSetlist: 4, uniqueSongs: 8, lastShowDate: '2026-09-01' },
        { now },
      ).reason,
      'thin-songs',
    );
    assert.equal(
      tourMeetsSeoExpandGate(
        { showsWithSetlist: 8, uniqueSongs: 80, lastShowDate: '2025-12-31' },
        { now },
      ).reason,
      'not-current-year',
    );
  });

  it('passes a current-year tour that clears both floors', () => {
    const gate = tourMeetsSeoExpandGate(
      {
        showsWithSetlist: 5,
        uniqueSongs: 44,
        lastShowDate: '2026-10-15',
      },
      { now },
    );
    assert.equal(gate.ok, true);
    assert.equal(lastShowDateIsInYear('2026-10-15', 2026), true);
    assert.equal(lastShowDateIsInYear('2025-12-31', 2026), false);
  });

  it('builds title / H1 / description from tourLabel', () => {
    const route = buildAutoTourStatsPrerenderRoute({
      slug: '2026-fall-tour',
      tourLabel: '2026 Fall Tour',
    });
    assert.equal(route.path, '/tour-stats/2026-fall-tour');
    assert.equal(route.tourStatsSeoSlug, '2026-fall-tour');
    assert.match(route.title, /2026 Fall Tour/);
    assert.match(route.h1, /2026 Fall Tour/);
    assert.match(route.description, /2026 Fall Tour/);
    assert.equal(route.autoExpanded, true);
    const jsonLd = route.buildJsonLd();
    assert.equal(jsonLd['@graph'][0].url, route.canonicalUrl);
    assert.equal(jsonLd['@graph'][1].itemListElement[2].name, '2026 Fall Tour');
  });

  it('selects only gated slugs from an offline _index mock', async () => {
    const indexDoc = {
      tours: [
        {
          tourSlug: '2026-fall-tour',
          tourLabel: '2026 Fall Tour',
          lastShowDate: '2026-10-15',
        },
        {
          tourSlug: 'thin-tour',
          tourLabel: 'Thin Tour',
          lastShowDate: '2026-09-01',
        },
        {
          tourSlug: '2025-new-year-run',
          tourLabel: '2025 NYE',
          lastShowDate: '2026-01-01',
        },
        {
          tourSlug: '2026-summer-tour',
          tourLabel: '2026 Summer Tour',
          lastShowDate: '2026-07-20',
        },
      ],
    };
    const docs = {
      '2026-fall-tour': {
        tourLabel: '2026 Fall Tour',
        showsWithSetlist: 6,
        uniqueSongs: 72,
        lastShowDate: '2026-10-15',
      },
      'thin-tour': {
        tourLabel: 'Thin Tour',
        showsWithSetlist: 1,
        uniqueSongs: 9,
        lastShowDate: '2026-09-01',
      },
      '2025-new-year-run': {
        tourLabel: '2025 NYE',
        showsWithSetlist: 20,
        uniqueSongs: 90,
        lastShowDate: '2025-12-31',
      },
      '2026-summer-tour': {
        tourLabel: '2026 Summer Tour',
        showsWithSetlist: 18,
        uniqueSongs: 188,
        lastShowDate: '2026-07-20',
      },
    };

    const routes = await resolveAutoExpandTourStatsRoutes({
      indexDoc,
      loadDoc: async (slug) => docs[slug] || null,
      existingSlugs: ['2026-summer-tour', '2026-sphere'],
      now,
      env: {},
    });
    assert.deepEqual(
      routes.map((r) => r.tourStatsSeoSlug),
      ['2026-fall-tour'],
    );
  });

  it('honors kill-switch, allowlist, and denylist', async () => {
    const indexDoc = {
      tours: [
        {
          tourSlug: '2026-fall-tour',
          tourLabel: '2026 Fall Tour',
          lastShowDate: '2026-10-15',
        },
      ],
    };
    const loadDoc = async () => ({
      tourLabel: '2026 Fall Tour',
      showsWithSetlist: 6,
      uniqueSongs: 72,
      lastShowDate: '2026-10-15',
    });

    const off = await resolveAutoExpandTourStatsRoutes({
      indexDoc,
      loadDoc,
      now,
      env: { TOUR_STATS_SEO_AUTO_EXPAND: '0' },
    });
    assert.equal(off.length, 0);

    const denied = await resolveAutoExpandTourStatsRoutes({
      indexDoc,
      loadDoc,
      now,
      env: { TOUR_STATS_SEO_DENYLIST: '2026-fall-tour' },
    });
    assert.equal(denied.length, 0);

    const notOnAllow = await resolveAutoExpandTourStatsRoutes({
      indexDoc,
      loadDoc,
      now,
      env: { TOUR_STATS_SEO_ALLOWLIST: 'other-slug' },
    });
    assert.equal(notOnAllow.length, 0);

    const allowed = await resolveAutoExpandTourStatsRoutes({
      indexDoc,
      loadDoc,
      now,
      env: { TOUR_STATS_SEO_ALLOWLIST: '2026-fall-tour' },
    });
    assert.equal(allowed[0]?.tourStatsSeoSlug, '2026-fall-tour');
  });

  it('does not auto-expand reserved pages /tour-stats/2026 or /tour-stats/msg', async () => {
    const indexDoc = {
      tours: [
        { tourSlug: '2026', tourLabel: '2026', lastShowDate: '2026-10-12' },
        { tourSlug: 'msg', tourLabel: 'MSG', lastShowDate: '2026-07-29' },
      ],
    };
    const routes = await resolveAutoExpandTourStatsRoutes({
      indexDoc,
      loadDoc: async (slug) => ({
        tourLabel: slug,
        showsWithSetlist: 10,
        uniqueSongs: 40,
        lastShowDate: '2026-10-12',
      }),
      now,
      env: {},
    });
    assert.equal(routes.length, 0);
  });

  it('merges sitemap + llms without duplicating existing URLs', () => {
    const route = buildAutoTourStatsPrerenderRoute({
      slug: '2026-fall-tour',
      tourLabel: '2026 Fall Tour',
    });
    const { locs, llms } = tourStatsDiscoveryFromRoutes([route]);
    const sitemap = appendSitemapTourStatsUrls(
      `<?xml version="1.0"?>
<urlset>
  <url><loc>https://www.setlistpickem.com/tour-stats/2026-summer-tour</loc></url>
</urlset>
`,
      locs,
    );
    assert.match(sitemap, /2026-fall-tour/);
    assert.equal(
      [...sitemap.matchAll(/2026-fall-tour/g)].length,
      1,
    );

    const llmsTxt = appendLlmsTourStatsLinks(
      `## Links
- 2026 Summer Tour setlist statistics: https://www.setlistpickem.com/tour-stats/2026-summer-tour
- About: https://www.setlistpickem.com/about
`,
      llms,
    );
    assert.match(llmsTxt, /2026 Fall Tour setlist statistics: https:\/\/www\.setlistpickem\.com\/tour-stats\/2026-fall-tour/);
    assert.ok(
      llmsTxt.indexOf('2026-fall-tour') < llmsTxt.indexOf('About:'),
      'auto link should sit with other tour-stats links',
    );
  });

  it('parseSlugCsv ignores blanks and _index', () => {
    assert.deepEqual(
      [...parseSlugCsv(' 2026-fall-tour, _index, ,2026-sphere ')],
      ['2026-fall-tour', '2026-sphere'],
    );
  });
});

describe('tour-stats sitemap lastmod (#930)', () => {
  it('accepts a real show date and rejects writtenAt-style noise and impossible days', () => {
    assert.equal(sitemapLastmodDate('2026-09-06'), '2026-09-06');
    assert.equal(sitemapLastmodDate('2026-10-21T11:30:32.063Z'), '2026-10-21');
    assert.equal(sitemapLastmodDate('2026-02-31'), null);
    assert.equal(sitemapLastmodDate('09/06/2026'), null);
    assert.equal(sitemapLastmodDate(''), null);
    assert.equal(maxSitemapLastmod(['2026-09-06', 'not-a-date', '2026-10-12']), '2026-10-12');
  });

  it('stamps hub and slug lastmod from lastShowDate and leaves other urls alone', () => {
    const lastmods = tourStatsSitemapLastmodMap(
      {
        '2026-summer-tour': '2026-09-06',
        '2026-sphere': '2026-05-02',
        '2026-fall-tour': '2026-10-12',
        _index: '2026-10-12',
        '': '2026-10-12',
      },
      { siteUrl: 'https://www.setlistpickem.com' },
    );
    assert.equal(
      lastmods['https://www.setlistpickem.com/tour-stats/2026-summer-tour'],
      '2026-09-06',
    );
    assert.equal(lastmods['https://www.setlistpickem.com/tour-stats'], '2026-10-12');
    assert.equal(lastmods['https://www.setlistpickem.com/tour-stats/_index'], undefined);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.setlistpickem.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.setlistpickem.com/tour-stats</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://www.setlistpickem.com/tour-stats/2026-summer-tour</loc>
    <lastmod>2020-01-01</lastmod>
    <changefreq>weekly</changefreq>
  </url>
  <url>
    <loc>https://www.setlistpickem.com/about</loc>
    <changefreq>monthly</changefreq>
  </url>
</urlset>
`;
    const stamped = applySitemapLastmods(xml, lastmods);
    assert.match(
      stamped,
      /<loc>https:\/\/www\.setlistpickem\.com\/tour-stats<\/loc>\s*<lastmod>2026-10-12<\/lastmod>/,
    );
    assert.match(
      stamped,
      /<loc>https:\/\/www\.setlistpickem\.com\/tour-stats\/2026-summer-tour<\/loc>\s*<lastmod>2026-09-06<\/lastmod>/,
    );
    assert.equal(stamped.includes('2020-01-01'), false);
    const blocks = [...stamped.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((m) => m[1]);
    const home = blocks.find((block) => block.includes('https://www.setlistpickem.com/</loc>'));
    const about = blocks.find((block) => block.includes('/about</loc>'));
    assert.ok(home && !home.includes('<lastmod>'));
    assert.ok(about && !about.includes('<lastmod>'));
    assert.equal(applySitemapLastmods(xml, { '/nope': 'yesterday' }), xml);
  });
});
