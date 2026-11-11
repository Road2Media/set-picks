/**
 * Build-time switch for the EthicalAds proof of concept (#422).
 *
 * Both values have to match. Anything else is off, and the loader does not
 * create a script tag. These are public placement ids, not secrets. Leave
 * them unset until Patrick has a publisher account, the CSP hosts, and a
 * privacy-policy update that names the partner.
 */

/** The only programmatic provider this build knows how to load. */
export const PROGRAMMATIC_PROVIDER_ETHICALADS = 'ethicalads';

/**
 * EthicalAds publisher slugs are a single token. A dot, slash, or scheme
 * cannot redirect the script host. The script URL is a constant in
 * `ethicalAdsProvider.js`.
 */
const PUBLISHER_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/**
 * @param {string | null | undefined} publisher
 * @returns {boolean}
 */
export function isValidEthicalAdsPublisher(publisher) {
  return typeof publisher === 'string' && PUBLISHER_RE.test(publisher);
}

/**
 * @param {Record<string, string | undefined> | undefined} [env]
 * @returns {{ provider: string, publisher: string, enabled: boolean }}
 */
export function readProgrammaticAdsConfig(env = import.meta.env) {
  const provider = String(env?.VITE_PROGRAMMATIC_ADS_PROVIDER ?? '').trim();
  const publisher = String(env?.VITE_ETHICALADS_PUBLISHER ?? '').trim();
  const recognized =
    provider === PROGRAMMATIC_PROVIDER_ETHICALADS && isValidEthicalAdsPublisher(publisher);
  return {
    provider: recognized ? provider : '',
    publisher: recognized ? publisher : '',
    enabled: recognized,
  };
}
