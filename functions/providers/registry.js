/**
 * Provider registry for Cloud Functions (Phase 2 / #606).
 *
 * `src/shared/config/bands.js` is the product band list, but it is ESM in the
 * Vite tree. Functions are CommonJS and do not import that tree (same split
 * as `functions/bandScope.js`). This mirror is the list schedulers iterate.
 * Phase 2 registers Phish / `phishnet` only.
 */

const phishnet = require("./phishnet");

/** @type {Readonly<Record<string, { fetchShowsForYear: Function, fetchSetlistForDate: Function, fetchSongs: Function, normalizeShows: Function, normalizeSetlistRows: Function, responseOk: Function }>>} */
const PROVIDERS = Object.freeze({
  phishnet,
});

const REGISTERED_BANDS = Object.freeze([
  Object.freeze({
    id: "phish",
    providerId: "phishnet",
    providerArgs: Object.freeze({
      baseUrl: "https://api.phish.net/v5",
      artistId: 1,
      secretName: "PHISHNET_API_KEY",
    }),
  }),
]);

/**
 * @param {string} providerId
 */
function getProvider(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new Error(`Unknown providerId: ${providerId}`);
  }
  return provider;
}

/** @returns {Array<{ id: string, providerId: string, providerArgs: { baseUrl: string, artistId: number, secretName: string } }>} */
function listRegisteredBands() {
  return REGISTERED_BANDS.map((band) => band);
}

/**
 * Phish `providerArgs`, plus `apiKey` when the caller has one.
 * Does not read the environment. Does not trim the key; each fetch does.
 *
 * @param {unknown} [apiKey]
 */
function phishProviderArgs(apiKey) {
  const band = REGISTERED_BANDS.find((row) => row.id === "phish");
  if (!band) {
    throw new Error("Phish band is not registered.");
  }
  const args = { ...band.providerArgs };
  if (arguments.length > 0) {
    args.apiKey = apiKey;
  }
  return args;
}

module.exports = {
  REGISTERED_BANDS,
  getProvider,
  listRegisteredBands,
  phishProviderArgs,
};
