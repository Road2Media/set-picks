import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FORM_FIELDS, SHARE_RECAP_ARTIST_NAME } from '../data/gameConfig.js';
import {
  BAND_CONFIGS,
  DEFAULT_BAND_ID,
  getBandConfig,
  listBandConfigs,
} from './bands.js';
import {
  PHISH_NET_FOOTER_ATTRIBUTION,
  PHISH_SONG_CATALOG_STORAGE_KEY,
} from './phishLiveSource.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readRepo(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const REQUIRED_FIELDS = [
  'id',
  'displayName',
  'providerId',
  'providerArgs',
  'songCatalogStorageKey',
  'slotConfig',
  'footerAttribution',
];

describe('getBandConfig / listBandConfigs', () => {
  it('returns a complete phish config derived from the live product constants', () => {
    const phish = getBandConfig('phish');

    expect(phish).toBe(BAND_CONFIGS.phish);
    expect(DEFAULT_BAND_ID).toBe('phish');
    for (const field of REQUIRED_FIELDS) {
      expect(phish[field], field).toBeTruthy();
    }
    expect(phish.id).toBe('phish');
    expect(phish.displayName).toBe(SHARE_RECAP_ARTIST_NAME);
    expect(phish.displayName).toBe('Phish');
    expect(phish.providerId).toBe('phishnet');
    expect(phish.providerArgs).toEqual({
      baseUrl: 'https://api.phish.net/v5',
      artistId: 1,
      secretName: 'PHISHNET_API_KEY',
    });
    expect(phish.songCatalogStorageKey).toBe(PHISH_SONG_CATALOG_STORAGE_KEY);
    expect(phish.songCatalogStorageKey).toBe('song-catalog.json');
    expect(phish.slotConfig).toEqual(FORM_FIELDS.map((field) => field.id));
    expect(phish.slotConfig).toEqual(['s1o', 's1c', 's2o', 's2c', 'enc', 'wild']);
    expect(phish.footerAttribution).toBe(PHISH_NET_FOOTER_ATTRIBUTION);
    expect(phish.footerAttribution).toEqual({
      text: 'The Mockingbird Foundation / Phish.Net',
      href: 'https://phish.net',
    });
    expect(phish.color).toBeUndefined();
  });

  it('lists only the phish registry row', () => {
    expect(Object.keys(BAND_CONFIGS)).toEqual(['phish']);
    expect(listBandConfigs()).toEqual([getBandConfig('phish')]);
  });

  it('throws on an unknown id', () => {
    expect(() => getBandConfig('goose')).toThrow(/Unknown bandId: goose/);
    expect(() => getBandConfig('')).toThrow(/Unknown bandId/);
    expect(() => getBandConfig(undefined)).toThrow(/Unknown bandId: undefined/);
  });

  it('stays locked to the footer credit and the catalog object path', () => {
    const phish = getBandConfig('phish');
    const splash = readRepo('src/features/landing/ui/SplashPageShell.jsx');
    const marketing = readRepo('src/features/landing/ui/MarketingPageShell.jsx');
    const catalogUrl = readRepo('src/features/song-catalog/model/songCatalogUrl.js');
    const catalogFn = readRepo('functions/phishnetSongCatalog.js');
    const calendarFn = readRepo('functions/phishnetShowCalendar.js');
    const providerFn = readRepo('functions/providers/phishnet/index.js');
    const registryFn = readRepo('functions/providers/registry.js');
    const functionsIndex = readRepo('functions/index.js');

    for (const source of [splash, marketing]) {
      expect(source).toContain('PHISH_NET_FOOTER_ATTRIBUTION.href');
      expect(source).toContain('PHISH_NET_FOOTER_ATTRIBUTION.text');
    }
    expect(catalogUrl).toContain(
      `const CATALOG_OBJECT_PATH = '${phish.songCatalogStorageKey}'`,
    );
    expect(catalogFn).toContain(
      `const CATALOG_STORAGE_PATH = "${phish.songCatalogStorageKey}"`,
    );
    expect(calendarFn).toContain('require("./providers/phishnet")');
    expect(providerFn).toContain(phish.providerArgs.baseUrl);
    expect(providerFn).toContain('Number(rec.artistid) !== artistId');
    expect(registryFn).toContain(`baseUrl: "${phish.providerArgs.baseUrl}"`);
    expect(registryFn).toContain(`artistId: ${phish.providerArgs.artistId}`);
    expect(registryFn).toContain(`secretName: "${phish.providerArgs.secretName}"`);
    expect(functionsIndex).toContain(
      `defineSecret("${phish.providerArgs.secretName}")`,
    );
    expect(functionsIndex).toContain('listProviderDispatches()');
  });
});
