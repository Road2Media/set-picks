import { describe, expect, it } from 'vitest';

import {
  GLOBAL_LEADERBOARD_BOARDS,
  GLOBAL_LEADERBOARD_MIN_SHOWS,
  GLOBAL_LEADERBOARD_PAGE_SIZE,
  GLOBAL_LEADERBOARD_SLOTS_PER_SHOW,
  GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS,
  GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME,
  GLOBAL_LEADERBOARD_TOP_N,
  computePickingAverage,
  computePointsPerShow,
  computeSluggingPercentage,
  formatAverageVintage,
  formatBustoutBoosts,
  formatPickingAverage,
  formatPointsPerShow,
  formatSluggingPercentage,
  leaderboardBoardHint,
  leaderboardPageWindow,
  mergeAllBoards,
  mergeYouRow,
  rankBoard,
  viewerMetricsFromUserDoc,
} from './globalLeaderboardRanking';

describe('global leaderboard ratios (#1004)', () => {
  it('points per show is totalPoints / showsPlayed', () => {
    expect(computePointsPerShow(30, 3)).toBe(10);
    expect(computePointsPerShow(7, 2)).toBe(3.5);
    expect(computePointsPerShow(10, 0)).toBeNull();
  });

  it('slugging percentage is totalPoints / (shows * 30)', () => {
    expect(GLOBAL_LEADERBOARD_SLUGGING_BASE_POINTS).toBe(30);
    expect(GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME).toBe(15);
    expect(computeSluggingPercentage(300, 20)).toBe(0.5);
    expect(computeSluggingPercentage(90, 3)).toBe(1);
    expect(computeSluggingPercentage(10, 0)).toBeNull();
    expect(computeSluggingPercentage(undefined, 15)).toBeNull();
    expect(formatSluggingPercentage(0.5)).toBe('.500');
    expect(formatSluggingPercentage(1)).toBe('1.000');
  });

  it('picking average uses PROFILE_SLOTS_PER_SHOW = 6', () => {
    expect(GLOBAL_LEADERBOARD_SLOTS_PER_SHOW).toBe(6);
    expect(computePickingAverage(9, 3)).toBe(0.5);
    expect(formatPickingAverage(0.5)).toBe('.500');
    expect(formatPointsPerShow(10)).toBe('10');
    expect(formatPointsPerShow(3.5)).toBe('3.5');
  });
});

describe('rankBoard min-shows gate', () => {
  it('keeps default showsPlayed >= 3 on ratio boards so one-show spikes drop', () => {
    expect(GLOBAL_LEADERBOARD_MIN_SHOWS).toBe(3);
    const ranked = rankBoard([
      { uid: 'spike', handle: 'Spike', value: 40, shows: 1 },
      { uid: 'steady', handle: 'Steady', value: 12, shows: 4 },
      { uid: 'mid', handle: 'Mid', value: 11, shows: 3 },
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(['steady', 'mid']);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('all-time slugging gate drops players under 15 shows', () => {
    const ranked = rankBoard(
      [
        { uid: 'short', handle: 'Short', value: 3, shows: 14 },
        { uid: 'vet', handle: 'Vet', value: 0.75, shows: 20 },
        { uid: 'edge', handle: 'Edge', value: 1, shows: 15 },
      ],
      { minShows: GLOBAL_LEADERBOARD_SLUGGING_MIN_SHOWS_ALL_TIME }
    );
    expect(ranked.map((r) => r.uid)).toEqual(['edge', 'vet']);
  });

  it('shows-count board has no ratio gate', () => {
    const ranked = rankBoard(
      [
        { uid: 'a', handle: 'A', value: 1, shows: 1 },
        { uid: 'b', handle: 'B', value: 12, shows: 12 },
      ],
      { minShows: 0 }
    );
    expect(ranked.map((r) => r.uid)).toEqual(['b', 'a']);
  });

  it('caps at top 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      uid: `u${i}`,
      handle: `H${String(i).padStart(2, '0')}`,
      value: 60 - i,
      shows: 5,
    }));
    expect(rankBoard(many)).toHaveLength(GLOBAL_LEADERBOARD_TOP_N);
  });
});

