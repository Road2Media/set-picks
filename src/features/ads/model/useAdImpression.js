import { useEffect } from 'react';

import { observeAdImpression } from './observeAdImpression';
import { trackAdImpression } from './adTelemetry';

/**
 * One impression per creative mount, after the unit is half visible for 1s.
 *
 * @param {React.RefObject<Element | null>} ref
 * @param {{ slotId?: string, creativeId?: string, enabled?: boolean }} input
 */
export function useAdImpression(ref, { slotId, creativeId, enabled }) {
  useEffect(() => {
    if (!enabled || !slotId || !creativeId) return undefined;
    const element = ref.current;
    if (!element) return undefined;
    return observeAdImpression(element, {
      onImpression: () => trackAdImpression({ slotId, creativeId }),
    });
  }, [ref, slotId, creativeId, enabled]);
}
