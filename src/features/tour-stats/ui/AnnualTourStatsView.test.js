import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AnnualTourStatsView from './AnnualTourStatsView.jsx';

const STATS = {
  year: 2026,
  showsWithSetlist: 38,
  uniqueSongs: 220,
  tours: [
    { tourSlug: 'summer', tourLabel: '2026 Summer Tour', showsWithSetlist: 21, uniqueSongs: 191 },
  ],
  unsplitTours: [],
  topSongs: [
    { title: 'Tweezer', showAppearances: 8, timesPlayed: 18 },
    { title: 'Ghost', showAppearances: 6, timesPlayed: 6 },
  ],
  bustouts: [],
};

function render(stats) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(AnnualTourStatsView, { stats, status: 'ready' }),
    ),
  );
}

describe('AnnualTourStatsView copy (#1285)', () => {
  it('uses the fan summary and marks only songs played more times than nights', () => {
    const html = render(STATS);
    expect(html).toContain(
      'Phish played 38 shows in 2026 across 1 tour, with 220 different songs.',
    );
    expect(html).toContain('8 nights (18)');
    expect(html).toContain('6 nights');
    expect(html).not.toContain('6 nights (6)');
    expect(html).not.toMatch(/song rows?|calendar year|chair/i);
    expect(html.split('data-song-play-note="marker"').length - 1).toBe(1);
    expect(html).toContain('data-song-play-note="footnote"');
  });

  it('omits the footnote when totals match nights', () => {
    const html = render({
      ...STATS,
      topSongs: [{ title: 'Ghost', showAppearances: 6, timesPlayed: 6 }],
    });
    expect(html).toContain('6 nights');
    expect(html).not.toContain('data-song-play-note');
  });
});
