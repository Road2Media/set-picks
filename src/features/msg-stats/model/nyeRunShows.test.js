import { describe, expect, it } from 'vitest';

import { isRestorableDashboardPath } from '../../../shared/lib/dashboardLastPath';
import { getPrerenderRoute } from '../../../shared/config/seoRoutes';
import { SITEMAP_PUBLIC_ROUTES } from '../../../shared/config/publicSitemapRoutes';
import { MSG_GARDEN_HUNDREDTH_DATE } from './aggregateMsgGardenStats';
import { NYE_RUN_PATH, NYE_RUN_SLUG, nyePoolCreateHref } from './nyeRunContract';
import {
  announcedNyeRunShows,
  buildNyeRunFactsHtml,
  buildNyeRunJsonLd,
} from './nyeRunShows';

describe('announced NYE run (#1144)', () => {
  const shows = announcedNyeRunShows();

  it('uses the Garden snapshot for the four MSG nights', () => {
    expect(shows.map((show) => show.date)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      MSG_GARDEN_HUNDREDTH_DATE,
    ]);
    expect(shows.every((show) => show.venueName === 'Madison Square Garden')).toBe(true);
    expect(shows.every((show) => show.address === 'New York, NY')).toBe(true);
    expect(shows.every((show) => show.url.startsWith('https://phish.com/'))).toBe(true);
    expect(shows[3].hundredth).toBe(true);
    expect(shows[3].name).toContain('100th performance');
    expect(JSON.stringify(shows)).not.toMatch(/setlist/i);
  });

  it('publishes one Event per show', () => {
    const pageUrl = `https://www.setlistpickem.com${NYE_RUN_PATH}`;
    const json = buildNyeRunJsonLd(shows, pageUrl);
    const events = json['@graph'].filter((node) => node['@type'] === 'Event');
    expect(events).toHaveLength(4);
    for (const event of events) {
      expect(event.name).toMatch(/^Phish at /);
      expect(event.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.location).toMatchObject({
        '@type': 'Place',
        name: 'Madison Square Garden',
        address: 'New York, NY',
      });
      expect(event.url).toMatch(/^https:\/\/phish\.com\//);
    }
    expect(events.map((event) => event.startDate)).toEqual(shows.map((show) => show.date));
  });

  it('puts the pool CTA and the Phish.net credit in the crawler HTML', () => {
    const html = buildNyeRunFactsHtml(shows);
    expect(html).toContain('Create a NYE pool');
    expect(html).toContain('href="/dashboard/pools/create?');
    expect(html).toContain('utm_campaign=seo_geo');
    expect(html).toContain('utm_content=nye-pool');
    expect(html).toContain('https://phish.net');
    expect(html).toContain('2026-12-30');
    expect(html).toContain('2027-01-02');
    expect(html).not.toContain('chair');
  });

  it('is a prerendered public route and a restorable pool link', () => {
    expect(getPrerenderRoute(NYE_RUN_PATH)?.tourStatsSeoSlug).toBe(NYE_RUN_SLUG);
    expect(SITEMAP_PUBLIC_ROUTES.some((route) => route.path === NYE_RUN_PATH)).toBe(true);
    expect(SITEMAP_PUBLIC_ROUTES.some((route) => route.path === '/phish-picks')).toBe(false);
    const href = nyePoolCreateHref();
    const url = new URL(href, 'https://www.setlistpickem.com');
    expect(isRestorableDashboardPath(url.pathname, url.search)).toBe(true);
    expect(url.searchParams.get('name')).toBe('NYE Run');
  });
});
