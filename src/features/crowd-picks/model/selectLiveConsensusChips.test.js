import { describe, expect, it } from 'vitest';

import {
  formatCrowdShare,
  selectLiveConsensusChips,
} from './selectLiveConsensusChips';

describe('selectLiveConsensusChips', () => {
  it('keeps consensus songs, consensus slot favorites, and numeric gaps', () => {
    const chips = selectLiveConsensusChips(
      {
        consensus: [
          { title: 'Tweezer', cardCount: 8, pctOfPickers: 53 },
          { title: '  ', cardCount: 4, pctOfPickers: 26 },
        ],
        bySlot: [
          {
            slotId: 's1o',
            label: 'Set 1 Opener',
            title: 'Tweezer',
            count: 4,
            pctOfPickers: 26.7,
          },
          {
            slotId: 's1c',
            label: 'Set 1 Closer',
            title: 'Ghost',
            count: 2,
            pctOfPickers: 13,
          },
          {
            slotId: 'wild',
            label: 'Wildcard',
            title: null,
            count: 0,
            pctOfPickers: 0,
          },
        ],
      },
      [
        { title: 'Hood', gap: 40, cardCount: 2 },
        { title: 'Unknown', gap: null, cardCount: 3 },
        { title: 'YEM', gap: 12, cardCount: 2 },
      ]
    );

    expect(chips.songs).toEqual([
      { title: 'Tweezer', cardCount: 8, pctOfPickers: 53 },
    ]);
    expect(chips.slots.map((row) => row.slotId)).toEqual(['s1o']);
    expect(chips.gaps.map((row) => row.title)).toEqual(['Hood', 'YEM']);
  });

  it('returns empty groups for a missing dive', () => {
    expect(selectLiveConsensusChips(null, null)).toEqual({
      songs: [],
      slots: [],
      gaps: [],
    });
  });
});

describe('formatCrowdShare', () => {
  it('prints a whole percent or one decimal', () => {
    expect(formatCrowdShare(53)).toBe('53%');
    expect(formatCrowdShare(26.66)).toBe('26.7%');
    expect(formatCrowdShare(null)).toBe('');
  });
});
