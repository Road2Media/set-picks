import { ga4Event } from '../../../shared/lib/ga4';

/** Providers this client can name on a GA4 ad event. House events omit it. */
const PROGRAMMATIC_PROVIDERS = new Set(['ethicalads']);

/**
 * @param {string | null | undefined} provider
 * @returns {{ provider?: string }}
 */
function providerParam(provider) {
  if (!PROGRAMMATIC_PROVIDERS.has(provider)) return {};
  return { provider };
}

/**
 * @param {{ slotId: string, creativeId: string, provider?: string }} input
 */
export function trackAdImpression({ slotId, creativeId, provider }) {
  if (!slotId || !creativeId) return;
  ga4Event('ad_impression', {
    slot_id: slotId,
    creative_id: creativeId,
    ...providerParam(provider),
  });
}

/**
 * @param {{
 *   slotId: string,
 *   creativeId: string,
 *   destinationType: 'internal' | 'external',
 *   provider?: string,
 * }} input
 */
export function trackAdClick({ slotId, creativeId, destinationType, provider }) {
  if (!slotId || !creativeId) return;
  if (destinationType !== 'internal' && destinationType !== 'external') return;
  ga4Event('ad_click', {
    slot_id: slotId,
    creative_id: creativeId,
    destination_type: destinationType,
    ...providerParam(provider),
  });
}

/**
 * A paid programmatic placement was returned. No creative id, no PII.
 *
 * @param {{ slotId: string, provider?: string }} input
 */
export function trackProgrammaticFill({ slotId, provider }) {
  if (!slotId || !PROGRAMMATIC_PROVIDERS.has(provider)) return;
  ga4Event('ad_programmatic_fill', {
    slot_id: slotId,
    provider,
  });
}
