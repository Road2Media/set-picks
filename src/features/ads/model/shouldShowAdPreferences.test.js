import { describe, expect, it } from 'vitest';

import { shouldShowAdPreferences } from './shouldShowAdPreferences';

const off = {
  adsEnabled: false,
  programmaticEnabled: false,
  providerEnabled: false,
  cmpEnabled: false,
};

describe('shouldShowAdPreferences', () => {
  it('stays hidden with the default switches', () => {
    expect(shouldShowAdPreferences()).toBe(false);
    expect(shouldShowAdPreferences(off)).toBe(false);
    expect(shouldShowAdPreferences({})).toBe(false);
  });

  it('shows when ads are enabled', () => {
    expect(shouldShowAdPreferences({ ...off, adsEnabled: true })).toBe(true);
    expect(
      shouldShowAdPreferences({
        adsEnabled: true,
        programmaticEnabled: true,
        providerEnabled: true,
        cmpEnabled: true,
      }),
    ).toBe(true);
  });

  it('stays hidden when only the programmatic switches are on', () => {
    expect(
      shouldShowAdPreferences({
        ...off,
        programmaticEnabled: true,
        providerEnabled: true,
        cmpEnabled: true,
      }),
    ).toBe(false);
    expect(shouldShowAdPreferences({ ...off, programmaticEnabled: true })).toBe(false);
    expect(shouldShowAdPreferences({ ...off, providerEnabled: true, cmpEnabled: true })).toBe(
      false,
    );
  });
});
