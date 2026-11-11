/**
 * Resolve registered bands to a provider module plus secret material.
 * Does not fetch and does not write Firestore or Storage.
 */

const { getProvider, listRegisteredBands } = require("./registry");

/**
 * @param {Record<string, unknown> | null | undefined} secretValues
 *   Map of Firebase secret name → value. The scheduler reads the secret.
 *   This function only copies that value onto `providerArgs.apiKey`.
 * @returns {Array<{ band: { id: string, providerId: string, providerArgs: object }, provider: object, providerArgs: object }>}
 */
function resolveProviderDispatches(secretValues) {
  const secrets =
    secretValues && typeof secretValues === "object" ? secretValues : {};
  return listRegisteredBands().map((band) => {
    const provider = getProvider(band.providerId);
    const providerArgs = { ...band.providerArgs };
    const secretName = band.providerArgs && band.providerArgs.secretName;
    if (typeof secretName === "string" && secretName) {
      const raw = secrets[secretName];
      providerArgs.apiKey = raw == null ? "" : String(raw).trim();
    }
    return { band, provider, providerArgs };
  });
}

module.exports = {
  resolveProviderDispatches,
};
