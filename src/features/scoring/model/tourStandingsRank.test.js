import { describe, expect, it } from 'vitest';

import { TOUR_STANDINGS_DESCRIPTION } from '../../../shared/config/dashboardVocabulary';
import { aggregateTourStandings } from './aggregateTourStandings';
import { assignTourDisplayRanks, tourStandingsBadge } from './tourStandingsRank';

const graded = (overrides) => ({
  isGraded: true,
  picks: { s1: 'Tweezer' },
  ...overrides,
});

/**
 * 2026 Fall Tour board from docs/TOUR_RANKINGS.md, already in list order.
 * Billy is first among 85 points because he has more nightly wins.
 * ArmenianMan precedes TheManMulcahy by handle. Jeff is the next points total.
 */
const FALL_TOUR_BOARD = [
  { uid: 'book', handle: 'I have the book', totalPoints: 115, wins: 3, shows: 8 },
  { uid: 'meg', handle: 'YarmouthMeg', totalPoints: 90, wins: 0, shows: 8 },
  { uid: 'billy', handle: 'HotDog Billy', totalPoints: 85, wins: 2, shows: 7 },
  { uid: 'arm', handle: 'ArmenianMan', totalPoints: 85, wins: 1, shows: 8 },
  { uid: 'mul', handle: 'TheManMulcahy', totalPoints: 85, wins: 1, shows: 7 },
  { uid: 'jeff', handle: 'Jeff', totalPoints: 80, wins: 1, shows: 8 },
];

describe('assignTourDisplayRanks', () => {
  it('shares rank 3 on the Fall Tour points tie and skips to 6', () => {
    const board = assignTourDisplayRanks(FALL_TOUR_BOARD);
    const byUid = Object.fromEntries(board.map((row) => [row.uid, row]));

    expect(board.map((row) => row.handle)).toEqual(FALL_TOUR_BOARD.map((row) => row.handle));
    expect(byUid.billy).toMatchObject({ rank: 3, tiedCount: 3 });
    expect(byUid.arm).toMatchObject({ rank: 3, tiedCount: 3 });
    expect(byUid.mul).toMatchObject({ rank: 3, tiedCount: 3 });
    expect(byUid.jeff.rank).toBe(6);
    expect(byUid.book).toMatchObject({ rank: 1, tiedCount: 1, tiedHandles: [] });
    expect(byUid.billy.tiedHandles).toEqual(['ArmenianMan', 'TheManMulcahy']);
    expect(byUid.arm.tiedHandles).toEqual(['HotDog Billy', 'TheManMulcahy']);
    expect(byUid.mul.tiedHandles).toEqual(['HotDog Billy', 'ArmenianMan']);
  });

  it('does not let shows played reorder a tie', () => {
    const rows = aggregateTourStandings([
      {
        date: '2026-10-01',
        picks: [
          graded({ userId: 'amy', handle: 'Amy', score: 85 }),
          graded({ userId: 'zoe', handle: 'Zoe', score: 85 }),
          graded({ userId: 'jeff', handle: 'Jeff', score: 40 }),
        ],
      },
      {
        date: '2026-10-02',
        picks: [
          graded({ userId: 'zoe', handle: 'Zoe', score: 0 }),
          graded({ userId: 'jeff', handle: 'Jeff', score: 40 }),
        ],
      },
    ]);

    expect(rows.map((row) => row.handle)).toEqual(['Amy', 'Zoe', 'Jeff']);
    expect(rows.find((row) => row.uid === 'amy')).toMatchObject({
      totalPoints: 85,
      wins: 1,
      shows: 1,
      rank: 1,
      tiedCount: 2,
      tiedHandles: ['Zoe'],
    });
    expect(rows.find((row) => row.uid === 'zoe')).toMatchObject({
      totalPoints: 85,
      wins: 1,
      shows: 2,
      rank: 1,
      tiedHandles: ['Amy'],
    });
    expect(rows.find((row) => row.uid === 'jeff').rank).toBe(3);
  });
});

describe('tourStandingsBadge', () => {
  it('marks a shared rank and leaves a sole rank unmarked', () => {
    const board = assignTourDisplayRanks(FALL_TOUR_BOARD);
    const billy = board.find((row) => row.uid === 'billy');
    const jeff = board.find((row) => row.uid === 'jeff');

    expect(tourStandingsBadge(billy)).toEqual({
      text: '3',
      tied: true,
      ariaLabel: 'Tied for rank 3',
    });
    expect(tourStandingsBadge(jeff)).toEqual({
      text: '6',
      tied: false,
      ariaLabel: 'Rank 6',
    });
  });
});

describe('tour standings description', () => {
  it('states the shared-rank rule', () => {
    expect(TOUR_STANDINGS_DESCRIPTION).toMatch(/same points share a rank/i);
    expect(TOUR_STANDINGS_DESCRIPTION).toMatch(/next rank skips/i);
  });
});
