import { describe, it, expect } from 'vitest';
import {
  SCORING_LADDER_V1,
  SCORING_LADDER_V2,
  SCORING_LADDER_V2_EFFECTIVE_DATE,
  SCORING_RULES,
  calculateSlotScore,
  calculateTotalScore,
  getSlotScoreBreakdown,
  scoringLadderComparisonRows,
  scoringRulesForShowDate,
  scoringRulesInEffect,
} from './scoring.js';

/**
 * Per-show `bustouts` snapshot read path (#214).
 *
 * These tests pin the invariant that bustout boosts come from the
 * `actualSetlist.bustouts` array on the official setlist doc — not a song
 * catalog. Absence or empty array must mean "no boost"; no fallback lookup.
 */
describe('scoring: bustout boost reads actualSetlist.bustouts (#214)', () => {
  const baseSetlist = {
    s1o: 'AC/DC Bag',
    s1c: 'Bathtub Gin',
    s2o: "Colonel Forbin's Ascent",
    s2c: 'Down with Disease',
    enc: 'Tweezer Reprise',
    officialSetlist: [
      'AC/DC Bag',
      'Bathtub Gin',
      "Colonel Forbin's Ascent",
      'Down with Disease',
      'Tweezer Reprise',
    ],
  };

  it('awards BUSTOUT_BOOST when the pick matches a bustout entry', () => {
    const actual = { ...baseSetlist, bustouts: ["Colonel Forbin's Ascent"] };
    // Wildcard hit (10) + bustout boost (20) = 30
    expect(calculateSlotScore('wild', "Colonel Forbin's Ascent", actual)).toBe(
      SCORING_RULES.WILDCARD_HIT + SCORING_RULES.BUSTOUT_BOOST,
    );
    // Exact slot (10) + bustout boost (20) = 30
    expect(calculateSlotScore('s2o', "Colonel Forbin's Ascent", actual)).toBe(
      SCORING_RULES.EXACT_SLOT + SCORING_RULES.BUSTOUT_BOOST,
    );
  });

  it('no bustout boost when the pick is not in bustouts', () => {
    const actual = { ...baseSetlist, bustouts: ["Colonel Forbin's Ascent"] };
    // Wildcard hit only, no boost
    expect(calculateSlotScore('wild', 'AC/DC Bag', actual)).toBe(
      SCORING_RULES.WILDCARD_HIT,
    );
  });

  it('treats absent bustouts as empty (no boost, no catalog fallback)', () => {
    const actual = { ...baseSetlist }; // no bustouts field
    expect(calculateSlotScore('wild', "Colonel Forbin's Ascent", actual)).toBe(
      SCORING_RULES.WILDCARD_HIT,
    );
  });

  it('treats empty bustouts array as no boost', () => {
    const actual = { ...baseSetlist, bustouts: [] };
    expect(calculateSlotScore('wild', "Colonel Forbin's Ascent", actual)).toBe(
      SCORING_RULES.WILDCARD_HIT,
    );
  });

  it('matches bustout entries case-insensitively', () => {
    const actual = { ...baseSetlist, bustouts: ['colonel forbins ascent', 'DOWN WITH DISEASE'] };
    // Different casing/punctuation normalize via `String#toLowerCase().trim()`.
    // "Colonel Forbin's Ascent" vs "colonel forbins ascent" differs in the
    // apostrophe, so guard against accidental matches: exact normalize only.
    expect(calculateSlotScore('s2c', 'Down with Disease', actual)).toBe(
      SCORING_RULES.EXACT_SLOT + SCORING_RULES.BUSTOUT_BOOST,
    );
  });

  it('getSlotScoreBreakdown surfaces bustoutBoost flag', () => {
    const actual = { ...baseSetlist, bustouts: ['AC/DC Bag'] };
    const result = getSlotScoreBreakdown('s1o', 'AC/DC Bag', actual);
    expect(result.points).toBe(SCORING_RULES.EXACT_SLOT + SCORING_RULES.BUSTOUT_BOOST);
    expect(result.bustoutBoost).toBe(true);
    expect(result.kind).toBe('exact_slot');

    const noBoost = getSlotScoreBreakdown('s1c', 'Bathtub Gin', actual);
    expect(noBoost.bustoutBoost).toBe(false);
  });

  it('drops non-string entries in bustouts defensively', () => {
    const actual = {
      ...baseSetlist,
      bustouts: [null, 42, { title: 'x' }, "Colonel Forbin's Ascent"],
    };
    expect(calculateSlotScore('wild', "Colonel Forbin's Ascent", actual)).toBe(
      SCORING_RULES.WILDCARD_HIT + SCORING_RULES.BUSTOUT_BOOST,
    );
  });

  it('calculateTotalScore sums base + boosts across slots', () => {
    const actual = { ...baseSetlist, bustouts: ["Colonel Forbin's Ascent"] };
    const picks = {
      s1o: 'AC/DC Bag', // exact slot, no bustout = 10
      s1c: 'Bathtub Gin', // exact slot, no bustout = 10
      s2o: "Colonel Forbin's Ascent", // exact slot + bustout = 30
      s2c: 'wrong', // miss = 0
      enc: 'Tweezer Reprise', // encore exact = 15
      wild: 'Down with Disease', // wildcard hit = 10
    };
    expect(calculateTotalScore(picks, actual)).toBe(10 + 10 + 30 + 0 + 15 + 10);
  });
});

