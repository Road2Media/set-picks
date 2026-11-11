import { describe, expect, it } from 'vitest';

import { SCORING_RULES } from '../../../shared/utils/scoring';
import {
  mapScorecardSlotGrade,
  scorecardHitChromeSpec,
} from './mapScorecardSlotGrade';

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

describe('mapScorecardSlotGrade', () => {
  it('marks any points > 0 as a hit and keeps getSlotScoreBreakdown fields', () => {
    const exact = mapScorecardSlotGrade('s1o', 'AC/DC Bag', baseSetlist);
    expect(exact).toEqual({
      kind: 'exact_slot',
      points: SCORING_RULES.EXACT_SLOT,
      bustoutBoost: false,
      hit: true,
    });

    const inSetlist = mapScorecardSlotGrade('s1o', 'Bathtub Gin', baseSetlist);
    expect(inSetlist).toMatchObject({
      kind: 'in_setlist',
      points: SCORING_RULES.IN_SETLIST,
      hit: true,
    });

    const encore = mapScorecardSlotGrade('enc', 'Tweezer Reprise', baseSetlist);
    expect(encore).toMatchObject({
      kind: 'encore_exact',
      points: SCORING_RULES.ENCORE_EXACT,
      hit: true,
    });

    const wildcard = mapScorecardSlotGrade('wild', 'AC/DC Bag', baseSetlist);
    expect(wildcard).toMatchObject({
      kind: 'wildcard_hit',
      points: SCORING_RULES.WILDCARD_HIT,
      hit: true,
    });
  });

  it('treats misses as hit: false with no bustout overlay', () => {
    const miss = mapScorecardSlotGrade('s1o', 'You Enjoy Myself', baseSetlist);
    expect(miss).toEqual({
      kind: 'miss',
      points: 0,
      bustoutBoost: false,
      hit: false,
    });
  });

  it('adds bustoutBoost without changing kind', () => {
    const actual = { ...baseSetlist, bustouts: ["Colonel Forbin's Ascent"] };
    const graded = mapScorecardSlotGrade('s2o', "Colonel Forbin's Ascent", actual);
    expect(graded.kind).toBe('exact_slot');
    expect(graded.bustoutBoost).toBe(true);
    expect(graded.hit).toBe(true);
    expect(graded.points).toBe(SCORING_RULES.EXACT_SLOT + SCORING_RULES.BUSTOUT_BOOST);
  });
});

describe('scorecardHitChromeSpec', () => {
  it('leaves pre-grade slots unchanged (no check / ring-3 / mute)', () => {
    expect(scorecardHitChromeSpec(null)).toEqual({
      showCheck: false,
      titleTone: 'default',
      ringTone: null,
      checkTone: null,
      titleMute: false,
      bustoutAccent: false,
    });
  });

  it('uses A5 check + primary ring-3 for exact / encore / wildcard hits', () => {
    for (const kind of ['exact_slot', 'encore_exact', 'wildcard_hit']) {
      expect(scorecardHitChromeSpec({ kind, hit: true, bustoutBoost: false })).toEqual({
        showCheck: true,
        titleTone: 'primary',
        ringTone: 'primary',
        checkTone: 'primary',
        titleMute: false,
        bustoutAccent: false,
      });
    }
  });

  it('uses accent-blue chrome for in_setlist hits', () => {
    expect(scorecardHitChromeSpec({ kind: 'in_setlist', hit: true, bustoutBoost: false })).toEqual({
      showCheck: true,
      titleTone: 'in_setlist',
      ringTone: 'in_setlist',
      checkTone: 'in_setlist',
      titleMute: false,
      bustoutAccent: false,
    });
  });

  it('mutes misses without check or ring-3', () => {
    expect(scorecardHitChromeSpec({ kind: 'miss', hit: false, bustoutBoost: false })).toEqual({
      showCheck: false,
      titleTone: 'miss',
      ringTone: null,
      checkTone: null,
      titleMute: true,
      bustoutAccent: false,
    });
  });

  it('overlays amber on the check/ring when bustoutBoost is set', () => {
    expect(
      scorecardHitChromeSpec({ kind: 'exact_slot', hit: true, bustoutBoost: true }),
    ).toEqual({
      showCheck: true,
      titleTone: 'primary',
      ringTone: 'amber',
      checkTone: 'amber',
      titleMute: false,
      bustoutAccent: true,
    });
    expect(
      scorecardHitChromeSpec({ kind: 'in_setlist', hit: true, bustoutBoost: true }),
    ).toMatchObject({
      titleTone: 'in_setlist',
      ringTone: 'amber',
      checkTone: 'amber',
      bustoutAccent: true,
    });
  });
});
