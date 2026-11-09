import { describe, expect, it } from 'vitest';

import {
  YEAR_END_ANNUAL_WINNER_LABEL,
  YEAR_END_RUNNER_UP_LABEL,
  YEAR_END_THIRD_PLACE_LABEL,
  yearEndCelebrationHeadline,
} from '../../../shared/config/dashboardVocabulary';
import {
  addCalendarMonths,
  isWithinYearEndWindow,
  isYearEndCelebrationPreview,
  isYearFinaleReady,
  latestClosedYear,
  markYearEndCelebrationSeen,
  readYearEndCelebrationSeen,
  resolveYearEndCelebration,
  tailShowReadiness,
  yearEndCelebrationStorageKey,
  yearEndPodium,
  yearFinaleDate,
} from './yearEndCelebration';

const CALENDAR = [
  { date: '2026-04-15' },
  { date: '2026-04-16' },
  { date: '2026-07-14' },
  { date: '2026-12-31' },
  { date: '2027-01-01' },
  { date: '2027-07-04' },
];

const WINNER = [{ uid: 'bea', handle: 'Bea', totalPoints: 40, wins: 1, shows: 2 }];

function readyFinale(showDate = '2026-12-31') {
  return {
    view: 'year',
    year: '2026',
    showDates: CALENDAR,
    today: '2027-01-01',
    calendarSettled: true,
    tailDate: showDate,
    tailReady: true,
    seen: false,
    leaders: WINNER,
    leadersLoading: false,
    leadersError: false,
  };
}

describe('year finale date', () => {
  it('keeps Dec 31 in that year and treats Jan 1 as the next year', () => {
    expect(yearFinaleDate(CALENDAR, '2026')).toBe('2026-12-31');
    expect(yearFinaleDate(CALENDAR, '2027')).toBe('2027-07-04');
    expect(yearFinaleDate([{ date: '2026-12-31T05:00:00Z' }], '2026')).toBeNull();
  });

  it('ignores nights before game launch', () => {
    expect(yearFinaleDate([{ date: '2026-04-15' }, { date: '2026-04-16' }], '2026')).toBe(
      '2026-04-16',
    );
  });
});

describe('two-month window', () => {
  it('clamps a Dec 31 close onto the last day of February', () => {
    expect(addCalendarMonths('2026-12-31', 2)).toBe('2027-02-28');
    expect(addCalendarMonths('2027-12-31', 2)).toBe('2028-02-29');
    expect(isWithinYearEndWindow('2026-12-31', '2026-12-31')).toBe(true);
    expect(isWithinYearEndWindow('2026-12-31', '2027-02-28')).toBe(true);
    expect(isWithinYearEndWindow('2026-12-31', '2027-03-01')).toBe(false);
    expect(isWithinYearEndWindow('2026-12-31', '2026-12-30')).toBe(false);
  });
});

describe('finale graded', () => {
  it('waits until every submitted card is graded', () => {
    expect(isYearFinaleReady([])).toBe(true);
    expect(
      isYearFinaleReady([{ isGraded: false, picks: { s1: '' } }]),
    ).toBe(true);
    expect(
      isYearFinaleReady([{ isGraded: false, picks: { s1: 'Tweezer' } }]),
    ).toBe(false);
    expect(
      isYearFinaleReady([
        { isGraded: true, picks: { s1: 'Tweezer' } },
        { isGraded: true, picks: { s1: 'Ghost' } },
      ]),
    ).toBe(true);
  });

  it('reads readiness from the latest fetched night, not list order', () => {
    const picksByDate = [
      { date: '2026-07-14', picks: [{ isGraded: true, picks: { s1: 'Tweezer' } }] },
      {
        date: '2026-12-31',
        picks: [{ isGraded: false, picks: { s1: 'Ghost' } }],
      },
    ];
    expect(tailShowReadiness(['2026-12-31', '2026-07-14'], picksByDate)).toEqual({
      tailDate: '2026-12-31',
      tailReady: false,
    });
  });
});

