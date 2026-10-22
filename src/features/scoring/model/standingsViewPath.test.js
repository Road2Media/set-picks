import { describe, expect, it } from 'vitest';

import { buildStandingsViewPath } from './standingsViewPath';

describe('buildStandingsViewPath', () => {
  it('builds the canonical Show path with no query', () => {
    expect(buildStandingsViewPath('show')).toBe('/dashboard/standings');
  });

  it('builds Tour with optional tour key', () => {
    expect(buildStandingsViewPath('tour')).toBe('/dashboard/standings?view=tour');
    expect(buildStandingsViewPath('tour', { tourKey: 'Summer 2026' })).toBe(
      '/dashboard/standings?view=tour&tour=Summer+2026',
    );
  });

  it('builds Year with optional calendar year (#1110)', () => {
    expect(buildStandingsViewPath('year')).toBe('/dashboard/standings?view=year');
    expect(buildStandingsViewPath('year', { yearKey: '2026' })).toBe(
      '/dashboard/standings?view=year&year=2026',
    );
    expect(buildStandingsViewPath('year', { yearKey: '26' })).toBe(
      '/dashboard/standings?view=year',
    );
  });

  it('builds Pools with optional pool id', () => {
    expect(buildStandingsViewPath('pools')).toBe('/dashboard/standings?view=pools');
    expect(buildStandingsViewPath('pools', { poolId: 'abc' })).toBe(
      '/dashboard/standings?view=pools&pool=abc',
    );
  });

  it('does not own a Stats path (#769)', () => {
    expect(buildStandingsViewPath('stats')).toBe('/dashboard/standings');
  });

  it('ignores blank tour / pool keys', () => {
    expect(buildStandingsViewPath('pools', { poolId: '' })).toBe(
      '/dashboard/standings?view=pools',
    );
  });
});
