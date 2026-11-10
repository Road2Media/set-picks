import { describe, expect, it } from 'vitest';

import {
  PROGRAMMATIC_PROVIDER_ETHICALADS,
  isValidEthicalAdsPublisher,
  readProgrammaticAdsConfig,
} from './programmaticAdsConfig';

describe('readProgrammaticAdsConfig', () => {
  it('ships off when the env is unset', () => {
    expect(readProgrammaticAdsConfig().enabled).toBe(false);
    expect(readProgrammaticAdsConfig({}).enabled).toBe(false);
    expect(readProgrammaticAdsConfig(undefined).enabled).toBe(false);
    expect(readProgrammaticAdsConfig().publisher).toBe('');
    expect(readProgrammaticAdsConfig().provider).toBe('');
  });

  it('stays off unless the provider and the publisher slug both match', () => {
    expect(
      readProgrammaticAdsConfig({ VITE_PROGRAMMATIC_ADS_PROVIDER: PROGRAMMATIC_PROVIDER_ETHICALADS })
        .enabled,
    ).toBe(false);
    expect(readProgrammaticAdsConfig({ VITE_ETHICALADS_PUBLISHER: 'setlist-pickem' }).enabled).toBe(
      false,
    );
    expect(
      readProgrammaticAdsConfig({
        VITE_PROGRAMMATIC_ADS_PROVIDER: 'EthicalAds',
        VITE_ETHICALADS_PUBLISHER: 'setlist-pickem',
      }).enabled,
    ).toBe(false);
    expect(
      readProgrammaticAdsConfig({
        VITE_PROGRAMMATIC_ADS_PROVIDER: 'adsense',
        VITE_ETHICALADS_PUBLISHER: 'setlist-pickem',
      }).enabled,
    ).toBe(false);
    expect(
      readProgrammaticAdsConfig({
        VITE_PROGRAMMATIC_ADS_PROVIDER: 'gam',
        VITE_ETHICALADS_PUBLISHER: 'setlist-pickem',
      }).enabled,
    ).toBe(false);
  });

  it('rejects a publisher that could change the script host', () => {
    for (const publisher of [
      'https://media.ethicalads.io/media/client/ethicalads.min.js',
      'media.ethicalads.io',
      'setlist-pickem/../../evil',
      'javascript:alert(1)',
      'publisher id',
      '-leading-hyphen',
      'trailing-',
      '',
    ]) {
      expect(isValidEthicalAdsPublisher(publisher)).toBe(false);
      expect(
        readProgrammaticAdsConfig({
          VITE_PROGRAMMATIC_ADS_PROVIDER: PROGRAMMATIC_PROVIDER_ETHICALADS,
          VITE_ETHICALADS_PUBLISHER: publisher,
        }).enabled,
      ).toBe(false);
    }
  });

  it('accepts one lowercase slug', () => {
    expect(
      readProgrammaticAdsConfig({
        VITE_PROGRAMMATIC_ADS_PROVIDER: PROGRAMMATIC_PROVIDER_ETHICALADS,
        VITE_ETHICALADS_PUBLISHER: ' setlist-pickem ',
      }),
    ).toEqual({
      provider: 'ethicalads',
      publisher: 'setlist-pickem',
      enabled: true,
    });
  });
});