describe('mergeYouRow', () => {
  it('highlights the viewer when they are already in the top 50', () => {
    const merged = mergeYouRow(
      [
        { uid: 'a', handle: 'A', value: 12, shows: 4, rank: 1 },
        { uid: 'me', handle: 'Me', value: 10, shows: 5, rank: 2 },
      ],
      { uid: 'me', handle: 'Me', value: 10, shows: 5 }
    );
    expect(merged[1].isSelf).toBe(true);
    expect(merged[1].outsideTop).toBe(false);
    expect(merged).toHaveLength(2);
  });

  it('appends a you-row when the viewer sits outside the top 50', () => {
    const merged = mergeYouRow(
      [{ uid: 'a', handle: 'A', value: 12, shows: 4, rank: 1 }],
      { uid: 'me', handle: 'Me', value: 8, shows: 6 }
    );
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      uid: 'me',
      isSelf: true,
      outsideTop: true,
      rank: null,
      value: 8,
    });
  });
});

describe('viewerMetricsFromUserDoc', () => {
  const user = {
    handle: 'Pat',
    totalPoints: 40,
    showsPlayed: 4,
    careerCorrectSlots: 12,
    seasonStats: {
      '2026 Summer Tour': { totalPoints: 15, shows: 3, correctSlots: 6 },
    },
  };

  it('reads career fields for all-time boards', () => {
    const viewer = viewerMetricsFromUserDoc(user, {
      uid: 'u1',
      scope: 'allTime',
    });
    expect(viewer.values.pointsPerShow).toBe(10);
    expect(viewer.values.pickingAverage).toBe(0.5);
    expect(viewer.values.sluggingPercentage).toBeCloseTo(40 / 120);
    expect(viewer.shows).toBe(4);
  });

  it('reads seasonStats.{tourKey} for this-tour boards', () => {
    const viewer = viewerMetricsFromUserDoc(user, {
      uid: 'u1',
      scope: 'tour',
      tourKey: '2026 Summer Tour',
    });
    expect(viewer.values.pointsPerShow).toBe(5);
    expect(viewer.values.pickingAverage).toBe(1 / 3);
    expect(viewer.values.sluggingPercentage).toBeCloseTo(15 / 90);
    expect(viewer.shows).toBe(3);
  });
});

describe('mergeAllBoards slugging minimum', () => {
  it('marks an all-time you-row under 15 shows as not ranked', () => {
    const merged = mergeAllBoards(
      { boards: { sluggingPercentage: [] } },
      {
        uid: 'me',
        handle: 'Me',
        shows: 8,
        values: { sluggingPercentage: 1.25, pointsPerShow: 10, pickingAverage: 0.4 },
      },
      'allTime'
    );
    expect(merged.sluggingPercentage[0]).toMatchObject({
      uid: 'me',
      belowMinimum: true,
      outsideTop: true,
      value: 1.25,
    });
  });

  it('keeps a 15-show all-time you-row eligible for a rank label', () => {
    const merged = mergeAllBoards(
      { boards: { sluggingPercentage: [] } },
      {
        uid: 'me',
        handle: 'Me',
        shows: 15,
        values: { sluggingPercentage: 0.8, pointsPerShow: 12, pickingAverage: 0.4 },
      },
      'allTime'
    );
    expect(merged.sluggingPercentage[0].belowMinimum).toBeUndefined();
    expect(merged.sluggingPercentage[0].outsideTop).toBe(true);
  });
});

