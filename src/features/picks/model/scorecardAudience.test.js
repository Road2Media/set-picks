import { describe, expect, it } from 'vitest';

import {
  resolveScorecardAudience,
  scorecardAudienceOptions,
  scorecardPoolExcludesNight,
  scorecardStandingsHref,
} from './scorecardAudience';

const pools = [
  { id: 'pool-b', name: 'Bravo' },
  { id: 'pool-a', name: 'Alpha' },
];

describe('resolveScorecardAudience', () => {
  it('defaults to everyone', () => {
    expect(resolveScorecardAudience('', pools)).toMatchObject({
      id: 'global',
      name: 'Everyone',
      pool: null,
      invalid: false,
    });
    expect(resolveScorecardAudience(null, null).id).toBe('global');
  });

  it('accepts one of the player pools and rejects the rest', () => {
    expect(resolveScorecardAudience('pool-a', pools)).toMatchObject({
      id: 'pool-a',
      name: 'Alpha',
      invalid: false,
    });
    expect(resolveScorecardAudience('missing', pools).invalid).toBe(true);
    expect(resolveScorecardAudience('missing', pools).id).toBe('global');
  });
});

describe('scorecardAudienceOptions', () => {
  it('leads with Everyone and sorts pools by name', () => {
    expect(scorecardAudienceOptions(pools)).toEqual([
      { id: 'global', name: 'Everyone' },
      { id: 'pool-a', name: 'Alpha' },
      { id: 'pool-b', name: 'Bravo' },
    ]);
    expect(scorecardAudienceOptions([])).toEqual([{ id: 'global', name: 'Everyone' }]);
  });
});

describe('scorecardPoolExcludesNight', () => {
  const globalPicks = [{ userId: 'me' }, { userId: 'a' }];

  it('is false for the global audience and when the player is in the pool list', () => {
    expect(scorecardPoolExcludesNight(globalPicks, globalPicks, 'me', 'global')).toBe(
      false,
    );
    expect(
      scorecardPoolExcludesNight(globalPicks, [{ userId: 'me' }], 'me', 'pool-a'),
    ).toBe(false);
  });

  it('is true when the global night includes the player and the pool list does not', () => {
    expect(
      scorecardPoolExcludesNight(globalPicks, [{ userId: 'a' }], 'me', 'pool-a'),
    ).toBe(true);
    expect(scorecardPoolExcludesNight([], [], 'me', 'pool-a')).toBe(false);
  });
});

describe('scorecardStandingsHref', () => {
  it('keeps the show on the global board and opens the pool board when scoped', () => {
    expect(scorecardStandingsHref('2026-07-19', 'global')).toBe(
      '/dashboard/standings?showDate=2026-07-19',
    );
    expect(scorecardStandingsHref('2026-07-19', 'pool-a')).toBe(
      '/dashboard/standings?showDate=2026-07-19&view=pools&pool=pool-a',
    );
    expect(scorecardStandingsHref('', 'global')).toBe('/dashboard/standings');
  });
});
