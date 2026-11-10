import { describe, expect, it } from 'vitest';

import { resolveDashboardMobileChromeHeight } from './dashboardMobileChromeHeight.js';

describe('resolveDashboardMobileChromeHeight (#707)', () => {
  it('reserves brand + context when the tab has no fixed tools band', () => {
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: false,
        picksCluster: false,
        statsQuaternary: false,
        short: false,
      }),
    ).toBe('9rem');
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: false,
        picksCluster: false,
        statsQuaternary: false,
        short: true,
      }),
    ).toBe('5rem');
  });

  it('adds one tools band for standings, pools, profile, and band stats', () => {
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: true,
        picksCluster: false,
        statsQuaternary: false,
        short: false,
      }),
    ).toBe('11.75rem');
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: true,
        picksCluster: false,
        statsQuaternary: false,
        short: true,
      }),
    ).toBe('7.75rem');
  });

  it('reserves the picks tools row and the stats quaternary trays', () => {
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: true,
        picksCluster: true,
        statsQuaternary: false,
        short: false,
      }),
    ).toBe('15.25rem');
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: true,
        picksCluster: false,
        statsQuaternary: true,
        short: false,
      }),
    ).toBe('17.75rem');
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: true,
        picksCluster: true,
        statsQuaternary: false,
        short: true,
      }),
    ).toBe('11.25rem');
    expect(
      resolveDashboardMobileChromeHeight({
        fixedChrome: true,
        picksCluster: false,
        statsQuaternary: true,
        short: true,
      }),
    ).toBe('13.75rem');
  });
});
