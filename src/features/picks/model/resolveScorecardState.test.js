import { describe, expect, it } from 'vitest';

import {
  resolveScorecardState,
  scorecardShowsCrowdShare,
  scorecardShowsOverlap,
  scorecardShowsRank,
} from './resolveScorecardState';

describe('resolveScorecardState', () => {
  it('is empty when the player has no picks', () => {
    expect(
      resolveScorecardState({ hasPicks: false, isLocked: false, hasSetlist: false }),
    ).toBe('empty');
    expect(
      resolveScorecardState({ hasPicks: false, isLocked: true, hasSetlist: true }),
    ).toBe('empty');
  });

  it('is pre_lock when picks exist and the show is still open', () => {
    expect(
      resolveScorecardState({ hasPicks: true, isLocked: false, hasSetlist: false }),
    ).toBe('pre_lock');
  });

  it('is locked_ungraded after lock without a setlist', () => {
    expect(
      resolveScorecardState({ hasPicks: true, isLocked: true, hasSetlist: false }),
    ).toBe('locked_ungraded');
  });

  it('is graded when locked and a setlist exists', () => {
    expect(
      resolveScorecardState({ hasPicks: true, isLocked: true, hasSetlist: true }),
    ).toBe('graded');
  });
});

describe('scorecard visibility gates', () => {
  it('hides overlap and rank before lock', () => {
    expect(scorecardShowsOverlap('empty')).toBe(false);
    expect(scorecardShowsOverlap('pre_lock')).toBe(false);
    expect(scorecardShowsRank('pre_lock')).toBe(false);
  });

  it('shows overlap and rank after lock', () => {
    expect(scorecardShowsOverlap('locked_ungraded')).toBe(true);
    expect(scorecardShowsOverlap('graded')).toBe(true);
    expect(scorecardShowsRank('locked_ungraded')).toBe(true);
    expect(scorecardShowsRank('graded')).toBe(true);
  });
});

describe('scorecardShowsCrowdShare', () => {
  it('waits until showtime', () => {
    expect(scorecardShowsCrowdShare('NEXT')).toBe(false);
    expect(scorecardShowsCrowdShare('FUTURE')).toBe(false);
    expect(scorecardShowsCrowdShare(null)).toBe(false);
    expect(scorecardShowsCrowdShare('LIVE')).toBe(true);
    expect(scorecardShowsCrowdShare('PAST')).toBe(true);
  });
});
