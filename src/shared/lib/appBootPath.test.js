import { describe, expect, it } from 'vitest';

import {
  isDashboardEntryPath,
  isPublicColdOpenPath,
  isPublicTourStatsPath,
  shouldDeferMessagingServiceWorker,
  shouldPrefetchDashboardOnBoot,
  shouldWarmAppCheckOnBoot,
} from './appBootPath.js';

describe('isDashboardEntryPath', () => {
  it('matches /dashboard and nested paths', () => {
    expect(isDashboardEntryPath('/dashboard')).toBe(true);
    expect(isDashboardEntryPath('/dashboard/')).toBe(true);
    expect(isDashboardEntryPath('/dashboard/picks')).toBe(true);
  });

  it('rejects non-dashboard paths', () => {
    expect(isDashboardEntryPath('/')).toBe(false);
    expect(isDashboardEntryPath('/setup')).toBe(false);
    expect(isDashboardEntryPath('/dashboarding')).toBe(false);
    expect(isDashboardEntryPath('')).toBe(false);
    expect(isDashboardEntryPath(undefined)).toBe(false);
  });
});

describe('isPublicColdOpenPath', () => {
  it('matches splash, join, and site invite', () => {
    expect(isPublicColdOpenPath('/')).toBe(true);
    expect(isPublicColdOpenPath('/join/ABC')).toBe(true);
    expect(isPublicColdOpenPath('/invite/pat')).toBe(true);
  });

  it('rejects dashboard, setup, marketing', () => {
    expect(isPublicColdOpenPath('/dashboard')).toBe(false);
    expect(isPublicColdOpenPath('/setup')).toBe(false);
    expect(isPublicColdOpenPath('/how-it-works')).toBe(false);
  });
});

describe('isPublicTourStatsPath', () => {
  it('matches public tour-stats routes', () => {
    expect(isPublicTourStatsPath('/tour-stats')).toBe(true);
    expect(isPublicTourStatsPath('/tour-stats/2026-sphere')).toBe(true);
  });

  it('rejects other paths', () => {
    expect(isPublicTourStatsPath('/')).toBe(false);
    expect(isPublicTourStatsPath('/dashboard/tour-stats')).toBe(false);
    expect(isPublicTourStatsPath('/how-it-works')).toBe(false);
  });
});

describe('shouldWarmAppCheckOnBoot', () => {
  it('warms dashboard and setup (#803)', () => {
    expect(shouldWarmAppCheckOnBoot('/dashboard/standings')).toBe(true);
    expect(shouldWarmAppCheckOnBoot('/setup')).toBe(true);
  });

  it('does not warm marketing tour-stats or anonymous cold-open (#853)', () => {
    expect(shouldWarmAppCheckOnBoot('/tour-stats')).toBe(false);
    expect(shouldWarmAppCheckOnBoot('/tour-stats/2026-sphere')).toBe(false);
    expect(shouldWarmAppCheckOnBoot('/')).toBe(false);
    expect(shouldWarmAppCheckOnBoot('/join/ABC')).toBe(false);
    expect(shouldWarmAppCheckOnBoot('/invite/pat')).toBe(false);
    expect(shouldWarmAppCheckOnBoot('/how-it-works')).toBe(false);
    expect(shouldWarmAppCheckOnBoot('/embed/stats')).toBe(false);
    expect(shouldWarmAppCheckOnBoot('/privacy')).toBe(false);
  });
});

describe('shouldDeferMessagingServiceWorker', () => {
  it('keeps FCM registration immediate on dashboard and setup', () => {
    expect(shouldDeferMessagingServiceWorker('/dashboard')).toBe(false);
    expect(shouldDeferMessagingServiceWorker('/dashboard/picks')).toBe(false);
    expect(shouldDeferMessagingServiceWorker('/setup')).toBe(false);
  });

  it('defers FCM on splash, invite, marketing, and legal hard opens', () => {
    expect(shouldDeferMessagingServiceWorker('/')).toBe(true);
    expect(shouldDeferMessagingServiceWorker('/join/ABC')).toBe(true);
    expect(shouldDeferMessagingServiceWorker('/invite/pat')).toBe(true);
    expect(shouldDeferMessagingServiceWorker('/how-it-works')).toBe(true);
    expect(shouldDeferMessagingServiceWorker('/tour-stats')).toBe(true);
    expect(shouldDeferMessagingServiceWorker('/privacy')).toBe(true);
    expect(shouldDeferMessagingServiceWorker('/terms')).toBe(true);
    expect(shouldDeferMessagingServiceWorker('/user/abc')).toBe(true);
  });
});

describe('shouldPrefetchDashboardOnBoot', () => {
  it('always prefetches on a dashboard hard open', () => {
    expect(shouldPrefetchDashboardOnBoot('/dashboard')).toBe(true);
    expect(shouldPrefetchDashboardOnBoot('/dashboard/pools', { hasSession: false })).toBe(
      true,
    );
  });

  it('prefetches on cold-open surfaces only with a session hint (#804)', () => {
    expect(shouldPrefetchDashboardOnBoot('/', { hasSession: true })).toBe(true);
    expect(shouldPrefetchDashboardOnBoot('/join/ABC', { hasSession: true })).toBe(true);
    expect(shouldPrefetchDashboardOnBoot('/setup', { hasSession: true })).toBe(true);
    expect(shouldPrefetchDashboardOnBoot('/')).toBe(false);
    expect(shouldPrefetchDashboardOnBoot('/join/ABC', { hasSession: false })).toBe(false);
  });

  it('leaves marketing and unknown paths alone', () => {
    expect(shouldPrefetchDashboardOnBoot('/how-it-works', { hasSession: true })).toBe(
      false,
    );
    expect(shouldPrefetchDashboardOnBoot('', { hasSession: true })).toBe(false);
    expect(shouldPrefetchDashboardOnBoot(undefined)).toBe(false);
  });
});
