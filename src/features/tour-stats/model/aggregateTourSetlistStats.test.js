import { describe, expect, it } from 'vitest';

import { aggregateTourSetlistStats } from './aggregateTourSetlistStats';

describe('aggregateTourSetlistStats (#555)', () => {
  it('returns empty stats for empty input', () => {
    expect(aggregateTourSetlistStats([], { tourShowCount: 3 })).toEqual({
      tourShowCount: 3,
      showsWithSetlist: 0,
      uniqueSongs: 0,
      totalSongPlays: 0,
      topSongs: [],
      bustouts: [],
      gapHighlights: [],
    });
  });

  it('counts every setlist row, ranks by nights, and keeps same-night returns as plays', () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: '2026-07-10',
          setlist: {
            officialSetlist: ['Tweezer', 'Free', 'Tweezer'],
            bustouts: [],
            songGaps: { tweezer: 2, free: 5 },
          },
        },
        {
          showDate: '2026-07-11',
          setlist: {
            officialSetlist: ['Free', 'Ghost'],
            bustouts: ['Ghost'],
            songGaps: { free: 1, ghost: 40 },
          },
        },
      ],
      { tourShowCount: 4, gapHighlightMin: 10 },
    );

    expect(stats.showsWithSetlist).toBe(2);
    expect(stats.tourShowCount).toBe(4);
    expect(stats.uniqueSongs).toBe(3);
    expect(stats.totalSongPlays).toBe(5);
    expect(stats.topSongs.find((row) => row.title === 'Tweezer')).toMatchObject({
      timesPlayed: 2,
      showAppearances: 1,
      showDates: ['2026-07-10'],
    });
    expect(stats.topSongs[0]).toMatchObject({
      title: 'Free',
      timesPlayed: 2,
      showAppearances: 2,
    });
    expect(stats.bustouts).toEqual([
      { title: 'Ghost', showDate: '2026-07-11', gap: 40 },
    ]);
  });

  it('surfaces non-bustout gap highlights above the threshold', () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: '2026-07-12',
          setlist: {
            officialSetlist: ['Reba', 'Dinner and a Movie', 'Free'],
            bustouts: ['Dinner and a Movie'],
            songGaps: {
              reba: 25,
              'dinner and a movie': 82,
              free: 12,
            },
          },
        },
      ],
      { gapHighlightMin: 10 },
    );
    expect(stats.gapHighlights).toEqual([
      { title: 'Reba', showDate: '2026-07-12', gap: 25 },
      { title: 'Free', showDate: '2026-07-12', gap: 12 },
    ]);
    expect(stats.bustouts[0].title).toBe('Dinner and a Movie');
  });

  it('drops bustouts/gaps for songs not actually played that show (stale snapshot)', () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: '2026-07-20',
          setlist: {
            officialSetlist: ['Wilson', 'Sample in a Jar'],
            // Frozen ghosts: the writer unions `bustouts`/`songGaps` across
            // polls and never removes, so a song from an edited feed can linger
            // even though it is not in `officialSetlist`.
            bustouts: ['The Curtain'],
            songGaps: { 'punch you in the eye': 55, wilson: 3 },
          },
        },
      ],
      { bustoutMinGap: 30, gapHighlightMin: 10 },
    );
    expect(stats.bustouts).toEqual([]);
    expect(stats.gapHighlights).toEqual([]);
  });

  it('promotes a played high-gap song to bustout even when missing from the snapshot', () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: '2026-07-21',
          setlist: {
            officialSetlist: ['Peaches en Regalia', 'Bouncing Around the Room'],
            bustouts: [],
            songGaps: {
              'peaches en regalia': 248,
              'bouncing around the room': 5,
            },
          },
        },
      ],
      { bustoutMinGap: 30, gapHighlightMin: 10 },
    );
    expect(stats.bustouts).toEqual([
      { title: 'Peaches en Regalia', showDate: '2026-07-21', gap: 248 },
    ]);
    expect(stats.gapHighlights).toEqual([]);
  });

  it('returns ALL songs and gap highlights — no top-N truncation (#709)', () => {
    const titles = Array.from({ length: 40 }, (_, i) => `Song ${String(i).padStart(2, '0')}`);
    const songGaps = Object.fromEntries(
      titles.map((t, i) => [t.toLowerCase(), 10 + (i % 15)]),
    );
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: '2026-07-25',
          setlist: { officialSetlist: titles, bustouts: [], songGaps },
        },
      ],
      { bustoutMinGap: 30, gapHighlightMin: 10 },
    );
    expect(stats.topSongs).toHaveLength(40);
    expect(stats.uniqueSongs).toBe(40);
    // every gap in the fixture is ≥ 10 and < 30 → all 40 are highlights
    expect(stats.gapHighlights).toHaveLength(40);
  });

  it('breaks Most played ties by lifetime plays from the catalog', () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: '2026-07-22',
          setlist: {
            officialSetlist: ['Rare Bird', 'You Enjoy Myself'],
            bustouts: [],
            songGaps: {},
          },
        },
      ],
      {
        lifetimePlaysByKey: new Map([
          ['you enjoy myself', 623],
          ['rare bird', 1],
        ]),
      },
    );
    expect(stats.topSongs.map((r) => r.title)).toEqual([
      'You Enjoy Myself',
      'Rare Bird',
    ]);
  });

  it('does not list a catalog song that was not played on the tour', () => {
    const stats = aggregateTourSetlistStats(
      [
        {
          showDate: '2026-10-02',
          setlist: {
            officialSetlist: ['Alumni Blues'],
            bustouts: [],
            songGaps: {},
          },
        },
      ],
      {
        lifetimePlaysByKey: new Map([
          ['alumni blues', 12],
          ['tweezer', 421],
        ]),
      },
    );
    expect(stats.topSongs.map((r) => r.title)).toEqual(['Alumni Blues']);
  });
});