const encoreShow = {
  s1o: 'AC/DC Bag',
  s1c: 'Bathtub Gin',
  s2o: 'Tweezer',
  s2c: 'Harry Hood',
  enc: 'Tweezer Reprise',
  encoreSongs: ['Tweezer Reprise', 'Wilson'],
  officialSetlist: [
    'AC/DC Bag',
    'Bathtub Gin',
    'Tweezer',
    'Harry Hood',
    'Tweezer Reprise',
    'Wilson',
    'Farmhouse',
  ],
};

describe('scoring ladder gate (#1086)', () => {
  it('keeps ladder v1 when the show date is missing', () => {
    expect(scoringRulesForShowDate(undefined).id).toBe('v1');
    expect(scoringRulesForShowDate('not-a-date')).toBe(SCORING_LADDER_V1);
    expect(calculateSlotScore('wild', 'Farmhouse', encoreShow)).toBe(10);
    expect(calculateSlotScore('enc', 'Wilson', encoreShow)).toBe(15);
    expect(getSlotScoreBreakdown('enc', 'Wilson', encoreShow).kind).toBe('encore_exact');
  });

  it('grades a Fall 2026 night on the ladder that was live that night', () => {
    const fall = { ...encoreShow, showDate: '2026-10-11' };
    expect(scoringRulesForShowDate('2026-12-29').id).toBe('v1');
    expect(calculateSlotScore('wild', 'Farmhouse', fall)).toBe(SCORING_LADDER_V1.WILDCARD_HIT);
    expect(calculateSlotScore('enc', 'Tweezer Reprise', fall)).toBe(15);
    expect(calculateSlotScore('enc', 'Wilson', fall)).toBe(15);
    expect(calculateSlotScore('enc', 'Farmhouse', fall)).toBe(5);
    expect(calculateSlotScore('s1o', 'AC/DC Bag', fall)).toBe(10);
    expect(
      calculateSlotScore('wild', 'Farmhouse', { ...fall, bustouts: ['Farmhouse'] }),
    ).toBe(30);
    expect(
      calculateSlotScore('enc', 'Wilson', { ...fall, bustouts: ['Wilson'] }),
    ).toBe(35);
  });

  it('grades the New Year\'s Run opener and later nights on ladder v2', () => {
    const nye = { ...encoreShow, showDate: SCORING_LADDER_V2_EFFECTIVE_DATE };
    const later = { ...encoreShow, showDate: '2027-01-02' };
    for (const actual of [nye, later]) {
      expect(calculateSlotScore('wild', 'Farmhouse', actual)).toBe(5);
      expect(calculateSlotScore('enc', 'Tweezer Reprise', actual)).toBe(15);
      expect(getSlotScoreBreakdown('enc', 'Tweezer Reprise', actual).kind).toBe('encore_exact');
      expect(calculateSlotScore('enc', 'Wilson', actual)).toBe(10);
      expect(getSlotScoreBreakdown('enc', 'Wilson', actual).kind).toBe('encore_later');
      expect(calculateSlotScore('enc', 'Farmhouse', actual)).toBe(5);
      expect(calculateSlotScore('s2c', 'Harry Hood', actual)).toBe(10);
      expect(calculateSlotScore('s1c', 'Tweezer', actual)).toBe(5);
      expect(
        calculateSlotScore('wild', 'Farmhouse', { ...actual, bustouts: ['Farmhouse'] }),
      ).toBe(25);
      expect(
        calculateSlotScore('enc', 'Wilson', { ...actual, bustouts: ['Wilson'] }),
      ).toBe(30);
      expect(
        calculateSlotScore('enc', 'Tweezer Reprise', { ...actual, bustouts: ['Tweezer Reprise'] }),
      ).toBe(35);
    }
    expect(calculateTotalScore(
      { s1o: 'nope', s1c: 'nope', s2o: 'nope', s2c: 'nope', enc: 'Wilson', wild: 'Farmhouse' },
      nye,
    )).toBe(15);
  });

  it('lets an explicit show date override a stale payload date', () => {
    const stamped = { ...encoreShow, showDate: '2026-10-11' };
    expect(calculateSlotScore('wild', 'Farmhouse', stamped, '2026-12-30')).toBe(5);
    expect(calculateSlotScore('enc', 'Wilson', stamped, '2026-10-11')).toBe(15);
  });

  it('does not treat showDate as a played song', () => {
    expect(calculateSlotScore('wild', '2026-12-30', { ...encoreShow, showDate: '2026-12-30' })).toBe(0);
  });

  it('comparison rows are the two ladders, not a third list of numbers', () => {
    const rows = scoringLadderComparisonRows();
    expect(rows.find((row) => row.id === 'wildcard')).toMatchObject({
      before: SCORING_LADDER_V1.WILDCARD_HIT,
      after: SCORING_LADDER_V2.WILDCARD_HIT,
    });
    expect(rows.find((row) => row.id === 'encore_later')).toMatchObject({
      before: 15,
      after: 10,
    });
    expect(rows.find((row) => row.id === 'bustout')).toMatchObject({ before: 20, after: 20 });
  });

  it('public rules follow the New York calendar, not the show being viewed', () => {
    expect(scoringRulesInEffect(new Date('2026-12-29T23:30:00-05:00')).id).toBe('v1');
    expect(scoringRulesInEffect(new Date('2026-12-30T00:30:00-05:00')).id).toBe('v2');
    expect(SCORING_RULES).toBe(SCORING_LADDER_V1);
  });
});
