import { describe, expect, it } from 'vitest';

import {
  annualTotalsMatchTourPages,
  calendarYearOfShowDate,
  classifyTourForYear,
  normalizePublishedYearStats,
  rollUpAnnualTourStats,
} from './rollUpAnnualTourStats';

function tour(overrides) {
  return {
    tourSlug: '2026-sphere',
    tourLabel: '2026 Sphere',
    showDates: ['2026-04-16', '2026-04-17'],
    firstShowDate: '2026-04-16',
    lastShowDate: '2026-04-17',
    showsWithSetlist: 2,
    uniqueSongs: 2,
    totalSongPlays: 3,
    topSongs: [
      { title: 'Tweezer', timesPlayed: 2, showAppearances: 2, lifetimePlays: 400 },
      { title: 'Ghost', timesPlayed: 1, showAppearances: 1, lifetimePlays: 200 },
    ],
    bustouts: [{ title: 'Ghost', gap: 40, showDate: '2026-04-17' }],
    ...overrides,
  };
}

describe('calendar year of a show date (#1109 decision 1)', () => {
  it('keeps December 31 in that year and moves January 1 to the next year', () => {
    expect(calendarYearOfShowDate('2026-12-30')).toBe(2026);
    expect(calendarYearOfShowDate('2026-12-31')).toBe(2026);
    expect(calendarYearOfShowDate('2027-01-01')).toBe(2027);
    expect(calendarYearOfShowDate('2027-01-02')).toBe(2027);
    expect(calendarYearOfShowDate('2026-02-31')).toBeNull();
    expect(calendarYearOfShowDate('12/31/2026')).toBeNull();
  });
});

describe('rollUpAnnualTourStats', () => {
  it('adds show counts and song rows from the tour pages, and unions unique songs', () => {
    const summer = tour({
      tourSlug: '2026-summer-tour',
      tourLabel: '2026 Summer Tour',
      showDates: ['2026-07-14'],
      firstShowDate: '2026-07-14',
      lastShowDate: '2026-07-14',
      showsWithSetlist: 4,
      uniqueSongs: 2,
      totalSongPlays: 5,
      topSongs: [
        { title: 'Tweezer', timesPlayed: 3, showAppearances: 3, lifetimePlays: 400 },
        { title: 'Harry Hood', timesPlayed: 2, showAppearances: 2, lifetimePlays: 150 },
      ],
      bustouts: [{ title: 'Harry Hood', gap: 55, showDate: '2026-07-14' }],
    });
    const stats = rollUpAnnualTourStats([tour(), summer], 2026);

    expect(stats.showsWithSetlist).toBe(2 + 4);
    expect(stats.totalSongPlays).toBe(3 + 5);
    expect(stats.uniqueSongs).toBe(3);
    expect(stats.bustouts).toHaveLength(2);
    expect(annualTotalsMatchTourPages(stats)).toBe(true);
    expect(stats.topSongs.map((row) => row.title)).toEqual([
      'Tweezer',
      'Harry Hood',
      'Ghost',
    ]);
    expect(stats.topSongs[0]).toMatchObject({
      title: 'Tweezer',
      timesPlayed: 5,
      showAppearances: 5,
    });
    expect(stats.tours.map((row) => row.tourSlug)).toEqual([
      '2026-sphere',
      '2026-summer-tour',
    ]);
    expect(stats.unsplitTours).toEqual([]);
    expect(stats.firstShowDate).toBe('2026-04-16');
    expect(stats.lastShowDate).toBe('2026-07-14');
  });

  it('leaves a New Year\'s Run that crosses January 1 out of the 2026 song totals', () => {
    const nye = tour({
      tourSlug: '2026-2027-nye-run',
      tourLabel: '2026/2027 NYE Run',
      showDates: ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'],
      firstShowDate: '2026-12-30',
      lastShowDate: '2027-01-02',
      showsWithSetlist: 4,
      uniqueSongs: 2,
      totalSongPlays: 4,
      topSongs: [
        { title: 'Piper', timesPlayed: 2, showAppearances: 2 },
        { title: 'Tweezer', timesPlayed: 2, showAppearances: 2 },
      ],
      bustouts: [
        { title: 'Piper', gap: 80, showDate: '2027-01-01' },
        { title: 'Tube', gap: 90, showDate: '2026-12-31' },
      ],
    });
    const stats = rollUpAnnualTourStats([tour(), nye], 2026);

    expect(classifyTourForYear(nye, 2026)).toBe('split');
    expect(stats.showsWithSetlist).toBe(2);
    expect(stats.totalSongPlays).toBe(3);
    expect(stats.topSongs.map((row) => row.title)).not.toContain('Piper');
    expect(stats.bustouts.map((row) => row.showDate)).toEqual(['2026-04-17']);
    expect(stats.unsplitTours).toEqual([
      {
        tourSlug: '2026-2027-nye-run',
        tourLabel: '2026/2027 NYE Run',
        showDatesInYear: ['2026-12-30', '2026-12-31'],
        showDatesOutsideYear: ['2027-01-01', '2027-01-02'],
      },
    ]);
    expect(annualTotalsMatchTourPages(stats)).toBe(true);
  });

  it('counts a December 31-only tour in 2026 and leaves a January tour out', () => {
    const nyeEve = tour({
      tourSlug: 'nye-eve',
      tourLabel: 'NYE Eve',
      showDates: ['2026-12-31'],
      firstShowDate: '2026-12-31',
      lastShowDate: '2026-12-31',
      showsWithSetlist: 1,
      uniqueSongs: 1,
      totalSongPlays: 1,
      topSongs: [{ title: 'Auld Lang Syne', timesPlayed: 1, showAppearances: 1 }],
      bustouts: [],
    });
    const nyeDay = tour({
      tourSlug: 'nye-day',
      tourLabel: 'NYE Day',
      showDates: ['2027-01-01'],
      firstShowDate: '2027-01-01',
      lastShowDate: '2027-01-01',
      showsWithSetlist: 1,
      uniqueSongs: 1,
      totalSongPlays: 1,
      topSongs: [{ title: 'Piper', timesPlayed: 1, showAppearances: 1 }],
      bustouts: [],
    });
    const stats = rollUpAnnualTourStats([nyeEve, nyeDay], 2026);
    expect(stats.tours.map((row) => row.tourSlug)).toEqual(['nye-eve']);
    expect(stats.showsWithSetlist).toBe(1);
    expect(stats.unsplitTours).toEqual([]);
    expect(rollUpAnnualTourStats([nyeEve, nyeDay], 2027).tours.map((row) => row.tourSlug)).toEqual([
      'nye-day',
    ]);
  });
});

