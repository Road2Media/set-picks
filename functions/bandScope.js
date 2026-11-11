/**
 * Server twin of `src/shared/config/bandScope.js` (#605).
 * Cloud Functions are CommonJS and do not import the Vite src tree.
 * Keep `DEFAULT_BAND_ID` and `BAND_SCOPED_COLLECTIONS` in sync with that module.
 * The client test locks this file to those values.
 *
 * `stampBandId` keeps an explicit non-empty `bandId` already on the payload.
 * Callers that have the stored document should pass `bandId: prior.bandId`
 * so a later band is not rewritten to phish. Missing values become phish.
 */

const DEFAULT_BAND_ID = "phish";

const BAND_SCOPED_COLLECTIONS = Object.freeze([
  "picks",
  "official_setlists",
  "live_setlist_automation",
  "rollup_audit",
  "pools",
]);

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @param {string} [fallback]
 * @returns {Record<string, unknown>}
 */
function stampBandId(data, fallback = DEFAULT_BAND_ID) {
  const base = data && typeof data === "object" ? { ...data } : {};
  const existing = typeof base.bandId === "string" ? base.bandId.trim() : "";
  base.bandId = existing || fallback;
  return base;
}

/**
 * Missing or blank `bandId` counts as the default band.
 * @param {Record<string, unknown> | null | undefined} data
 * @param {string} [bandId]
 * @returns {boolean}
 */
function docBelongsToBand(data, bandId = DEFAULT_BAND_ID) {
  const raw = data && typeof data.bandId === "string" ? data.bandId.trim() : "";
  const effective = raw || DEFAULT_BAND_ID;
  return effective === bandId;
}

module.exports = {
  DEFAULT_BAND_ID,
  BAND_SCOPED_COLLECTIONS,
  stampBandId,
  docBelongsToBand,
};
