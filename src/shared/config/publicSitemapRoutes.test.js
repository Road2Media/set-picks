import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  appendMissingLlmsRoutes,
  appendMissingSitemapRoutes,
  assertPublicDiscovery,
  extractRoutePaths,
  missingLlmsPaths,
  missingSitemapPaths,
  unclassifiedPublicPaths,
} from './publicSitemapRoutes';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('public sitemap registry (#1144)', () => {
  const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8');
  const llms = readFileSync(join(root, 'public/llms.txt'), 'utf8');
  const app = readFileSync(join(root, 'src/app/App.jsx'), 'utf8');
  const marketing = readFileSync(join(root, 'src/app/MarketingApp.jsx'), 'utf8');

  it('lists MSG, the annual page, Rewind, Phish IQ, and the NYE run', () => {
    expect(missingSitemapPaths(sitemap)).toEqual([]);
    expect(missingLlmsPaths(llms)).toEqual([]);
    expect(() => assertPublicDiscovery(sitemap, llms)).not.toThrow();
    expect(sitemap).not.toContain('/phish-picks');
    expect(llms).not.toContain('/phish-picks');
    expect(app).not.toContain('"/phish-picks"');
  });

  it('fails when a required public route is dropped', () => {
    const stripped = sitemap.replace(
      /<url>\s*<loc>https:\/\/www\.setlistpickem\.com\/rewind<\/loc>[\s\S]*?<\/url>\s*/i,
      '',
    );
    expect(missingSitemapPaths(stripped)).toContain('/rewind');
    expect(() => assertPublicDiscovery(stripped, llms)).toThrow(/sitemap\.xml missing \/rewind/);
  });

  it('appends a missing route instead of leaving the file short', () => {
    const stripped = sitemap.replace(
      /<url>\s*<loc>https:\/\/www\.setlistpickem\.com\/phish-iq<\/loc>[\s\S]*?<\/url>\s*/i,
      '',
    );
    const next = appendMissingSitemapRoutes(stripped);
    expect(missingSitemapPaths(next)).toEqual([]);
    const llmsNext = appendMissingLlmsRoutes(llms.replace('https://www.setlistpickem.com/phish-iq', ''));
    expect(missingLlmsPaths(llmsNext)).toEqual([]);
  });

  it('classifies every route in App.jsx and MarketingApp.jsx', () => {
    const paths = [...extractRoutePaths(app), ...extractRoutePaths(marketing)];
    expect(unclassifiedPublicPaths(paths)).toEqual([]);
    expect(paths).toContain('/phish-at-msg');
    expect(paths).toContain('/tour-stats/2026');
    expect(paths).toContain('/rewind');
    expect(paths).toContain('/phish-iq');
  });
});
