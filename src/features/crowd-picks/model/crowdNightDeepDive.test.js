import { describe, expect, it } from 'vitest';

import {
  aggregateBySlotFavorites,
  buildCrowdNightDeepDive,
  compareCrowdSlotHits,
  crowdSlotSurpriseCopy,
  selectConsensusSongs,
} from './crowdNightDeepDive';

describe('selectConsensusSongs', () => {
  it('keeps a song at 25% or on 3 cards', () => {
    const songs = [
      { title: 'Sample', cardCount: 2, pctOfPickers: 50 },
      { title: 'Bug', cardCount: 3, pctOfPickers: 15 },
      { title: 'Tube', cardCount: 2, pctOfPickers: 10 },
    ];
    expect(selectConsensusSongs(songs).map((row) => row.title)).toEqual([
      'Sample',
      'Bug',
    ]);
  });
});

describe('aggregateBySlotFavorites', () => {
  const docs = [
    { picks: { s1o: 'Tweezer', s1c: 'Gin', wild: 'Free' } },
    { picks: { s1o: 'Tweezer', s1c: 'Hood', wild: 'Ghost' } },
    { picks: { s1o: 'Sample', s1c: 'Gin', wild: '  ' } },
    { picks: { s1o: '  ' } },
  ];

  it('picks the most common title per slot and breaks ties by title', () => {
    const rows = aggregateBySlotFavorites(docs, 3);
    const opener = rows.find((row) => row.slotId === 's1o');
    const closer = rows.find((row) => row.slotId === 's1c');
    const wild = rows.find((row) => row.slotId === 'wild');
    expect(opener).toMatchObject({ title: 'Tweezer', count: 2, pctOfPickers: 66.7 });
    expect(closer).toMatchObject({ title: 'Gin', count: 2 });
    expect(wild?.title).toBe('Free');
    expect(rows.find((row) => row.slotId === 's2o')?.title).toBeNull();
  });
});

describe('compareCrowdSlotHits', () => {
  const favorites = [
    { slotId: 's1o', label: 'Set 1 Opener', title: 'Tweezer' },
    { slotId: 's1c', label: 'Set 1 Closer', title: 'Gin' },
    { slotId: 's2o', label: 'Set 2 Opener', title: 'Ghost' },
    { slotId: 's2c', label: 'Set 2 Closer', title: null },
    { slotId: 'enc', label: 'Encore', title: 'Zero' },
    { slotId: 'wild', label: 'Wildcard', title: 'Secret Song' },
  ];

  it('counts exact slot matches and omits the official title on a miss', () => {
    const result = compareCrowdSlotHits(favorites, {
      s1o: 'Tweezer',
      s1c: 'Secret Song',
      s2o: 'Ghost',
      enc: 'zero',
      officialSetlist: ['Secret Song', 'Also Played', 'Not A Call'],
      wild: 'Secret Song',
    });
    expect(result.hits).toBe(3);
    expect(result.compared).toBe(4);
    expect(result.pending).toBe(1);
    expect(result.rows.map((row) => row.slotId)).toEqual([
      's1o',
      's1c',
      's2o',
      'enc',
    ]);
    expect(result.rows.find((row) => row.slotId === 's1c')).toEqual({
      slotId: 's1c',
      label: 'Set 1 Closer',
      crowdTitle: 'Gin',
      hit: false,
    });
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain('Secret Song');
    expect(encoded).not.toContain('Also Played');
    expect(encoded).not.toContain('officialSetlist');
  });

  it('frames a low hit rate as a surprise without naming misses', () => {
    expect(crowdSlotSurpriseCopy({ hits: 0, compared: 5 })).toMatch(/another way/);
    expect(crowdSlotSurpriseCopy({ hits: 1, compared: 5 })).toMatch(/Mostly a surprise/);
    expect(crowdSlotSurpriseCopy({ hits: 4, compared: 5 })).toBe(
      "The room's favorite slot calls matched 4 of 5."
    );
    expect(crowdSlotSurpriseCopy({ hits: 0, compared: 0 })).toBe('');
  });
});

describe('buildCrowdNightDeepDive', () => {
  it('joins consensus, slot favorites, and the post-show comparison', () => {
    const dive = buildCrowdNightDeepDive({
      pickers: 2,
      songs: [{ title: 'Tweezer', cardCount: 2, pctOfPickers: 100 }],
      submittedDocs: [
        { picks: { s1o: 'Tweezer', enc: 'Zero' } },
        { picks: { s1o: 'Tweezer', enc: 'Zero' } },
      ],
      actualSetlist: { s1o: 'Tweezer', enc: 'Hood' },
    });
    expect(dive.consensus).toHaveLength(1);
    expect(dive.bySlot.find((row) => row.slotId === 's1o')?.title).toBe('Tweezer');
    expect(dive.slotHit.hits).toBe(1);
    expect(dive.slotHit.compared).toBe(2);
  });
});
