import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STANDINGS_VIEW,
  STANDINGS_PATH_VIEWS,
  STANDINGS_VIEWS,
  deriveDefaultPoolId,
  deriveStandingsView,
  normalizeView,
} from './useStandingsView';

describe('normalizeView', () => {
  it('returns known path views verbatim', () => {
    for (const v of STANDINGS_PATH_VIEWS) {
      expect(normalizeView(v)).toBe(v);
    }
  });

  it('does not treat Stats as a standings view (#769)', () => {
    expect(STANDINGS_VIEWS).not.toContain('stats');
    expect(STANDINGS_VIEWS).toEqual(STANDINGS_PATH_VIEWS);
    expect(normalizeView('stats')).toBe(DEFAULT_STANDINGS_VIEW);
  });

  it.each([
    null,
    undefined,
    '',
    'season',
    'picks',
    'POOLS',
    42,
    true,
    {},
  ])('falls back to the default view for %p', (input) => {
    expect(normalizeView(input)).toBe(DEFAULT_STANDINGS_VIEW);
  });
});

describe('deriveStandingsView', () => {
  const pools = [
    { id: 'pool-a', name: 'A' },
    { id: 'pool-b', name: 'B' },
  ];

  it('defaults to the Show view when no query is present', () => {
    expect(deriveStandingsView({}, pools)).toEqual({
      view: 'show',
      poolId: null,
    });
  });

  it('preserves a known view when valid', () => {
    expect(deriveStandingsView({ view: 'tour' }, pools)).toEqual({
      view: 'tour',
      poolId: null,
    });
    expect(deriveStandingsView({ view: 'year' }, pools)).toEqual({
      view: 'year',
      poolId: null,
    });
  });

  it('falls back to Show for an unknown view', () => {
    expect(deriveStandingsView({ view: 'season' }, pools)).toEqual({
      view: 'show',
      poolId: null,
    });
  });

  it('ignores pool when the view is not Pools', () => {
    expect(deriveStandingsView({ view: 'show', pool: 'pool-a' }, pools)).toEqual({
      view: 'show',
      poolId: null,
    });
    expect(deriveStandingsView({ view: 'tour', pool: 'pool-a' }, pools)).toEqual({
      view: 'tour',
      poolId: null,
    });
    expect(deriveStandingsView({ view: 'year', pool: 'pool-a' }, pools)).toEqual({
      view: 'year',
      poolId: null,
    });
  });

  it('keeps the Pools view with a matching pool id', () => {
    expect(
      deriveStandingsView({ view: 'pools', pool: 'pool-b' }, pools),
    ).toEqual({ view: 'pools', poolId: 'pool-b' });
  });

  it('drops unknown pool ids but keeps the Pools view (picker will show)', () => {
    expect(
      deriveStandingsView({ view: 'pools', pool: 'ghost' }, pools),
    ).toEqual({ view: 'pools', poolId: null });
  });

  it('handles null / empty userPools without throwing', () => {
    expect(deriveStandingsView({ view: 'pools', pool: 'x' }, null)).toEqual({
      view: 'pools',
      poolId: null,
    });
    expect(deriveStandingsView({ view: 'pools', pool: 'x' }, [])).toEqual({
      view: 'pools',
      poolId: null,
    });
  });

  it('tolerates malformed pool entries', () => {
    expect(
      deriveStandingsView(
        { view: 'pools', pool: 'pool-a' },
        [null, undefined, { id: null }, { id: 'pool-a' }],
      ),
    ).toEqual({ view: 'pools', poolId: 'pool-a' });
  });
});

describe('deriveDefaultPoolId', () => {
  const pools = [
    { id: 'pool-a', name: 'A' },
    { id: 'pool-b', name: 'B' },
  ];

  it('prefers the recent pool when still present', () => {
    expect(deriveDefaultPoolId(pools, 'pool-b')).toBe('pool-b');
  });

  it('falls back to first pool when recent pool is missing', () => {
    expect(deriveDefaultPoolId(pools, 'ghost')).toBe('pool-a');
  });

  it('returns null when there are no pools', () => {
    expect(deriveDefaultPoolId([], 'pool-a')).toBeNull();
    expect(deriveDefaultPoolId(null, 'pool-a')).toBeNull();
  });

  it('ignores malformed pool rows', () => {
    expect(deriveDefaultPoolId([null, { id: null }, { id: 'pool-z' }], 'pool-a')).toBe(
      'pool-z',
    );
  });
});
