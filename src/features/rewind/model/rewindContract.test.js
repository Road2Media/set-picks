import { describe, expect, it } from 'vitest';

import {
  LIVE_PICKS_COLLECTION,
  REWIND_PICKS_COLLECTION,
  SUGGESTED_MSG_NYE_DATES,
  buildRewindShareText,
  rankRewindBoard,
  rewindAnswerVisible,
  rewindLoadErrorMessage,
  toPublicRewindWeek,
} from './rewindContract';

describe('rewind contract (#1142)', () => {
  it('keeps rewind scores off the live picks collection', () => {
    expect(REWIND_PICKS_COLLECTION).toBe('rewind_picks');
    expect(LIVE_PICKS_COLLECTION).toBe('picks');
    expect(REWIND_PICKS_COLLECTION).not.toBe(LIVE_PICKS_COLLECTION);
  });

  it('strips setlist songs from a public week', () => {
    const week = toPublicRewindWeek({
      weekId: '2026-11-23',
      showDate: '1995-12-31',
      title: 'MSG NYE 1995',
      playerCount: 4,
      setlist: { s1o: 'Wilson' },
      officialSetlist: ['Wilson', 'Tweezer'],
      bustouts: ['You Enjoy Myself'],
    });
    const blob = JSON.stringify(week);
    expect(blob).not.toContain('Wilson');
    expect(blob).not.toContain('Tweezer');
    expect(blob).not.toContain('You Enjoy Myself');
    expect(week?.playerCount).toBe(4);
    expect(week?.attribution).toBe('Setlist data courtesy of Phish.net.');
  });

  it('hides raw Firestore permission errors', () => {
    expect(
      rewindLoadErrorMessage(
        new Error('Firestore REST 403 for rewind_state/current: PERMISSION_DENIED'),
        'Could not load Rewind.',
      ),
    ).toBe('This Rewind week is not available yet.');
    expect(rewindLoadErrorMessage(new Error('network'), 'Could not load Rewind.')).toBe(
      'Could not load Rewind.',
    );
  });

  it('hides the answer until a reveal exists', () => {
    expect(rewindAnswerVisible(null)).toBe(false);
    expect(rewindAnswerVisible({ score: 10 })).toBe(false);
    expect(rewindAnswerVisible({ slots: [] })).toBe(true);
  });

  it('share text does not repeat song titles', () => {
    const text = buildRewindShareText({
      title: 'MSG NYE 1995',
      showDate: '1995-12-31',
      weekId: '2026-11-23',
      score: 40,
      correctSlots: 3,
      slots: [
        { kind: 'exact_slot', guess: 'AC/DC Bag', actual: 'AC/DC Bag' },
        { kind: 'miss', guess: 'Wilson', actual: 'You Enjoy Myself' },
        { kind: 'wildcard_hit', bustoutBoost: true, guess: 'Tweezer' },
      ],
    });
    expect(text).toContain('40 pts');
    expect(text).toContain('phish.net/setlists/?d=1995-12-31');
    expect(text).toContain('Setlist data courtesy of Phish.net.');
    expect(text).not.toContain('AC/DC Bag');
    expect(text).not.toContain('Wilson');
    expect(text).not.toContain('Tweezer');
    expect(text).not.toContain('You Enjoy Myself');
  });

  it('ranks a tie by sharing the place', () => {
    const board = rankRewindBoard([
      { userId: 'a', handle: 'Bee', score: 10 },
      { userId: 'b', handle: 'Ada', score: 30 },
      { userId: 'c', handle: 'Cy', score: 30 },
    ]);
    expect(board.map((row) => [row.handle, row.rank])).toEqual([
      ['Ada', 1],
      ['Cy', 1],
      ['Bee', 3],
    ]);
  });

  it('suggests MSG NYE dates only', () => {
    expect(SUGGESTED_MSG_NYE_DATES.length).toBeGreaterThan(0);
    expect(new Set(SUGGESTED_MSG_NYE_DATES).size).toBe(SUGGESTED_MSG_NYE_DATES.length);
    for (const date of SUGGESTED_MSG_NYE_DATES) {
      expect(date.endsWith('-12-31')).toBe(true);
    }
  });
});
