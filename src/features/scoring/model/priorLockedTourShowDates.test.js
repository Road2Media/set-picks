import { describe, expect, it } from 'vitest';

import { priorLockedTourShowDates } from './priorLockedTourShowDates';

const SHOW_DATES = [
  { date: '2026-07-17', timeZone: 'America/New_York' },
  { date: '2026-07-18', timeZone: 'America/New_York' },
  { date: '2026-12-30', timeZone: 'America/New_York' },
  { date: '2026-12-31', timeZone: 'America/New_York' },
];

const BY_TOUR = [
  {
    tour: '2026',
    shows: SHOW_DATES.map((show) => ({ date: show.date, venue: 'MSG' })),
  },
];

/** 11:00 in New York on 2026-11-09, before the 19:30 lock. */
const OPEN_AFTERNOON = new Date('2026-11-09T16:00:00Z');

describe('priorLockedTourShowDates', () => {
  it('keeps the still-open next night out of chalk for a later date', () => {
    const dates = priorLockedTourShowDates(
      '2026-12-31',
      SHOW_DATES,
      BY_TOUR,
      OPEN_AFTERNOON
    );
    expect(dates).toEqual(['2026-07-17', '2026-07-18']);
    expect(dates).not.toContain('2026-12-30');
    expect(dates).not.toContain('2026-12-31');
  });

  it('uses earlier locked nights when the selected show is next', () => {
    expect(
      priorLockedTourShowDates('2026-12-30', SHOW_DATES, BY_TOUR, OPEN_AFTERNOON)
    ).toEqual(['2026-07-17', '2026-07-18']);
  });

  it('includes today after the picks lock', () => {
    const afterLock = new Date('2026-12-31T01:00:00Z');
    expect(
      priorLockedTourShowDates('2027-01-02', SHOW_DATES, BY_TOUR, afterLock)
    ).toEqual(['2026-07-17', '2026-07-18', '2026-12-30']);
  });

  it('returns nothing without a calendar or a selected date', () => {
    expect(priorLockedTourShowDates('', SHOW_DATES, BY_TOUR, OPEN_AFTERNOON)).toEqual(
      []
    );
    expect(priorLockedTourShowDates('2026-12-30', [], BY_TOUR, OPEN_AFTERNOON)).toEqual(
      []
    );
  });
});
