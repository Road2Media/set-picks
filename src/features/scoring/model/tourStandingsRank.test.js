import { describe, expect, it } from 'vitest';

import { SHOW_STANDINGS_DESCRIPTION } from '../../../shared/config/dashboardVocabulary';
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
  it('breaks the Fall Tour points tie by nightly wins, then handle', () => {
    const board = assignTourDisplayRanks(FALL_TOUR_BOARD);
    const byUid = Object.fromEntries(board.map((row) => [row.uid, row]));

    expect(board.map((row) => row.handle)).toEqual([
      'I have the book',
      'YarmouthMeg',
      'HotDog Billy',
      'ArmenianMan',
      'TheManMulcahy',
      'Jeff',
    ]);
    expect(byUid.billy).toMatchObject({ rank: 3, tiedCount: 1, tiedHandles: [] });
    expect(byUid.arm).toMatchObject({ rank: 4, tiedCount: 1 });
    expect(byUid.mul).toMatchObject({ rank: 5, tiedCount: 1 });
    expect(byUid.jeff.rank).toBe(6);
    expect(byUid.book).toMatchObject({ rank: 1, tiedCount: 1, tiedHandles: [] });
    expect(byUid.arm.tieBreak.decisive).toBe('nightlyWins');
    expect(byUid.mul.tieBreak.decisive).toBe('username');
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
      tiedCount: 1,
      tiedHandles: [],
    });
    expect(rows.find((row) => row.uid === 'zoe')).toMatchObject({
      totalPoints: 85,
      wins: 1,
      shows: 2,
      rank: 2,
      tiedHandles: [],
    });
    expect(rows.find((row) => row.uid === 'zoe').tieBreak.decisive).toBe('username');
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
      tied: false,
      ariaLabel: 'Rank 3',
    });
    expect(tourStandingsBadge(jeff)).toEqual({
      text: '6',
      tied: false,
      ariaLabel: 'Rank 6',
    });
  });

  it('marks a tie only when the cascade does not separate the rows', () => {
    const board = assignTourDisplayRanks([
      { uid: 'a', handle: 'Ada', totalPoints: 10, exactHits: 1, correctPicks: 1, wins: 1 },
      { uid: 'b', handle: 'Ada', totalPoints: 10, exactHits: 1, correctPicks: 1, wins: 1 },
    ]);
    expect(tourStandingsBadge(board[0])).toMatchObject({
      tied: true,
      ariaLabel: 'Tied for rank 1',
    });
  });
});

describe('show standings description', () => {
  it('names the night and skips the ranking essay', () => {
    expect(SHOW_STANDINGS_DESCRIPTION).toBe('Points from this show.');
    expect(SHOW_STANDINGS_DESCRIPTION).not.toMatch(/chair/i);
    expect(SHOW_STANDINGS_DESCRIPTION).not.toMatch(/tie/i);
  });
});
