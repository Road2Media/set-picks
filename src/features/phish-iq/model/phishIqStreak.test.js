import { describe, expect, it } from 'vitest';

import { nextPhishIqRecord, normalizePhishIqRecord, shiftQuizDate } from './phishIqStreak';

const DAY = '2026-11-09';
const RESULT = { date: DAY, score: 4, marks: [true, true, true, true, false] };

describe('nextPhishIqRecord', () => {
  it('starts a streak at 1', () => {
    expect(nextPhishIqRecord(null, RESULT)).toEqual({
      currentStreak: 1,
      bestStreak: 1,
      lastPlayedDate: DAY,
      lastScore: 4,
      lastMarks: RESULT.marks,
    });
  });

  it('continues a streak on the next calendar day', () => {
    const previous = nextPhishIqRecord(null, {
      date: shiftQuizDate(DAY, -1),
      score: 2,
      marks: [true, false],
    });
    const next = nextPhishIqRecord(previous, RESULT);
    expect(next.currentStreak).toBe(2);
    expect(next.bestStreak).toBe(2);
    expect(next.lastScore).toBe(4);
  });

  it('keeps the first score when the same day is submitted again', () => {
    const first = nextPhishIqRecord(null, RESULT);
    const again = nextPhishIqRecord(first, { date: DAY, score: 5, marks: [true, true, true, true, true] });
    expect(again).toEqual(first);
  });

  it('resets after a missed day and keeps the best streak', () => {
    const previous = {
      currentStreak: 6,
      bestStreak: 6,
      lastPlayedDate: shiftQuizDate(DAY, -3),
      lastScore: 1,
      lastMarks: [false],
    };
    const next = nextPhishIqRecord(previous, RESULT);
    expect(next.currentStreak).toBe(1);
    expect(next.bestStreak).toBe(6);
  });

  it('drops a record with no play date', () => {
    expect(normalizePhishIqRecord({ currentStreak: 4 })).toBeNull();
  });
});