describe('resolveYearEndCelebration', () => {
  it('plays on the closed year once the finale is graded, including the next morning', () => {
    const decision = resolveYearEndCelebration(readyFinale());
    expect(decision.play).toBe(true);
    expect(decision.finaleDate).toBe('2026-12-31');
    expect(decision.places[0]).toMatchObject({
      rank: 1,
      label: YEAR_END_ANNUAL_WINNER_LABEL,
      members: [{ uid: 'bea', handle: 'Bea' }],
    });
  });

  it('can start the same calendar day the finale is graded', () => {
    expect(
      resolveYearEndCelebration({ ...readyFinale(), today: '2026-12-31' }).play,
    ).toBe(true);
  });

  it('does not play before the finale is graded', () => {
    expect(resolveYearEndCelebration({ ...readyFinale(), tailReady: false }).play).toBe(false);
    expect(
      resolveYearEndCelebration({ ...readyFinale(), today: '2026-11-09' }).play,
    ).toBe(false);
  });

  it('does not play on Show, Tour, or Pools', () => {
    for (const view of ['show', 'tour', 'pools']) {
      expect(resolveYearEndCelebration({ ...readyFinale(), view }).play).toBe(false);
    }
  });

  it('does not play while browsing an earlier year', () => {
    const shows = [{ date: '2026-12-31' }, { date: '2027-01-02' }];
    expect(latestClosedYear(shows, '2027-01-03')).toEqual({
      year: '2027',
      finaleDate: '2027-01-02',
    });
    expect(
      resolveYearEndCelebration({
        ...readyFinale(),
        showDates: shows,
        year: '2026',
        today: '2027-01-03',
        tailDate: '2026-12-31',
      }).play,
    ).toBe(false);
    expect(
      resolveYearEndCelebration({
        ...readyFinale(),
        showDates: shows,
        year: '2027',
        today: '2027-01-03',
        tailDate: '2027-01-02',
      }).play,
    ).toBe(true);
  });

  it('does not play on the bundled fallback calendar', () => {
    expect(resolveYearEndCelebration({ ...readyFinale(), calendarSettled: false }).play).toBe(
      false,
    );
  });

  it('does not play again after the first view, or after two months', () => {
    expect(resolveYearEndCelebration({ ...readyFinale(), seen: true }).play).toBe(false);
    expect(
      resolveYearEndCelebration({ ...readyFinale(), today: '2027-03-01' }).play,
    ).toBe(false);
  });

  it('does not play an empty board', () => {
    expect(resolveYearEndCelebration({ ...readyFinale(), leaders: [] }).play).toBe(false);
    expect(resolveYearEndCelebration({ ...readyFinale(), leadersLoading: true }).play).toBe(
      false,
    );
  });

  it('gives the higher place to the player with more nightly wins', () => {
    const places = yearEndPodium([
      { uid: 'a', handle: 'Ada', totalPoints: 10, wins: 1, shows: 1 },
      { uid: 'b', handle: 'Bea', totalPoints: 10, wins: 0, shows: 1 },
      { uid: 'c', handle: 'Cal', totalPoints: 4, wins: 0, shows: 1 },
    ]);
    expect(places.map((place) => place.label)).toEqual([
      YEAR_END_ANNUAL_WINNER_LABEL,
      YEAR_END_RUNNER_UP_LABEL,
      YEAR_END_THIRD_PLACE_LABEL,
    ]);
    expect(places[0].tied).toBe(false);
    expect(places[0].members.map((member) => member.handle)).toEqual(['Ada']);
    expect(places[1].members.map((member) => member.handle)).toEqual(['Bea']);
  });
});

describe('seen flag', () => {
  it('remembers one view per person and year in this browser', () => {
    const store = new Map();
    const read = (key) => (store.has(key) ? store.get(key) : null);
    const write = (key, value) => {
      store.set(key, value);
    };
    expect(yearEndCelebrationStorageKey('ada', '2026')).toBe(
      'set-picks:year-end-celebration:ada:2026',
    );
    expect(readYearEndCelebrationSeen('ada', '2026', read)).toBe(false);
    markYearEndCelebrationSeen('ada', '2026', write);
    expect(readYearEndCelebrationSeen('ada', '2026', read)).toBe(true);
    expect(readYearEndCelebrationSeen('bea', '2026', read)).toBe(false);
    expect(readYearEndCelebrationSeen('ada', '2027', read)).toBe(false);
    expect(readYearEndCelebrationSeen('', '2026', read)).toBe(false);
  });
});

describe('preview and copy', () => {
  it('previews only on the dev server', () => {
    expect(isYearEndCelebrationPreview('preview', false)).toBe(false);
    expect(isYearEndCelebrationPreview('preview', true)).toBe(true);
    expect(isYearEndCelebrationPreview('1', true)).toBe(false);
  });

  it('uses the wrap opening and never says chair', () => {
    const headline = yearEndCelebrationHeadline('2026');
    expect(headline).toBe('2026 is officially in the books.');
    const copy = [
      headline,
      YEAR_END_ANNUAL_WINNER_LABEL,
      YEAR_END_RUNNER_UP_LABEL,
      YEAR_END_THIRD_PLACE_LABEL,
    ].join(' ');
    expect(copy.toLowerCase()).not.toContain('chair');
  });
});
