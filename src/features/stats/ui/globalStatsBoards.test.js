import { describe, expect, it } from 'vitest';

import {
  GLOBAL_LEADERBOARD_BOARDS,
  GLOBAL_LEADERBOARD_MIN_SHOWS,
  GLOBAL_LEADERBOARD_PAGE_SIZE,
} from '../model/globalLeaderboardRanking';

describe('Global Stats boards (#1004, #1044)', () => {
  it('ships PPS, picking average, slugging, average vintage, and Bustout Boost', () => {
    expect(GLOBAL_LEADERBOARD_BOARDS.map((b) => b.title)).toEqual([
      'Points per show',
      'Picking average',
      'Slugging percentage',
      'Average vintage',
      'Bustout Boost',
    ]);
    expect(GLOBAL_LEADERBOARD_BOARDS.map((b) => b.shortLabel)).toEqual([
      'PPS',
      'Picking Avg',
      'SLG',
      'Vintage',
      'Bustout',
    ]);
    expect(GLOBAL_LEADERBOARD_MIN_SHOWS).toBe(3);
    expect(GLOBAL_LEADERBOARD_PAGE_SIZE).toBe(10);
    const copy = GLOBAL_LEADERBOARD_BOARDS.map((b) => `${b.hint} ${b.title}`).join(' ');
    expect(copy).not.toMatch(/chair|most played|#300|#694/i);
    expect(copy).toMatch(/slot/i);
    expect(copy).toMatch(/Average vintage/);
    expect(copy).toMatch(/Bustout Boost/);
  });
});
