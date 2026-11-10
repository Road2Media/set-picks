import { describe, expect, it } from 'vitest';

import {
  crowdSongKey,
  selectScorecardCrowdShare,
} from './selectScorecardCrowdShare';

describe('selectScorecardCrowdShare', () => {
  const docs = [
    { picks: { s1o: 'Tweezer', s1c: 'Ghost' } },
    { picks: { s1o: 'Tweezer' } },
    { picks: { s2o: 'You Enjoy Myself' } },
    { picks: { wild: 'Tweezer' } },
  ];

  it('uses the night aggregate share of cards, including other slots', () => {
    const rows = selectScorecardCrowdShare(docs, {
      s1o: 'Tweezer',
      s1c: 'Ghost',
      s2o: 'You Enjoy Myself',
    });
    const byId = Object.fromEntries((rows || []).map((row) => [row.fieldId, row]));

    expect(byId.s1o.label).toBe('75%');
    expect(byId.s1o.cardCount).toBe(3);
    expect(byId.s1c.label).toBe('25%');
    expect(byId.s2o.label).toBe('25%');
  });

  it('matches the crowd title key, not a collapsed-space key', () => {
    expect(crowdSongKey('  Tweezer ')).toBe('tweezer');
    const rows = selectScorecardCrowdShare(
      [{ picks: { s1o: 'Tweezer' } }, { picks: { s1o: 'tweezer' } }],
      { s1o: 'TWEEZER' },
    );
    expect(rows?.[0].label).toBe('100%');
  });

  it('returns null when the audience has no submitted cards', () => {
    expect(selectScorecardCrowdShare([], { s1o: 'Tweezer' })).toBeNull();
    expect(selectScorecardCrowdShare(null, { s1o: 'Tweezer' })).toBeNull();
    expect(
      selectScorecardCrowdShare([{ picks: { s1o: 'Ghost' } }], { s1o: '' }),
    ).toBeNull();
  });
});
