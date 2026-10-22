import { afterEach, describe, expect, it, vi } from 'vitest';

import { isRewindModeEnabled } from './isRewindModeEnabled';

describe('isRewindModeEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stays off when the flag is unset', () => {
    vi.stubEnv('VITE_ENABLE_REWIND_MODE', undefined);
    expect(isRewindModeEnabled()).toBe(false);
  });

  it('stays off for any value other than true', () => {
    vi.stubEnv('VITE_ENABLE_REWIND_MODE', 'false');
    expect(isRewindModeEnabled()).toBe(false);
  });

  it('turns on only for the string true', () => {
    vi.stubEnv('VITE_ENABLE_REWIND_MODE', 'true');
    expect(isRewindModeEnabled()).toBe(true);
  });
});
