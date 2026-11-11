import { createRemoteConfigAdProvider } from './remoteConfigAdProvider';

/**
 * @typedef {Object} AdLoadContext
 * @property {string} [route]
 * @property {string} [surface]
 * @property {'anonymous' | 'authenticated'} [authState]
 * @property {string} [showDate]
 * @property {boolean} [picksLocked]
 */

/**
 * @typedef {Object} AdCreative
 * @property {string} creative_id
 * @property {string} image_url
 * @property {string} alt_text
 * @property {string} headline
 * @property {string} body
 * @property {string} cta_label
 * @property {string} destination_url
 * @property {'internal' | 'external'} destination_type
 */

/**
 * @typedef {Object} AdProvider
 * @property {(slotId: string, context?: AdLoadContext) => Promise<AdCreative | null>} loadAdCreative
 * @property {(slotId: string, onChange: () => void) => () => void} watchSlot
 *   Call `watchSlot` only while a creative is on screen. It listens for a
 *   publish (the kill switch). An empty placement does not.
 */

/** @type {AdProvider | null} */
let provider = null;

/**
 * Remote Config is the only provider in this phase.
 * @returns {AdProvider}
 */
export function getAdProvider() {
  if (!provider) provider = createRemoteConfigAdProvider();
  return provider;
}
