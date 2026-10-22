import { describe, expect, it } from 'vitest';

import {
  MSG_GARDEN_HUNDREDTH_DATE,
  aggregateMsgGardenStats,
  daysBetweenShowDates,
  msgSetOneOpener,
} from './aggregateMsgGardenStats.js';

describe('aggregateMsgGardenStats', () => {
  it('drops canceled nights and empty setlists', () => {
    const stats = aggregateMsgGardenStats(
      [
        {
          showDate: '2002-12-31',
          songs: [
            { title: 'Tweezer', set: '1', position: 1 },
            { title: 'Tweezer', set: '2', position: 8 },
          ],
        },
        {
          showDate: '2021-12-31',
          canceled: true,
          songs: [{ title: 'Ghost', set: '1', position: 1 }],
        },
        { showDate: '2026-12-30', songs: [] },
        { showDate: 'not-a-date', songs: [{ title: 'Fee', set: '1', position: 1 }] },
      ],
      {
        upcomingShows: [
          { showDate: '2026-12-30' },
          { showDate: '2026-12-31' },
          { showDate: '2027-01-01' },
          { showDate: MSG_GARDEN_HUNDREDTH_DATE },
        ],
      },
    );

    expect(stats.showCount).toBe(1);
    expect(stats.topSongs[0]).toEqual({ title: 'Tweezer', timesPlayed: 2 });
    expect(stats.uniqueSongs).toBe(1);
    expect(stats.milestoneShowNumber).toBe(5);
    expect(stats.upcomingShowDates).toHaveLength(4);
    expect(stats).not.toHaveProperty('songs');
  });

  it('uses the earliest set 1 song when position is show-wide', () => {
    expect(
      msgSetOneOpener([
        { title: 'Later', set: '1', position: 6 },
        { title: 'Opener', set: 'Set 1', position: 2 },
        { title: 'Soundcheck Jam', set: 'soundcheck', position: 1 },
      ]),
    ).toBe('Opener');
  });

  it('keeps debuts, NYE openers, visit gaps, and the longest bustout', () => {
    const stats = aggregateMsgGardenStats([
      {
        showDate: '2002-12-31',
        songs: [{ title: 'AC/DC Bag', set: '1', position: 1, debut: true }],
        bustouts: [{ title: 'Cold as Ice', gap: 100, showDate: '2002-12-31' }],
      },
      {
        showDate: '2009-12-02',
        songs: [
          { title: 'Wilson', set: '1', position: 3 },
          { title: 'Fee', set: '1', position: 9, debut: true },
        ],
        bustouts: [
          { title: 'Cold as Ice', gap: 40, showDate: '2009-12-02' },
          { title: 'Short', gap: 10, showDate: '2009-12-02' },
        ],
      },
    ]);

    expect(daysBetweenShowDates('2002-12-31', '2009-12-02')).toBe(2528);
    expect(stats.longestVisitGaps[0]).toMatchObject({
      fromDate: '2002-12-31',
      toDate: '2009-12-02',
      days: 2528,
    });
    expect(stats.debuts).toEqual([
      { title: 'AC/DC Bag', showDate: '2002-12-31' },
      { title: 'Fee', showDate: '2009-12-02' },
    ]);
    expect(stats.nyeShowCount).toBe(1);
    expect(stats.nyeOpeners[0]).toEqual({ title: 'AC/DC Bag', timesPlayed: 1 });
    expect(stats.longestBustouts[0]).toEqual({
      title: 'Cold as Ice',
      gap: 100,
      showDate: '2002-12-31',
    });
    expect(stats.longestBustouts.some((row) => row.title === 'Short')).toBe(false);
    expect(stats.openers.map((row) => row.title)).toEqual(['AC/DC Bag', 'Wilson']);
  });
});
