import { describe, expect, it } from 'vitest';

import {
  catalogChalkSongs,
  crowdStatsHref,
  findOpenSlotForTitle,
  picksCrowdHelperCopy,
  resolvePicksHelperMode,
  tourChalkMeta,
  tourChalkOddsLabel,
} from './picksCrowdHelper';

describe('resolvePicksHelperMode', () => {
  it('keeps live consensus off until showtime', () => {
    expect(resolvePicksHelperMode('NEXT')).toBe('chalk');
    expect(resolvePicksHelperMode('FUTURE')).toBe('chalk');
    expect(resolvePicksHelperMode(null)).toBe('chalk');
    expect(resolvePicksHelperMode('LIVE')).toBe('consensus');
    expect(resolvePicksHelperMode('PAST')).toBe('consensus');
  });
});

describe('findOpenSlotForTitle', () => {
  it('fills the first open slot and refuses a title already on the card', () => {
    expect(
      findOpenSlotForTitle({ s1o: 'Ghost', s1c: '' }, 'Tweezer')
    ).toEqual({ state: 'open', slotId: 's1c' });
    expect(
      findOpenSlotForTitle({ s1o: 'tweezer' }, 'Tweezer')
    ).toEqual({ state: 'on_card', slotId: null });
    expect(
      findOpenSlotForTitle(
        {
          s1o: 'A',
          s1c: 'B',
          s2o: 'C',
          s2c: 'D',
          enc: 'E',
          wild: 'F',
        },
        'Tweezer'
      )
    ).toEqual({ state: 'card_full', slotId: null });
  });
});

describe('tour chalk chip labels', () => {
  it('uses nights when a song spans the tour, otherwise cards', () => {
    expect(tourChalkMeta({ nights: 3, cardCount: 12 })).toBe('3 nights');
    expect(tourChalkMeta({ nights: 1, cardCount: 4 })).toBe('4 cards');
  });

  it('shows model odds only for a known play chance on this night', () => {
    const artifact = {
      targetShow: { date: '2026-12-30' },
      playProbBySong: { tweezer: 0.42 },
    };
    expect(tourChalkOddsLabel(artifact, '2026-12-30', 'Tweezer')).toBe('Odds 42%');
    expect(tourChalkOddsLabel(artifact, '2026-12-30', 'Ghost')).toBeNull();
    expect(tourChalkOddsLabel(artifact, '2026-12-31', 'Tweezer')).toBeNull();
  });
});

describe('catalogChalkSongs', () => {
  it('uses the catalog title and drops songs the card cannot save', () => {
    expect(
      catalogChalkSongs(
        [
          { title: 'tweezer', nights: 2, cardCount: 4 },
          { title: 'Not A Real Song', nights: 2, cardCount: 3 },
        ],
        [{ name: 'Tweezer' }]
      )
    ).toEqual([{ title: 'Tweezer', nights: 2, cardCount: 4 }]);
  });
});

describe('picks helper copy', () => {
  it('says slot and never chair', () => {
    const copy = picksCrowdHelperCopy().join('\n');
    expect(copy.toLowerCase()).not.toMatch(/chair/);
    expect(copy).toMatch(/slot/);
    expect(copy).toMatch(/Tonight's picks stay private until showtime/);
  });
});

describe('crowdStatsHref', () => {
  it('keeps the date picker on the selected show', () => {
    expect(crowdStatsHref('2026-12-30')).toBe(
      '/dashboard/stats/night?showDate=2026-12-30'
    );
  });
});
