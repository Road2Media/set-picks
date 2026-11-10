import { useEffect, useState } from 'react';

import { getAdProvider } from '../api/adProvider';
import { getAdSlot } from '../config/adSlots';

/**
 * Live updates stay off unless a creative is actually on screen (#420).
 * An off switch, empty JSON, or invalid JSON does not keep a connection open.
 *
 * @param {object | null | undefined} creative
 * @returns {boolean}
 */
export function shouldWatchAdSlot(creative) {
  return creative != null;
}

/**
 * @param {string} slotId
 * @returns {{ status: 'loading' | 'ready', creative: object | null }}
 */
export function useAdCreative(slotId) {
  const [state, setState] = useState({ status: 'loading', creative: null });

  useEffect(() => {
    let cancelled = false;
    let stopWatch = () => {};
    let generation = 0;
    const slot = getAdSlot(slotId);
    const context = slot ? { surface: slot.surface } : undefined;
    const provider = getAdProvider();

    const load = () => {
      const token = ++generation;
      stopWatch();
      stopWatch = () => {};
      provider
        .loadAdCreative(slotId, context)
        .then((creative) => {
          if (cancelled || token !== generation) return;
          setState({ status: 'ready', creative });
          if (!shouldWatchAdSlot(creative) || typeof provider.watchSlot !== 'function') return;
          let watchReady = false;
          stopWatch = provider.watchSlot(slotId, () => {
            if (!watchReady || cancelled) return;
            load();
          });
          watchReady = true;
        })
        .catch(() => {
          if (!cancelled && token === generation) {
            setState({ status: 'ready', creative: null });
          }
        });
    };

    setState({ status: 'loading', creative: null });
    load();

    return () => {
      cancelled = true;
      generation += 1;
      stopWatch();
    };
  }, [slotId]);

  return state;
}
