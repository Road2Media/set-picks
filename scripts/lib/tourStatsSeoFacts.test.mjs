import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTourStatsFactsHtml,
  mergeTourStatsFactsJsonLd,
  normalizeTourStatsFacts,
} from './tourStatsSeoFacts.mjs';

describe('tourStatsSeoFacts (#928)', () => {
  const facts = normalizeTourStatsFacts({
    tourLabel: '2026 Summer Tour',
    uniqueSongs: 188,
    showsWithSetlist: 18,
    tourShowCount: 21,
    bustouts: [
      { title: 'Melt the Guns', gap: 142, showDate: '2026-07-15' },
      { title: '', gap: 10 },
    ],
    topSongs: [{ title: 'Character Zero', timesPlayed: 12 }],
  });

  it('normalizes and truncates empty titles', () => {
    assert.equal(facts.bustouts.length, 1);
    assert.equal(facts.bustouts[0].title, 'Melt the Guns');
    assert.equal(facts.uniqueSongs, 188);
  });

  it('builds aggregate-only HTML with markers', () => {
    const html = buildTourStatsFactsHtml(facts);
    assert.match(html, /bustout/i);
    assert.match(html, /Melt the Guns/);
    assert.match(html, /data-seo-tour-stats-facts="bustouts"/);
    assert.match(html, /Character Zero/);
    assert.match(html, /Character Zero: 12 nights/);
    assert.doesNotMatch(html, /data-seo-tour-stats-facts="play-note"/);
    assert.doesNotMatch(html, /setlist archive of every song/i);
  });

  it('marks total plays only when they exceed nights', () => {
    const html = buildTourStatsFactsHtml(
      normalizeTourStatsFacts({
        tourLabel: '2026 Fall Tour',
        topSongs: [
          { title: 'Tweezer', showAppearances: 8, timesPlayed: 18 },
          { title: 'Ghost', showAppearances: 6, timesPlayed: 6 },
        ],
      }),
    );
    assert.match(html, /Tweezer: 8 nights \(18\)\*/);
    assert.match(html, /Ghost: 6 nights/);
    assert.doesNotMatch(html, /Ghost: 6 nights \(/);
    assert.match(html, /data-seo-tour-stats-facts="play-note"/);
    assert.match(html, /per phish\.net/);

    const merged = mergeTourStatsFactsJsonLd(
      { '@context': 'https://schema.org', '@graph': [] },
      normalizeTourStatsFacts({
        tourLabel: '2026 Fall Tour',
        topSongs: [
          { title: 'Tweezer', showAppearances: 8, timesPlayed: 18 },
          { title: 'Ghost', showAppearances: 6, timesPlayed: 6 },
        ],
      }),
      'https://www.setlistpickem.com/tour-stats/2026-fall-tour',
    );
    const json = JSON.stringify(merged);
    assert.match(json, /8 nights \(18\)/);
    assert.match(json, /Why do some songs have a number in parentheses/);
    assert.doesNotMatch(json, /6 nights \(6\)/);
  });

  it('merges FAQPage + ItemList into JSON-LD graph', () => {
    const merged = mergeTourStatsFactsJsonLd(
      {
        '@context': 'https://schema.org',
        '@graph': [{ '@type': 'WebPage', name: 'x' }],
      },
      facts,
      'https://www.setlistpickem.com/tour-stats/2026-summer-tour',
    );
    const types = merged['@graph'].map((n) => n['@type']);
    assert.ok(types.includes('WebPage'));
    assert.ok(types.includes('ItemList'));
    assert.ok(types.includes('FAQPage'));
  });
});