describe('leaderboardBoardHint', () => {
  it('uses the 15-show copy for all-time slugging and the tour copy otherwise', () => {
    const slugging = {
      key: 'sluggingPercentage',
      hint: 'tour hint',
      allTimeHint: 'all-time hint',
    };
    expect(leaderboardBoardHint(slugging, 'allTime')).toBe('all-time hint');
    expect(leaderboardBoardHint(slugging, 'tour')).toBe('tour hint');
    expect(leaderboardBoardHint({ hint: 'pps' }, 'allTime')).toBe('pps');
  });
});

describe('leaderboardPageWindow', () => {
  it('pages the top 50 in tens and clamps a stale page', () => {
    expect(GLOBAL_LEADERBOARD_PAGE_SIZE).toBe(10);
    expect(leaderboardPageWindow(49, 0)).toEqual({
      current: 0,
      maxPage: 4,
      start: 0,
      end: 10,
    });
    expect(leaderboardPageWindow(49, 4)).toEqual({
      current: 4,
      maxPage: 4,
      start: 40,
      end: 49,
    });
    expect(leaderboardPageWindow(12, 9)).toEqual({
      current: 1,
      maxPage: 1,
      start: 10,
      end: 12,
    });
    expect(leaderboardPageWindow(8, 0).maxPage).toBe(0);
  });
});

describe('average vintage and bustout boost (#1044)', () => {
  it('formats a debut year and a bustout count', () => {
    expect(formatAverageVintage(1994.4)).toBe('1994');
    expect(formatAverageVintage(null)).toBe('—');
    expect(formatBustoutBoosts(4)).toBe('4');
    expect(formatBustoutBoosts(0)).toBe('0');
  });

  it('ranks an older year ahead of a newer one and drops players under 3 shows', () => {
    const ranked = rankBoard(
      [
        { uid: 'newSong', handle: 'New', value: 2004, shows: 6 },
        { uid: 'old', handle: 'Old', value: 1988, shows: 4 },
        { uid: 'spike', handle: 'Spike', value: 1970, shows: 1 },
      ],
      { minShows: 3, order: 'asc' }
    );
    expect(ranked.map((row) => row.uid)).toEqual(['old', 'newSong']);
    expect(ranked[0].rank).toBe(1);
  });

  it('reads career and tour vintage plus bustout counts from the user doc', () => {
    const user = {
      handle: 'Pat',
      totalPoints: 40,
      showsPlayed: 4,
      careerCorrectSlots: 12,
      avgVintageYear: 1992,
      avgVintageByTour: { '2026 Summer Tour': 1996 },
      seasonStats: {
        '2026 Summer Tour': {
          totalPoints: 15,
          shows: 3,
          correctSlots: 6,
          bustoutBoosts: 2,
        },
        '2026 Sphere': { totalPoints: 10, shows: 2, bustoutBoosts: 1 },
      },
    };
    const career = viewerMetricsFromUserDoc(user, { uid: 'u1', scope: 'allTime' });
    expect(career.values.averageVintage).toBe(1992);
    expect(career.values.bustoutBoosts).toBe(3);
    const tour = viewerMetricsFromUserDoc(user, {
      uid: 'u1',
      scope: 'tour',
      tourKey: '2026 Summer Tour',
    });
    expect(tour.values.averageVintage).toBe(1996);
    expect(tour.values.bustoutBoosts).toBe(2);
  });

  it('marks a zero bustout you-row as not ranked', () => {
    const bustout = GLOBAL_LEADERBOARD_BOARDS.find((board) => board.key === 'bustoutBoosts');
    const merged = mergeAllBoards(
      { boards: { bustoutBoosts: [] } },
      {
        uid: 'me',
        handle: 'Me',
        shows: 8,
        values: { bustoutBoosts: 0 },
      },
      'allTime'
    );
    expect(bustout.minValue).toBe(1);
    expect(merged.bustoutBoosts[0]).toMatchObject({
      belowMinimum: true,
      belowMinimumReason: 'value',
      value: 0,
    });
  });
});
