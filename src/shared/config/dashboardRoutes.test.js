import { describe, expect, it } from 'vitest';

import {
  PICKS_CLUSTER_PATHS,
  POOLS_CLUSTER_PATHS,
  STATS_CLUSTER_PATHS,
  isMakePicksPath,
  isPicksClusterPath,
  isPersonalStatsPath,
  isGlobalStatsPath,
  isPoolsClusterPath,
  isPoolsTertiaryPath,
  isProfileClusterPath,
  isStatsClusterPath,
  isStatsQuaternaryPath,
  isStatsTourScopedPath,
} from './dashboardRoutes';

describe('isPicksClusterPath', () => {
  it('treats /dashboard and /dashboard/picks as the cluster', () => {
    expect(isPicksClusterPath('/dashboard')).toBe(true);
    expect(isPicksClusterPath('/dashboard/')).toBe(true);
    expect(isPicksClusterPath('/dashboard/picks')).toBe(true);
    expect(isPicksClusterPath('/dashboard/picks/')).toBe(true);
  });

  it('includes Lab, Scorecard, and Rewind nested routes', () => {
    expect(isPicksClusterPath(PICKS_CLUSTER_PATHS.lab)).toBe(true);
    expect(isPicksClusterPath(`${PICKS_CLUSTER_PATHS.lab}/`)).toBe(true);
    expect(isPicksClusterPath(PICKS_CLUSTER_PATHS.scorecard)).toBe(true);
    expect(isPicksClusterPath(PICKS_CLUSTER_PATHS.rewind)).toBe(true);
  });

  it('does not match sibling primary tabs', () => {
    expect(isPicksClusterPath('/dashboard/pools')).toBe(false);
    expect(isPicksClusterPath('/dashboard/standings')).toBe(false);
    expect(isPicksClusterPath('/dashboard/profile')).toBe(false);
    expect(isPicksClusterPath('/dashboard/tour-stats')).toBe(false);
    expect(isPicksClusterPath('/dashboard/stats')).toBe(false);
    expect(isPicksClusterPath('/dashboard/stats/global')).toBe(false);
  });
});

describe('isMakePicksPath', () => {
  it('is true only for the Make Picks form destinations', () => {
    expect(isMakePicksPath('/dashboard')).toBe(true);
    expect(isMakePicksPath('/dashboard/picks')).toBe(true);
    expect(isMakePicksPath(PICKS_CLUSTER_PATHS.lab)).toBe(false);
    expect(isMakePicksPath(PICKS_CLUSTER_PATHS.scorecard)).toBe(false);
  });
});

describe('isPoolsClusterPath / isPoolsTertiaryPath (#768)', () => {
  it('treats My / Create / Join as tertiary + cluster', () => {
    for (const path of [
      POOLS_CLUSTER_PATHS.list,
      `${POOLS_CLUSTER_PATHS.list}/`,
      POOLS_CLUSTER_PATHS.create,
      POOLS_CLUSTER_PATHS.join,
    ]) {
      expect(isPoolsTertiaryPath(path)).toBe(true);
      expect(isPoolsClusterPath(path)).toBe(true);
    }
  });

  it('keeps pool details in the cluster (Pools primary active) but not tertiary', () => {
    expect(isPoolsClusterPath('/dashboard/pool/abc123')).toBe(true);
    expect(isPoolsTertiaryPath('/dashboard/pool/abc123')).toBe(false);
  });

  it('does not treat other dashboard tabs as Pools', () => {
    expect(isPoolsClusterPath('/dashboard')).toBe(false);
    expect(isPoolsClusterPath('/dashboard/standings')).toBe(false);
    expect(isPoolsClusterPath('/dashboard/profile')).toBe(false);
    expect(isPoolsTertiaryPath('/dashboard')).toBe(false);
  });
});

describe('isProfileClusterPath (unchanged)', () => {
  it('still recognizes profile cluster paths', () => {
    expect(isProfileClusterPath('/dashboard/profile')).toBe(true);
    expect(isProfileClusterPath('/dashboard/picks')).toBe(false);
    expect(isProfileClusterPath('/dashboard/stats')).toBe(false);
  });
});

describe('isStatsClusterPath (#769)', () => {
  it('treats Personal / Global / Band as the cluster', () => {
    expect(isStatsClusterPath(STATS_CLUSTER_PATHS.root)).toBe(true);
    expect(isStatsClusterPath(`${STATS_CLUSTER_PATHS.root}/`)).toBe(true);
    expect(isStatsClusterPath(STATS_CLUSTER_PATHS.personal)).toBe(true);
    expect(isStatsClusterPath(STATS_CLUSTER_PATHS.global)).toBe(true);
    expect(isStatsClusterPath(STATS_CLUSTER_PATHS.band)).toBe(true);
  });

  it('keeps the tour-stats redirect hop in the cluster (Stats primary active)', () => {
    expect(isStatsClusterPath('/dashboard/tour-stats')).toBe(true);
    expect(isStatsClusterPath('/dashboard/tour-stats/')).toBe(true);
  });

  it('does not treat sibling primaries as Stats', () => {
    expect(isStatsClusterPath('/dashboard')).toBe(false);
    expect(isStatsClusterPath('/dashboard/standings')).toBe(false);
    expect(isStatsClusterPath('/dashboard/profile')).toBe(false);
    expect(isStatsClusterPath('/dashboard/pools')).toBe(false);
  });

  it('treats /dashboard/stats and /personal as Personal', () => {
    expect(isPersonalStatsPath(STATS_CLUSTER_PATHS.root)).toBe(true);
    expect(isPersonalStatsPath(STATS_CLUSTER_PATHS.personal)).toBe(true);
    expect(isPersonalStatsPath(STATS_CLUSTER_PATHS.global)).toBe(false);
    expect(isPersonalStatsPath(STATS_CLUSTER_PATHS.band)).toBe(false);
  });

  it('marks Personal / Global as quaternary filter surfaces (not Band)', () => {
    expect(isGlobalStatsPath(STATS_CLUSTER_PATHS.global)).toBe(true);
    expect(isGlobalStatsPath(STATS_CLUSTER_PATHS.personal)).toBe(false);
    expect(isStatsQuaternaryPath(STATS_CLUSTER_PATHS.root)).toBe(true);
    expect(isStatsQuaternaryPath(STATS_CLUSTER_PATHS.personal)).toBe(true);
    expect(isStatsQuaternaryPath(STATS_CLUSTER_PATHS.global)).toBe(true);
    expect(isStatsQuaternaryPath(STATS_CLUSTER_PATHS.band)).toBe(false);
    expect(isStatsQuaternaryPath('/dashboard/tour-stats')).toBe(false);
  });

  it('scopes the tour picker to every Stats destination plus the legacy hop', () => {
    expect(isStatsTourScopedPath(STATS_CLUSTER_PATHS.root)).toBe(true);
    expect(isStatsTourScopedPath(STATS_CLUSTER_PATHS.personal)).toBe(true);
    expect(isStatsTourScopedPath(STATS_CLUSTER_PATHS.global)).toBe(true);
    expect(isStatsTourScopedPath(STATS_CLUSTER_PATHS.band)).toBe(true);
    expect(isStatsTourScopedPath('/dashboard/tour-stats')).toBe(true);
    expect(isStatsTourScopedPath('/dashboard/standings')).toBe(false);
  });
});
