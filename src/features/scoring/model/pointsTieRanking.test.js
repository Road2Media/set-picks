import { describe, expect, it } from 'vitest';

import {
  LIVE_RANK_POLICY,
  RANK_POLICIES,
  comparatorsForSurface,
  rankScoredRows,
} from './pointsTieRanking.js';

const BOARD = [
  { uid: 'c', handle: 'Cara', points: 10, exactHits: 1, correctPicks: 2, wins: 0 },
  { uid: 'a', handle: 'Ada', points: 10, exactHits: 2, correctPicks: 2, wins: 1 },
  { uid: 'b', handle: 'Bea', points: 10, exactHits: 2, correctPicks: 4, wins: 3 },
  { uid: 'd', handle: 'Dee', points: 4, exactHits: 0, correctPicks: 1, wins: 1 },
];

function order(result) {
  return result.rows.map((row) => row.handle);
}

function ranks(result) {
  return result.rows.map((row) => row.rank);
}

describe('rankScoredRows', () => {
  it('returns an empty result for an empty list and a sole rank for one player', () => {
    expect(rankScoredRows(null).rows).toEqual([]);
    expect(rankScoredRows([]).unresolvedTieCount).toBe(0);
    expect(rankScoredRows(undefined, { policy: RANK_POLICIES.SHARED }).rows).toEqual([]);

    const solo = rankScoredRows([{ uid: 'a', handle: 'Ada', points: 8 }]);
    expect(solo.rows).toHaveLength(1);
    expect(solo.rows[0]).toMatchObject({
      rank: 1,
      displayOrder: 0,
      orderInTie: 0,
      tiedCount: 1,
      tiedHandles: [],
    });
    expect(solo.rows[0].tieBreak).toMatchObject({
      pointsTiedWith: 1,
      decisive: null,
      stillTied: false,
    });
    expect(solo.unresolvedTieCount).toBe(0);
  });

  it('uses full tie-break as the live policy', () => {
    expect(LIVE_RANK_POLICY).toBe(RANK_POLICIES.FULL);
    const result = rankScoredRows(BOARD);
    expect(result.policy).toBe(RANK_POLICIES.FULL);
    expect(order(result)).toEqual(['Bea', 'Ada', 'Cara', 'Dee']);
    expect(ranks(result)).toEqual([1, 2, 3, 4]);
    expect(result.unresolvedTieCount).toBe(0);
    const ada = result.rows.find((row) => row.handle === 'Ada');
    expect(ada.tieBreak.decisive).toBe('correctPicks');
    expect(ada.tieBreak.stillTied).toBe(false);
    expect(ada.tieBreak.pointsTiedWith).toBe(3);
    expect(ada.tiedCount).toBe(1);
  });

  it('keeps shared ranks and does not let the cascade reorder them', () => {
    const result = rankScoredRows(BOARD, { policy: RANK_POLICIES.SHARED, surface: 'tour' });
    expect(order(result)).toEqual(['Ada', 'Bea', 'Cara', 'Dee']);
    expect(ranks(result)).toEqual([1, 1, 1, 4]);
    expect(result.rows[0].tiedCount).toBe(3);
    expect(result.rows[0].tiedHandles).toEqual(['Bea', 'Cara']);
    expect(result.rows[0].tieBreak.decisive).toBeNull();
    expect(result.rows[1].orderInTie).toBe(1);
    expect(result.unresolvedTieCount).toBe(1);
  });

  it('sorts inside a shared rank with the named cascade and does not change the numbers', () => {
    const result = rankScoredRows(BOARD, {
      policy: RANK_POLICIES.SHARED_DISPLAY,
      surface: 'tour',
    });
    expect(order(result)).toEqual(['Bea', 'Ada', 'Cara', 'Dee']);
    expect(ranks(result)).toEqual([1, 1, 1, 4]);
    expect(result.rows[1].tieBreak.decisive).toBe('correctPicks');
    expect(result.rows[1].rank).toBe(1);
    expect(result.rows[2].tieBreak.decisive).toBe('exactHits');
  });

  it('breaks a multi-way tie one step at a time and records which step did it', () => {
    const result = rankScoredRows(
      [
        { uid: 'low', handle: 'Low', points: 20, exactHits: 0, correctPicks: 6, wins: 4 },
        { uid: 'mid', handle: 'Mid', points: 20, exactHits: 3, correctPicks: 3, wins: 0 },
        { uid: 'top', handle: 'Top', points: 20, exactHits: 3, correctPicks: 5, wins: 0 },
        { uid: 'tail', handle: 'Tail', points: 19, exactHits: 4, correctPicks: 6, wins: 9 },
      ],
      { surface: 'tour' },
    );
    expect(order(result)).toEqual(['Top', 'Mid', 'Low', 'Tail']);
    expect(ranks(result)).toEqual([1, 2, 3, 4]);
    expect(result.rows[1].tieBreak.decisive).toBe('correctPicks');
    expect(result.rows[2].tieBreak.decisive).toBe('exactHits');
    expect(result.rows[3].tieBreak.decisive).toBeNull();
    expect(result.rows[3].tieBreak.pointsTiedWith).toBe(1);
  });

  it('lets a tie that survives the cascade share a rank, in a stable order', () => {
    const rows = [
      { uid: 'b', handle: 'Same', points: 10, exactHits: 1, correctPicks: 2, wins: 1 },
      { uid: 'a', handle: 'Same', points: 10, exactHits: 1, correctPicks: 2, wins: 1 },
    ];
    const first = rankScoredRows(rows, { surface: 'tour' });
    const second = rankScoredRows([...rows].reverse(), { surface: 'tour' });
    expect(first.rows.map((row) => row.uid)).toEqual(['a', 'b']);
    expect(second.rows.map((row) => row.uid)).toEqual(['a', 'b']);
    expect(ranks(first)).toEqual([1, 1]);
    expect(first.unresolvedTieCount).toBe(1);
    expect(first.rows[0].tiedHandles).toEqual(['Same']);
    expect(first.rows[1].tieBreak.stillTied).toBe(true);
    expect(first.rows[1].tieBreak.decisive).toBeNull();
  });

  it('does not shuffle when the input order changes', () => {
    const shuffled = [BOARD[2], BOARD[3], BOARD[0], BOARD[1]];
    expect(order(rankScoredRows(shuffled))).toEqual(order(rankScoredRows(BOARD)));
    expect(ranks(rankScoredRows(shuffled))).toEqual(ranks(rankScoredRows(BOARD)));
  });

  it('skips nightly wins on a show and uses them on a tour', () => {
    const rows = [
      { uid: 'a', handle: 'Ada', points: 10, exactHits: 1, correctPicks: 2, wins: 0 },
      { uid: 'b', handle: 'Bea', points: 10, exactHits: 1, correctPicks: 2, wins: 3 },
    ];
    const show = rankScoredRows(rows, { surface: 'show' });
    expect(order(show)).toEqual(['Ada', 'Bea']);
    expect(show.rows[0].tieBreak.decisive).toBeNull();
    expect(show.rows[1].tieBreak.decisive).toBe('username');
    expect(show.rows[0].tieBreak.steps.map((step) => step.id)).toEqual([
      'exactHits',
      'correctPicks',
      'username',
    ]);

    const tour = rankScoredRows(rows, { surface: 'tour' });
    expect(order(tour)).toEqual(['Bea', 'Ada']);
    expect(tour.rows[1].tieBreak.decisive).toBe('nightlyWins');
    expect(comparatorsForSurface('year').map((step) => step.id)).toEqual(
      comparatorsForSurface('tour').map((step) => step.id),
    );
  });

  it('ranks a higher point total ahead of a better card', () => {
    const result = rankScoredRows([
      { uid: 'a', handle: 'Ada', points: 5, exactHits: 3, correctPicks: 6, wins: 4 },
      { uid: 'b', handle: 'Bea', points: 6, exactHits: 0, correctPicks: 1, wins: 0 },
    ]);
    expect(order(result)).toEqual(['Bea', 'Ada']);
    expect(ranks(result)).toEqual([1, 2]);
    expect(result.rows[1].tieBreak.pointsTiedWith).toBe(1);
  });

  it('accepts a caller-supplied comparator without a surface rewrite', () => {
    const streak = {
      id: 'streak',
      label: 'Streak',
      read: (row) => (typeof row.streak === 'number' ? row.streak : 0),
      compare: (a, b) => (a === b ? 0 : a > b ? -1 : 1),
    };
    const result = rankScoredRows(
      [
        { uid: 'a', handle: 'Ada', points: 10, streak: 1 },
        { uid: 'b', handle: 'Bea', points: 10, streak: 4 },
      ],
      { policy: RANK_POLICIES.FULL, comparators: [streak] },
    );
    expect(order(result)).toEqual(['Bea', 'Ada']);
    expect(result.rows[1].tieBreak.decisive).toBe('streak');
    expect(ranks(result)).toEqual([1, 2]);
  });
});
