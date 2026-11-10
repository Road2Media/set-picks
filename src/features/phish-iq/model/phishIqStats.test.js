import { describe, expect, it } from 'vitest';

import { computePhishIqStats, normalizePhishIqDay, normalizePhishIqDays } from './phishIqStats';
import { shiftQuizDate } from './phishIqStreak';

const TODAY = '2026-11-12';

function day(score, marks) {
  return { score, marks };
}

describe('computePhishIqStats', () => {
  it('starts at zero with an even distribution', () => {
    expect(computePhishIqStats({}, TODAY)).toEqual({
      played: 0,
      wins: 0,
      winPercent: 0,
      currentStreak: 0,
      bestStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0],
    });
  });

  it('counts plays, perfect scores, and the 0–5 distribution', () => {
    const stats = computePhishIqStats(
      {
        '2026-11-09': day(0, [false, false, false, false, false]),
        '2026-11-10': day(2, [true, false, true, false, false]),
        '2026-11-11': day(5, [true, true, true, true, true]),
        '2026-11-12': day(5, [true, true, true, true, true]),
      },
      TODAY,
    );
    expect(stats.played).toBe(4);
    expect(stats.wins).toBe(2);
    expect(stats.winPercent).toBe(50);
    expect(stats.distribution).toEqual([1, 0, 1, 0, 0, 2]);
    expect(stats.currentStreak).toBe(4);
    expect(stats.bestStreak).toBe(4);
  });

  it('rounds win % and keeps a play streak that is not a win streak', () => {
    const stats = computePhishIqStats(
      {
        [shiftQuizDate(TODAY, -1)]: day(1, [true, false, false, false, false]),
        [TODAY]: day(4, [true, true, true, true, false]),
      },
      TODAY,
    );
    expect(stats.winPercent).toBe(0);
    expect(stats.currentStreak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });

  it('breaks the current streak on a missed day and keeps the best run', () => {
    const stats = computePhishIqStats(
      {
        '2026-11-01': day(3, []),
        '2026-11-02': day(3, []),
        '2026-11-03': day(3, []),
        '2026-11-04': day(3, []),
        '2026-11-06': day(2, []),
        [TODAY]: day(1, []),
      },
      TODAY,
    );
    expect(stats.currentStreak).toBe(1);
    expect(stats.bestStreak).toBe(4);
  });

  it('keeps yesterday’s run until today’s quiz date passes', () => {
    const yesterday = shiftQuizDate(TODAY, -1);
    const stats = computePhishIqStats(
      {
        [shiftQuizDate(TODAY, -2)]: day(5, []),
        [yesterday]: day(5, []),
      },
      TODAY,
    );
    expect(stats.currentStreak).toBe(2);
    expect(computePhishIqStats({ [shiftQuizDate(TODAY, -2)]: day(5, []) }, TODAY).currentStreak).toBe(
      0,
    );
  });

  it('fills missing fields and drops bad dates', () => {
    expect(normalizePhishIqDay({})).toEqual({ score: 0, marks: [] });
    expect(normalizePhishIqDay({ marks: [true, false, true] })).toEqual({
      score: 2,
      marks: [true, false, true],
    });
    expect(normalizePhishIqDay({ score: -3, marks: [true] })).toEqual({
      score: 0,
      marks: [true],
    });
    expect(normalizePhishIqDay({ score: 1.9 })).toEqual({ score: 1, marks: [] });
    expect(normalizePhishIqDay({ score: 8, marks: [true, true, true, true, true, true] }).score).toBe(
      5,
    );
    expect(normalizePhishIqDay(null)).toBeNull();
    const days = normalizePhishIqDays({
      'not-a-date': { score: 5 },
      '2026-11-12': { marks: [true, true] },
      __proto__: { score: 5 },
    });
    expect(days['2026-11-12']).toEqual({ score: 2, marks: [true, true] });
    expect(Object.keys(days)).toEqual(['2026-11-12']);
  });
});
