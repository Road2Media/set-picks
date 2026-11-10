import { describe, expect, it } from 'vitest';

import {
  SCORECARD_EMPTY_BODY,
  SCORECARD_EMPTY_TITLE,
  SCORECARD_HINT,
  SCORECARD_LOCKED_UNGRADED_COPY,
  scorecardPoolExcludedCopy,
} from './PicksScorecardCard';

describe('PicksScorecardCard copy (#767)', () => {
  it('keeps empty-state guidance to Make Picks', () => {
    expect(SCORECARD_EMPTY_TITLE).toMatch(/no picks/i);
    expect(SCORECARD_EMPTY_BODY).toMatch(/Make Picks/i);
  });

  it('explains crowd share, slot overlap, and showtime in the header hint', () => {
    expect(SCORECARD_HINT).toMatch(/showtime/i);
    expect(SCORECARD_HINT).toMatch(/slot/i);
    expect(SCORECARD_HINT).toMatch(/Standings/i);
    expect(SCORECARD_HINT).toMatch(/Hide crowd pulse/i);
    expect(SCORECARD_HINT).not.toMatch(/predictive|model odds|chair|best guess/i);
  });

  it('says when a night does not count for the selected pool', () => {
    expect(scorecardPoolExcludedCopy('Alpha')).toBe(
      'This night does not count for Alpha.',
    );
    expect(scorecardPoolExcludedCopy('')).toMatch(/this pool/i);
    expect(scorecardPoolExcludedCopy('Alpha')).not.toMatch(/chair/i);
  });

  it('explains locked / ungraded rank pending', () => {
    expect(SCORECARD_LOCKED_UNGRADED_COPY).toMatch(/locked/i);
    expect(SCORECARD_LOCKED_UNGRADED_COPY).toMatch(/setlist/i);
  });
});
