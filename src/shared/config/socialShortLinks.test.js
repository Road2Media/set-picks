import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Owned-social caption paths. Vercel matches these before the SPA rewrite.
 * Exact paths only — a wildcard would swallow a future page.
 */
const BEATS = [
  ['how', '/how-it-works', 'how-it-works'],
  ['card', '/phish-setlist-prediction-game', 'card-open'],
  ['score', '/how-scoring-works', 'how-scoring-works'],
  ['about', '/about', 'about'],
  ['stats', '/tour-stats', 'tour-stats'],
];

const NETWORKS = [
  ['ig', 'instagram'],
  ['th', 'threads'],
];

const OCCUPIED_PREFIXES = [
  '/dashboard',
  '/how-it-works',
  '/how-scoring-works',
  '/phish-setlist-prediction-game',
  '/tour-stats',
  '/phish-at-msg',
  '/about',
  '/privacy',
  '/terms',
  '/login',
  '/setup',
  '/join',
  '/invite',
  '/user',
  '/assets',
  '/fonts',
  '/api',
  '/__',
  '/comms-preview',
  '/card-shell-preview',
  '/password-reset-complete',
];

function expectedSocialRedirects() {
  return NETWORKS.flatMap(([prefix, source]) =>
    BEATS.map(([slug, path, content]) => ({
      source: `/${prefix}/${slug}`,
      destination: `${path}?utm_source=${source}&utm_medium=social&utm_campaign=seo_geo&utm_content=${content}`,
      permanent: false,
    })),
  );
}

function loadRedirects() {
  const raw = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
  const vercel = JSON.parse(raw);
  return vercel.redirects;
}

describe('social short-link redirects', () => {
  const redirects = loadRedirects();
  const social = redirects.filter(
    (rule) => rule.source.startsWith('/ig/') || rule.source.startsWith('/th/'),
  );

  it('keeps the summer-tour slug redirect', () => {
    expect(redirects).toContainEqual({
      source: '/tour-stats/summer-tour-2026',
      destination: '/tour-stats/2026-summer-tour',
      permanent: true,
    });
  });

  it('permanently redirects the old Phish at MSG path (#1192)', () => {
    expect(redirects).toContainEqual({
      source: '/tour-stats/msg',
      destination: '/phish-at-msg',
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: '/tour-stats/msg/',
      destination: '/phish-at-msg',
      permanent: true,
    });
  });

  it('matches the closed caption map and nothing else', () => {
    expect(social).toEqual(expectedSocialRedirects());
  });

  it('uses exact paths that are not existing routes', () => {
    for (const rule of social) {
      expect(rule.source).not.toMatch(/[*:()]/);
      expect(rule.source.endsWith('/')).toBe(false);
      for (const prefix of OCCUPIED_PREFIXES) {
        expect(rule.source === prefix || rule.source.startsWith(`${prefix}/`)).toBe(false);
      }
      const destinationPath = rule.destination.split('?')[0];
      expect(BEATS.map((beat) => beat[1])).toContain(destinationPath);
      expect(destinationPath).not.toBe(rule.source);
    }
  });
});
