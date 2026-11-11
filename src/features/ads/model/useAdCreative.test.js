import { describe, expect, it } from 'vitest';

import { shouldWatchAdSlot } from './useAdCreative';

describe('shouldWatchAdSlot', () => {
  it('listens only while a creative is on screen', () => {
    expect(shouldWatchAdSlot(null)).toBe(false);
    expect(shouldWatchAdSlot(undefined)).toBe(false);
    expect(shouldWatchAdSlot({ creative_id: 'install_pwa_v1' })).toBe(true);
  });
});