describe('normalizePublishedYearStats', () => {
  it('uses the year doc when its totals match the tour slices', () => {
    const stats = normalizePublishedYearStats(
      {
        year: 2026,
        yearRule: 'calendar-show-date',
        showsWithSetlist: 3,
        uniqueSongs: 2,
        totalSongPlays: 4,
        firstShowDate: '2026-04-16',
        lastShowDate: '2026-12-31',
        topSongs: [
          { title: 'Tweezer', timesPlayed: 3, showAppearances: 3 },
          { title: 'Tube', timesPlayed: 1, showAppearances: 1 },
        ],
        bustouts: [{ title: 'Tube', gap: 90, showDate: '2026-12-31' }],
        tours: [
          {
            tourSlug: '2026-sphere',
            tourLabel: '2026 Sphere',
            showsWithSetlist: 2,
            uniqueSongs: 2,
            totalSongPlays: 3,
            firstShowDate: '2026-04-16',
            lastShowDate: '2026-04-17',
          },
          {
            tourSlug: '2026-2027-nye-run',
            tourLabel: '2026/2027 NYE Run',
            showsWithSetlist: 1,
            uniqueSongs: 1,
            totalSongPlays: 1,
            firstShowDate: '2026-12-31',
            lastShowDate: '2026-12-31',
          },
        ],
      },
      2026,
    );
    expect(stats?.source).toBe('year-doc');
    expect(stats?.showsWithSetlist).toBe(3);
    expect(stats?.tours).toHaveLength(2);
    expect(stats?.unsplitTours).toEqual([]);
    expect(annualTotalsMatchTourPages(stats)).toBe(true);
    expect(stats?.bustouts.map((row) => row.showDate)).toEqual(['2026-12-31']);
  });

  it('rejects a year doc whose show count is not the sum of its tours', () => {
    expect(
      normalizePublishedYearStats(
        {
          year: 2026,
          yearRule: 'calendar-show-date',
          showsWithSetlist: 9,
          totalSongPlays: 1,
          uniqueSongs: 1,
          topSongs: [{ title: 'Tweezer', timesPlayed: 1, showAppearances: 1 }],
          bustouts: [],
          tours: [
            {
              tourSlug: '2026-sphere',
              tourLabel: '2026 Sphere',
              showsWithSetlist: 2,
              totalSongPlays: 1,
            },
          ],
        },
        2026,
      ),
    ).toBeNull();
  });

  it('rejects a January show that was filed under 2026', () => {
    const stats = normalizePublishedYearStats(
      {
        year: 2026,
        yearRule: 'calendar-show-date',
        showsWithSetlist: 1,
        uniqueSongs: 1,
        totalSongPlays: 1,
        topSongs: [{ title: 'Piper', timesPlayed: 1, showAppearances: 1 }],
        bustouts: [{ title: 'Piper', gap: 10, showDate: '2027-01-01' }],
        tours: [
          {
            tourSlug: 'nye',
            tourLabel: 'NYE',
            showsWithSetlist: 1,
            totalSongPlays: 1,
          },
        ],
      },
      2026,
    );
    expect(stats?.bustouts).toEqual([]);
  });
});
