import { FORM_FIELDS, SHARE_RECAP_ARTIST_NAME } from '../data/gameConfig.js';
import {
  PHISH_NET_FOOTER_ATTRIBUTION,
  PHISH_SONG_CATALOG_STORAGE_KEY,
} from './phishLiveSource.js';

/**
 * @typedef {'phishnet' | 'songfish' | 'setlistfm'} BandProviderId
 */

/**
 * Per-band product contract. Phase 0 registers Phish only.
 * Goose (`songfish`) and Umphrey's (`songfish`) are later registry rows,
 * not entries here — see `docs/MULTI_BAND_COLLECTIONS_STRATEGY.md`.
 *
 * @typedef {Object} BandConfig
 * @property {string} id URL-safe id (for example `'phish'`).
 * @property {string} displayName Player-facing name (for example `'Phish'`).
 * @property {BandProviderId} providerId API family, not the band.
 * @property {BandProviderArgs} providerArgs Provider-specific coordinates. Not a secret value.
 * @property {string} songCatalogStorageKey Storage object path. Phish stays `song-catalog.json` until a later phase.
 * @property {string[]} slotConfig Pick slot ids. Defaults to {@link FORM_FIELDS}.
 * @property {{ text: string, href: string }} footerAttribution Data-credit link.
 * @property {string} [color] Optional brand accent. Omitted until a band switcher needs one.
 */

/**
 * @typedef {Object} BandProviderArgs
 * @property {string} baseUrl API root. Callers append the path.
 * @property {number} [artistId] Upstream artist filter when the host serves more than one act.
 * @property {string} [secretName] Firebase secret name. The value is resolved by the scheduler, not stored here.
 */

/** Active band when the URL has no valid `?band=` override. */
export const DEFAULT_BAND_ID = 'phish';

/**
 * Phish.net v5 coordinates. `artistId` is the
 * `Number(row.artistid) !== artistId` filter in
 * `functions/providers/phishnet/index.js`. `secretName` is
 * `defineSecret("PHISHNET_API_KEY")` in `functions/index.js`.
 * The scheduler resolves the secret and passes `apiKey` on `providerArgs`.
 */
const PHISH_PROVIDER_ARGS = Object.freeze({
  baseUrl: 'https://api.phish.net/v5',
  artistId: 1,
  secretName: 'PHISHNET_API_KEY',
});

const PHISH_BAND_CONFIG = Object.freeze({
  id: DEFAULT_BAND_ID,
  displayName: SHARE_RECAP_ARTIST_NAME,
  providerId: 'phishnet',
  providerArgs: PHISH_PROVIDER_ARGS,
  songCatalogStorageKey: PHISH_SONG_CATALOG_STORAGE_KEY,
  slotConfig: Object.freeze(FORM_FIELDS.map((field) => field.id)),
  footerAttribution: PHISH_NET_FOOTER_ATTRIBUTION,
});

/** @type {Readonly<Record<string, BandConfig>>} */
export const BAND_CONFIGS = Object.freeze({
  [DEFAULT_BAND_ID]: PHISH_BAND_CONFIG,
});

/**
 * @param {string} bandId
 * @returns {BandConfig}
 */
export function getBandConfig(bandId) {
  if (typeof bandId === 'string' && Object.hasOwn(BAND_CONFIGS, bandId)) {
    return BAND_CONFIGS[bandId];
  }
  const label = typeof bandId === 'string' ? bandId : typeof bandId;
  throw new Error(`Unknown bandId: ${label}`);
}

/** @returns {BandConfig[]} */
export function listBandConfigs() {
  return Object.values(BAND_CONFIGS);
}
