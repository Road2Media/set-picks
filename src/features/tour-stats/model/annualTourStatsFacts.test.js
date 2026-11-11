import { describe, expect, it } from 'vitest';

import {
  annualSummarySentences,
  buildAnnualFactsHtml,
  buildAnnualTourStatsJsonLd,
} from './annualTourStatsFacts.js';

const STATS = {
  year: 2026,
  showsWithSetlist: 38,
  uniqueSongs: 220,
  totalSongPlays: 665,
  tours: [
    { tourSlug: 'summer', tourLabel: '2026 Summer Tour', showsWithSetlist: 21, uniqueSongs: 191 },
    { tourSlug: 'fall', tourLabel: '2026 Fall Tour', showsWithSetlist: 12, uniqueSongs: 80 },
    { tourSlug: 'sphere', tourLabel: '2026 Sphere', showsWithSetlist: 5, uniqueSongs: 40 },
  ],
  unsplitTours: [],
  topSongs: [
    { title: 'Tweezer', showAppearances: 8, timesPlayed: 18 },
    { title: 'Ghost', showAppearances: 6, timesPlayed: 6 },
  ],
  bustouts: [],
};

describe('annual tour stats copy (#1285)', () => {
  it('summarizes shows, tours, and different songs', () => {
    expect(annualSummarySentences(STATS)).toEqual([
      'Phish played 38 shows in 2026 across 3 tours, with 220 different songs.',
    ]);
    const text = annualSummarySentences(STATS).join(' ');
    expect(text).not.toMatch(/song row|calendar year|published setlist/i);
  });

  it('marks the footnote in crawler HTML only when total plays exceed nights', () => {
    const html = buildAnnualFactsHtml(STATS);
    expect(html).toContain('Tweezer: 8 nights (18)*');
    expect(html).toContain('Ghost: 6 nights');
    expect(html).not.toContain('Ghost: 6 nights (');
    expect(html).toContain('data-seo-annual-stats="play-note"');
    expect(html).toContain('per phish.net');
    expect(html).not.toMatch(/song row|January 1 counts for 2027/i);

    const even = buildAnnualFactsHtml({
      ...STATS,
      topSongs: [{ title: 'Ghost', showAppearances: 6, timesPlayed: 6 }],
    });
    expect(even).toContain('Ghost: 6 nights');
    expect(even).not.toContain('data-seo-annual-stats="play-note"');
    expect(even).not.toContain('*');
  });

  it('keeps the same nights line in JSON-LD and adds the footnote question only when needed', () => {
    const withExtra = JSON.stringify(
      buildAnnualTourStatsJsonLd(STATS, 'https://www.setlistpickem.com/tour-stats/2026'),
    );
    expect(withExtra).toContain('8 nights (18)');
    expect(withExtra).toContain('Why do some songs have a number in parentheses?');
    expect(withExtra).not.toMatch(/song row/i);

    const even = JSON.stringify(
      buildAnnualTourStatsJsonLd(
        {
          ...STATS,
          topSongs: [{ title: 'Ghost', showAppearances: 6, timesPlayed: 6 }],
        },
        'https://www.setlistpickem.com/tour-stats/2026',
      ),
    );
    expect(even).not.toContain('Why do some songs have a number in parentheses?');
    expect(even).toContain('6 nights');
    expect(even).not.toContain('6 nights (6)');
  });
});
