import { describe, expect, it, vi } from 'vitest';

import { resolveProgrammaticPhase, shouldMountProgrammaticAd } from './resolveProgrammaticPhase';

const slot = { id: 'programmatic_standings_inline' };
const config = { enabled: true, provider: 'ethicalads', publisher: 'setlist-pickem' };
const allowed = { cmpEnabled: true, advertisingAllowed: true };
const house = { creative_id: 'install_pwa_v1' };

describe('shouldMountProgrammaticAd', () => {
  it('requires the env, consent, an empty house slot, and both flags', () => {
    expect(
      shouldMountProgrammaticAd({
        config,
        consent: allowed,
        houseCreative: null,
        adsEnabled: true,
        programmaticEnabled: true,
      }),
    ).toBe(true);

    expect(shouldMountProgrammaticAd({ config: { enabled: false }, consent: allowed, adsEnabled: true, programmaticEnabled: true })).toBe(false);
    expect(shouldMountProgrammaticAd({ config, consent: { cmpEnabled: false, advertisingAllowed: false }, adsEnabled: true, programmaticEnabled: true })).toBe(false);
    expect(shouldMountProgrammaticAd({ config, consent: allowed, houseCreative: house, adsEnabled: true, programmaticEnabled: true })).toBe(false);
    expect(shouldMountProgrammaticAd({ config, consent: allowed, adsEnabled: false, programmaticEnabled: true })).toBe(false);
    expect(shouldMountProgrammaticAd({ config, consent: allowed, adsEnabled: true, programmaticEnabled: false })).toBe(false);
    expect(shouldMountProgrammaticAd({ config, consent: { cmpEnabled: true, advertisingAllowed: false }, adsEnabled: true, programmaticEnabled: true })).toBe(false);
  });
});

describe('resolveProgrammaticPhase', () => {
  it('does not ask for a house creative or Remote Config when the env is off', async () => {
    const loadHouseCreative = vi.fn();
    const readFlags = vi.fn();
    await expect(
      resolveProgrammaticPhase({
        slot,
        config: { enabled: false },
        consent: allowed,
        loadHouseCreative,
        readFlags,
      }),
    ).resolves.toBe('off');
    expect(loadHouseCreative).not.toHaveBeenCalled();
    expect(readFlags).not.toHaveBeenCalled();
  });

  it('does not ask for Remote Config when consent blocks the script', async () => {
    const loadHouseCreative = vi.fn();
    const readFlags = vi.fn();
    await expect(
      resolveProgrammaticPhase({
        slot,
        config,
        consent: { cmpEnabled: false, advertisingAllowed: false },
        loadHouseCreative,
        readFlags,
      }),
    ).resolves.toBe('blocked');
    expect(loadHouseCreative).not.toHaveBeenCalled();
    expect(readFlags).not.toHaveBeenCalled();
  });

  it('keeps the house creative and does not read the programmatic flag', async () => {
    const readFlags = vi.fn();
    await expect(
      resolveProgrammaticPhase({
        slot,
        config,
        consent: allowed,
        loadHouseCreative: async () => house,
        readFlags,
      }),
    ).resolves.toBe('house');
    expect(readFlags).not.toHaveBeenCalled();
  });

  it('is ready only when both Remote Config flags are true', async () => {
    await expect(
      resolveProgrammaticPhase({
        slot,
        config,
        consent: allowed,
        loadHouseCreative: async () => null,
        readFlags: async () => ({ adsEnabled: true, programmaticEnabled: true }),
      }),
    ).resolves.toBe('ready');

    await expect(
      resolveProgrammaticPhase({
        slot,
        config,
        consent: allowed,
        loadHouseCreative: async () => null,
        readFlags: async () => ({ adsEnabled: true, programmaticEnabled: false }),
      }),
    ).resolves.toBe('blocked');

    await expect(
      resolveProgrammaticPhase({
        slot,
        config,
        consent: allowed,
        loadHouseCreative: async () => null,
        readFlags: async () => {
          throw new Error('offline');
        },
      }),
    ).resolves.toBe('blocked');
  });
});
