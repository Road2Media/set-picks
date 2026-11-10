import { ga4Event } from '../../../shared/lib/ga4';

/**
 * @param {{ slotId: string, creativeId: string }} input
 */
export function trackAdImpression({ slotId, creativeId }) {
  if (!slotId || !creativeId) return;
  ga4Event('ad_impression', {
    slot_id: slotId,
    creative_id: creativeId,
  });
}

/**
 * @param {{ slotId: string, creativeId: string, destinationType: 'internal' | 'external' }} input
 */
export function trackAdClick({ slotId, creativeId, destinationType }) {
  if (!slotId || !creativeId) return;
  if (destinationType !== 'internal' && destinationType !== 'external') return;
  ga4Event('ad_click', {
    slot_id: slotId,
    creative_id: creativeId,
    destination_type: destinationType,
  });
}
